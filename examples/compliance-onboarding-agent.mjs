/**
 * compliance-onboarding-agent.mjs — HederaToolbox compliance onboarding agent
 *
 * Screens a Hedera account before doing business with them.
 * Runs identity resolution, sanctions screening, and KYC verification in sequence,
 * then writes a tamper-proof compliance record to the Hedera blockchain.
 *
 * Use cases: token issuers, exchanges, regulated businesses, any counterparty screening.
 *
 * Setup (one time):
 *   1. Send any amount of HBAR to the platform wallet: 0.0.10309126
 *      Your Hedera account ID becomes your API key automatically.
 *   2. Replace YOUR_HEDERA_ACCOUNT_ID below with your account ID.
 *   3. node examples/compliance-onboarding-agent.mjs
 *      Or: SUBJECT=0.0.999999 node examples/compliance-onboarding-agent.mjs
 *
 * Cost per onboarding: ~1.7 ℏ (identity_resolve + identity_check_sanctions + hcs_write_record)
 * Add identity_verify_kyc for an additional 0.5 ℏ if your token uses Hedera KYC keys.
 */

// ─── Config ───────────────────────────────────────────────────────────────────
const API_KEY        = process.env.HEDERA_ACCOUNT_ID || "YOUR_HEDERA_ACCOUNT_ID";
const SUBJECT_ID     = process.env.SUBJECT           || "0.0.7925398";  // account to screen
const KYC_TOKEN_ID   = process.env.KYC_TOKEN_ID      || null;           // optional: your token ID for KYC check
const ENDPOINT       = "https://api.hederatoolbox.com/mcp";
const HASHSCAN_BASE  = "https://hashscan.io/mainnet/transaction";
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

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function separator(char = "─", len = 62) {
  console.log(char.repeat(len));
}

