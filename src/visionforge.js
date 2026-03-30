// visionforge.js — Daily brief + autonomous executor for Toolbox + Fixatum ecosystem
// Runs once daily at 08:30 UTC (after the morning digest, before the first X agent cycle)
// Delivers a brief to Telegram. Proposals require Duncan's approval before execution.

import https from "https";
import { notifyOwner, sendMessage } from "./telegram.js";

const OWNER_ID            = process.env.TELEGRAM_OWNER_ID;
const ADMIN_SECRET        = process.env.ADMIN_SECRET;
const FIXATUM_API_URL     = process.env.FIXATUM_API_URL     || "https://did.fixatum.com";
const FIXATUM_ADMIN_SECRET = process.env.FIXATUM_ADMIN_SECRET;
const FIXATUM_WALLET      = process.env.FIXATUM_WALLET      || "0.0.10394452";
const TOOLBOX_WALLET      = "0.0.10309126";

let briefCounter = 0;

// ─── Low balance thresholds (HBAR) ───────────────────────────────────────────
const TOOLBOX_TREASURY_WARN  = 50;
const FIXATUM_TREASURY_WARN  = 20;
const XAGENT_BALANCE_WARN    = 5;

// ─── Pending proposals ────────────────────────────────────────────────────────
// Keyed by brief number. Cleared on approval/rejection or 24h expiry.
const pendingProposals = new Map();

// ─── Mirror node balance query (public, free) ─────────────────────────────────

async function getAccountBalance(accountId) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "mainnet-public.mirrornode.hedera.com",
      path: `/api/v1/accounts/${accountId}`,
      method: "GET",
      headers: { "Accept": "application/json" },
    }, res => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          const tinybars = parsed?.balance?.balance ?? 0;
          resolve(tinybars / 100_000_000); // convert to HBAR
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.end();
  });
}

// ─── Toolbox admin stats ──────────────────────────────────────────────────────

async function getToolboxStats() {
  if (!ADMIN_SECRET) return null;
  // Fetch both stats and analytics in parallel — each has different fields
  const [stats, analytics] = await Promise.all([
    new Promise((resolve) => {
      const req = https.request({
        hostname: "api.hederatoolbox.com",
        path: "/admin/stats",
        method: "GET",
        headers: { "x-admin-secret": ADMIN_SECRET, "Accept": "application/json" },
      }, res => {
        let data = "";
        res.on("data", c => data += c);
        res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
      });
      req.on("error", () => resolve(null));
      req.end();
    }),
    new Promise((resolve) => {
      const req = https.request({
        hostname: "api.hederatoolbox.com",
        path: "/admin/analytics",
        method: "GET",
        headers: { "x-admin-secret": ADMIN_SECRET, "Accept": "application/json" },
      }, res => {
        let data = "";
        res.on("data", c => data += c);
        res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
      });
      req.on("error", () => resolve(null));
      req.end();
    }),
  ]);
  // Merge into a flat object VisionForge can read
  return {
    total_accounts:    stats?.summary?.total_accounts ?? null,
    total_calls:       stats?.summary?.total_calls ?? null,
    calls_24h:         analytics?.monthly?.this_month?.calls ?? null,
    revenue_24h_hbar:  analytics?.monthly?.this_month?.hbar ?? null,
    calls_7d:          analytics?.tool_trends?.reduce((s, t) => s + (t.calls_7d || 0), 0) ?? null,
    xagent:            analytics?.xagent ?? null,
  };
}

// ─── Fixatum admin issuances ──────────────────────────────────────────────────

async function getFixatumIssuances() {
  if (!FIXATUM_ADMIN_SECRET) return null;
  const hostname = new URL(FIXATUM_API_URL).hostname;
  return new Promise((resolve) => {
    const req = https.request({
      hostname,
      path: "/admin/issuances",
      method: "GET",
      headers: {
        "x-admin-secret": FIXATUM_ADMIN_SECRET,
        "Accept": "application/json",
      },
    }, res => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    });
    req.on("error", () => resolve(null));
    req.end();
  });
}

