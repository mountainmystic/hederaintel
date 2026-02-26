# Hedera MCP Platform

Complete Hedera ecosystem intelligence platform for AI agents. 8 MCP servers, 24 tools covering HCS, compliance, governance, tokens, identity, contracts, NFTs and cross-chain bridges. Pay per call in HBAR.

## Live Endpoint

https://hedera-mcp-platform-production.up.railway.app/mcp

## Available Tools

### Module 1 — HCS Topic Intelligence

| Tool | Description | Cost |
|------|-------------|------|
| hcs_monitor | Topic metadata and recent activity | Free |
| hcs_query | Natural language query with AI analysis | 0.05 HBAR |
| hcs_understand | Deep pattern analysis and anomaly detection | 0.50 HBAR |

### Module 2 — Compliance & Audit Trail

| Tool | Description | Cost |
|------|-------------|------|
| hcs_write_record | Write tamper-evident compliance record | 2.00 HBAR |
| hcs_verify_record | Verify record integrity on-chain | 0.50 HBAR |
| hcs_audit_trail | Full chronological audit history | 1.00 HBAR |

## Setup

npm install
cp .env.example .env
npm start

## Environment Variables

| Variable | Description |
|----------|-------------|
| HEDERA_ACCOUNT_ID | Your Hedera account (0.0.XXXXXXX) |
| HEDERA_PRIVATE_KEY | ECDSA private key |
| HEDERA_NETWORK | testnet or mainnet |
| OPENAI_API_KEY | For GPT-4o Mini analysis |

## MCP Registry

Listed at: https://registry.modelcontextprotocol.io
npm: https://www.npmjs.com/package/hedera-mcp-platform
