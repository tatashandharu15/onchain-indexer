# AGENTS.md

Rules for any agent working in this repo.

- Index only public data of the three Onchain contracts. Never add endpoints that accept, log or store visitor wallet addresses or other personal data.
- The API is read-only. No write endpoints, no admin endpoints.
- Chains and addresses live in `ponder.config.ts` only. Both chains use the same addresses; keep them in sync with the onchain repo README.
- ABIs in `abis/` are generated from the onchain repo's `contracts/out`. Do not hand-edit them.
- Any change to `ponder.schema.ts` or `src/index.ts` needs a new `DEPLOYMENT_ID` on deploy.
- Secrets (RPC URLs with keys, POSTGRES_PASSWORD) only in `.env` on the server, never committed.
- Keep `docker-compose.yml` free of published ports except `127.0.0.1:42069`.
- Before committing: `npm run typecheck`.
