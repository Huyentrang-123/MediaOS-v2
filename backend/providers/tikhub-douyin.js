'use strict';

const config = require('../config');

const NAME = 'tikhub-douyin';

function isActive() { return !!config.tikhub.apiKey; }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isRetryable(err) {
  if (!err) return false;
  return err.name === 'SocketError'
    || err.cause?.code === 'UND_ERR_SOCKET'
    || /terminated|other side closed|premature close/.test(err.message || '')
    || /^Douyin 5\d\d:/.test(err.message || '');
}

async function fetchOnce(url, headers, { attempt = 1, timeoutMs = 90_000 } = {}) {
  const tag = `[TikHub/Douyin] attempt=${attempt}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    const chunks = [];
    for await (const chunk of res.body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const text = Buffer.concat(chunks).toString('utf-8');
    console.log(`${tag} ← ${res.status} bytes=${text.length}`);
    if (!res.ok) {
      const err = new Error(`Douyin ${res.status}: ${text.slice(0, 300)}`);
      if (res.status === 402) err.code = 'TIKHUB_QUOTA_EXCEEDED';
      throw err;
    }
    return JSON.parse(text);
  } catch (err) {
    console.log(`${tag} ERROR ${err.message}`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function search({ query, offset = 0 }) {
  const headers = {
    'Authorization': `Bearer ${config.tikhub.apiKey}`,
    'Content-Type':  'application/json',
  };
  const page   = String(Math.floor(offset / 10) + 1);
  const url    = `${config.tikhub.baseUrl}/api/v1/douyin/app/v3/fetch_video_search_result_v2?${new URLSearchParams({
    keyword: query, sort_type: '0', publish_time: '0', filter_duration: '0', page
  })}`;
  console.log(`[TikHub/Douyin] query="${query}" page=${page}`);

  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const data = await fetchOnce(url, headers, { attempt });
      return extractVideos(data, Number(page));
    } catch (err) {
      lastErr = err;
      if (attempt < 3 && isRetryable(err)) { await sleep(2_000); continue; }
      break;
    }
  }

  if (isRetryable(lastErr)) {
    const err = new Error('Douyin chưa phản hồi ổn định. Hãy thử lại sau.');
    err.code = 'DOUYIN_UNAVAILABLE';
    throw err;
  }
  throw lastErr;
}

function extractVideos(data, page = 1) {
  let items = [];
  if (Array.isArray(data?.data?.search_item_list)) items = data.data.search_item_list;
  else if (Array.isArray(data?.data?.item_list))   items = data.data.item_list;
  else if (Array.isArray(data?.data?.data))        items = data.data.data;
  else if (Array.isArray(data?.data))              items = data.data;

  const hasMore    = data?.data?.has_more === 1 || data?.data?.has_more === true;
  const nextOffset = hasMore ? page * 10 : null;

  const videos = items.map(v => normalizeVideo(v)).filter(Boolean);
  console.log(`[TikHub/Douyin] normalized=${videos.length}/${items.length} hasMore=${hasMore}`);
  return { videos, hasMore, nextOffset };
}

function coverUrl(videoInfo) {
  const c = videoInfo?.cover || videoInfo?.dynamic_cover || videoInfo?.origin_cover;
  if (!c) return '';
  return typeof c === 'string' ? c : (c.url_list?.[0] || '');
}

function normalizeVideo(item) {
  try {
    const v      = item?.aweme_info || item;
    const stats  = v.statistics || v.stats || {};
    const author = v.author || {};
    const vi     = v.video  || {};

    const views    = parseInt(stats.play_count    || stats.playCount    || 0, 10);
    const comments = parseInt(stats.comment_count || stats.commentCount || 0, 10);
    const shares   = parseInt(stats.share_count   || stats.shareCount   || 0, 10);
    const likes    = parseInt(stats.digg_count    || stats.diggCount    || stats.like_count || 0, 10);
    const videoId  = v.aweme_id || v.id || '';
    if (!videoId) return null;

    const postedAt     = v.create_time ? new Date(v.create_time * 1000).toISOString() : null;
    const hoursOld     = postedAt ? Math.max(1, (Date.now() - new Date(postedAt).getTime()) / 3_600_000) : null;
    const viewsPerHour = (hoursOld && views) ? views / hoursOld : null;
    const handle       = author.unique_id || '';

    return {
      id:             `douyin:${videoId}`,
      platform:       'douyin',
      market:         'cn',
      url:            `https://www.douyin.com/video/${videoId}`,
      thumbnail:      coverUrl(vi),
      caption:        v.desc || '',
      creator:        author.nickname || handle || '',
      creatorHandle:  handle ? `@${handle}` : '',
      postedAt,
      views,
      likes,
      comments,
      shares,
      hashtags:       (v.text_extra || []).filter(t => t.hashtag_name).map(t => t.hashtag_name),
      viewsPerHour,
      statsAvailable: true,
      sourceProvider: NAME
    };
  } catch (err) {
    console.warn('[TikHub/Douyin] normalizeVideo error:', err.message);
    return null;
  }
}

module.exports = { name: NAME, isActive, search };
