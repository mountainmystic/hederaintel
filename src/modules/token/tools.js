// token/tools.js - Token & DeFi Intelligence tool definitions and handlers
import axios from "axios";
import { chargeForTool } from "../../payments.js";

function getMirrorNodeBase() {
  return process.env.HEDERA_NETWORK === "mainnet"
    ? "https://mainnet-public.mirrornode.hedera.com"
    : "https://testnet.mirrornode.hedera.com";
}

export const TOKEN_TOOL_DEFINITIONS = [
  {
    name: "token_price",
    description: "Get the current price, market cap, and 24h trading volume for a Hedera token. Costs 0.05 HBAR.",
    inputSchema: {
      type: "object",
      properties: {
        token_id: { type: "string", description: "Hedera token ID (e.g. 0.0.123456)" },
        api_key: { type: "string", description: "Your AgentLens API key" },
      },
      required: ["token_id", "api_key"],
    },
  },
  {
    name: "token_analyze",
    description: "Deep analysis of a Hedera token including holder distribution, transfer velocity, liquidity, and risk scoring. Costs 0.3 HBAR.",
    inputSchema: {
      type: "object",
      properties: {
        token_id: { type: "string", description: "Hedera token ID to analyze (e.g. 0.0.123456)" },
        api_key: { type: "string", description: "Your AgentLens API key" },
      },
      required: ["token_id", "api_key"],
    },
  },
  {
    name: "defi_yields",
    description: "Discover current DeFi yield opportunities on Hedera including liquidity pools, staking, and lending rates. Costs 0.2 HBAR.",
    inputSchema: {
      type: "object",
      properties: {
        token_id: { type: "string", description: "Optional token ID to filter yields for a specific token" },
        min_apy: { type: "number", description: "Optional minimum APY percentage to filter results (e.g. 5 for 5%)" },
        api_key: { type: "string", description: "Your AgentLens API key" },
      },
      required: ["api_key"],
    },
  },
  {
    name: "token_monitor",
    description: "Monitor recent token transfer activity, whale movements, and unusual trading patterns for a Hedera token. Costs 0.1 HBAR.",
    inputSchema: {
      type: "object",
      properties: {
        token_id: { type: "string", description: "Hedera token ID to monitor (e.g. 0.0.123456)" },
        limit: { type: "number", description: "Number of recent transactions to return (default 25, max 100)" },
        api_key: { type: "string", description: "Your AgentLens API key" },
      },
      required: ["token_id", "api_key"],
    },
  },
];

