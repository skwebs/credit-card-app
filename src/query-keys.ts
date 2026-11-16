/** Centralized TanStack Query keys for the Card Ledger server state. */
export const queryKeys = {
  all: ['ledger'] as const,
  session: {
    all: ['session'] as const,
    status: ['session', 'status'] as const,
  },
  bootstrap: ['ledger', 'bootstrap'] as const,
  transactions: {
    all: ['ledger', 'transactions'] as const,
    cycle: (cardId: number, startDate: string, endDate: string) =>
      ['ledger', 'transactions', 'cycle', cardId, startDate, endDate] as const,
  },
} as const;
