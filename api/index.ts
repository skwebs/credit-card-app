import crypto from 'node:crypto';
import pg from 'pg';
import type { PoolClient } from 'pg';
const { Pool, types } = pg;
types.setTypeParser(20, value => Number(value));
// PostgreSQL DATE is a calendar date, not a timezone-aware instant. Keep it as YYYY-MM-DD.
types.setTypeParser(1082, value => value);
// TIMESTAMP WITHOUT TIME ZONE represents the app's local wall-clock timestamp.
types.setTypeParser(1114, value => value.replace('T',' '));
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import Busboy from 'busboy';
import bcrypt from 'bcryptjs';
import { cycleFor, isCurrentMonthCycle, isPreviousMonthDueCycle } from './billing.js';

const COOKIE = 'ccm_session';
const SESSION_SECONDS = 60 * 60 * 24;
let pool: InstanceType<typeof Pool> | undefined;

/**
 * Reuse one small pool per warm serverless instance. Neon pooling handles the
 * cross-instance connection fan-out; this pool must remain deliberately small.
 */
const db = () => {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    const error = new Error('DATABASE_URL is not configured.');
    (error as any).code = 'DATABASE_URL_MISSING';
    throw error;
  }

  const isLocal = /(?:localhost|127\.0\.0\.1)(?::|\/)/i.test(connectionString);
  pool = new Pool({
    connectionString,
    ...(isLocal ? { ssl: false } : { ssl: { rejectUnauthorized: true } }),
    max: 3,
    min: 0,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    maxLifetimeSeconds: 300,
    application_name: 'credit-card-ledger-api',
  });

  // pg emits idle-client errors on the pool. Handle them so a transient socket
  // close is logged instead of becoming an unhandled process-level error.
  pool.on('error', (error: any) => {
    console.error('PostgreSQL idle connection error:', {
      message: error?.message || 'Unknown PostgreSQL connection error',
      code: error?.code,
    });
  });

  return pool;
};

const RETRYABLE_DB_CODES = new Set([
  '08000', '08001', '08003', '08006', '08007', '08P01',
  '57P01', '57P02', '57P03', '53300', '53400', 'ECONNRESET', 'ECONNREFUSED',
  'ETIMEDOUT', 'EPIPE', 'EHOSTUNREACH', 'ENETUNREACH',
]);