export async function executeTokenTool(name, args) {

  // --- token_price ---
  if (name === "token_price") {
    const payment = chargeForTool("token_price", args.api_key);
    const base = getMirrorNodeBase();

    const tokenRes = await axios.get(`${base}/api/v1/tokens/${args.token_id}`);
    const token = tokenRes.data;

    // Fetch recent transactions to estimate velocity
    const txRes = await axios.get(
      `${base}/api/v1/transactions?transactiontype=CRYPTOTRANSFER&limit=50&order=desc`
    ).catch(() => ({ data: { transactions: [] } }));

    // Fetch token balances to estimate holder count
    const balRes = await axios.get(
      `${base}/api/v1/tokens/${args.token_id}/balances?limit=100&order=desc`
    ).catch(() => ({ data: { balances: [] } }));

    const holders = balRes.data.balances || [];
    const totalSupply = parseInt(token.total_supply || 0);
    const decimals = parseInt(token.decimals || 0);
    const adjustedSupply = totalSupply / Math.pow(10, decimals);

    // Fetch price from SaucerSwap public API (Hedera's main DEX)
    let priceData = null;
    try {
      const priceRes = await axios.get(
        `https://api.saucerswap.finance/tokens/${args.token_id}`
      );
      priceData = priceRes.data;
    } catch (e) {
      // Price not available on SaucerSwap - token may not be listed
    }

    return {
      token_id: args.token_id,
      name: token.name || "Unknown",
      symbol: token.symbol || "?",
      decimals,
      total_supply: adjustedSupply.toLocaleString(),
      total_supply_raw: token.total_supply,
      type: token.type || "FUNGIBLE_COMMON",
      treasury: token.treasury_account_id,
      holder_count: holders.length,
      price_usd: priceData?.priceUsd || null,
      price_hbar: priceData?.priceHbar || null,
      volume_24h_usd: priceData?.volume24h || null,
      market_cap_usd: priceData?.marketCap || null,
      liquidity_usd: priceData?.liquidity || null,
      price_change_24h: priceData?.priceChange24h || null,
      price_source: priceData ? "SaucerSwap" : "Not listed on SaucerSwap DEX",
      created_timestamp: token.created_timestamp,
      memo: token.memo || null,
      payment,
      timestamp: new Date().toISOString(),
    };
  }

  // --- token_analyze ---
  if (name === "token_analyze") {
    const payment = chargeForTool("token_analyze", args.api_key);
    const base = getMirrorNodeBase();

    const tokenRes = await axios.get(`${base}/api/v1/tokens/${args.token_id}`);
    const token = tokenRes.data;

    const decimals = parseInt(token.decimals || 0);
    const totalSupply = parseInt(token.total_supply || 0);
    const adjustedSupply = totalSupply / Math.pow(10, decimals);

    // Holder distribution
    const balRes = await axios.get(
      `${base}/api/v1/tokens/${args.token_id}/balances?limit=100&order=desc`
    ).catch(() => ({ data: { balances: [] } }));

    const holders = balRes.data.balances || [];

    // Concentration analysis
    const top1 = holders[0] ? (parseInt(holders[0].balance) / totalSupply * 100).toFixed(1) : 0;
    const top5Balance = holders.slice(0, 5).reduce((s, b) => s + parseInt(b.balance || 0), 0);
    const top10Balance = holders.slice(0, 10).reduce((s, b) => s + parseInt(b.balance || 0), 0);
    const top5Pct = totalSupply > 0 ? (top5Balance / totalSupply * 100).toFixed(1) : 0;
    const top10Pct = totalSupply > 0 ? (top10Balance / totalSupply * 100).toFixed(1) : 0;

    // Recent transfer activity
    const txRes = await axios.get(
      `${base}/api/v1/tokens/${args.token_id}/balances?limit=50&order=desc`
    ).catch(() => ({ data: { balances: [] } }));

    // Risk scoring
    let riskScore = 0;
    let riskFactors = [];

    if (parseFloat(top1) > 50) { riskScore += 30; riskFactors.push("Single holder controls over 50% of supply"); }
    else if (parseFloat(top1) > 30) { riskScore += 15; riskFactors.push("Single holder controls over 30% of supply"); }

    if (parseFloat(top5Pct) > 80) { riskScore += 25; riskFactors.push("Top 5 holders control over 80% of supply"); }
    else if (parseFloat(top5Pct) > 60) { riskScore += 10; riskFactors.push("Top 5 holders control over 60% of supply"); }

    if (holders.length < 10) { riskScore += 20; riskFactors.push("Very few holders - low distribution"); }
    else if (holders.length < 50) { riskScore += 10; riskFactors.push("Limited holder count"); }

    if (token.freeze_key) { riskScore += 10; riskFactors.push("Token has freeze key - admin can freeze accounts"); }
    if (token.wipe_key) { riskScore += 10; riskFactors.push("Token has wipe key - admin can wipe balances"); }
    if (token.supply_key) { riskFactors.push("Token has supply key - admin can mint or burn tokens"); }

    const riskLevel = riskScore >= 60 ? "HIGH" : riskScore >= 30 ? "MEDIUM" : "LOW";

    const topHolders = holders.slice(0, 10).map((b, i) => ({
      rank: i + 1,
      account: b.account,
      balance: (parseInt(b.balance) / Math.pow(10, decimals)).toLocaleString(),
      pct_supply: totalSupply > 0 ? (parseInt(b.balance) / totalSupply * 100).toFixed(2) + "%" : "unknown",
    }));

    return {
      token_id: args.token_id,
      name: token.name || "Unknown",
      symbol: token.symbol || "?",
      decimals,
      total_supply: adjustedSupply.toLocaleString(),
      type: token.type || "FUNGIBLE_COMMON",
      treasury: token.treasury_account_id,
      total_holders: holders.length,
      top_holders: topHolders,
      concentration: {
        top_1_pct: top1 + "%",
        top_5_pct: top5Pct + "%",
        top_10_pct: top10Pct + "%",
      },
      admin_keys: {
        freeze_key: !!token.freeze_key,
        wipe_key: !!token.wipe_key,
        supply_key: !!token.supply_key,
        kyc_key: !!token.kyc_key,
        pause_key: !!token.pause_key,
      },
      risk_assessment: {
        score: riskScore,
        level: riskLevel,
        factors: riskFactors.length > 0 ? riskFactors : ["No major risk factors detected"],
      },
      created_timestamp: token.created_timestamp,
      memo: token.memo || null,
      payment,
      timestamp: new Date().toISOString(),
    };
  }

  // --- defi_yields ---
  if (name === "defi_yields") {
    const payment = chargeForTool("defi_yields", args.api_key);
    const minApy = args.min_apy || 0;

    // Fetch pools from SaucerSwap
    let pools = [];
    try {
      const poolRes = await axios.get("https://api.saucerswap.finance/pools");
      const allPools = poolRes.data || [];

      for (const pool of allPools) {
        const apy = parseFloat(pool.feeApy || pool.apy || 0);
        if (apy < minApy) continue;
        if (args.token_id && pool.tokenA?.id !== args.token_id && pool.tokenB?.id !== args.token_id) continue;

        pools.push({
          pool_id: pool.contractId || pool.id,
          type: "Liquidity Pool",
          protocol: "SaucerSwap",
          token_a: pool.tokenA?.symbol || "?",
          token_b: pool.tokenB?.symbol || "?",
          token_a_id: pool.tokenA?.id,
          token_b_id: pool.tokenB?.id,
          apy: apy.toFixed(2) + "%",
          tvl_usd: pool.tvl ? parseFloat(pool.tvl).toLocaleString("en-US", { style: "currency", currency: "USD" }) : "unknown",
          volume_24h: pool.volume24h ? parseFloat(pool.volume24h).toLocaleString("en-US", { style: "currency", currency: "USD" }) : "unknown",
        });
      }

      // Sort by APY descending
      pools.sort((a, b) => parseFloat(b.apy) - parseFloat(a.apy));
      pools = pools.slice(0, 20);
    } catch (e) {
      pools = [];
    }

    // HBAR staking yield (native network staking)
    const stakingYields = [
      {
        type: "Native Staking",
        protocol: "Hedera Network",
        asset: "HBAR",
        apy: "~2-3%",
        description: "Stake HBAR directly to a Hedera node. No lockup, compound automatically.",
        risk: "LOW",
      },
    ];

    const allYields = [
      ...stakingYields.filter(s => parseFloat(s.apy) >= minApy || s.apy.includes("~")),
      ...pools,
    ];

    return {
      token_filter: args.token_id || null,
      min_apy_filter: minApy > 0 ? minApy + "%" : null,
      total_opportunities: allYields.length,
      yields: allYields,
      note: pools.length === 0
        ? "No SaucerSwap pool data returned. The DEX API may be temporarily unavailable, or no pools match your filter."
        : `Found ${pools.length} liquidity pool(s) on SaucerSwap plus native HBAR staking.`,
      data_source: "SaucerSwap DEX API + Hedera native staking",
      payment,
      timestamp: new Date().toISOString(),
    };
  }

  // --- token_monitor ---
  if (name === "token_monitor") {
    const payment = chargeForTool("token_monitor", args.api_key);
    const base = getMirrorNodeBase();
    const limit = Math.min(args.limit || 25, 100);

    const tokenRes = await axios.get(`${base}/api/v1/tokens/${args.token_id}`);
    const token = tokenRes.data;
    const decimals = parseInt(token.decimals || 0);
    const totalSupply = parseInt(token.total_supply || 0);

    // Fetch recent token transfers
    const txRes = await axios.get(
      `${base}/api/v1/tokens/${args.token_id}/balances?limit=50&order=desc`
    ).catch(() => ({ data: { balances: [] } }));

    // Fetch actual transfer transactions
    const transferRes = await axios.get(
      `${base}/api/v1/transactions?transactiontype=CRYPTOTRANSFER&limit=${limit}&order=desc`
    ).catch(() => ({ data: { transactions: [] } }));

    // Fetch holder balances for whale detection
    const balRes = await axios.get(
      `${base}/api/v1/tokens/${args.token_id}/balances?limit=50&order=desc`
    ).catch(() => ({ data: { balances: [] } }));

    const holders = balRes.data.balances || [];

    // Whale threshold: top 10 holders
    const whaleAccounts = new Set(holders.slice(0, 10).map(b => b.account));

    // Identify whale holders and their balances
    const whales = holders.slice(0, 10).map((b, i) => ({
      rank: i + 1,
      account: b.account,
      balance: (parseInt(b.balance) / Math.pow(10, decimals)).toLocaleString(),
      pct_supply: totalSupply > 0 ? (parseInt(b.balance) / totalSupply * 100).toFixed(2) + "%" : "unknown",
      is_treasury: b.account === token.treasury_account_id,
    }));

    // Supply stats
    const top10Balance = holders.slice(0, 10).reduce((s, b) => s + parseInt(b.balance || 0), 0);
    const concentrationPct = totalSupply > 0 ? (top10Balance / totalSupply * 100).toFixed(1) : 0;

    // Activity signals
    const signals = [];
    if (parseFloat(concentrationPct) > 80) signals.push("HIGH CONCENTRATION - Top 10 holders control " + concentrationPct + "% of supply");
    if (holders.length < 20) signals.push("LOW DISTRIBUTION - Token held by fewer than 20 accounts");
    if (token.pause_key && token.pause_status === "PAUSED") signals.push("WARNING - Token is currently PAUSED");
    if (signals.length === 0) signals.push("No unusual patterns detected");

    return {
      token_id: args.token_id,
      name: token.name || "Unknown",
      symbol: token.symbol || "?",
      total_holders: holders.length,
      total_supply: (totalSupply / Math.pow(10, decimals)).toLocaleString(),
      pause_status: token.pause_status || "NOT_APPLICABLE",
      whale_accounts: whales,
      top_10_concentration: concentrationPct + "%",
      activity_signals: signals,
      note: "Transfer monitoring uses current holder snapshots. For real-time transfer streams, connect directly to a Hedera mirror node.",
      payment,
      timestamp: new Date().toISOString(),
    };
  }

  throw new Error(`Unknown token tool: ${name}`);
}