// ─── Onboard (free) ───────────────────────────────────────────────────────────
async function onboard() {
  await callTool("get_terms", {});
  await callTool("confirm_terms", { consent: true });
  const info = await callTool("account_info", {});
  log(`Account: ${API_KEY} | Balance: ${info.balance_hbar} ℏ`);
  if (parseFloat(info.balance_hbar) < 2) {
    console.error(`\n❌ Insufficient balance: ${info.balance_hbar} ℏ (need ~2 ℏ)`);
    console.error(`   Top up: send HBAR to ${info.platform_wallet}\n`);
    process.exit(1);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n" + "=".repeat(62));
  console.log("  HederaToolbox — Compliance Onboarding Agent");
  console.log(`  Screening: ${SUBJECT_ID}`);
  if (KYC_TOKEN_ID) console.log(`  KYC token: ${KYC_TOKEN_ID}`);
  console.log("=".repeat(62) + "\n");

  await onboard();
  log("Onboarding complete. Starting compliance workflow...\n");

  // ── Step 1: Identity resolution ──────────────────────────────────────────
  log("Step 1/3 — Resolving identity (0.2 ℏ)...");
  const identity = await callTool("identity_resolve", { account_id: SUBJECT_ID });

  separator();
  console.log(" IDENTITY PROFILE");
  separator();
  console.log(` Account:       ${identity.account_id}`);
  console.log(` Age:           ${identity.account_age_days ?? "unknown"} days`);
  console.log(` HBAR balance:  ${identity.hbar_balance}`);
  console.log(` Tokens held:   ${identity.token_count}`);
  console.log(` NFTs held:     ${identity.nft_count}`);
  console.log(` Transactions:  ${identity.recent_transaction_count} (recent sample)`);
  console.log(` Summary:       ${identity.identity_summary}`);

  // ── Step 2: Sanctions screening ──────────────────────────────────────────
  log("\nStep 2/3 — Running sanctions screening (1.0 ℏ)...");
  const sanctions = await callTool("identity_check_sanctions", { account_id: SUBJECT_ID });

  separator();
  console.log(" SANCTIONS SCREENING");
  separator();
  console.log(` Result:        ${sanctions.screening_result}`);
  console.log(` Risk level:    ${sanctions.risk_level} (score: ${sanctions.risk_score}/100)`);
  console.log(` Risk signals:`);
  sanctions.risk_signals.forEach(s => console.log(`   • ${s}`));
  console.log(` Counterparties sampled: ${sanctions.account_profile.unique_counterparties}`);
  console.log(` Failed transactions:    ${sanctions.account_profile.failed_transactions}`);

  // ── Step 3: KYC check (optional) ─────────────────────────────────────────
  let kycResult = null;
  if (KYC_TOKEN_ID) {
    log("\nStep 3a — Verifying KYC status (0.5 ℏ)...");
    kycResult = await callTool("identity_verify_kyc", {
      account_id: SUBJECT_ID,
      token_id: KYC_TOKEN_ID,
    });
    separator();
    console.log(" KYC VERIFICATION");
    separator();
    console.log(` Token:   ${KYC_TOKEN_ID}`);
    console.log(` Status:  ${kycResult.kyc_details[0]?.kyc_status ?? "NOT_APPLICABLE"}`);
    console.log(` Note:    ${kycResult.note}`);
  }

  // ── Step 4: Write compliance record to HCS ───────────────────────────────
  const overallResult = sanctions.screening_result === "FLAGGED" ? "REJECTED"
    : sanctions.screening_result === "REVIEW"                    ? "PENDING_REVIEW"
    : kycResult && !kycResult.kyc_details[0]?.kyc_granted        ? "PENDING_KYC"
    : "APPROVED";

  log(`\nStep ${KYC_TOKEN_ID ? "4" : "3"}/3 — Writing compliance record to Hedera HCS (5 ℏ)...`);

  const record = await callTool("hcs_write_record", {
    record_type: "compliance_onboarding",
    entity_id: SUBJECT_ID,
    data: {
      subject_account: SUBJECT_ID,
      screened_by: API_KEY,
      onboarding_result: overallResult,
      identity_summary: identity.identity_summary,
      account_age_days: identity.account_age_days,
      sanctions_result: sanctions.screening_result,
      risk_level: sanctions.risk_level,
      risk_score: sanctions.risk_score,
      risk_signals: sanctions.risk_signals,
      kyc_checked: !!KYC_TOKEN_ID,
      kyc_token: KYC_TOKEN_ID || null,
      kyc_status: kycResult?.kyc_details[0]?.kyc_status || null,
      agent: "compliance-onboarding-agent",
    },
  });

  // ── Final report ─────────────────────────────────────────────────────────
  const resultColor = overallResult === "APPROVED" ? "✅" : overallResult === "REJECTED" ? "❌" : "⚠️ ";

  console.log("\n" + "=".repeat(62));
  console.log(`  ${resultColor} ONBOARDING RESULT: ${overallResult}`);
  console.log("=".repeat(62));
  console.log(` Subject:        ${SUBJECT_ID}`);
  console.log(` Identity:       ${identity.identity_summary}`);
  console.log(` Sanctions:      ${sanctions.screening_result} (${sanctions.risk_level} risk)`);
  if (KYC_TOKEN_ID) {
    console.log(` KYC:            ${kycResult?.kyc_details[0]?.kyc_status ?? "NOT_APPLICABLE"}`);
  }
  console.log(` HCS Record ID:  ${record.record_id}`);
  console.log(` Transaction ID: ${record.transaction_id}`);
  console.log(` On-chain proof: ${HASHSCAN_BASE}/${record.transaction_id}`);
  console.log(` Balance after:  ${record.payment?.remaining_hbar} ℏ`);
  console.log("=".repeat(62) + "\n");

  if (overallResult === "REJECTED") {
    console.log("  ⛔ Account flagged by sanctions screening. Do not proceed.");
  } else if (overallResult === "PENDING_REVIEW") {
    console.log("  ⚠️  Manual review required before onboarding.");
  } else if (overallResult === "PENDING_KYC") {
    console.log("  ℹ️  KYC not granted. Grant KYC before allowing token interactions.");
  } else {
    console.log("  ✅ Account cleared for onboarding.");
  }
  console.log();
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
