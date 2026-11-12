import { createConfig } from "ponder";
import { endorsementsAbi } from "./abis/endorsementsAbi";
import { guestbookAbi } from "./abis/guestbookAbi";
import { visitorBadgeAbi } from "./abis/visitorBadgeAbi";

/** Primary RPC from env (e.g. Alchemy), public Base RPC as fallback. */
const rpc = (primary: string | undefined, fallback: string) => (primary ? [primary, fallback] : fallback);

// Same addresses on both chains: same deployer, same nonce sequence.
const GUESTBOOK = "0x930b86E72b6F2c64fdc0263cf4f0126888b5Cec7";
const ENDORSEMENTS = "0x121cB00B3E837057e1EefbD951F166F2Ce576E55";
const BADGE = "0x611D092f2a2A574E88321e9ffF493630b1F6ba37";
const BASE_DEPLOY_BLOCK = 56364360;

export default createConfig({
  chains: {
    base: {
      id: 8453,
      rpc: rpc(process.env.PONDER_RPC_URL_8453, "https://mainnet.base.org"),
    },
    baseSepolia: {
      id: 84532,
      rpc: rpc(process.env.PONDER_RPC_URL_84532, "https://sepolia.base.org"),
    },
  },
  contracts: {
    Guestbook: {
      abi: guestbookAbi,
      chain: {
        base: { address: GUESTBOOK, startBlock: BASE_DEPLOY_BLOCK },
        baseSepolia: { address: GUESTBOOK, startBlock: 55725414 },
      },
    },
    Endorsements: {
      abi: endorsementsAbi,
      chain: {
        base: { address: ENDORSEMENTS, startBlock: BASE_DEPLOY_BLOCK },
        baseSepolia: { address: ENDORSEMENTS, startBlock: 55749740 },
      },
    },
    VisitorBadge: {
      abi: visitorBadgeAbi,
      chain: {
        base: { address: BADGE, startBlock: BASE_DEPLOY_BLOCK },
        baseSepolia: { address: BADGE, startBlock: 55767448 },
      },
    },
  },
});
