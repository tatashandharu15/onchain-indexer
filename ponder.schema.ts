import { index, onchainTable, primaryKey } from "ponder";

export const guestbookEntry = onchainTable(
  "guestbook_entry",
  (t) => ({
    chainId: t.integer().notNull(),
    id: t.bigint().notNull(),
    author: t.hex().notNull(),
    message: t.text().notNull(),
    timestamp: t.bigint().notNull(),
    hidden: t.boolean().notNull(),
    blockNumber: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.chainId, table.id] }),
    byTime: index().on(table.chainId, table.timestamp),
    byAuthor: index().on(table.author),
  }),
);

export const skill = onchainTable(
  "skill",
  (t) => ({
    chainId: t.integer().notNull(),
    skillId: t.bigint().notNull(),
    name: t.text().notNull(),
    count: t.integer().notNull(),
  }),
  (table) => ({ pk: primaryKey({ columns: [table.chainId, table.skillId] }) }),
);

export const endorsement = onchainTable(
  "endorsement",
  (t) => ({
    chainId: t.integer().notNull(),
    endorser: t.hex().notNull(),
    skillId: t.bigint().notNull(),
    active: t.boolean().notNull(),
    viaSignature: t.boolean().notNull(),
    updatedAt: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({ pk: primaryKey({ columns: [table.chainId, table.endorser, table.skillId] }) }),
);

export const badge = onchainTable(
  "badge",
  (t) => ({
    chainId: t.integer().notNull(),
    tokenId: t.bigint().notNull(),
    owner: t.hex().notNull(),
    mintedAt: t.bigint().notNull(),
    burnedAt: t.bigint(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.chainId, table.tokenId] }),
    byOwner: index().on(table.owner),
  }),
);

/** One row per indexed event, for the "Recent activity" feed. */
export const activity = onchainTable(
  "activity",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    kind: t.text().notNull(),
    actor: t.hex().notNull(),
    ref: t.text().notNull(),
    detail: t.text().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({ byTime: index().on(table.chainId, table.timestamp) }),
);
