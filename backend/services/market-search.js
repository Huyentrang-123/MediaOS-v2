'use strict';

const tiktok          = require('../connectors/tiktok');
const douyin          = require('../connectors/douyin');
const { allVariants } = require('./query-expansion');
const viralScore      = require('./viral-score');
const config          = require('../config');

const MARKET_CONFIG = {
  global: { connector: tiktok, region: 'global' },
  vn:     { connector: tiktok, region: 'vn' },
  kr:     { connector: tiktok, region: 'kr' },
  tw:     { connector: tiktok, region: 'tw' },
  cn:     { connector: douyin, region: null },
};

/* 30-minute in-memory response cache keyed by market:provider:query:offset */
const _cache    = new Map();
const CACHE_TTL = 30 * 60 * 1000;
const PAGE_SIZE = 10;

function getCached(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { _cache.delete(key); return null; }
  return entry.data;
}

function setCached(key, data) {
  _cache.set(key, { ts: Date.now(), data });
}

/*
 * Market-aware search — single-query fetch with caching.
 *
 * query:  specific localized query to use; defaults to allVariants()[0].
 * offset: pagination offset (0 = first page).
 *
 * Returns: { videos, fallback, hasMore, nextOffset, rawCount, returnedCount }
 *   fallback=true: no video met minViralScore; top results returned with _reference=true.
 */
async function marketSearch({ keyword, market, query, offset = 0 }) {
  const cfg = MARKET_CONFIG[market];
  if (!cfg) throw new Error(`Unknown market: ${market}`);

  const effectiveQuery = query || allVariants(keyword, market)[0] || keyword.trim();
  const provider       = market === 'cn' ? 'douyin' : 'tiktok';
  const cacheKey       = `${market}:${provider}:${effectiveQuery}:${offset}`;

  console.log(`[MarketSearch] market=${market} provider=${provider} query="${effectiveQuery}" offset=${offset}`);

  const cached = getCached(cacheKey);
  if (cached) {
    console.log(`[MarketSearch] cache hit: ${cacheKey}`);
    return cached;
  }

  const connectorArgs = { keyword: effectiveQuery, offset };
  if (cfg.region !== null) connectorArgs.region = cfg.region;

  /* Let connector errors (including TIKHUB_QUOTA_EXCEEDED, TIKHUB_REGIONAL_UNAVAILABLE) propagate */
  const { videos: rawVideos, hasMore, nextOffset } = await cfg.connector.searchVideos(connectorArgs);
  const rawCount = rawVideos.length;
  console.log(`[MarketSearch] raw=${rawCount} hasMore=${hasMore} nextOffset=${nextOffset}`);

  if (rawCount === 0) {
    const result = { videos: [], fallback: false, hasMore: false, nextOffset: null, rawCount: 0, returnedCount: 0 };
    setCached(cacheKey, result);
    return result;
  }

  const scored = await viralScore.scoreVideos(rawVideos);
  const viral  = scored.filter(v => v.viralScore >= config.minViralScore);
  viral.sort((a, b) => b.viralScore - a.viralScore);

  let videos;
  let fallback;

  if (viral.length > 0) {
    videos   = viral.slice(0, PAGE_SIZE);
    fallback = false;
  } else {
    scored.sort((a, b) => b.viralScore - a.viralScore);
    videos   = scored.slice(0, PAGE_SIZE).map(v => ({ ...v, _reference: true }));
    fallback = true;
  }

  const result = {
    videos,
    fallback,
    hasMore:       !!hasMore,
    nextOffset,
    rawCount,
    returnedCount: videos.length
  };
  setCached(cacheKey, result);
  return result;
}

module.exports = { marketSearch };
