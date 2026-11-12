import { createConfig } from "ponder";
import { custom, hexToNumber, numberToHex, type Hex } from "viem";
import { endorsementsAbi } from "./abis/endorsementsAbi";
import { guestbookAbi } from "./abis/guestbookAbi";
import { visitorBadgeAbi } from "./abis/visitorBadgeAbi";

/**
 * RPC from env. Production uses Envio HyperRPC (archive, no eth_getLogs block-range cap).
 * The public Base RPCs are pruned (no history before a recent block) and only suit quick local tests.
 *
 * The transport reports a "latest" block that trails the real head by RPC_LAG_BLOCKS. Combined with
 * reorgWindow: 0 and endBlock: "latest", every run indexes only blocks that are already settled and then
 * stops, instead of following each new block (Base makes several per second). Chain settings are not part
 * of Ponder's build id, so restarts resume from the checkpoint.
 */
const LAG = Math.max(0, Number(process.env.RPC_LAG_BLOCKS ?? 150) || 0);

async function call(url: string, method: string, params: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: params ?? [] }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from RPC: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { result?: unknown; error?: { code: number; message: string } };
  if (body.error) throw Object.assign(new Error(body.error.message), { code: body.error.code });
  return body.result;
}

async function laggedHead(url: string): Promise<number> {
  const head = hexToNumber((await call(url, "eth_blockNumber", [])) as Hex);
  return Math.max(0, head - LAG);
}

const lagged = (url: string) =>
  custom({
    async request({ method, params }) {
      if (method === "eth_blockNumber") return numberToHex(await laggedHead(url));
      if (method === "eth_getBlockByNumber" && Array.isArray(params) && params[0] === "latest") {
        return call(url, method, [numberToHex(await laggedHead(url)), params[1]]);
      }
      return call(url, method, params);
    },
  });

const rpc = (primary: string | undefined, fallback: string) => lagged(primary || fallback);

// Same addresses on both chains: same deployer, same nonce sequence.
const GUESTBOOK = "0x930b86E72b6F2c64fdc0263cf4f0126888b5Cec7";
const ENDORSEMENTS = "0x121cB00B3E837057e1EefbD951F166F2Ce576E55";
const BADGE = "0x611D092f2a2A574E88321e9ffF493630b1F6ba37";
const BASE_DEPLOY_BLOCK = 56364360;

/**
 * Catch-up mode: each `ponder start` run indexes up to the lagged head and then idles; the compose loop
 * restarts it every few minutes and crash recovery resumes from the last checkpoint. The API is served by a
 * separate `ponder serve` process, so it stays up while the indexer cycles.
 */
const END = "latest" as const;

export default createConfig({
  chains: {
    base: {
      id: 8453,
      rpc: rpc(process.env.PONDER_RPC_URL_8453, "https://mainnet.base.org"),
      reorgWindow: 0,
    },
    baseSepolia: {
      id: 84532,
      rpc: rpc(process.env.PONDER_RPC_URL_84532, "https://sepolia.base.org"),
      reorgWindow: 0,
    },
  },
  contracts: {
    Guestbook: {
      abi: guestbookAbi,
      chain: {
        base: { address: GUESTBOOK, startBlock: BASE_DEPLOY_BLOCK, endBlock: END },
        baseSepolia: { address: GUESTBOOK, startBlock: 55725414, endBlock: END },
      },
    },
    Endorsements: {
      abi: endorsementsAbi,
      chain: {
        base: { address: ENDORSEMENTS, startBlock: BASE_DEPLOY_BLOCK, endBlock: END },
        baseSepolia: { address: ENDORSEMENTS, startBlock: 55749740, endBlock: END },
      },
    },
    VisitorBadge: {
      abi: visitorBadgeAbi,
      chain: {
        base: { address: BADGE, startBlock: BASE_DEPLOY_BLOCK, endBlock: END },
        baseSepolia: { address: BADGE, startBlock: 55767448, endBlock: END },
      },
    },
  },
});
