/**
 * whale-alert-agent.mjs — HederaToolbox autonomous whale monitoring agent
 *
 * Monitors a Hedera token for unusual whale concentration.
 * When an anomaly is detected, writes a tamper-proof alert to the Hedera
 * blockchain via HCS and prints the on-chain proof link.
 *
 * Setup (one time):
 *   1. Send any amount of HBAR to the platform wallet: 0.0.10309126
 *      Your Hedera account ID becomes your API key automatically.
 *   2. Replace YOUR_HEDERA_ACCOUNT_ID below with your account ID (e.g. "0.0.123456").
 *   3. Replace TOKEN_ID with the token you want to monitor.
 *   4. node examples/whale-alert-agent.mjs
 *
 * Cost per run: 0.2 ℏ (token_monitor) + 5 ℏ only when anomaly fires (hcs_write_record)
 * At hourly checks: ~4.8 ℏ/day baseline. 10 ℏ covers ~2 days of monitoring.
 */

// ─── Config ──────────────────────────────────────────────────────────────────
const API_KEY            = process.env.HEDERA_ACCOUNT_ID || "YOUR_HEDERA_ACCOUNT_ID";
const TOKEN_ID           = process.env.TOKEN_ID          || "0.0.731861";   // SAUCE by default
const THRESHOLD_PCT      = parseFloat(process.env.THRESHOLD_PCT     || "80");  // alert if top-10 holders > this %
const CHECK_INTERVAL_MS  = parseInt(process.env.CHECK_INTERVAL_MS   || "3600000"); // 1 hour default
const ENDPOINT           = "https://api.hederatoolbox.com/mcp";
const HASHSCAN_BASE      = "https://hashscan.io/mainnet/transaction";
// ─────────────────────────────────────────────────────────────────────────────

if (API_KEY === "YOUR_HEDERA_ACCOUNT_ID") {
  console.error("\n❌ Replace API_KEY with your Hedera account ID (e.g. \"0.0.123456\").");
  console.error("   Send any HBAR to 0.0.10309126 first — your account ID becomes your key.\n");
  process.exit(1);
}

// ─── MCP tool caller ─────────────────────────────────────────────────────────
async function callTool(toolName, args) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name: toolName, arguments: { ...args, api_key: API_KEY } },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} calling ${toolName}`);
  const json = await res.json();
  if (json.error) throw new Error(`${toolName}: ${json.error.message}`);

  const text = json.result?.content?.find(c => c.type === "text")?.text;
  if (!text) throw new Error(`No response body from ${toolName}`);
  return JSON.parse(text);
}

// ─── Logging ─────────────────────────────────────────────────────────────────
function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// ─── Onboard (free, runs once) ────────────────────────────────────────────────
async function onboard() {
  log("Checking terms and account balance...");

  await callTool("get_terms", {});
  await callTool("confirm_terms", { consent: true });

  const info = await callTool("account_info", {});
  log(`Account: ${API_KEY} | Balance: ${info.balance_hbar} ℏ`);

  if (parseFloat(info.balance_hbar) < 0.5) {
    console.error(`\n❌ Insufficient balance: ${info.balance_hbar} ℏ`);
    console.error(`   Top up by sending HBAR to: ${info.platform_wallet}\n`);
    process.exit(1);
  }

  return info;
}

// ─── Write on-chain HCS alert ─────────────────────────────────────────────────
async function writeAlert(symbol, concentration, signals) {
  log(`🚨 Writing HCS alert to Hedera blockchain (costs 5 ℏ)...`);

  return callTool("hcs_write_record", {
    record_type: "whale_alert",
    entity_id: TOKEN_ID,
    data: {
      token_id: TOKEN_ID,
      symbol,
      top_10_concentration_pct: concentration,
      threshold_pct: THRESHOLD_PCT,
      signals,
      agent: "whale-alert-agent",
    },
  });
}

// ─── Main monitoring cycle ────────────────────────────────────────────────────
async function runCycle(cycleNum) {
  log(`─── Cycle #${cycleNum} — monitoring ${TOKEN_ID} ───`);

  const monitor = await callTool("token_monitor", { token_id: TOKEN_ID });

  const symbol    = monitor.symbol || TOKEN_ID;
  const holders   = monitor.total_holders;
  const conc      = parseFloat(monitor.top_10_concentration);
  const signals   = monitor.activity_signals || [];
  const priceUsd  = monitor.current_price_usd ? `$${monitor.current_price_usd}` : "not listed";
  const remaining = monitor.payment?.remaining_hbar ?? "?";

  log(`${symbol} | holders: ${holders} | top-10: ${conc}% | price: ${priceUsd} | balance: ${remaining} ℏ`);
  log(`Signals: ${signals.join(" | ")}`);

  const anomalySignals = signals.filter(s => !s.includes("No unusual"));
  const isAnomaly = conc > THRESHOLD_PCT || anomalySignals.length > 0;

  if (isAnomaly) {
    const alert = await writeAlert(symbol, conc, signals);

    console.log("\n" + "=".repeat(62));
    console.log(` 🚨 WHALE ALERT — ${symbol} (${TOKEN_ID})`);
    console.log(` Top-10 concentration: ${conc}%  (threshold: ${THRESHOLD_PCT}%)`);
    if (anomalySignals.length > 0) {
      anomalySignals.forEach(s => console.log(`   ⚠  ${s}`));
    }
    console.log(` HCS Record ID:  ${alert.record_id}`);
    console.log(` Transaction ID: ${alert.transaction_id}`);
    console.log(` On-chain proof: ${HASHSCAN_BASE}/${alert.transaction_id}`);
    console.log(` Balance after:  ${alert.payment?.remaining_hbar} ℏ`);
    console.log("=".repeat(62) + "\n");
  } else {
    log(`✅ No anomaly detected. Next check in ${CHECK_INTERVAL_MS / 60000} min.`);
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────
async function main() {
  console.log("\n" + "=".repeat(62));
  console.log("  HederaToolbox — Autonomous Whale Alert Agent");
  console.log(`  Token:     ${TOKEN_ID}`);
  console.log(`  Threshold: top-10 holders > ${THRESHOLD_PCT}% triggers alert`);
  console.log(`  Interval:  every ${CHECK_INTERVAL_MS / 60000} minutes`);
  console.log(`  API key:   ${API_KEY}`);
  console.log("=".repeat(62) + "\n");

  await onboard();
  log("Onboarding complete. Starting monitor loop...\n");

  let cycleNum = 1;

  while (true) {
    try {
      await runCycle(cycleNum++);
    } catch (err) {
      log(`⚠  Cycle error: ${err.message} — retrying next interval`);
    }
    await new Promise(r => setTimeout(r, CHECK_INTERVAL_MS));
  }
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
