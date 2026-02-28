# Hedera MCP Platform

> **26 tools. 8 modules. One unified MCP server for Hedera blockchain intelligence.**

A production-ready [Model Context Protocol](https://modelcontextprotocol.io) server that gives AI agents deep, structured access to the Hedera ecosystem — HCS topics, compliance trails, governance, tokens, DeFi, identity, smart contracts, NFTs, and cross-chain bridges. Metered by HBAR micropayments per tool call.

[![npm version](https://img.shields.io/npm/v/hedera-mcp-platform)](https://www.npmjs.com/package/hedera-mcp-platform)
[![MCP Registry](https://img.shields.io/badge/MCP%20Registry-listed-blue)](https://registry.modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Live Endpoint

```
https://hedera-mcp-platform-production.up.railway.app/mcp
```

Connect any MCP-compatible AI agent (Claude, GPT, etc.) directly — no infrastructure needed.

---

## Quick Start

### Use the hosted endpoint (recommended)

Add this to your MCP client config:

```json
{
  "mcpServers": {
    "hedera": {
      "url": "https://hedera-mcp-platform-production.up.railway.app/mcp"
    }
  }
}
```

### Run locally

```bash
npm install -g hedera-mcp-platform

# or clone and run
git clone https://github.com/mountainmystic/hedera-mcp-platform.git
cd hedera-mcp-platform
npm install
cp .env.example .env   # fill in your keys
npm start
```

**Requirements:** Node.js ≥ 20

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `HEDERA_ACCOUNT_ID` | Your Hedera account (e.g. `0.0.123456`) | Yes |
| `HEDERA_PRIVATE_KEY` | ECDSA private key for signing transactions | Yes |
| `HEDERA_NETWORK` | `mainnet` or `testnet` | Yes |
| `OPENAI_API_KEY` | GPT-4o Mini for AI-powered analysis tools | Yes |
| `PORT` | HTTP server port (default: `3000`) | No |

---

## Modules & Tools

All tools require an `api_key` parameter. Each call is metered and deducted from your AgentLens balance in HBAR.

---

### Module 1 — HCS Topic Intelligence

Monitor, query, and deeply analyze any Hedera Consensus Service topic.

| Tool | Description | Cost |
|------|-------------|------|
| `hcs_monitor` | Topic metadata, message count, creation time, and recent activity | 0.05 HBAR |
| `hcs_query` | Natural language question answered from topic messages, AI-ranked | 0.05 HBAR |
| `hcs_understand` | Deep pattern analysis: anomaly detection, trend analysis, entity extraction, risk assessment | 0.50 HBAR |

**Example use cases:** Monitor governance forums, audit log topics, oracle feeds, token launch announcements.

---

### Module 2 — Compliance & Audit Trail

Write and verify tamper-evident records on Hedera — an immutable on-chain compliance layer for any workflow.

| Tool | Description | Cost |
|------|-------------|------|
| `hcs_write_record` | Write a compliance record to HCS with timestamp proof | 2.00 HBAR |
| `hcs_verify_record` | Verify a record exists and has not been tampered with | 0.50 HBAR |
| `hcs_audit_trail` | Full chronological audit history for an entity | 1.00 HBAR |

**Example use cases:** KYC approval records, trade approvals, document signing workflows, regulatory audit trails.

---

### Module 3 — Governance Intelligence

Track and participate in on-chain governance across Hedera DAOs and protocols.

| Tool | Description | Cost |
|------|-------------|------|
| `governance_monitor` | Active proposals, voting deadlines, current tallies | 0.10 HBAR |
| `governance_analyze` | Deep proposal analysis: voter sentiment, participation rate, token concentration, outcome prediction | 0.50 HBAR |
| `governance_vote` | Cast a governance vote on-chain via HCS (permanent) | 2.00 HBAR |

**Example use cases:** Automated governance bots, DAO dashboards, voting agents.

---

### Module 4 — Token & DeFi Intelligence

Real-time token data, market analytics, and DeFi yield discovery across the Hedera ecosystem.

| Tool | Description | Cost |
|------|-------------|------|
| `token_price` | Current price, market cap, and 24h trading volume | 0.05 HBAR |
| `token_analyze` | Holder distribution, transfer velocity, liquidity, and risk scoring | 0.30 HBAR |
| `defi_yields` | Current yield opportunities: liquidity pools, staking, lending rates | 0.20 HBAR |
| `token_monitor` | Recent transfer activity, whale movements, and unusual trading patterns | 0.10 HBAR |

**Example use cases:** DeFi portfolio agents, yield optimizers, token risk screeners.

---

### Module 5 — Verified Identity Resolution

Resolve and screen Hedera accounts with on-chain identity profiles and risk signals.

| Tool | Description | Cost |
|------|-------------|------|
| `identity_resolve` | Account profile: age, token holdings, transaction history, HCS identity records | 0.10 HBAR |
| `identity_verify_kyc` | KYC grant status and verification history for a token | 0.20 HBAR |
| `identity_check_sanctions` | Screen account against on-chain risk signals, counterparty patterns, flagged accounts | 0.50 HBAR |

**Example use cases:** Onboarding flows, compliance screening, counterparty due diligence.

---

### Module 6 — Smart Contract Abstraction

Inspect and interact with Hedera smart contracts without needing ABI knowledge.

| Tool | Description | Cost |
|------|-------------|------|
| `contract_read` | Contract info, bytecode size, recent activity, storage details | 0.10 HBAR |
| `contract_call` | Execute a read-only call to any contract function (no gas, no transaction) | 0.50 HBAR |
| `contract_analyze` | Deep analysis: activity patterns, caller distribution, gas usage, risk assessment, functional classification | 1.00 HBAR |

**Example use cases:** Contract auditing agents, DeFi protocol monitoring, ERC-20/ERC-721/HTS introspection.

---

### Module 7 — NFT & Token Metadata

Full NFT collection analytics and token holder intelligence.

| Tool | Description | Cost |
|------|-------------|------|
| `nft_collection_info` | Collection metadata: supply, royalties, treasury, token properties | 0.10 HBAR |
| `nft_token_metadata` | Specific NFT serial: on-chain data, IPFS/metadata URI, current owner | 0.10 HBAR |
| `nft_collection_analyze` | Holder distribution, whale concentration, transfer velocity, floor price signals, rarity insights | 0.30 HBAR |
| `token_holders` | Top holders, concentration metrics, whale analysis | 0.20 HBAR |

**Example use cases:** NFT market intelligence, rarity tools, holder distribution dashboards.

---

### Module 8 — Cross-Network Bridge Intelligence

Monitor and analyze bridged assets flowing between Hedera and other chains via HashPort.

| Tool | Description | Cost |
|------|-------------|------|
| `bridge_status` | Current bridge infrastructure status, known bridge contracts, wrapped token registry, health indicators | 0.10 HBAR |
| `bridge_transfers` | Recent bridge transfer activity: volume, frequency, counterparty analysis | 0.20 HBAR |
| `bridge_analyze` | Deep bridge analysis: peg stability, mint/burn ratio, custodian concentration, risk assessment | 0.50 HBAR |

**Supported bridged assets:** USDC, USDT, WETH, WBTC, and other HashPort-registered tokens.

**Example use cases:** Bridge risk monitoring, cross-chain DeFi agents, custodian concentration alerts.

---

## Pricing Summary

| Tier | Tools | Cost |
|------|-------|------|
| Micro | `hcs_monitor`, `hcs_query`, `token_price`, `nft_collection_info`, `nft_token_metadata`, `identity_resolve`, `contract_read`, `governance_monitor`, `token_monitor`, `bridge_status` | 0.05–0.10 HBAR |
| Standard | `identity_verify_kyc`, `defi_yields`, `bridge_transfers`, `token_holders`, `token_analyze`, `nft_collection_analyze` | 0.20–0.30 HBAR |
| Analysis | `hcs_understand`, `hcs_verify_record`, `identity_check_sanctions`, `governance_analyze`, `contract_call`, `bridge_analyze` | 0.50 HBAR |
| Deep | `contract_analyze`, `hcs_audit_trail` | 1.00 HBAR |
| Write | `hcs_write_record`, `governance_vote` | 2.00 HBAR |

New accounts receive **10 HBAR** of starting credit.

---

## Architecture

```
hedera-mcp-platform/
├── src/
│   ├── index.js          # Entry point — stdio + Streamable HTTP transports
│   ├── server.js         # MCP server, tool registry, request routing
│   ├── payments.js       # HBAR micropayment ledger
│   └── modules/
│       ├── hcs/          # HCS Topic Intelligence
│       ├── compliance/   # Compliance & Audit Trail
│       ├── governance/   # Governance Intelligence
│       ├── token/        # Token & DeFi Intelligence
│       ├── identity/     # Verified Identity Resolution
│       ├── contract/     # Smart Contract Abstraction
│       ├── nft/          # NFT & Token Metadata
│       └── bridge/       # Cross-Network Bridge Intelligence
```

The server supports two MCP transports:
- **Streamable HTTP** (`/mcp`) — for remote AI agents and Claude.ai integrations
- **stdio** — for local MCP client configurations (Claude Desktop, etc.)

---

## Connecting to Claude

### Claude.ai (via MCP connector)

In Claude.ai settings → Integrations, add:

```
https://hedera-mcp-platform-production.up.railway.app/mcp
```

### Claude Desktop (local)

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hedera": {
      "command": "node",
      "args": ["/path/to/hedera-mcp-platform/src/index.js"]
    }
  }
}
```

---

## Health Check

```bash
curl https://hedera-mcp-platform-production.up.railway.app/
```

Returns current status, network, all 26 tool names, and per-tool pricing.

---

## Known Limitations

- **`token_price`** — Price data pending SaucerSwap API key. Market cap and volume available; spot price returns `null` until resolved.
- **`token_holders`** — Sorted by account ID (mirror node limitation). Balances are accurate; ranking by balance requires client-side sorting after fetching.
- **`bridge_analyze`** — Custodian flow may show zeros for very low-activity bridged tokens (e.g. WETH with <100 recent transfers). The tool correctly reports what it finds within the most recent 100 transactions.
- **Payment system** — Currently an in-memory ledger (resets on restart). Production API key provisioning with persistent balances is on the roadmap.

---

## Roadmap

- [ ] Persistent API key provisioning with real HBAR payments
- [ ] SaucerSwap API integration for live token prices  
- [ ] AgentLens developer portal and dashboard
- [ ] Webhook/subscription support for real-time topic monitoring
- [ ] USDT[hts] bridge support once token ID confirmed

---

## Links

- **npm:** https://www.npmjs.com/package/hedera-mcp-platform  
- **MCP Registry:** https://registry.modelcontextprotocol.io (search: `hedera-mcp-platform`)  
- **GitHub:** https://github.com/mountainmystic/hedera-mcp-platform  
- **Live endpoint:** https://hedera-mcp-platform-production.up.railway.app/mcp  

---

## License

MIT
