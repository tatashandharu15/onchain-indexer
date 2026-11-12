# onchain-indexer

Ponder indexer for the contracts behind onchain.tatas.anxentlab.my.id (repo tatashandharu15/onchain). It indexes Guestbook, Endorsements and VisitorBadge on Base (8453) and Base Sepolia (84532) and serves a public, read-only API at https://indexer.tatas.anxentlab.my.id.

PRD: `Web3 & Blockchain/03-projects/web3-portfolio/PRD-fase4.md`.

## Contracts

Same addresses on both chains (same deployer, same nonce sequence):

- Guestbook `0x930b86E72b6F2c64fdc0263cf4f0126888b5Cec7`
- Endorsements `0x121cB00B3E837057e1EefbD951F166F2Ce576E55`
- VisitorBadge `0x611D092f2a2A574E88321e9ffF493630b1F6ba37`

ABIs in `abis/` are generated from `contracts/out` in the onchain repo. Regenerate them if a contract changes.

## API

- `GET /stats?chain=8453`: guestbook entries, hidden count, unique signers, endorsements per skill, active badges
- `GET /guestbook?chain=8453&limit=20&before=<id>`: visible entries, newest first
- `GET /activity?chain=8453&limit=20`: recent events across all three contracts (messages of hidden entries are blanked)
- `POST /graphql`, `/sql/*`: Ponder's built-in GraphQL and SQL-over-HTTP (read-only)
- `GET /health` (process up), `GET /ready` (200 once both chains are indexed to realtime, 503 during backfill)

`chain` accepts 8453 (default) and 84532. All data is public on-chain data; no visitor addresses are received or stored. Hiding a guestbook entry is UI moderation only: the message stays on-chain and remains visible through `/graphql` and `/sql`.

## How it runs

Base produces several blocks per second, so following every block in realtime would exhaust any free RPC plan. The indexer therefore runs in catch-up mode:

- `indexer` service: `ponder start` with `endBlock: "latest"` indexes up to the current head and idles; a loop stops it after `INDEX_RUN_SECONDS` (240), pauses `INDEX_PAUSE_SECONDS` (60) and starts again. Crash recovery resumes from the last checkpoint, so each run only fetches the new range. Data lags the chain by at most a few minutes.
- `api` service: `ponder serve` on the same schema serves the API continuously, also while the indexer restarts.
- RPC: Envio HyperRPC (archive, no eth_getLogs block-range cap). Alchemy's free plan caps eth_getLogs at 10 blocks and the public Base RPCs are pruned, so neither can backfill.

## Local development

```
cp .env.example .env
npm install
npm run dev
```

`npm run dev` uses PGlite in `.ponder/` and serves on http://localhost:42069.

## Deploy (VPS, Docker Compose behind host nginx)

First time:

```
git clone https://github.com/tatashandharu15/onchain-indexer.git /opt/onchain-indexer
cd /opt/onchain-indexer
cp .env.example .env
chmod 600 .env
# fill PONDER_RPC_URL_8453, PONDER_RPC_URL_84532 (HyperRPC) and POSTGRES_PASSWORD (openssl rand -hex 24)
docker compose up -d --build
docker compose logs -f indexer
curl -s localhost:42069/stats?chain=8453
```

Nginx and TLS:

```
cp deploy/nginx-indexer.conf /etc/nginx/sites-available/indexer.tatas.anxentlab.my.id
ln -s /etc/nginx/sites-available/indexer.tatas.anxentlab.my.id /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d indexer.tatas.anxentlab.my.id
```

DNS: `A indexer.tatas → <VPS IP>`.

Redeploy after a code change: `git pull`, bump `DEPLOYMENT_ID` in `.env` if the schema or indexing logic changed (Ponder requires a fresh schema), then `docker compose up -d --build`. Restarting with the same `DEPLOYMENT_ID` resumes indexing. Old schemas are never dropped automatically; drop them from Postgres when no longer needed.

The index can always be rebuilt from the chain, so the database needs no backup. Keep `.env` safe.

## Resource limits

Postgres 512 MB, indexer 768 MB and 1 CPU, api 512 MB and 0.5 CPU (`docker-compose.yml`). Postgres publishes no port; only the api listens, on 127.0.0.1:42069.
