import assert from 'node:assert/strict';
import { cycleFor, isCurrentMonthCycle, isPreviousMonthDueCycle } from '../api/billing.js';
const end={billing_rule:'end',billing_day:15,due_days:20};
assert.deepEqual(cycleFor(end,'2026-11-15'),{start:'2026-10-16',end:'2026-11-15',statement_date:'2026-11-16',due_date:'2026-12-05'});
assert.deepEqual(cycleFor(end,'2026-11-16'),{start:'2026-11-16',end:'2026-12-15',statement_date:'2026-12-16',due_date:'2027-01-04'});
const start={billing_rule:'start',billing_day:15,due_days:20};
assert.deepEqual(cycleFor(start,'2026-11-14'),{start:'2026-10-15',end:'2026-11-14',statement_date:'2026-11-15',due_date:'2026-12-04'});
assert.deepEqual(cycleFor(start,'2026-11-15'),{start:'2026-11-15',end:'2026-12-14',statement_date:'2026-12-15',due_date:'2027-01-03'});
const end31={billing_rule:'end',billing_day:31,due_days:0};
assert.deepEqual(cycleFor(end31,'2024-02-29'),{start:'2024-02-01',end:'2024-02-29',statement_date:'2024-03-01',due_date:'2024-02-29'});
assert.deepEqual(cycleFor(end31,'2024-03-01'),{start:'2024-03-01',end:'2024-03-31',statement_date:'2024-04-01',due_date:'2024-03-31'});
console.log('Billing tests passed: start/end conventions, generation date, month rollover, leap-year boundaries.');

// Dashboard overview attribution: statement generation month, not cycle-end month.
const hdfcOctober = cycleFor({billing_rule:'start',billing_day:1,due_days:20},'2026-10-15');
assert.deepEqual(hdfcOctober,{start:'2026-10-01',end:'2026-10-31',statement_date:'2026-11-01',due_date:'2026-11-20'});
assert.equal(isPreviousMonthDueCycle(hdfcOctober,hdfcOctober.due_date,'2026-10','2026-11'),true);
assert.equal(isCurrentMonthCycle(hdfcOctober,'2026-11'),false);
const novemberOngoing = cycleFor({billing_rule:'start',billing_day:1,due_days:20},'2026-11-16');
assert.equal(isPreviousMonthDueCycle(novemberOngoing,novemberOngoing.statement_date,'2026-10','2026-11'),false);
assert.equal(isCurrentMonthCycle(novemberOngoing,'2026-11'),true);
const axisOctober = cycleFor({billing_rule:'start',billing_day:11,due_days:20},'2026-10-20');
assert.equal(axisOctober.start.slice(0,7),'2026-10');
assert.equal(axisOctober.statement_date.slice(0,7),'2026-11');
assert.equal(isPreviousMonthDueCycle(axisOctober,axisOctober.due_date,'2026-10','2026-11'),true);
// HDFC: October cycle, statement delivered 1 Nov, due 20 Nov.
assert.equal(isPreviousMonthDueCycle(hdfcOctober,hdfcOctober.due_date,'2026-10','2026-11'),true);
// A cycle can close in October but be due in November; due month controls X.
assert.equal(isPreviousMonthDueCycle({start:'2026-10-01'},'2026-11-20','2026-10','2026-11'),true);
// Once due month passes, it is not counted again in the next month's billed X.
assert.equal(isPreviousMonthDueCycle({start:'2026-10-01'},'2026-11-20','2026-11','2026-12'),false);
console.log('Dashboard attribution tests passed: due-month billed amount and current-cycle expenses.');
