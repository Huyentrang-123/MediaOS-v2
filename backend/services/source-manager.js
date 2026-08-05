'use strict';

const config   = require('../config');
const tiktok   = require('../providers/tikhub-tiktok');
const douyin   = require('../providers/tikhub-douyin');
const youtube  = require('../providers/youtube');
const facebook = require('../providers/facebook');

const ALL_PROVIDERS = [tiktok, douyin, youtube, facebook];
const TIMEOUT_MS    = 10_000;

const _cache = new Map();

function _cacheKey(providerName, market, query, offset) {
  return `${providerName}:${market}:${query}:${offset}`;
}

function _cacheValid(entry) {
  return Date.now() - entry.ts < config.cacheMinutes * 60_000;
}

function _withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)
    )
  ]);
}

function _selectProviders(platform, market) {
  return ALL_PROVIDERS.filter(p => {
    if (!p.isActive()) return false;
    if (p.name === 'tikhub-douyin' && market !== 'cn') return false;
    if (platform === 'tiktok'  && p.name !== 'tikhub-tiktok')  return false;
    if (platform === 'youtube' && p.name !== 'youtube')         return false;
    if (platform === 'douyin'  && p.name !== 'tikhub-douyin')   return false;
    return true;
  });
}

async function search({ query, market = 'global', offset = 0, platform = 'all' }) {
  const providers = _selectProviders(platform, market);

  if (providers.length === 0) {
    const err = new Error('Không có nguồn dữ liệu nào đang hoạt động. Hãy kiểm tra API key trong .env');
    err.code = 'NO_ACTIVE_PROVIDERS';
    throw err;
  }

  const tasks = providers.map(async p => {
    const key = _cacheKey(p.name, market, query, offset);
    const hit  = _cache.get(key);
    if (hit && _cacheValid(hit)) {
      console.log(`[SourceManager] cache hit: ${key}`);
      return hit.data;
    }

    try {
      const result = await _withTimeout(
        p.search({ query, market, offset }),
        TIMEOUT_MS,
        p.name
      );
      _cache.set(key, { ts: Date.now(), data: result });
      return result;
    } catch (err) {
      console.warn(`[SourceManager] ${p.name} error:`, err.message);
      return null;
    }
  });

  const results  = (await Promise.all(tasks)).filter(Boolean);
  if (results.length === 0) {
    throw new Error('Tất cả nguồn dữ liệu đều không phản hồi. Vui lòng thử lại sau.');
  }

  /* Merge + dedup */
  const seen      = new Set();
  const videos    = [];
  let   hasMore   = false;
  let   nextOffset = null;

  for (const r of results) {
    for (const v of (r.videos || [])) {
      if (!seen.has(v.id)) {
        seen.add(v.id);
        videos.push({ ...v, matchedQuery: query });
      }
    }
    if (r.hasMore) hasMore = true;
    if (r.nextOffset != null && (nextOffset == null || r.nextOffset < nextOffset)) {
      nextOffset = r.nextOffset;
    }
  }

  return { videos, hasMore, nextOffset };
}

module.exports = { search };
