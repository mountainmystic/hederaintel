/**
 * dao-monitor-agent.mjs — HederaToolbox DAO governance monitor
 *
 * Watches active governance proposals for a Hedera token on a schedule.
 * Alerts when a proposal is closing within 24 hours so you never miss a vote.
 * Optionally provide an HCS topic ID if your DAO records proposals on-chain.
 *
 * Use cases: DAO members, large HBAR holders, governance councils, anyone
 * who wants to stop missing votes and stay informed on proposal outcomes.
 *
 * Setup (one time):
 *   1. Send any amount of HBAR to the platform wallet: 0.0.10309126
 *      Your Hedera account ID becomes your API key automatically.
 *   2. Replace YOUR_HEDERA_ACCOUNT_ID below with your account ID.
 *   3. Replace TOKEN_ID with your DAO governance token.
 *   4. node examples/dao-monitor-agent.mjs
 *
 * Cost per check: 0.2 ℏ (governance_monitor)
 * At 4x/day: ~0.8 ℏ/day. 10 ℏ covers ~12 days of monitoring.
 */

// ─── Config ───────────────────────────────────────────────────────────────────
const API_KEY           = process.env.HEDERA_ACCOUNT_ID || "YOUR_HEDERA_ACCOUNT_ID";
const TOKEN_ID          = process.env.TOKEN_ID          || "0.0.731861";   // your DAO token
const TOPIC_ID          = process.env.TOPIC_ID          || null;            // optional HCS governance topic
const DEADLINE_ALERT_H  = parseInt(process.env.DEADLINE_ALERT_H || "24");   // alert if closing within N hours
const CHECK_INTERVAL_MS = parseInt(process.env.CHECK_INTERVAL_MS || "21600000"); // 6 hours default
const ENDPOINT          = "https://api.hederatoolbox.com/mcp";
// ─────────────────────────────────────────────────────────────────────────────

if (API_KEY === "YOUR_HEDERA_ACCOUNT_ID") {
  console.error("\n❌ Replace API_KEY with your Hedera account ID (e.g. \"0.0.123456\").");
  console.error("   Send any HBAR to 0.0.10309126 first — your account ID becomes your key.\n");
  process.exit(1);
}

// ─── MCP tool caller ──────────────────────────────────────────────────────────
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

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }
function sep(len = 62) { console.log("─".repeat(len)); }

// ─── Check if a deadline is closing soon ─────────────────────────────────────
function hoursUntil(deadlineStr) {
  if (!deadlineStr) return null;
  const deadline = new Date(deadlineStr);
  if (isNaN(deadline.getTime())) return null;
  return (deadline.getTime() - Date.now()) / (1000 * 60 * 60);
}

// ─── Onboard (free) ───────────────────────────────────────────────────────────
async function onboard() {
  await callTool("get_terms", {});
  await callTool("confirm_terms", { consent: true });
  const info = await callTool("account_info", {});
  log(`Account: ${API_KEY} | Balance: ${info.balance_hbar} ℏ`);
  if (parseFloat(info.balance_hbar) < 0.5) {
    console.error(`\n❌ Insufficient balance: ${info.balance_hbar} ℏ`);
    console.error(`   Top up: send HBAR to ${info.platform_wallet}\n`);
    process.exit(1);
  }
}