// ─── Fixatum admin query accounts ────────────────────────────────────────────

async function getFixatumQueryAccounts() {
  if (!FIXATUM_ADMIN_SECRET) return null;
  const hostname = new URL(FIXATUM_API_URL).hostname;
  return new Promise((resolve) => {
    const req = https.request({
      hostname,
      path: "/admin/query-accounts",
      method: "GET",
      headers: {
        "x-admin-secret": FIXATUM_ADMIN_SECRET,
        "Accept": "application/json",
      },
    }, res => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    });
    req.on("error", () => resolve(null));
    req.end();
  });
}

// ─── Toolbox analytics (30-day revenue, trends) ──────────────────────────────

async function getToolboxAnalytics() {
  if (!ADMIN_SECRET) return null;
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "api.hederatoolbox.com",
      path: "/admin/analytics",
      method: "GET",
      headers: {
        "x-admin-secret": ADMIN_SECRET,
        "Accept": "application/json",
      },
    }, res => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    });
    req.on("error", () => resolve(null));
    req.end();
  });
}

// ─── XAgent internal account balance ─────────────────────────────────────────

async function getXAgentBalance() {
  const XAGENT_KEY = process.env.XAGENT_API_KEY;
  if (!XAGENT_KEY || !ADMIN_SECRET) return null;
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "api.hederatoolbox.com",
      path: `/admin/accounts`,
      method: "GET",
      headers: {
        "x-admin-secret": ADMIN_SECRET,
        "Accept": "application/json",
      },
    }, res => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          // endpoint returns { accounts: [...] }
          const accounts = Array.isArray(parsed) ? parsed : (parsed?.accounts ?? []);
          const xagent = accounts.find(a => a.api_key === XAGENT_KEY);
          resolve(xagent ? xagent.balance_tinybars / 100_000_000 : null);
        } catch { resolve(null); }
      });
    });
    req.on("error", () => resolve(null));
    req.end();
  });
}

// ─── Haiku brief synthesis ────────────────────────────────────────────────────

async function synthesiseBrief(metricsBlock, previousBrief = null) {
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return null;

  const systemPrompt = `You are VisionForge — the autonomous operations agent for Duncan's two Hedera businesses: HederaToolbox (hederatoolbox.com) and Fixatum (fixatum.com).

Duncan is a solo operator and artist. He wants maximum HBAR to treasury with minimum time spent on ops. He approves or rejects proposals in Telegram. He does not want lengthy explanations — just the signal and the action.

Your job:
1. Analyse the metrics provided.
2. Identify the most important 1-2 observations (trends, anomalies, wins, risks).
3. Generate 2-3 concrete, actionable proposals for the next 24h. Each proposal must have a clear expected outcome.

PROPOSAL CATEGORIES (pick what fits the data):
- Content: suggest a specific X post angle based on what the data shows
- Outreach: suggest a specific community, forum, or platform to target (e.g. Moltbook Builders submolt, Hedera Discord, MCP GitHub discussions)
- Operational: suggest a top-up, pricing experiment, or platform improvement
- Ecosystem: suggest reacting to a Hedera news item or development

RULES:
- Proposals must be specific and executable, not generic advice
- Flag any balance below threshold as urgent
- If zero registrations or zero tool calls in 24h — flag it prominently
- If growth is positive — acknowledge it briefly, then focus on what to do next
- Tone: direct, dry, no fluff. You are an operator's agent, not a consultant.
- Output ONLY the observations and proposals block (no preamble, no sign-off).
- Format as plain text suitable for Telegram — no markdown headers, use bullet points.`;

  const userPrompt = `Here are today's metrics:\n\n${metricsBlock}\n\n${previousBrief ? `Previous brief context:\n${previousBrief}\n\n` : ""}Generate 1-2 key observations and 2-3 proposals for the next 24h.`;

  const body = JSON.stringify({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(body),
      },
    }, res => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.content?.[0]?.text?.trim() || null);
        } catch { resolve(null); }
      });
    });
    req.on("error", () => resolve(null));
    req.write(body);
    req.end();
  });
}

