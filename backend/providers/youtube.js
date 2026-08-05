'use strict';

const config = require('../config');

const NAME     = 'youtube';
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

/* Market → YouTube relevanceLanguage and regionCode */
const MARKET_LANG   = { vn: 'vi', kr: 'ko', tw: 'zh-Hant', cn: 'zh-Hans', global: 'en' };
const MARKET_REGION = { vn: 'VN', kr: 'KR', tw: 'TW', cn: 'CN' };

function isActive() { return !!config.youtube.apiKey; }

async function search({ query, market = 'global', offset = 0 }) {
  const key = config.youtube.apiKey;

  /* Pagination: YouTube uses page tokens, not offsets.
     We cache the nextPageToken from previous calls keyed by [query:market:offset].
     For simplicity, offset maps to page index — we store tokens in module-level cache. */
  const pageToken = _pageTokenCache.get(`${query}:${market}:${offset}`);

  /* Step 1 — search.list (costs 100 quota units) */
  const searchParams = new URLSearchParams({
    part:       'snippet',
    q:          query,
    type:       'video',
    maxResults: '20',
    key
  });
  const lang   = MARKET_LANG[market] || 'en';
  const region = MARKET_REGION[market];
  if (lang)   searchParams.set('relevanceLanguage', lang);
  if (region) searchParams.set('regionCode', region);
  if (pageToken) searchParams.set('pageToken', pageToken);

  console.log(`[YouTube] query="${query}" market=${market} offset=${offset}`);

  let searchData;
  try {
    const res = await fetch(`${BASE_URL}/search?${searchParams}`);
    searchData = await res.json();
    if (!res.ok) {
      const msg = searchData?.error?.message || res.statusText;
      const err = new Error(`YouTube search error: ${msg}`);
      if (res.status === 403) err.code = 'YOUTUBE_QUOTA_EXCEEDED';
      throw err;
    }
  } catch (err) {
    console.warn('[YouTube] search.list error:', err.message);
    throw err;
  }

  const items      = searchData.items || [];
  const nextToken  = searchData.nextPageToken || null;
  const hasMore    = !!nextToken;
  const nextOffset = hasMore ? offset + items.length : null;

  /* Store next page token for subsequent requests */
  if (nextToken) {
    _pageTokenCache.set(`${query}:${market}:${offset + items.length}`, nextToken);
  }

  if (items.length === 0) return { videos: [], hasMore: false, nextOffset: null };

  /* Step 2 — videos.list for statistics (costs 1 unit/video) */
  const videoIds = items.map(i => i.id?.videoId).filter(Boolean).join(',');
  let statsMap   = {};
  if (videoIds) {
    try {
      const statsRes  = await fetch(`${BASE_URL}/videos?${new URLSearchParams({
        part: 'statistics,contentDetails', id: videoIds, key
      })}`);
      const statsData = await statsRes.json();
      for (const item of (statsData.items || [])) {
        statsMap[item.id] = {
          stats:   item.statistics   || {},
          details: item.contentDetails || {}
        };
      }
    } catch (err) {
      console.warn('[YouTube] videos.list error (stats unavailable):', err.message);
    }
  }

  const videos = items.map(item => normalizeVideo(item, statsMap, market)).filter(Boolean);
  console.log(`[YouTube] normalized=${videos.length}/${items.length} hasMore=${hasMore}`);
  return { videos, hasMore, nextOffset };
}

function normalizeVideo(item, statsMap, market) {
  try {
    const videoId = item.id?.videoId;
    if (!videoId) return null;

    const snippet = item.snippet || {};
    const entry   = statsMap[videoId] || {};
    const stats   = entry.stats || {};

    const views    = parseInt(stats.viewCount    || 0, 10) || null;
    const likes    = parseInt(stats.likeCount    || 0, 10) || null;
    const comments = parseInt(stats.commentCount || 0, 10) || null;

    const postedAt     = snippet.publishedAt || null;
    const hoursOld     = postedAt ? Math.max(1, (Date.now() - new Date(postedAt).getTime()) / 3_600_000) : null;
    const viewsPerHour = (hoursOld && views) ? views / hoursOld : null;

    const channelTitle = snippet.channelTitle || '';

    /* Best available thumbnail */
    const thumb = snippet.thumbnails?.maxres?.url
      || snippet.thumbnails?.high?.url
      || snippet.thumbnails?.medium?.url
      || snippet.thumbnails?.default?.url
      || '';

    return {
      id:             `youtube:${videoId}`,
      platform:       'youtube',
      market,
      url:            `https://www.youtube.com/watch?v=${videoId}`,
      thumbnail:      thumb,
      caption:        snippet.title || '',
      creator:        channelTitle,
      creatorHandle:  snippet.channelId ? `@${snippet.channelId}` : '',
      postedAt,
      views,
      likes,
      comments,
      shares:         null,
      hashtags:       [],
      viewsPerHour,
      statsAvailable: !!(views || likes || comments),
      sourceProvider: NAME
    };
  } catch (err) {
    console.warn('[YouTube] normalizeVideo error:', err.message);
    return null;
  }
}

/* Module-level page token cache (ephemeral, resets on server restart) */
const _pageTokenCache = new Map();

module.exports = { name: NAME, isActive, search };
