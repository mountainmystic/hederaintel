// bridge/tools.js - Cross-Network Bridge Intelligence tool definitions and handlers
import axios from "axios";
import { chargeForTool } from "../../payments.js";

function getMirrorNodeBase() {
  return process.env.HEDERA_NETWORK === "mainnet"
    ? "https://mainnet-public.mirrornode.hedera.com"
    : "https://testnet.mirrornode.hedera.com";
}

// Known bridge contracts and accounts on Hedera mainnet
const KNOWN_BRIDGES = {
  "0.0.1117100": { name: "HashPort Bridge", network: "Ethereum", type: "lock-and-mint" },
  "0.0.1117101": { name: "HashPort Bridge", network: "Polygon", type: "lock-and-mint" },
  "0.0.1456985": { name: "WHBAR Contract", network: "Hedera EVM", type: "wrap" },
};

// Known wrapped/bridged tokens on Hedera
const BRIDGED_TOKENS = {
  "0.0.1460200": { name: "HBARX", source: "Stader", type: "liquid-staking" },
  "0.0.731861":  { name: "SAUCE", source: "SaucerSwap", type: "native" },
  "0.0.1456986": { name: "WHBAR", source: "SaucerSwap", type: "wrapped-native" },
  "0.0.541564":  { name: "WETH[hts]", source: "HashPort", type: "bridged", origin_network: "Ethereum" },
  "0.0.1055483": { name: "USDC[hts]", source: "HashPort", type: "bridged", origin_network: "Ethereum" },
  "0.0.1117481": { name: "WBTC[hts]", source: "HashPort", type: "bridged", origin_network: "Ethereum" },
};

export const BRIDGE_TOOL_DEFINITIONS = [
  {
    name: "bridge_status",
    description: "Get the current status of Hedera bridge infrastructure including known bridge contracts, wrapped token registry, and bridge health indicators. Costs 0.1 HBAR.",
    inputSchema: {
      type: "object",
      properties: {
        bridge_id: { type: "string", description: "Optional specific bridge contract ID or token ID to check status for" },
        api_key: { type: "string", description: "Your AgentLens API key" },
      },
      required: ["api_key"],
    },
  },
  {
    name: "bridge_transfers",
    description: "Monitor recent bridge transfer activity for a specific bridged token or bridge contract on Hedera. Returns transfer volume, frequency, and counterparty analysis. Costs 0.2 HBAR.",
    inputSchema: {
      type: "object",
      properties: {
        token_id: { type: "string", description: "Hedera token ID of a bridged asset to monitor (e.g. USDC, WETH)" },
        limit: { type: "number", description: "Number of recent transfers to analyze (default 50, max 100)" },
        api_key: { type: "string", description: "Your AgentLens API key" },
      },
      required: ["token_id", "api_key"],
    },
  },
  {
    name: "bridge_analyze",
    description: "Deep analysis of cross-network bridge activity for a token including peg stability, mint/burn ratio, custodian concentration, and bridge risk assessment. Costs 0.5 HBAR.",
    inputSchema: {
      type: "object",
      properties: {
        token_id: { type: "string", description: "Hedera token ID of a bridged asset to analyze" },
        api_key: { type: "string", description: "Your AgentLens API key" },
      },
      required: ["token_id", "api_key"],
    },
  },
];