// ─── Monitoring cycle ─────────────────────────────────────────────────────────
async function runCycle(cycleNum) {
  log(`─── Cycle #${cycleNum} — checking governance for ${TOKEN_ID} ───`);

  const args = { token_id: TOKEN_ID };
  if (TOPIC_ID) args.topic_id = TOPIC_ID;

  const monitor = await callTool("governance_monitor", args);

  const remaining = monitor.payment?.remaining_hbar ?? "?";
  log(`${monitor.token_name} (${monitor.token_symbol}) | Active proposals: ${monitor.active_proposals} | Balance: ${remaining} ℏ`);
  log(`Summary: ${monitor.summary}`);

  const proposals = monitor.proposals || [];

  if (proposals.length === 0) {
    log(`✅ No active proposals found. Next check in ${CHECK_INTERVAL_MS / 3600000}h.`);
    return;
  }

  // Print all active proposals
  console.log();
  sep();
  console.log(` ACTIVE PROPOSALS — ${monitor.token_name}`);
  sep();

  const urgent = [];

  for (const p of proposals) {
    const hours = hoursUntil(p.deadline);
    const deadlineStr = p.deadline
      ? `${new Date(p.deadline).toUTCString()} (${hours !== null ? hours.toFixed(1) + "h remaining" : "deadline set"})`
      : "No deadline set";

    const totalVotes = (p.yes_votes || 0) + (p.no_votes || 0) + (p.abstain_votes || 0);
    const yesPct = totalVotes > 0 ? ((p.yes_votes / totalVotes) * 100).toFixed(0) : "—";
    const noPct  = totalVotes > 0 ? ((p.no_votes  / totalVotes) * 100).toFixed(0) : "—";

    console.log(`\n Proposal #${p.proposal_id}: ${p.title}`);
    console.log(`   Status:    ${p.status}`);
    console.log(`   Deadline:  ${deadlineStr}`);
    console.log(`   Votes:     ✅ Yes ${p.yes_votes} (${yesPct}%)  ❌ No ${p.no_votes} (${noPct}%)  Abstain ${p.abstain_votes || 0}`);

    if (hours !== null && hours > 0 && hours <= DEADLINE_ALERT_H) {
      urgent.push({ ...p, hours_remaining: hours });
    }
  }

  // Deadline alerts
  if (urgent.length > 0) {
    console.log("\n" + "=".repeat(62));
    console.log(`  ⏰ DEADLINE ALERT — ${urgent.length} proposal(s) closing soon`);
    console.log("=".repeat(62));
    for (const p of urgent) {
      console.log(`\n  ⚠️  "${p.title}" closes in ${p.hours_remaining.toFixed(1)} hours`);
      console.log(`     Proposal ID: ${p.proposal_id}`);
      console.log(`     Current: Yes ${p.yes_votes} / No ${p.no_votes} / Abstain ${p.abstain_votes || 0}`);
      if (TOPIC_ID) {
        console.log(`     Run governance_analyze for deeper insight:`);
        console.log(`     TOKEN_ID=${TOKEN_ID} TOPIC_ID=${TOPIC_ID} PROPOSAL_ID=${p.proposal_id} node examples/dao-monitor-agent.mjs --analyze`);
      }
    }
    console.log("\n" + "=".repeat(62) + "\n");
  } else {
    log(`✅ No proposals closing within ${DEADLINE_ALERT_H}h. Next check in ${CHECK_INTERVAL_MS / 3600000}h.`);
  }

  // ── Optional: deep analyze a specific proposal ────────────────────────────
  if (process.argv.includes("--analyze") && TOPIC_ID && process.env.PROPOSAL_ID) {
    log(`\nRunning governance_analyze on proposal ${process.env.PROPOSAL_ID} (1.0 ℏ)...`);
    const analysis = await callTool("governance_analyze", {
      token_id: TOKEN_ID,
      proposal_id: process.env.PROPOSAL_ID,
      topic_id: TOPIC_ID,
    });

    console.log("\n" + "=".repeat(62));
    console.log(" PROPOSAL DEEP ANALYSIS");
    console.log("=".repeat(62));
    console.log(` Proposal:          ${analysis.proposal?.title ?? analysis.proposal_id}`);
    console.log(` Yes:               ${analysis.vote_tally.yes} (${analysis.vote_tally.yes_pct})`);
    console.log(` No:                ${analysis.vote_tally.no} (${analysis.vote_tally.no_pct})`);
    console.log(` Total votes:       ${analysis.vote_tally.total}`);
    console.log(` Participation:     ${analysis.participation_rate}`);
    console.log(` Concentration:     ${analysis.token_concentration.top_5_holders_pct} held by top 5`);
    console.log(` Prediction:        ${analysis.outcome_prediction}`);
    console.log("=".repeat(62) + "\n");
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────
async function main() {
  console.log("\n" + "=".repeat(62));
  console.log("  HederaToolbox — DAO Governance Monitor");
  console.log(`  Token:     ${TOKEN_ID}`);
  if (TOPIC_ID) console.log(`  Topic:     ${TOPIC_ID}`);
  console.log(`  Alert:     proposals closing within ${DEADLINE_ALERT_H}h`);
  console.log(`  Interval:  every ${CHECK_INTERVAL_MS / 3600000}h`);
  console.log("=".repeat(62) + "\n");

  await onboard();
  log("Onboarding complete. Starting governance monitor...\n");

  let cycleNum = 1;

  while (true) {
    try {
      await runCycle(cycleNum++);
    } catch (err) {
      log(`⚠️  Cycle error: ${err.message} — retrying next interval`);
    }
    await new Promise(r => setTimeout(r, CHECK_INTERVAL_MS));
  }
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
