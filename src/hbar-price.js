// hbar-price.js - Cached HBAR/USD price fetched from SaucerSwap
// Refreshes every 5 minutes. Used by account_info to show real-time USD costs.

import axios from "axios";

const SAUCERSWAP_TOKENS_URL = "https://api.saucerswap.finance/tokens";
const HBAR_TOKEN_ID = "0.0.0"; // HBAR native listing on SaucerSwap
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cachedPrice = null;
let cachedAt = null;

export async function getHbarPriceUsd() {
  const now = Date.now();

  // Return cached value if still fresh
  if (cachedPrice !== null && cachedAt && (now - cachedAt) < CACHE_TTL_MS) {
    return cachedPrice;
  }

  try {
    const headers = process.env.SAUCERSWAP_API_KEY
      ? { "x-api-key": process.env.SAUCERSWAP_API_KEY }
      : {};

    const res = await axios.get(SAUCERSWAP_TOKENS_URL, { headers, timeout: 5000 });
    const tokens = res.data || [];

    // HBAR is listed as the native token — find by id "0.0.0" or symbol "HBAR"
    const hbar = tokens.find(t => t.id === "0.0.0" || t.symbol === "HBAR");
    if (hbar && hbar.priceUsd) {
      cachedPrice = parseFloat(hbar.priceUsd);
      cachedAt = now;
      return cachedPrice;
    }

    // Fallback: derive from a known stable pair if direct listing not found
    // Use USDC (0.0.456858) price in HBAR to back-calculate
    const usdc = tokens.find(t => t.symbol === "USDC" || t.id === "0.0.456858");
    if (usdc && usdc.priceUsd && usdc.price) {
      // priceUsd = USDC price in USD (~1.0), price = USDC price in HBAR
      // So 1 HBAR = priceUsd / price
      cachedPrice = parseFloat(usdc.priceUsd) / parseFloat(usdc.price);
      cachedAt = now;
      return cachedPrice;
    }
  } catch (err) {
    console.error("[hbar-price] Failed to fetch HBAR price:", err.message);
  }

  // Return last cached value if fetch failed, otherwise null
  return cachedPrice || null;
}

// Format USD cost string from HBAR amount
export function formatUsdCost(hbarAmount, hbarPriceUsd) {
  if (!hbarPriceUsd || hbarAmount === 0) return "free";
  const usd = parseFloat(hbarAmount) * hbarPriceUsd;
  if (usd < 0.001) return `~$${usd.toFixed(4)}`;
  if (usd < 0.01)  return `~$${usd.toFixed(3)}`;
  return `~$${usd.toFixed(2)}`;
}