const isTransientDatabaseError = (error: any) =>
  RETRYABLE_DB_CODES.has(error?.code) ||
  /connection terminated|connection timeout|connection closed|socket hang up/i.test(String(error?.message || ''));

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Retry only explicitly read-only operations; never replay financial writes. */
async function readRows<T = any>(query: string, params: any[] = [], retries = 1): Promise<T[]> {
  for (let attempt = 0; ; attempt++) {
    try {
      return (await db().query(query, params)).rows as T[];
    } catch (error) {
      if (!isTransientDatabaseError(error) || attempt >= retries) throw error;
      await sleep(250 * (attempt + 1));
    }
  }
}
const json = (res, status, payload, headers={}) => { res.statusCode=status; res.setHeader('Content-Type','application/json; charset=utf-8'); res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff'); Object.entries(headers).forEach(([k,v])=>res.setHeader(k,v)); res.end(JSON.stringify(payload)); };
const fail = (status, error) => { const e=new Error(error); (e as any).status=status; throw e; };
const body = async req => {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw=''; for await (const chunk of req) { raw+=chunk; if(raw.length>1_000_000) fail(413,'Request body is too large.'); }
  if(!raw) return {}; try { return JSON.parse(raw); } catch { fail(400,'Invalid JSON request body.'); }
};
const cookieMap = req => Object.fromEntries((req.headers.cookie||'').split(';').map(s=>s.trim()).filter(Boolean).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),decodeURIComponent(s.slice(i+1))]}));
const cookie = (token,maxAge=SESSION_SECONDS) => `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV==='production'?'; Secure':''}`;
const tokenHash = token => crypto.createHmac('sha256',process.env.SESSION_SECRET||'').update(token).digest('hex');
async function readSession(req){const token=cookieMap(req)[COOKIE];if(!token)return null;const found=(await readRows('SELECT s.user_id,s.csrf_token,s.expires_at,u.username FROM auth_sessions s LEFT JOIN app_user u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>CURRENT_TIMESTAMP',[tokenHash(token)],1))[0];return found?{uid:found.user_id?Number(found.user_id):0,username:found.username||'',csrf:found.csrf_token,token}:null;}
const csrfCheck = (req,session) => { if(!session || !req.headers['x-csrf-token'] || req.headers['x-csrf-token']!==session.csrf) fail(419,'Security token expired. Refresh the page and try again.'); };
const needAuth = session => { if(!session || !session.uid) fail(401,'Please log in again.'); };
const asInt = (v,label,min=0) => { if(v===undefined||v===null||v===''||!Number.isSafeInteger(Number(v))||Number(v)<min) fail(400,`${label} is invalid.`); return Number(v); };
const dateOnly = (s,label='Date') => { if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s)) fail(400,`${label} must be YYYY-MM-DD.`); const d=new Date(`${s}T00:00:00Z`); if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==s)fail(400,`${label} must be YYYY-MM-DD.`); return s; };
const dateTime = s => { if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(s)) fail(400,'Transaction date/time is invalid.');dateOnly(s.slice(0,10),'Transaction date');const time=s.slice(11).split(':').map(Number);if(time[0]>23||time[1]>59||(time[2]??0)>59)fail(400,'Transaction date/time is invalid.');const clean=s.replace('T',' ');return clean.length===16?clean+':00':clean; };
const intBool = v => v===true||v===1||v==='1';
const defaultCategories=['Groceries','Fuel','Food & dining','Shopping','Bills & utilities','Travel','Education','Health','Entertainment','Other'];
const minor = v => Number(v||0);
async function rows(q,params=[]){
  // Automatically retry plain SELECTs only. DML/transactions are never replayed.
  if (/^\s*SELECT\b/i.test(q)) return readRows(q, params, 1);
  return (await db().query(q,params)).rows;
}
async function statementRows(cardId=null){const params=cardId?[cardId]:[];const where=cardId?'WHERE s.card_id=$1':'';return rows(`SELECT s.*,c.name card_name,c.bank_name,COALESCE((SELECT SUM(pa.amount_minor) FROM payment_allocations pa WHERE pa.statement_id=s.id),0)::bigint paid_minor FROM statements s JOIN credit_cards c ON c.id=s.card_id ${where} ORDER BY s.cycle_end DESC`,params).then(rs=>rs.map(r=>{const bill= r.confirmed_at&&r.bank_amount_minor!==null?minor(r.bank_amount_minor):minor(r.amount_minor);const paid=minor(r.paid_minor);const due=Math.max(0,bill-paid);return {...r,amount_minor:minor(r.amount_minor),bank_amount_minor:r.bank_amount_minor===null?null:minor(r.bank_amount_minor),bill_amount_minor:bill,paid_minor:paid,outstanding_minor:due,status:due===0?'paid':paid>0?'partial':'unpaid',is_locked:r.is_locked?1:0};}));}
async function allocatePayment(paymentId,cardId,amount,client: InstanceType<typeof Pool> | PoolClient = db()){let left=amount;const sts=(await client.query(`SELECT s.id,GREATEST(0,(CASE WHEN s.confirmed_at IS NOT NULL AND s.bank_amount_minor IS NOT NULL THEN s.bank_amount_minor ELSE s.amount_minor END)-COALESCE((SELECT SUM(pa.amount_minor) FROM payment_allocations pa WHERE pa.statement_id=s.id),0)) due FROM statements s WHERE s.card_id=$1 ORDER BY s.cycle_end ASC`,[cardId])).rows;for(const s of sts){if(left<=0)break;const a=Math.min(left,minor(s.due));if(a>0){await client.query('INSERT INTO payment_allocations(payment_id,statement_id,amount_minor) VALUES($1,$2,$3) ON CONFLICT(payment_id,statement_id) DO UPDATE SET amount_minor=payment_allocations.amount_minor+EXCLUDED.amount_minor',[paymentId,s.id,a]);left-=a;}}}
async function rebalanceCardPayments(cardId){const client=await db().connect();try{await client.query('BEGIN');await client.query('DELETE FROM payment_allocations WHERE payment_id IN (SELECT id FROM bill_payments WHERE card_id=$1)',[cardId]);const ps=(await client.query('SELECT id,amount_minor FROM bill_payments WHERE card_id=$1 ORDER BY paid_at,id',[cardId])).rows;for(const p of ps)await allocatePayment(p.id,cardId,minor(p.amount_minor),client);await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}
async function ensureStatements(cardId=null){const cards=await rows(`SELECT * FROM credit_cards WHERE active=TRUE ${cardId?'AND id=$1':''}`,cardId?[cardId]:[]);const today=new Date().toLocaleDateString('en-CA',{timeZone:process.env.APP_TIME_ZONE||'Asia/Kolkata'});for(const c of cards){let changed=false;const first=(await rows('SELECT MIN(settlement_date)::text first_date FROM transactions WHERE card_id=$1',[c.id]))[0]?.first_date;if(first){let cursor=cycleFor(c,first).start;for(let i=0;i<240;i++){const cy=cycleFor(c,cursor);if(cy.end>=today)break;const total=minor((await rows('SELECT COALESCE(SUM(amount_minor),0)::bigint amount FROM transactions WHERE card_id=$1 AND settlement_date BETWEEN $2 AND $3',[c.id,cy.start,cy.end]))[0].amount);if(total>0){const ins=await db().query(`INSERT INTO statements(card_id,cycle_start,cycle_end,statement_date,due_date,amount_minor) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(card_id,cycle_start,cycle_end) DO NOTHING`,[c.id,cy.start,cy.end,cy.statement_date,cy.due_date,total]);if(ins.rowCount)changed=true;const upd=await db().query(`UPDATE statements SET amount_minor=$4,confirmed_at=NULL WHERE card_id=$1 AND cycle_start=$2 AND cycle_end=$3 AND is_locked=FALSE AND amount_minor<>$4`,[c.id,cy.start,cy.end,total]);if(upd.rowCount)changed=true;}const nextCursor=new Date(`${cy.end}T00:00:00Z`);nextCursor.setUTCDate(nextCursor.getUTCDate()+1);cursor=nextCursor.toISOString().slice(0,10);}}
    const reconciled=await db().query(`UPDATE statements s SET amount_minor=COALESCE((SELECT SUM(t.amount_minor) FROM transactions t WHERE t.card_id=s.card_id AND t.settlement_date BETWEEN s.cycle_start AND s.cycle_end),0),confirmed_at=NULL WHERE s.card_id=$1 AND s.is_locked=FALSE AND s.amount_minor<>COALESCE((SELECT SUM(t.amount_minor) FROM transactions t WHERE t.card_id=s.card_id AND t.settlement_date BETWEEN s.cycle_start AND s.cycle_end),0)`,[c.id]);if(reconciled.rowCount)changed=true;if(changed)await rebalanceCardPayments(Number(c.id));}}
async function settingMap(){const rs=await rows("SELECT setting_key,setting_value FROM app_settings WHERE setting_key IN ('monthly_budget_minor','categories_json')");const m=Object.fromEntries(rs.map(r=>[r.setting_key,r.setting_value]));let categories;try{categories=JSON.parse(m.categories_json||'[]')}catch{categories=[]}if(!Array.isArray(categories)||!categories.length)categories=defaultCategories;return {monthly_budget_minor:Number(m.monthly_budget_minor||0),categories};}
async function txnRows(where='',params=[],limit=null){const sql=`SELECT t.id,t.card_id,c.name card_name,t.particular,t.category,t.tags,t.amount_minor,t.txn_at,t.settlement_date,t.payment_method,t.upi_app_id,t.upi_app_name,t.notes,CASE WHEN t.attachment_key<>'' THEN 1 ELSE 0 END has_attachment FROM transactions t JOIN credit_cards c ON c.id=t.card_id ${where} ORDER BY t.txn_at DESC,t.id DESC ${limit?'LIMIT '+limit:''}`;return rows(sql,params);}
async function dashboard(){
  await ensureStatements();
  const today=new Date().toLocaleDateString('en-CA',{timeZone:process.env.APP_TIME_ZONE||'Asia/Kolkata'});
  const budgetMonth=today.slice(0,7);
  const [year,month]=budgetMonth.split('-').map(Number);
  const previousDate=new Date(Date.UTC(year,month-2,1));
  const previousBudgetMonth=`${previousDate.getUTCFullYear()}-${String(previousDate.getUTCMonth()+1).padStart(2,'0')}`;
  const nextDate=new Date(Date.UTC(year,month,1));
  const nextBudgetMonth=`${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth()+1).padStart(2,'0')}`;
  const monthStart=`${budgetMonth}-01`;
  const nextMonthStart=`${nextBudgetMonth}-01`;
  const cards=(await rows('SELECT * FROM credit_cards ORDER BY active DESC,name')).map(c=>({...c,active:c.active?1:0}));
  const active=cards.filter(c=>c.active);
  const cardById=new Map(active.map(c=>[Number(c.id),c]));
  const sts=await statementRows();
  const activeCards=[];
  for(const c of active){
    const cy=cycleFor(c,today);
    const cur=minor((await rows('SELECT COALESCE(SUM(amount_minor),0)::bigint n FROM transactions WHERE card_id=$1 AND settlement_date BETWEEN $2 AND $3',[c.id,cy.start,cy.end]))[0].n);
    const dues=sts.filter(s=>Number(s.card_id)===Number(c.id)).reduce((sum,s)=>sum+minor(s.outstanding_minor),0);
    activeCards.push({...c,current_minor:cur,dues_minor:dues,cycle_start:cy.start,cycle_end:cy.end});
  }

  // Dashboard accounting separates three dates:
  // 1) cycle_start assigns purchases to their expense month;
  // 2) statement_date records when the bill was generated;
  // 3) due_date assigns the billed obligation to its due month.
  // X is billed amount for previous-month cycles due this month. Y is the
  // outstanding balance of every statement already generated by today, so
  // overdue balances carry forward until their allocations pay them off.
  // Z is spending in cycles that started this month; payments never reduce Z.
  let previousBilledExpenses=0;
  let currentCycleExpenses=0;
  for(const statement of sts){
    const cycleStart=String(statement.cycle_start).slice(0,10);
    const dueDate=String(statement.due_date).slice(0,10);
    const cycle={start:cycleStart};
    if(isPreviousMonthDueCycle(cycle,dueDate,previousBudgetMonth,budgetMonth)){
      previousBilledExpenses+=minor(statement.bill_amount_minor);
    }
  }

  const currentMonthTransactions=await rows(`SELECT t.card_id,t.settlement_date::text settlement_date,t.amount_minor
    FROM transactions t JOIN credit_cards c ON c.id=t.card_id
    WHERE c.active=TRUE AND t.settlement_date IS NOT NULL AND t.settlement_date <= $1`,[today]);
  for(const transaction of currentMonthTransactions){
    const card=cardById.get(Number(transaction.card_id));
    if(!card)continue;
    const cycle=cycleFor(card,String(transaction.settlement_date).slice(0,10));
    if(isCurrentMonthCycle(cycle,budgetMonth)) currentCycleExpenses+=minor(transaction.amount_minor);
  }

  // Outstanding includes all generated statements (including overdue ones),
  // not just bills due this month. Payment allocations reduce the relevant
  // statement balance regardless of which month the payment was made.
  const previousUnpaid=sts
    .filter(statement=>String(statement.statement_date).slice(0,10)<=today)
    .reduce((sum,statement)=>sum+minor(statement.outstanding_minor),0);

  const latest=await txnRows('',[],5);
  return {
    cards:activeCards,
    previous_billed_minor:previousBilledExpenses,
    previous_dues_minor:previousUnpaid,
    current_expenses_minor:previousBilledExpenses,
    budget_month:budgetMonth,
    previous_budget_month:previousBudgetMonth,
    next_budget_month:nextBudgetMonth,
    next_budget_expenses_minor:currentCycleExpenses,
    latest
  };
}
function r2MissingConfig(){return ['R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET_NAME'].filter(key=>!process.env[key]?.trim());}
function r2Client(){const missing=r2MissingConfig();if(missing.length)fail(503,`Receipt storage is not configured. Missing: ${missing.join(', ')}. Set these private values in your server environment.`);return new S3Client({region:'auto',endpoint:process.env.R2_ENDPOINT||`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID!,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY!}});}
async function multipart(req): Promise<any> {
  return await new Promise((resolve, reject) => {
    const contentType = String(req.headers['content-type'] || '');
    if (!/^multipart\/form-data\s*;/i.test(contentType) || !/boundary=/i.test(contentType)) {
      return reject(Object.assign(new Error('Invalid image upload request. The multipart boundary is missing. Please retry.'), { status: 400 }));
    }

    let bb;
    try {
      bb = Busboy({
        headers: req.headers,
        limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 5, parts: 6 },
      });
    } catch {
      return reject(Object.assign(new Error('Invalid multipart upload headers. Please select the image again.'), { status: 400 }));
    }

    const fields: Record<string, string> = {};
    let file: any = null;
    let tooLarge = false;
    let tooManyFiles = false;
    let receivedBytes = 0;
    let settled = false;
    let fileStreamDone: Promise<void> = Promise.resolve();
    let fileStreamError: Error | null = null;
    const expectedBytes = Number(req.headers['content-length'] || 0);
    const finishReject = (error: any) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    // Observe the raw request without consuming it. This helps distinguish a
    // truncated proxy/runtime request from an invalid image or R2 failure.
    req.on('data', (chunk: Buffer) => { receivedBytes += chunk.length; });
    req.once('aborted', () => finishReject(Object.assign(new Error('The image upload was interrupted before it reached the server. Check your connection and retry.'), { status: 400 })));
    req.once('error', (error: Error) => finishReject(Object.assign(new Error('The image upload request stream failed. Please retry.'), { status: 400, cause: error })));

    bb.on('field', (name, value) => { fields[name] = value; });
    bb.on('filesLimit', () => { tooManyFiles = true; });
    bb.on('file', (name, stream, info) => {
      const chunks: Buffer[] = [];
      file = { name, filename: info.filename, mime: info.mimeType };
      fileStreamDone = new Promise((resolveFile) => {
        stream.on('limit', () => { tooLarge = true; });
        stream.on('data', (chunk: Buffer) => { chunks.push(chunk); });
        stream.once('error', (error: Error) => { fileStreamError = error; resolveFile(); });
        stream.once('end', () => {
          file.buffer = Buffer.concat(chunks);
          resolveFile();
        });
      });
      // Always drain the stream so Busboy can finish and enforce its limits.
      stream.resume();
    });
    bb.once('error', (error: Error) => {
      const incomplete = /Unexpected end of form/i.test(error.message);
      console.error('Receipt multipart parsing failed', {
        reason: incomplete ? 'incomplete_multipart_body' : 'multipart_parser_error',
        contentLength: expectedBytes || null,
        receivedBytes,
        requestComplete: req.complete === true,
        transferEncoding: req.headers['transfer-encoding'] || null,
      });
      finishReject(Object.assign(
        new Error(incomplete
          ? 'The image upload request arrived incomplete. Check the local API proxy/server and retry.'
          : 'The image upload could not be parsed. Please retry.'),
        { status: 400, cause: error },
      ));
    });
    bb.once('finish', async () => {
      try {
        await fileStreamDone;
        if (settled) return;
        if (fileStreamError) return finishReject(Object.assign(new Error('The image upload stream ended unexpectedly. Please retry.'), { status: 400, cause: fileStreamError }));
        if (expectedBytes && receivedBytes !== expectedBytes) {
          console.error('Receipt upload content-length mismatch', { contentLength: expectedBytes, receivedBytes, requestComplete: req.complete === true });
          return finishReject(Object.assign(new Error('The image upload was interrupted in transit. Please retry.'), { status: 400 }));
        }
        if (tooLarge) return finishReject(Object.assign(new Error('Attachment must be 5 MB or smaller.'), { status: 413 }));
        if (tooManyFiles) return finishReject(Object.assign(new Error('Only one receipt image is allowed per transaction.'), { status: 400 }));
        settled = true;
        resolve({ fields, file });
      } catch (error) {
        finishReject(Object.assign(new Error('The image upload stream ended unexpectedly. Please retry.'), { status: 400, cause: error }));
      }
    });

    req.pipe(bb);
  });
}
function imageType(buffer){if(buffer.length>=3&&buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff)return {mime:'image/jpeg',ext:'jpg'};if(buffer.length>=8&&buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {mime:'image/png',ext:'png'};if(buffer.length>=12&&buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP')return {mime:'image/webp',ext:'webp'};return null;}
function requestIpHash(req){const raw=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();return crypto.createHmac('sha256',process.env.SESSION_SECRET).update(raw).digest('hex');}
async function checkLoginThrottle(req){const ip=requestIpHash(req);await db().query("DELETE FROM login_attempts WHERE attempted_at<CURRENT_TIMESTAMP-INTERVAL '1 day'");const n=Number((await rows("SELECT COUNT(*) n FROM login_attempts WHERE ip_hash=$1 AND succeeded=FALSE AND attempted_at>CURRENT_TIMESTAMP-INTERVAL '15 minutes'",[ip]))[0].n);if(n>=8)fail(429,'Too many login attempts. Wait 15 minutes before trying again.');return ip;}
async function scryptHash(password){const salt=crypto.randomBytes(16);const derived=await new Promise<Buffer>((resolve,reject)=>crypto.scrypt(password,salt,64,(e,d)=>e?reject(e):resolve(d)));return `scrypt$${salt.toString('base64url')}$${Buffer.from(derived).toString('base64url')}`;}
async function verifyPassword(password,stored){if(String(stored).startsWith('$2y$'))return await bcrypt.compare(password,String(stored).replace(/^\$2y\$/,'$2b$'));const [alg,salt,hash]=String(stored).split('$');if(alg!=='scrypt')return false;const actual=await new Promise<Buffer>((resolve,reject)=>crypto.scrypt(password,Buffer.from(salt,'base64url'),64,(e,d)=>e?reject(e):resolve(d)));const a=Buffer.from(hash,'base64url'),b=Buffer.from(actual);return a.length===b.length&&crypto.timingSafeEqual(a,b);}
async function sessionFor(user=null,remember=false){const csrf=crypto.randomBytes(24).toString('hex');const token=crypto.randomBytes(32).toString('base64url');const seconds=remember?60*60*24*30:SESSION_SECONDS;await db().query(`INSERT INTO auth_sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,$3,CURRENT_TIMESTAMP + ($4 * INTERVAL '1 second'))`,[tokenHash(token),user?.id??null,csrf,seconds]);return {csrf,token,seconds};}
function requireEnv(){if(!process.env.DATABASE_URL)fail(500,'DATABASE_URL is not configured. Copy .env.example to .env.local and set your Neon connection string.');if(!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32)fail(500,'SESSION_SECRET must be set to a random value of at least 32 characters.');}

export default async function handler(req: any, res: any){
  try {
    requireEnv(); const url=new URL(req.url,'http://localhost');const action=url.searchParams.get('action')||'';const method=(req.method||'GET').toUpperCase();let session=await readSession(req);
    if(action==='status'&&method==='GET'){const count=Number((await rows('SELECT COUNT(*) n FROM app_user'))[0].n);if(!session){const s=await sessionFor(null,false);session={uid:0,username:'',csrf:s.csrf,token:s.token};return json(res,200,{setup_required:count===0,authenticated:false,username:null,csrf:s.csrf},{'Set-Cookie':cookie(s.token,s.seconds)});}return json(res,200,{setup_required:count===0,authenticated:session.uid>0,username:session.username||null,user_id:session.uid,csrf:session.csrf});}
    if(['setup','login','logout'].includes(action)&&method==='POST'){csrfCheck(req,session);const b=await body(req);if(action==='setup'){const count=Number((await rows('SELECT COUNT(*) n FROM app_user'))[0].n);if(count>0)fail(409,'Setup has already been completed.');const username=String(b.username||'').trim(),password=String(b.password||'');if(username.length<3||password.length<10)fail(400,'Username must be at least 3 characters and password at least 10 characters.');const hash=await scryptHash(password);const user=(await rows('INSERT INTO app_user(username,password_hash) VALUES($1,$2) RETURNING id,username',[username,hash]))[0];const s=await sessionFor(user,!!b.remember);if(session?.token)await db().query('DELETE FROM auth_sessions WHERE token_hash=$1',[tokenHash(session.token)]);return json(res,200,{ok:true,csrf:s.csrf},{'Set-Cookie':cookie(s.token,s.seconds)});}if(action==='login'){const ipHash=await checkLoginThrottle(req);const user=(await rows('SELECT * FROM app_user ORDER BY id LIMIT 1'))[0];if(!user||!(await verifyPassword(String(b.password||''),user.password_hash))){await db().query('INSERT INTO login_attempts(ip_hash,succeeded) VALUES($1,FALSE)',[ipHash]);fail(401,'Invalid password.');}await db().query('DELETE FROM login_attempts WHERE ip_hash=$1',[ipHash]);await db().query('INSERT INTO login_attempts(ip_hash,succeeded) VALUES($1,TRUE)',[ipHash]);const s=await sessionFor(user,!!b.remember);if(session?.token)await db().query('DELETE FROM auth_sessions WHERE token_hash=$1',[tokenHash(session.token)]);return json(res,200,{ok:true,csrf:s.csrf},{'Set-Cookie':cookie(s.token,s.seconds)});}if(session?.token)await db().query('DELETE FROM auth_sessions WHERE token_hash=$1',[tokenHash(session.token)]);return json(res,200,{ok:true,csrf:crypto.randomBytes(24).toString('hex')},{'Set-Cookie':cookie('',0)});}
    if(method!=='GET')csrfCheck(req,session);if(!['status','setup','login'].includes(action))needAuth(session);
    if(action==='change-password'&&method==='POST'){
      const b=await body(req);
      const currentPassword=String(b.current_password||'');
      const newPassword=String(b.new_password||'');
      if(!currentPassword||newPassword.length<10)fail(400,'New password must be at least 10 characters.');
      if(newPassword===currentPassword)fail(400,'New password must be different from your current password.');
      const user=(await rows('SELECT id,password_hash FROM app_user WHERE id=$1',[session.uid]))[0];
      if(!user||!(await verifyPassword(currentPassword,user.password_hash)))fail(400,'Current password is incorrect.');
      const passwordHash=await scryptHash(newPassword);
      const client=await db().connect();
      try{
        await client.query('BEGIN');
        await client.query('UPDATE app_user SET password_hash=$1 WHERE id=$2',[passwordHash,session.uid]);
        await client.query('DELETE FROM auth_sessions WHERE user_id=$1',[session.uid]);
        const csrf=crypto.randomBytes(24).toString('hex');
        const token=crypto.randomBytes(32).toString('base64url');
        const seconds=60*60*24*30;
        await client.query("INSERT INTO auth_sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,$3,CURRENT_TIMESTAMP + ($4 * INTERVAL '1 second'))",[tokenHash(token),session.uid,csrf,seconds]);
        await client.query('COMMIT');
        return json(res,200,{ok:true,csrf},{'Set-Cookie':cookie(token,seconds)});
      }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    }
    if(action==='bootstrap'&&method==='GET'){await ensureStatements();const cards=(await rows('SELECT * FROM credit_cards ORDER BY active DESC,name')).map(c=>({...c,active:c.active?1:0}));const transactions=await txnRows('',[],null);const apps=(await rows('SELECT * FROM upi_apps ORDER BY active DESC,name')).map(a=>({...a,active:a.active?1:0}));const d=await dashboard();const payments=await rows('SELECT p.*,c.name card_name,COALESCE((SELECT SUM(pa.amount_minor) FROM payment_allocations pa WHERE pa.payment_id=p.id),0)::bigint allocated_minor FROM bill_payments p JOIN credit_cards c ON c.id=p.card_id ORDER BY p.paid_at DESC,p.id DESC');for(const p of payments){p.unallocated_minor=minor(p.amount_minor)-minor(p.allocated_minor);p.amount_minor=minor(p.amount_minor);p.allocated_minor=minor(p.allocated_minor);}return json(res,200,{cards,transactions,apps,dashboard:d,payments,statements:await statementRows(),settings:await settingMap()});}
    if(action==='receipt-storage-status'&&method==='GET'){
      const missing=r2MissingConfig();
      if(missing.length)return json(res,200,{state:'unconfigured',configured:false,reachable:false,missing,message:`Receipt storage is not configured. Missing: ${missing.join(', ')}.`});
      try{
        await r2Client().send(new HeadBucketCommand({Bucket:process.env.R2_BUCKET_NAME}));
        return json(res,200,{state:'available',configured:true,reachable:true,missing:[],message:'Cloudflare R2 bucket is reachable. Upload permissions will be verified when an image is uploaded.',checked_at:new Date().toISOString()});
      }catch(error){
        const code=String((error as any)?.name||(error as any)?.Code||'');
        const message=code==='NotFound'||code==='NoSuchBucket'?'The configured R2 bucket was not found. Check R2_BUCKET_NAME.':'R2 credentials are configured, but the bucket could not be reached. Check the account, endpoint, bucket and bucket permissions.';
        return json(res,200,{state:'unreachable',configured:true,reachable:false,missing:[],message,checked_at:new Date().toISOString()});
      }
    }
    if(action==='dashboard'&&method==='GET')return json(res,200,await dashboard());
    if(action==='settings'&&method==='GET')return json(res,200,{settings:await settingMap()});
    if(action==='settings'&&method==='POST'){const b=await body(req);if('monthly_budget_minor'in b){const v=asInt(b.monthly_budget_minor,'Budget amount');await db().query("INSERT INTO app_settings(setting_key,setting_value) VALUES('monthly_budget_minor',$1) ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value,updated_at=CURRENT_TIMESTAMP",[String(v)]);}if('categories'in b){if(!Array.isArray(b.categories)||!b.categories.length||b.categories.length>100)fail(400,'At least one category is required.');const cats=b.categories.map(x=>String(x).trim());if(cats.some(x=>!x||x.length>50)||new Set(cats.map(x=>x.toLowerCase())).size!==cats.length)fail(400,'Category names must be unique and 1–50 characters.');await db().query("INSERT INTO app_settings(setting_key,setting_value) VALUES('categories_json',$1) ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value,updated_at=CURRENT_TIMESTAMP",[JSON.stringify(cats)]);}return json(res,200,{ok:true});}
    if(action==='cards'&&method==='GET')return json(res,200,{cards:(await rows('SELECT * FROM credit_cards ORDER BY active DESC,name')).map(c=>({...c,active:c.active?1:0}))});
    if(action==='cards'&&['POST','PUT'].includes(method)){const b=await body(req);const name=String(b.name||'').trim(),bank=String(b.bank_name||'').trim(),day=asInt(b.billing_day??5,'Billing day',1),due=asInt(b.due_days??20,'Due days',0);if(!name||!bank||day>31)fail(400,'Check the card details.');const vals=[name,bank,String(b.last4||'').replace(/\D/g,'').slice(-4),b.credit_limit_minor===''||b.credit_limit_minor==null?null:asInt(b.credit_limit_minor,'Credit limit'),day,b.billing_rule==='start'?'start':'end',due];if(method==='POST'){const r=(await rows('INSERT INTO credit_cards(name,bank_name,last4,credit_limit_minor,billing_day,billing_rule,due_days) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',vals))[0];return json(res,201,{ok:true,id:Number(r.id)});}await db().query('UPDATE credit_cards SET name=$1,bank_name=$2,last4=$3,credit_limit_minor=$4,billing_day=$5,billing_rule=$6,due_days=$7,active=$8 WHERE id=$9',[...vals,intBool(b.active),asInt(b.id,'Card ID',1)]);return json(res,200,{ok:true});}
    if(action==='cards'&&method==='DELETE'){const id=asInt(url.searchParams.get('id'),'Card ID',1);const counts=(await rows('SELECT (SELECT COUNT(*) FROM transactions WHERE card_id=$1)+(SELECT COUNT(*) FROM statements WHERE card_id=$1)+(SELECT COUNT(*) FROM bill_payments WHERE card_id=$1) n',[id]))[0].n;if(Number(counts)>0){await db().query('UPDATE credit_cards SET active=FALSE WHERE id=$1',[id]);return json(res,200,{ok:true,archived:true});}await db().query('DELETE FROM credit_cards WHERE id=$1',[id]);return json(res,200,{ok:true});}
    if(action==='transactions'&&method==='GET'){const cond=[],p=[];const add=(s,v)=>{p.push(v);cond.push(s.replace('?',`$${p.length}`));};for(const [k,col] of [['card_id','t.card_id'],['month',"to_char(t.txn_at,'YYYY-MM')"],['method','t.payment_method'],['upi_app_id','t.upi_app_id']])if(url.searchParams.get(k))add(`${col}=?`,url.searchParams.get(k));for(const [k,expr] of [['from','t.txn_at::date >= ?'],['to','t.txn_at::date <= ?'],['settle_from','t.settlement_date >= ?'],['settle_to','t.settlement_date <= ?']])if(url.searchParams.get(k))add(expr,url.searchParams.get(k));if(url.searchParams.get('q')){p.push(`%${url.searchParams.get('q')}%`);cond.push(`(t.particular ILIKE $${p.length} OR t.notes ILIKE $${p.length})`);}const list=await txnRows(cond.length?'WHERE '+cond.join(' AND '):'',p,null);return json(res,200,{transactions:list});}
    if(action==='transactions'&&['POST','PUT'].includes(method)){const b=await body(req);const id=method==='PUT'?asInt(b.id,'Transaction ID',1):0,card=asInt(b.card_id,'Card',1),amount=asInt(b.amount_minor,'Amount',1),txn=dateTime(b.txn_at||new Date().toISOString().slice(0,19).replace('T',' ')),settle=dateOnly(b.settlement_date||txn.slice(0,10),'Settlement date'),pm=b.payment_method||'swipe';if(!['swipe','online','upi'].includes(pm))fail(400,'Invalid payment method.');const c=(await rows('SELECT * FROM credit_cards WHERE id=$1',[card]))[0];if(!c)fail(400,'Select a valid card.');let appId=null,appName='';if(pm==='upi'){appId=asInt(b.upi_app_id,'UPI app',1);const a=(await rows('SELECT name FROM upi_apps WHERE id=$1',[appId]))[0];if(!a)fail(400,'Select a UPI application.');appName=a.name;}if(method==='PUT'){const old=(await rows('SELECT * FROM transactions WHERE id=$1',[id]))[0];if(!old)fail(404,'Transaction not found.');const lock=(await rows('SELECT COUNT(*) n FROM statements WHERE is_locked=TRUE AND ((card_id=$1 AND $2 BETWEEN cycle_start AND cycle_end) OR (card_id=$3 AND $4 BETWEEN cycle_start AND cycle_end))',[old.card_id,old.settlement_date,card,settle]))[0].n;if(Number(lock)>0)fail(409,'This transaction belongs to a manually locked statement. Unlock that statement before editing.');}else{const lock=(await rows('SELECT COUNT(*) n FROM statements WHERE is_locked=TRUE AND card_id=$1 AND $2 BETWEEN cycle_start AND cycle_end',[card,settle]))[0].n;if(Number(lock)>0)fail(409,'This billing cycle is manually locked. Unlock its statement before adding a transaction.');}const vals=[card,String(b.particular||'').trim(),String(b.category||'').trim(),String(b.tags||'').trim(),amount,txn,settle,pm,appId,appName,String(b.notes||'').trim()];if(method==='POST'){
      const mutationId=String(req.headers['x-idempotency-key']||b.client_mutation_id||'').trim();
      if(mutationId){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(mutationId))fail(400,'Invalid transaction idempotency key.');
        const existing=(await rows('SELECT transaction_id FROM transaction_mutations WHERE user_id=$1 AND mutation_id=$2',[session.uid,mutationId]))[0];
        if(existing)return json(res,200,{ok:true,id:Number(existing.transaction_id),replayed:true});
        const client=await db().connect();try{await client.query('BEGIN');const prior=(await client.query('SELECT transaction_id FROM transaction_mutations WHERE user_id=$1 AND mutation_id=$2 FOR UPDATE',[session.uid,mutationId])).rows[0];if(prior){await client.query('COMMIT');return json(res,200,{ok:true,id:Number(prior.transaction_id),replayed:true});}
          const r=(await client.query('INSERT INTO transactions(card_id,particular,category,tags,amount_minor,txn_at,settlement_date,payment_method,upi_app_id,upi_app_name,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id',vals)).rows[0];
          await client.query('INSERT INTO transaction_mutations(user_id,mutation_id,transaction_id) VALUES($1,$2,$3)',[session.uid,mutationId,r.id]);await client.query('COMMIT');return json(res,201,{ok:true,id:Number(r.id)});
        }catch(e){await client.query('ROLLBACK');if(e.code==='23505'){const duplicate=(await rows('SELECT transaction_id FROM transaction_mutations WHERE user_id=$1 AND mutation_id=$2',[session.uid,mutationId]))[0];if(duplicate)return json(res,200,{ok:true,id:Number(duplicate.transaction_id),replayed:true});}throw e;}finally{client.release();}
      }
      const r=(await rows('INSERT INTO transactions(card_id,particular,category,tags,amount_minor,txn_at,settlement_date,payment_method,upi_app_id,upi_app_name,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id',vals))[0];return json(res,201,{ok:true,id:Number(r.id)});
    }await db().query('UPDATE transactions SET card_id=$1,particular=$2,category=$3,tags=$4,amount_minor=$5,txn_at=$6,settlement_date=$7,payment_method=$8,upi_app_id=$9,upi_app_name=$10,notes=$11,updated_at=CURRENT_TIMESTAMP WHERE id=$12',[...vals,id]);return json(res,200,{ok:true});}
    if(action==='transactions'&&method==='DELETE'){const id=asInt(url.searchParams.get('id'),'Transaction ID',1);const t=(await rows('SELECT * FROM transactions WHERE id=$1',[id]))[0];if(!t)return json(res,200,{ok:true,already_deleted:true});const lock=(await rows('SELECT COUNT(*) n FROM statements WHERE is_locked=TRUE AND card_id=$1 AND $2 BETWEEN cycle_start AND cycle_end',[t.card_id,t.settlement_date]))[0].n;if(Number(lock)>0)fail(409,'This transaction belongs to a manually locked statement. Unlock that statement before deleting it.');if(t.attachment_key){try{await r2Client().send(new DeleteObjectCommand({Bucket:process.env.R2_BUCKET_NAME,Key:t.attachment_key}));}catch(error){console.error('Transaction deleted but receipt object cleanup failed',error);}}await db().query('DELETE FROM transactions WHERE id=$1',[id]);return json(res,200,{ok:true});}
    if(action==='statements'&&method==='GET'){await ensureStatements(url.searchParams.has('card_id')?asInt(url.searchParams.get('card_id'),'Card ID',1):null);return json(res,200,{statements:await statementRows(url.searchParams.has('card_id')?Number(url.searchParams.get('card_id')):null)});}
    if(action==='statement-action'&&method==='POST'){const b=await body(req),id=asInt(b.id,'Statement ID',1),op=String(b.operation||''),s=(await rows('SELECT * FROM statements WHERE id=$1',[id]))[0];if(!s)fail(404,'Statement not found.');if(op==='confirm'){const bank=asInt(b.bank_amount_minor,'Bank statement amount',0);await db().query('UPDATE statements SET bank_amount_minor=$1,confirmed_at=CURRENT_TIMESTAMP WHERE id=$2',[bank,id]);await rebalanceCardPayments(Number(s.card_id));return json(res,200,{ok:true,confirmed:true,difference_minor:bank-minor(s.amount_minor)});}if(op==='lock'){if(!s.confirmed_at)fail(400,'Confirm the statement against your bank statement before locking it.');await db().query('UPDATE statements SET is_locked=TRUE WHERE id=$1',[id]);return json(res,200,{ok:true,is_locked:true});}if(op==='unlock'){await db().query('UPDATE statements SET is_locked=FALSE WHERE id=$1',[id]);return json(res,200,{ok:true,is_locked:false});}fail(400,'Unknown statement operation.');}
    if(action==='payments'&&method==='GET'){await ensureStatements();const payments=await rows('SELECT p.*,c.name card_name,COALESCE((SELECT SUM(pa.amount_minor) FROM payment_allocations pa WHERE pa.payment_id=p.id),0)::bigint allocated_minor FROM bill_payments p JOIN credit_cards c ON c.id=p.card_id ORDER BY p.paid_at DESC,p.id DESC');for(const p of payments){p.unallocated_minor=minor(p.amount_minor)-minor(p.allocated_minor);p.amount_minor=minor(p.amount_minor);p.allocated_minor=minor(p.allocated_minor);}return json(res,200,{payments,statements:await statementRows()});}
    if(action==='payments'&&method==='POST'){const b=await body(req),card=asInt(b.card_id,'Card',1),amount=asInt(b.amount_minor,'Payment amount',1),paid=dateTime(b.paid_at||new Date().toISOString().slice(0,19).replace('T',' '));if(!(await rows('SELECT id FROM credit_cards WHERE id=$1',[card])).length)fail(400,'Card not found.');await ensureStatements(card);const client=await db().connect();try{await client.query('BEGIN');const p=(await client.query('INSERT INTO bill_payments(card_id,amount_minor,paid_at,reference,notes) VALUES($1,$2,$3,$4,$5) RETURNING id',[card,amount,paid,String(b.reference||'').trim(),String(b.notes||'').trim()])).rows[0];await allocatePayment(p.id,card,amount,client);await client.query('COMMIT');return json(res,201,{ok:true,id:Number(p.id)});}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}
    if(action==='payments'&&method==='PUT'){const b=await body(req),id=asInt(b.id,'Payment ID',1),card=asInt(b.card_id,'Card',1),amount=asInt(b.amount_minor,'Payment amount',1),paid=dateTime(b.paid_at||new Date().toISOString().slice(0,19).replace('T',' '));if(!(await rows('SELECT id FROM credit_cards WHERE id=$1',[card])).length)fail(400,'Card not found.');const old=(await rows('SELECT id FROM bill_payments WHERE id=$1',[id]))[0];if(!old)fail(404,'Payment not found.');await ensureStatements(card);const client=await db().connect();try{await client.query('BEGIN');await client.query('DELETE FROM payment_allocations WHERE payment_id=$1',[id]);await client.query('UPDATE bill_payments SET card_id=$1,amount_minor=$2,paid_at=$3,reference=$4,notes=$5 WHERE id=$6',[card,amount,paid,String(b.reference||'').trim(),String(b.notes||'').trim(),id]);await allocatePayment(id,card,amount,client);await client.query('COMMIT');if(Number(old.card_id)!==card)await rebalanceCardPayments(Number(old.card_id));return json(res,200,{ok:true,id});}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}
    if(action==='payments'&&method==='DELETE'){const id=asInt(url.searchParams.get('id'),'Payment ID',1);const p=(await rows('SELECT card_id FROM bill_payments WHERE id=$1',[id]))[0];if(p){await db().query('DELETE FROM bill_payments WHERE id=$1',[id]);await rebalanceCardPayments(Number(p.card_id));}return json(res,200,{ok:true});}
    if(action==='upi-apps'&&method==='GET')return json(res,200,{apps:(await rows('SELECT * FROM upi_apps ORDER BY active DESC,name')).map(a=>({...a,active:a.active?1:0}))});
    if(action==='upi-apps'&&['POST','PUT'].includes(method)){const b=await body(req),name=String(b.name||'').trim();if(!name||name.length>80)fail(400,'Application name is required (maximum 80 characters).');if(method==='POST'){try{const a=(await rows('INSERT INTO upi_apps(name) VALUES($1) RETURNING id',[name]))[0];return json(res,201,{ok:true,id:Number(a.id)});}catch(e){if(e.code==='23505')fail(409,'That UPI app already exists.');throw e;}}await db().query('UPDATE upi_apps SET name=$1,active=$2 WHERE id=$3',[name,intBool(b.active),asInt(b.id,'App ID',1)]);return json(res,200,{ok:true});}
    if(action==='upi-apps'&&method==='DELETE'){await db().query('UPDATE upi_apps SET active=FALSE WHERE id=$1',[asInt(url.searchParams.get('id'),'App ID',1)]);return json(res,200,{ok:true});}
    if(action==='transaction-attachment'&&method==='POST'){
      const {fields,file}=await multipart(req);const id=asInt(fields.transaction_id,'Transaction ID',1);
      if(!file?.buffer?.length)fail(400,'Choose an image attachment.');
      const type=imageType(file.buffer);if(!type)fail(415,'Only JPG, PNG or WebP images are supported.');
      const exists=(await rows('SELECT id,attachment_key FROM transactions WHERE id=$1',[id]))[0];if(!exists)fail(404,'Transaction not found.');
      const key=`receipts/${id}/${crypto.randomUUID()}.${type.ext}`;const client=r2Client();
      await client.send(new PutObjectCommand({Bucket:process.env.R2_BUCKET_NAME,Key:key,Body:file.buffer,ContentType:type.mime,CacheControl:'private, no-store',Metadata:{transactionid:String(id)}}));
      try{await db().query('UPDATE transactions SET attachment_key=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2',[key,id]);}
      catch(error){await client.send(new DeleteObjectCommand({Bucket:process.env.R2_BUCKET_NAME,Key:key})).catch(cleanupError=>console.error('Failed to clean up unreferenced receipt object',cleanupError));throw error;}
      if(exists.attachment_key)await client.send(new DeleteObjectCommand({Bucket:process.env.R2_BUCKET_NAME,Key:exists.attachment_key})).catch(error=>console.error('Failed to clean up replaced receipt object',error));
      return json(res,200,{ok:true,has_attachment:true,content_type:type.mime,size:file.buffer.length});
    }
    if(action==='transaction-attachment'&&method==='GET'){
      const id=asInt(url.searchParams.get('id'),'Transaction ID',1);const t=(await rows('SELECT attachment_key FROM transactions WHERE id=$1',[id]))[0];if(!t?.attachment_key)fail(404,'Attachment not found.');
      const obj=await r2Client().send(new GetObjectCommand({Bucket:process.env.R2_BUCKET_NAME,Key:t.attachment_key}));
      const ext=t.attachment_key.split('.').pop()?.toLowerCase();const filename=`transaction-${id}.${ext==='jpeg'?'jpg':ext||'img'}`;
      res.statusCode=200;res.setHeader('Content-Type',obj.ContentType||'application/octet-stream');res.setHeader('Content-Disposition',`inline; filename="${filename}"`);res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
      if(obj.ContentLength!==undefined)res.setHeader('Content-Length',String(obj.ContentLength));
      if(obj.Body&&typeof (obj.Body as any).pipe==='function')(obj.Body as any).pipe(res);else res.end(Buffer.from(await (obj.Body as any).transformToByteArray()));return;
    }
    if(action==='transaction-attachment'&&method==='DELETE'){
      const id=asInt(url.searchParams.get('id'),'Transaction ID',1);const t=(await rows('SELECT attachment_key FROM transactions WHERE id=$1',[id]))[0];
      if(t?.attachment_key){await r2Client().send(new DeleteObjectCommand({Bucket:process.env.R2_BUCKET_NAME,Key:t.attachment_key}));await db().query("UPDATE transactions SET attachment_key='',updated_at=CURRENT_TIMESTAMP WHERE id=$1",[id]);}
      return json(res,200,{ok:true,has_attachment:false});
    }
    fail(404,'Unknown API action.');
  } catch(e) {
    if (isTransientDatabaseError(e) || (e as any)?.code === 'DATABASE_URL_MISSING') {
      console.error('Card Ledger database temporarily unavailable:', {
        message: (e as any)?.message,
        code: (e as any)?.code,
      });
      res.setHeader('Retry-After', '3');
      return json(res, 503, {
        error: 'The database is temporarily unavailable. Please retry shortly.',
        code: 'DATABASE_UNAVAILABLE',
      });
    }
    console.error('Card Ledger API error:',e);
    return json(res,e.status||500,{error:e.status?e.message:'A server error occurred. Check the Vercel function logs.'});
  }
}

export const config = { api: { bodyParser: false }, maxDuration: 30 };