export async function executeBridgeTool(name, args) {

  // --- bridge_status ---
  if (name === "bridge_status") {
    const payment = chargeForTool("bridge_status", args.api_key);
    const base = getMirrorNodeBase();

    // If specific bridge/token ID provided, fetch its status
    let specificStatus = null;
    if (args.bridge_id) {
      const knownBridge = KNOWN_BRIDGES[args.bridge_id];
      const knownToken = BRIDGED_TOKENS[args.bridge_id];
      if (knownBridge || knownToken) {
        const infoRes = await axios.get(`${base}/api/v1/tokens/${args.bridge_id}`)
          .catch(() => axios.get(`${base}/api/v1/contracts/${args.bridge_id}`))
          .catch(() => ({ data: null }));
        specificStatus = {
          id: args.bridge_id,
          known_bridge: knownBridge || null,
          known_token: knownToken || null,
          on_chain_info: infoRes.data,
        };
      }
    }

    // Check health of all tracked bridged tokens
    const tokenChecks = await Promise.all(
      Object.entries(BRIDGED_TOKENS).map(async ([id, info]) => {
        try {
          const res = await axios.get(`${base}/api/v1/tokens/${id}`);
          const token = res.data;
          const decimals = parseInt(token.decimals || 0);
          const supply = parseInt(token.total_supply || 0);
          return {
            token_id: id,
            name: info.name,
            type: info.type,
            source: info.source,
            origin_network: info.origin_network || "Hedera-native",
            total_supply: supply,
            decimals,
            supply_formatted: (supply / Math.pow(10, decimals)).toLocaleString(),
            treasury: token.treasury_account_id,
            pause_status: token.pause_status || "NOT_APPLICABLE",
            status: token.deleted ? "DELETED" : "ACTIVE",
          };
        } catch (e) {
          return {
            token_id: id,
            name: info.name,
            type: info.type,
            source: info.source,
            status: "UNAVAILABLE",
            error: e.message,
          };
        }
      })
    );

    const activeTokens = tokenChecks.filter(t => t.status === "ACTIVE").length;
    const totalTokens = tokenChecks.length;

    return {
      bridge_ecosystem_health: activeTokens === totalTokens ? "HEALTHY" : activeTokens > totalTokens / 2 ? "DEGRADED" : "UNHEALTHY",
      active_bridged_tokens: activeTokens,
      total_tracked_tokens: totalTokens,
      known_bridge_contracts: Object.entries(KNOWN_BRIDGES).map(([id, info]) => ({
        contract_id: id,
        ...info,
      })),
      bridged_token_registry: tokenChecks,
      specific_query: specificStatus,
      note: "Bridge data is derived from on-chain Hedera mirror node data and a curated registry of known bridge contracts and wrapped tokens.",
      payment,
      timestamp: new Date().toISOString(),
    };
  }

  // --- bridge_transfers ---
  if (name === "bridge_transfers") {
    const payment = chargeForTool("bridge_transfers", args.api_key);
    const base = getMirrorNodeBase();
    const limit = Math.min(args.limit || 50, 100);

    // Fetch token info
    const tokenRes = await axios.get(`${base}/api/v1/tokens/${args.token_id}`);
    const token = tokenRes.data;
    const decimals = parseInt(token.decimals || 0);
    const formatAmount = (raw) => (Math.abs(raw) / Math.pow(10, decimals)).toFixed(decimals);

    // Fetch recent CRYPTOTRANSFER transactions and extract token_transfers for this token
    const txRes = await axios.get(
      `${base}/api/v1/transactions?limit=${limit}&order=desc&transactiontype=CRYPTOTRANSFER`
    ).catch(() => ({ data: { transactions: [] } }));
    const allTxs = txRes.data.transactions || [];

    const transfers = allTxs.flatMap(tx =>
      (tx.token_transfers || [])
        .filter(tt => tt.token_id === args.token_id)
        .map(tt => ({
          consensus_timestamp: tx.consensus_timestamp,
          account: tt.account,
          amount: tt.amount,
          is_approval: tt.is_approval || false,
        }))
    );

    // Aggregate stats
    const senders = {};
    const receivers = {};
    let totalVolume = 0;

    for (const t of transfers) {
      const amount = Math.abs(t.amount || 0);
      totalVolume += amount;
      if (t.amount > 0) {
        receivers[t.account] = (receivers[t.account] || 0) + amount;
      } else {
        senders[t.account] = (senders[t.account] || 0) + amount;
      }
    }

    const topSenders = Object.entries(senders)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([account, amount]) => ({
        account,
        volume_formatted: formatAmount(amount) + " " + token.symbol,
      }));

    const topReceivers = Object.entries(receivers)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([account, amount]) => ({
        account,
        volume_formatted: formatAmount(amount) + " " + token.symbol,
      }));

    // Time range
    const timestamps = transfers.map(t => parseFloat(t.consensus_