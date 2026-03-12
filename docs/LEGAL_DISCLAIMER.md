# Legal Disclaimer — HederaToolbox MCP Platform

**Plain-English Version** | Last updated: March 2026

---

## What This Service Does

HederaToolbox gives AI agents access to Hedera blockchain data — token prices,
governance proposals, identity checks, smart contract analysis, compliance
records, and more. You pay small amounts of HBAR per tool call. No registration
required.

---

## What We Are NOT Responsible For

### 1. Bad AI Decisions
If your AI agent reads our data and then hallucinates a bad trade, votes on
a proposal you didn't intend, or misinterprets our output — **that's not on
us**. We return raw blockchain data. What your agent does with it is entirely
your responsibility.

### 2. Stale or Incorrect Data
Blockchain mirror nodes sometimes lag. Token prices are snapshots. Holder
lists may not reflect the last few seconds of activity. **Do not make
time-critical financial decisions based solely on our data without independent
verification.**

### 3. Smart Contract Execution Failures
If you call `contract_call` and the transaction reverts on-chain, we have
already charged you for the query (we hit the network). **No refunds for
reverted transactions.**

### 4. Network Outages
Hedera mainnet and mirror nodes can go down. We provide no uptime SLA for
HBAR-credit users. Enterprise SLAs are available by separate agreement.

### 5. Regulatory Compliance
We provide data. You must comply with your local laws around financial data,
AML/KYC, sanctions screening, and anything else applicable in your
jurisdiction. **We are a data API, not a regulated financial institution.**

---

## Safety Controls

All controls are enforced server-side and cannot be bypassed by modifying
the npm package:

| Trigger | Behaviour |
|---|---|
| Any tool call | `confirm_terms` must have been accepted for current terms version |
| Any tool called >20 times in 60s by same key | Blocked for 60 seconds. Prevents runaway agent loops. |
| All other tools | Execute immediately |

---

## The Terms of Service Flow

Every AI agent must:

1. Call `get_terms` to retrieve the machine-readable TOS.
2. Call `confirm_terms` to record their acceptance.
3. Then — and only then — can they call paid tools.

This is a legally meaningful consent event recorded with a timestamp on our
servers. It protects both of us.

---

## Pricing Is in HBAR, Not USD

HBAR's USD value changes. When we say a tool costs "0.10 HBAR", that might
be roughly $0.01 USD today and something different next month. **You are
buying HBAR credits, not USD credits.** We make no guarantee about USD
purchasing power of your deposited HBAR.

---

## Maximum Liability

If something does go wrong and it's our fault, our maximum liability to you
is: the HBAR credits you consumed in the 30 days before the incident.
That's it. No consequential, incidental, or punitive damages.

---

## Questions

File an issue at:
https://github.com/mountainmystic/hederatoolbox/issues

For commercial licensing or enterprise SLAs, mention "Enterprise" in the
issue title and we'll respond within 2 business days.

---

*This plain-English disclaimer does not replace the full legal Terms of Service
at hederatoolbox.com/terms.html. In case of conflict, those terms govern.*
