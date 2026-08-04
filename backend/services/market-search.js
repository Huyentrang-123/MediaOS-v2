'use strict';

const tiktok               = require('../connectors/tiktok');
const douyin               = require('../connectors/douyin');
const { queriesForMarket } = require('./query-expansion');
const viralScore           = require('./viral-score');
const config               = require('../config');

/*
 * Per-market routing table.
 * region=null means the connector handles globally (no region param).
 */
const MARKET_CONFIG = {
  global: { connector: tiktok, region: 'global' },
  vn:     { connector: tiktok, region: 'vn' },
  kr:     { connector: tiktok, region: 'kr' },
  tw:     { connector: tiktok, region: 'tw' },
  cn:     { connector: douyin, region: null },
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isStreamError(err) {
  if (!err) return false;
  if (err.name === 'SocketError')                   return true;
  if (err.cause?.code === 'UND_ERR_SOCKET')         return true;
  if (err.message?.includes('terminated'))          return true;
  if (err.message?.includes('other side closed'))   return true;
  if (err.message?.includes('premature close'))     return true;
  if (/^(TikHub|Douyin) 5\d\d:/.test(err.message)) return true;
  return false;
}

async function fetchWithRetry(connector, args, maxAttempts = 2) {
  let lastErr = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await connector.searchVideos(args);
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts && isStreamError(err)) {
        console.warn(`[MarketSearch] query="${args.keyword}" attempt=${attempt} retry in 2s`);
        await sleep(2_000);
      } else {
        break;
      }
    }
  }
  throw lastErr;
}

/*
 * Market-aware search:
 * 1. Expand the keyword into localized queries for the target market.
 * 2. Call the appropriate connector (TikTok or Douyin) sequentially per query.
 * 3. Deduplicate by video_id across all query results.
 * 4. Score the full deduplicated pool.
 * 5. Filter by minViralScore; if nothing passes, fall back to top 10.
 *
 * Errors on the first (primary) query propagate to the caller.
 * Errors on secondary queries are logged and skipped.
 */
async function marketSearch({ keyword, market }) {
  const cfg = MARKET_CONFIG[market];
  if (!cfg) throw new Error(`Unknown market: ${market}`);

  const queries = queriesForMarket(keyword, market);
  console.log(`[MarketSearch] market=${market} queries=${JSON.stringify(queries)}`);

  const seen = new Set();
  const all  = [];

  for (const q of queries) {
    const connectorArgs = cfg.region !== null
      ? { keyword: q, region: cfg.region }
      : { keyword: q };

    try {
      const videos = await fetchWithRetry(cfg.connector, connectorArgs, 2);
      console.log(`[MarketSearch]   query="${q}" → ${videos.length} raw videos`);

      for (const v of videos) {
        const key = v.video_id || v.id;
        if (!seen.has(key)) {
          seen.add(key);
          all.push({ ...v, matchedQuery: q, originalKeyword: keyword });
        }
      }
    } catch (err) {
      if (q === queries[0]) {
        /* Primary query failed — surface to caller with original error code */
        throw err;
      }
      /* Secondary query failed — log and continue */
      console.warn(`[MarketSearch]   query="${q}" failed (non-fatal): ${err.message}`);
    }
  }

  console.log(`[MarketSearch] total after dedup: ${all.length}`);

  if (all.length === 0) return { videos: [], fallback: false };

  const scored   = await viralScore.scoreVideos(all);
  const filtered = scored.filter(v => v.viralScore >= config.minViralScore);

  console.log(`[MarketSearch] after score filter (>=${config.minViralScore}): ${filtered.length}/${scored.length}`);

  if (filtered.length > 0) {
    filtered.sort((a, b) => b.viralScore - a.viralScore);
    return { videos: filtered.slice(0, config.maxResults), fallback: false };
  }

  /* Nothing met the threshold — return best 10 with a fallback flag */
  scored.sort((a, b) => b.viralScore - a.viralScore);
  return { videos: scored.slice(0, 10), fallback: true };
}

module.exports = { marketSearch };
