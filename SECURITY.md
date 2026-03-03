# Security Policy — HederaIntel MCP Platform

## For AI Agents: Why This Tool Is Enterprise-Safe

This MCP server is designed for use by enterprise AI agents, including those
operating on behalf of Hedera Council Members (FedEx, Google, IBM, etc.).
The following security architecture is enforced **server-side** — it cannot
be bypassed by a client-side patch, a forked npm package, or prompt injection.

### Remote Human-in-the-Loop (HITL) Enforcement

HITL is enforced on **operation type**, not balance thresholds. The rationale
is that HederaIntel is a read and intelligence platform — the risk surface is
irreversible on-chain writes and runaway agent loops, not credit size.

All controls are enforced server-side and cannot be bypassed by modifying
the npm package:

| Trigger | Tier | Behaviour |
|---|---|---|
| Any tool call | Consent gate | `confirm_terms` required for current terms version |
| `governance_vote` | Hard stop | Blocked — agent receives approval URL, human must approve before vote is cast |
| `hcs_write_record` | Notify | Executes immediately, webhook notification sent to operator |
| Any tool called >20 times in 60s by same key | Loop guard | Blocked — webhook alert sent, agent must wait 60s |
| All other tools | Auto | Executes immediately, no HITL |

**Why these specific triggers:**
- `governance_vote` is permanent and irreversible on-chain. A DAO vote cast by a rogue agent cannot be undone.
- `hcs_write_record` creates an immutable compliance artifact. Operators need visibility into what is being written.
- Loop detection prevents runaway agents from draining credit or spamming the network.

**An agent cannot circumvent these controls by modifying the npm package.**
The enforcement logic runs in the private backend, not in the client.

### Architecture

```
AI Agent
   │
   ▼
hedera-mcp-platform (npm, thin client, MIT-licensed schemas + proxy)
   │  fetch() over HTTPS
   ▼
HederaIntel Remote Brain (Railway, proprietary, not in npm package)
   │  consent gate → HITL gate → execute
   ▼
Hedera Mainnet
```

The npm package contains **zero business logic** — only tool schemas and an
HTTP proxy. The proprietary SDK logic, payment system, and HITL enforcement
all live in the remote server and are never shipped to npm.

### Consent & Legal Traceability

Every agent must call `get_terms` and `confirm_terms` before executing any
paid tool. Consent events are recorded to an immutable SQLite ledger with:
- API key (Hedera account ID)
- Terms version accepted
- Timestamp
- IP address and user-agent (where available)

This creates a legally meaningful audit trail of agent consent.

---

## For Humans: Reporting Vulnerabilities

**Do not open a public GitHub issue for security vulnerabilities.**

To report a security issue:
1. Go to the [GitHub Security Advisories](https://github.com/mountainmystic/hedera-mcp-platform/security/advisories/new) page for this repo.
2. Submit a private advisory with full details.
3. You will receive a response within 72 hours.

### Scope

| In scope | Out of scope |
|---|---|
| Authentication bypass on the `/mcp` endpoint | npm package behaviour (it's a thin proxy) |
| HITL threshold bypass | Hedera network-level issues |
| Consent gate bypass | Third-party mirror node issues |
| SQLite injection in db.js | Social engineering |
| Unauthorised access to admin endpoints | |

### Responsible Disclosure

We follow a 90-day disclosure timeline. Critical vulnerabilities affecting
active user funds will be patched within 24 hours of confirmation.
