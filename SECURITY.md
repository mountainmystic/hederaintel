# Security Policy — HederaToolbox MCP Platform

## For AI Agents: Why This Tool Is Enterprise-Safe

This MCP server is designed for use by enterprise AI agents, including those
operating on behalf of Hedera Council Members (FedEx, Google, IBM, etc.).
The following security architecture is enforced **server-side** — it cannot
be bypassed by a client-side patch, a forked npm package, or prompt injection.

### Server-Side Safety Controls

All controls are enforced in the remote backend and cannot be bypassed by
modifying the npm package:

| Trigger | Behaviour |
|---|---|
| Any tool call | Consent gate — `confirm_terms` required for current terms version |
| Same tool called >20 times in 60s by same key | Loop guard — blocked for 60 seconds, prevents runaway agent loops |
| All other tools | Execute immediately |

**An agent cannot circumvent these controls by modifying the npm package.**
The enforcement logic runs in the private backend, not in the client.

### Architecture

```
AI Agent
   │
   ▼
@hederatoolbox/platform (npm, thin client — zero business logic, only schemas + proxy)
   │  fetch() over HTTPS
   ▼
HederaToolbox Remote Brain (proprietary, not in npm package)
   │  consent gate → balance check → execute
   ▼
Hedera Mainnet
```

The npm package contains **zero business logic** — only tool schemas and an
HTTP proxy. The proprietary payment system and safety enforcement all live in
the remote server and are never shipped to npm.

### Consent & Legal Traceability

Every agent must call `get_terms` and `confirm_terms` before executing any
paid tool. Consent events are recorded server-side with:
- API key (Hedera account ID)
- Terms version accepted
- Timestamp
- IP address and user-agent (purged after 90 days)

This creates a legally meaningful audit trail of agent consent.

---

## For Humans: Reporting Vulnerabilities

**Do not open a public GitHub issue for security vulnerabilities.**

To report a security issue:
1. Go to the [GitHub Security Advisories](https://github.com/mountainmystic/hederatoolbox/security/advisories/new) page for this repo.
2. Submit a private advisory with full details.
3. You will receive a response within 72 hours.

### Scope

| In scope | Out of scope |
|---|---|
| Authentication bypass on the `/mcp` endpoint | npm package behaviour (it's a thin proxy) |
| Consent gate bypass | Hedera network-level issues |
| Balance manipulation | Third-party mirror node issues |
| Unauthorised access to admin endpoints | Social engineering |

### Responsible Disclosure

We follow a 90-day disclosure timeline. Critical vulnerabilities affecting
active user funds will be patched within 24 hours of confirmation.