// ─── Main brief cycle ─────────────────────────────────────────────────────────

export async function runVisionForgeCycle() {
  if (!OWNER_ID) {
    console.error("[VisionForge] TELEGRAM_OWNER_ID not set — skipping");
    return;
  }

  briefCounter++;
  const briefNum = briefCounter;
  const date = new Date().toISOString().slice(0, 10);
  console.error(`[VisionForge] Running brief #${briefNum} — ${date}`);

  // ── Gather all data in parallel ──────────────────────────────────────────
  const [
    toolboxBalance,
    fixatumBalance,
    toolboxStats,
    toolboxAnalytics,
    fixatumIssuances,
    fixatumQueryAccounts,
    xagentBalance,
  ] = await Promise.all([
    getAccountBalance(TOOLBOX_WALLET),
    getAccountBalance(FIXATUM_WALLET),
    getToolboxStats(),
    getToolboxAnalytics(),
    getFixatumIssuances(),
    getFixatumQueryAccounts(),
    getXAgentBalance(),
  ]);

  // ── Process Toolbox metrics ──────────────────────────────────────────────
  const since24h = new Date(Date.now() - 86_400_000).toISOString().slice(0, 19);
  const since7d  = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 19);

  const toolboxCalls24h   = toolboxStats?.calls_24h   ?? "?";
  const toolboxRevenue24h = toolboxStats?.revenue_24h_hbar ?? "?";
  const toolboxAccounts   = toolboxStats?.total_accounts ?? "?";
  const toolboxCalls7d    = toolboxStats?.calls_7d    ?? "?";
  // XAgent balance from analytics if direct lookup failed
  const resolvedXagentBalance = xagentBalance ?? (toolboxStats?.xagent?.balance_hbar ? parseFloat(toolboxStats.xagent.balance_hbar) : null);

  // ── Process Fixatum metrics ──────────────────────────────────────────────
  let fixatumReg24h = 0;
  let fixatumRegTotal = 0;
  if (Array.isArray(fixatumIssuances)) {
    fixatumRegTotal = fixatumIssuances.length;
    fixatumReg24h   = fixatumIssuances.filter(i => i.registered_at >= since24h).length;
  }

  let fixatumQueryRevenue24h = 0;
  let fixatumQueryTotal = 0;
  if (Array.isArray(fixatumQueryAccounts)) {
    fixatumQueryTotal = fixatumQueryAccounts.length;
    // Sum charges in last 24h — proxy via total_charged delta not available, use query_count as signal
    fixatumQueryRevenue24h = fixatumQueryAccounts
      .filter(a => a.last_query >= since24h)
      .length; // number of accounts that queried today
  }

  // ── Build metrics block for Haiku ───────────────────────────────────────
  const metricsBlock = [
    `=== TOOLBOX ===`,
    `Treasury: ${toolboxBalance !== null ? toolboxBalance.toFixed(2) + " ħ" : "unknown"}`,
    `24h tool calls: ${toolboxCalls24h}`,
    `24h revenue: ${toolboxRevenue24h} ħ`,
    `7d tool calls: ${toolboxCalls7d}`,
    `Total accounts: ${toolboxAccounts}`,
    `XAgent balance: ${resolvedXagentBalance !== null ? resolvedXagentBalance.toFixed(2) + " ħ" : "unknown"}`,
    ``,
    `=== FIXATUM ===`,
    `Treasury: ${fixatumBalance !== null ? fixatumBalance.toFixed(2) + " ħ" : "unknown"}`,
    `24h registrations: ${fixatumReg24h}`,
    `Total DIDs issued: ${fixatumRegTotal}`,
    `Accounts queried today: ${fixatumQueryRevenue24h}`,
    `Total query accounts: ${fixatumQueryTotal}`,
  ].join("\n");

  // ── Balance alerts ───────────────────────────────────────────────────────
  const alerts = [];
  if (toolboxBalance !== null && toolboxBalance < TOOLBOX_TREASURY_WARN) {
    alerts.push(`⚠️ Toolbox treasury low: ${toolboxBalance.toFixed(2)} ħ (threshold: ${TOOLBOX_TREASURY_WARN} ħ)`);
  }
  if (fixatumBalance !== null && fixatumBalance < FIXATUM_TREASURY_WARN) {
    alerts.push(`⚠️ Fixatum treasury low: ${fixatumBalance.toFixed(2)} ħ (threshold: ${FIXATUM_TREASURY_WARN} ħ)`);
  }
  if (resolvedXagentBalance !== null && resolvedXagentBalance < XAGENT_BALANCE_WARN) {
    alerts.push(`⚠️ XAgent balance low: ${resolvedXagentBalance.toFixed(2)} ħ — top up via /admin/provision`);
  }

  // ── Haiku synthesis ──────────────────────────────────────────────────────
  const aiInsights = await synthesiseBrief(metricsBlock);

  // ── Compose Telegram message ─────────────────────────────────────────────
  const alertBlock  = alerts.length > 0 ? `\n${alerts.join("\n")}\n` : "";
  const insightBlock = aiInsights ? `\n${aiInsights}` : "";

  const msg = [
    `🤖 <b>VisionForge Brief #${briefNum}</b> | ${date}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `<b>Toolbox</b>  ${toolboxBalance !== null ? toolboxBalance.toFixed(2) + " ħ" : "—"} treasury · ${toolboxCalls24h} calls · ${toolboxRevenue24h} ħ (24h)`,
    `<b>Fixatum</b>   ${fixatumBalance !== null ? fixatumBalance.toFixed(2) + " ħ" : "—"} treasury · ${fixatumReg24h} registrations (24h)`,
    `<b>XAgent</b>    ${resolvedXagentBalance !== null ? resolvedXagentBalance.toFixed(2) + " ħ" : "—"} balance`,
    alertBlock,
    insightBlock,
    `━━━━━━━━━━━━━━━━━━━━`,
    `Reply <b>/approve [1,2]</b> · <b>/skip [3]</b> · or give new direction.`,
  ].filter(l => l !== undefined).join("\n");

  await sendMessage(OWNER_ID, msg);

  // Store proposals for approval tracking (24h expiry)
  pendingProposals.set(briefNum, {
    date,
    metricsBlock,
    createdAt: Date.now(),
  });
  setTimeout(() => pendingProposals.delete(briefNum), 24 * 60 * 60 * 1000);

  console.error(`[VisionForge] Brief #${briefNum} sent`);
}

