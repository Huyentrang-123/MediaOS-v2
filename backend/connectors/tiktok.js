'use strict';

const config = require('../config');

/* Map MediaOS region codes to Tikhub region codes */
const REGION_MAP = {
  vn:     'VN',
  kr:     'KR',
  cn:     'CN',
  tw:     'TW',
  global: ''      /* empty = no region filter */
};

async function fetchJson(url, options = {}) {
  const { default: fetch } = await import('node-fetch');
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${config.tikhub.apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Tikhub ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/*
 * Search TikTok videos by keyword and region.
 * Returns normalized video objects ready for scoring.
 */
async function searchVideos({ keyword, region = 'global', count = 30, cursor = 0 }) {
  if (!config.tikhub.apiKey) {
    throw new Error('TIKHUB_API_KEY is not configured. Add it to backend/.env');
  }

  const regionCode = REGION_MAP[region] || '';
  const params = new URLSearchParams({
    keyword,
    count:  String(count),
    cursor: String(cursor),
    ...(regionCode ? { region: regionCode } : {})
  });

  const data = await fetchJson(
    `${config.tikhub.baseUrl}/api/v1/tiktok/app/v3/search/general/video?${params}`
  );

  const items = data?.data?.video_list || data?.data?.data || [];
  return items.map(normalizeVideo).filter(Boolean);
}

/*
 * Normalize a raw Tikhub video object to MediaOS standard format.
 */
function normalizeVideo(raw) {
  try {
    const stats   = raw.statistics || raw.stats || {};
    const author  = raw.author || {};
    const videoInfo = raw.video || {};
    const music   = raw.music || {};

    const views    = parseInt(stats.play_count    || stats.playCount    || 0, 10);
    const comments = parseInt(stats.comment_count || stats.commentCount || 0, 10);
    const shares   = parseInt(stats.share_count   || stats.shareCount   || 0, 10);
    const likes    = parseInt(stats.digg_count    || stats.diggCount    || stats.like_count || 0, 10);

    /* Skip videos with no views (deleted or private) */
    if (!views) return null;

    const videoId  = raw.aweme_id || raw.id || '';
    const postedAt = raw.create_time
      ? new Date(raw.create_time * 1000).toISOString()
      : null;

    /* Average views per hour since posting — NOT recent growth, just a time-adjusted reach signal */
    const hoursOld = postedAt
      ? Math.max(1, (Date.now() - new Date(postedAt).getTime()) / 3_600_000)
      : null;
    const viewsPerHour = hoursOld ? views / hoursOld : null;

    return {
      id:            `tiktok:${videoId}`,
      platform:      'tiktok',
      video_id:      videoId,
      url:           `https://www.tiktok.com/@${author.unique_id}/video/${videoId}`,
      thumbnail:     videoInfo.cover || videoInfo.dynamic_cover || '',
      caption:       raw.desc || '',
      creator:       author.nickname || author.unique_id || '',
      creatorHandle: author.unique_id ? `@${author.unique_id}` : '',
      region:        (raw.region || author.region || '').toLowerCase(),
      postedAt,
      views,
      comments,
      shares,
      likes,
      hashtags:      (raw.text_extra || [])
                       .filter(t => t.hashtag_name)
                       .map(t => t.hashtag_name),
      viewsPerHour,
      /* Raw field kept for debugging */
      _raw:          undefined
    };
  } catch {
    return null;
  }
}

module.exports = { searchVideos };
