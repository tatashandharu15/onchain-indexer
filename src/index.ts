import { ponder, type Context } from "ponder:registry";
import { activity, badge, endorsement, guestbookEntry, skill } from "ponder:schema";
import { zeroAddress } from "viem";

type Meta = {
  block: { number: bigint; timestamp: bigint };
  transaction: { hash: `0x${string}` };
  log: { logIndex: number };
};

const MAX_DETAIL = 140;

async function record(context: Context, event: Meta, kind: string, actor: `0x${string}`, ref: string, detail = "") {
  await context.db.insert(activity).values({
    id: `${context.chain.id}-${event.transaction.hash}-${event.log.logIndex}`,
    chainId: context.chain.id,
    kind,
    actor,
    ref,
    detail: detail.slice(0, MAX_DETAIL),
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });
}

// Guestbook

ponder.on("Guestbook:Signed", async ({ event, context }) => {
  const { id, author, message } = event.args;
  await context.db.insert(guestbookEntry).values({
    chainId: context.chain.id,
    id,
    author,
    message,
    timestamp: event.block.timestamp,
    hidden: false,
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });
  await record(context, event, "signed", author, id.toString(), message);
});

ponder.on("Guestbook:VisibilityChanged", async ({ event, context }) => {
  const { id, hidden } = event.args;
  await context.db.update(guestbookEntry, { chainId: context.chain.id, id }).set({ hidden });
  await record(context, event, hidden ? "hidden" : "unhidden", event.transaction.from, id.toString());
});

ponder.on("Guestbook:OwnershipTransferred", async ({ event, context }) => {
  await record(context, event, "ownership_transferred", event.args.newOwner, "guestbook", event.args.previousOwner);
});

// Endorsements

ponder.on("Endorsements:SkillAdded", async ({ event, context }) => {
  const { skillId, name } = event.args;
  await context.db.insert(skill).values({ chainId: context.chain.id, skillId, name, count: 0 });
  await record(context, event, "skill_added", event.transaction.from, skillId.toString(), name);
});

ponder.on("Endorsements:Endorsed", async ({ event, context }) => {
  const { endorser, skillId, viaSignature } = event.args;
  const chainId = context.chain.id;
  await context.db
    .insert(endorsement)
    .values({ chainId, endorser, skillId, active: true, viaSignature, updatedAt: event.block.timestamp, txHash: event.transaction.hash })
    .onConflictDoUpdate({ active: true, viaSignature, updatedAt: event.block.timestamp, txHash: event.transaction.hash });
  const row = await context.db.update(skill, { chainId, skillId }).set((s) => ({ count: s.count + 1 }));
  await record(context, event, "endorsed", endorser, skillId.toString(), row.name);
});

ponder.on("Endorsements:Unendorsed", async ({ event, context }) => {
  const { endorser, skillId } = event.args;
  const chainId = context.chain.id;
  await context.db
    .update(endorsement, { chainId, endorser, skillId })
    .set({ active: false, updatedAt: event.block.timestamp, txHash: event.transaction.hash });
  const row = await context.db.update(skill, { chainId, skillId }).set((s) => ({ count: Math.max(0, s.count - 1) }));
  await record(context, event, "unendorsed", endorser, skillId.toString(), row.name);
});

// Visitor badge (soulbound: only mint and burn are expected)

ponder.on("VisitorBadge:Transfer", async ({ event, context }) => {
  const { from, to, tokenId } = event.args;
  const chainId = context.chain.id;
  if (from === zeroAddress) {
    await context.db.insert(badge).values({ chainId, tokenId, owner: to, mintedAt: event.block.timestamp, burnedAt: null });
    await record(context, event, "badge_minted", to, tokenId.toString());
  } else if (to === zeroAddress) {
    await context.db.update(badge, { chainId, tokenId }).set({ burnedAt: event.block.timestamp });
    await record(context, event, "badge_burned", from, tokenId.toString());
  } else {
    await context.db.update(badge, { chainId, tokenId }).set({ owner: to });
  }
});