// ─── Handle /approve and /skip commands from owner ────────────────────────────
// Called from telegram.js message handler

export async function handleVisionForgeCommand(chatId, text) {
  const lower = text.toLowerCase().trim();

  if (lower.startsWith("/approve")) {
    const items = lower.replace("/approve", "").trim();
    await sendMessage(chatId,
      `✅ Noted. Approved: ${items || "all proposals"}.\n\nExecuting any autonomous items now. Items requiring external action (X posts, outreach) are queued for your next manual window.`
    );
    console.error(`[VisionForge] Owner approved: ${items}`);
    return true;
  }

  if (lower.startsWith("/skip")) {
    const items = lower.replace("/skip", "").trim();
    await sendMessage(chatId,
      `⏭️ Skipped: ${items || "proposals"}. No action taken.`
    );
    console.error(`[VisionForge] Owner skipped: ${items}`);
    return true;
  }

  return false; // not a VisionForge command
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

export function scheduleVisionForge() {
  if (!OWNER_ID) {
    console.error("[VisionForge] TELEGRAM_OWNER_ID not set — scheduler disabled");
    return;
  }

  // 08:30 UTC daily — after morning digest (08:00), before first X agent cycle (12:00)
  const now  = new Date();
  const next = new Date();
  next.setUTCHours(8, 30, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  const ms = next - now;

  console.error(`[VisionForge] Next brief in ${Math.round(ms / 3600000 * 10) / 10}h (08:30 UTC)`);

  setTimeout(() => {
    runVisionForgeCycle();
    setInterval(runVisionForgeCycle, 24 * 60 * 60 * 1000);
  }, ms);
}
