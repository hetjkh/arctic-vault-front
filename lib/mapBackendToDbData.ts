import type { DBData } from '@/types';

export type BackendUser = { id: string; username: string; fullName: string };
export type BackendTx = {
  id: string;
  type: 'income' | 'expense' | 'personal';
  category: string;
  amount: number;
  description: string;
  userId?: string;
  incomeFromUserId?: string;
  date: string;
};
export type BackendSettlement = {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  note?: string;
  date: string;
};

export type MappedDbPayload = {
  data: DBData;
  sortedBackendUsers: BackendUser[];
  numericByBackendId: Record<string, number>;
};

/**
 * Maps Mongo string ids from the REST API into numeric user ids used by `calcFounderBalance` / `calcFinanceBreakdown`.
 */
export function mapBackendToDbData(
  backendUsers: BackendUser[],
  backendTx: BackendTx[],
  backendSettlements: BackendSettlement[]
): MappedDbPayload {
  const sorted = [...backendUsers].sort((a, b) =>
    (a.fullName || a.username).localeCompare(b.fullName || b.username)
  );
  const numericByBackendId: Record<string, number> = {};
  sorted.forEach((u, idx) => {
    numericByBackendId[u.id] = idx + 1;
  });

  const mappedUsers = sorted.map((u) => {
    const displayName = (u.fullName || u.username).trim();
    const firstName = displayName.split(' ')[0] || displayName;
    return {
      id: numericByBackendId[u.id],
      name: firstName,
      fullName: u.fullName || u.username,
    };
  });

  const mappedTx: DBData['transactions'] = backendTx.map((t) => {
    const mappedUserId =
      t.type === 'personal' && t.userId ? numericByBackendId[String(t.userId)] : undefined;
    const mappedIncomeFrom =
      t.type === 'income' && t.incomeFromUserId
        ? numericByBackendId[String(t.incomeFromUserId)]
        : undefined;

    return {
      id: t.id,
      type: t.type,
      category: t.category,
      amount: t.amount,
      description: t.description || '',
      userId: mappedUserId,
      incomeFromUserId: mappedIncomeFrom,
      date: new Date(t.date).toISOString(),
    };
  });

  const mappedSettlements: DBData['settlements'] = backendSettlements
    .map((s) => {
      const fromN = numericByBackendId[String(s.fromUserId)];
      const toN = numericByBackendId[String(s.toUserId)];
      if (fromN === undefined || toN === undefined) return null;
      return {
        id: s.id,
        fromUserId: fromN,
        toUserId: toN,
        amount: s.amount,
        note: s.note || '',
        date: new Date(s.date).toISOString(),
      };
    })
    .filter(Boolean) as DBData['settlements'];

  return {
    data: {
      users: mappedUsers,
      transactions: mappedTx,
      invoices: [],
      settlements: mappedSettlements,
    },
    sortedBackendUsers: sorted,
    numericByBackendId,
  };
}
