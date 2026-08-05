/* ============================================================
   MediaOS — URL Importer
   Validates, normalizes TikTok/Douyin/Facebook URLs.
   Fetches oEmbed metadata via backend proxy (no direct scraping).
   Depends on: modules/library/storage.js, modules/library/analysis.js
   ============================================================ */

'use strict';

/* Known URL patterns → platform + videoId extraction */
var URL_PATTERNS = [
  /* TikTok long */
  { platform: 'tiktok',   re: /tiktok\.com\/@[^/?#]+\/video\/(\d+)/i,         extract: function(m){ return m[1]; } },
  /* TikTok short (vm / vt / m) — videoId resolved via oEmbed */
  { platform: 'tiktok',   re: /(?:vm|vt|m)\.tiktok\.com\/([A-Za-z0-9]+)/i,    extract: function(){ return null; }, isShort: true },
  /* Douyin long */
  { platform: 'douyin',   re: /douyin\.com\/video\/(\d+)/i,                    extract: function(m){ return m[1]; } },
  /* Douyin short */
  { platform: 'douyin',   re: /v\.douyin\.com\/([A-Za-z0-9]+)/i,              extract: function(){ return null; }, isShort: true },
  /* Facebook reel */
  { platform: 'facebook', re: /facebook\.com\/reel\/(\d+)/i,                   extract: function(m){ return m[1]; } },
  /* Facebook watch?v= */
  { platform: 'facebook', re: /facebook\.com\/watch\/?[?#].*?v=(\d+)/i,        extract: function(m){ return m[1]; } },
  /* Facebook page video */
  { platform: 'facebook', re: /facebook\.com\/[^/?#]+\/videos\/(\d+)/i,        extract: function(m){ return m[1]; } },
  /* fb.watch short */
  { platform: 'facebook', re: /fb\.watch\/([A-Za-z0-9_-]+)/i,                 extract: function(){ return null; }, isShort: true },
];

function parseUrl(raw) {
  if (!raw) return null;
  var trimmed = raw.trim();
  if (trimmed.indexOf('http') !== 0) return null;

  for (var i = 0; i < URL_PATTERNS.length; i++) {
    var pat = URL_PATTERNS[i];
    var m   = trimmed.match(pat.re);
    if (!m) continue;
    var videoId = pat.extract(m);
    var id      = videoId
      ? pat.platform + ':' + videoId
      : 'url:' + btoa(trimmed).slice(0, 40).replace(/[+/=]/g, '_');
    var normalizedUrl = videoId
      ? pat.platform + ':' + videoId
      : 'url:' + trimmed;
    return {
      platform:     pat.platform,
      videoId:      videoId || null,
      url:          trimmed,
      normalizedUrl: normalizedUrl,
      id:           id,
      isShort:      !!(pat.isShort)
    };
  }
  return null;
}

async function fetchOEmbed(url, platform) {
  try {
    var params = new URLSearchParams({ url: url, platform: platform });
    var resp   = await fetch('/api/oembed?' + params);
    if (!resp.ok) return null;
    return await resp.json();
  } catch (e) {
    return null;
  }
}

async function importUrl(rawUrl, opts) {
  opts = opts || {};
  var region   = opts.region   || 'global';
  var addedBy  = opts.addedBy  || '';
  var parsed   = parseUrl(rawUrl);
  if (!parsed) return { ok: false, reason: 'invalid_url', url: rawUrl };

  /* Best-effort oEmbed — no failure if unavailable */
  var oembed = await fetchOEmbed(parsed.url, parsed.platform);

  /* If oEmbed resolved a canonical URL with videoId, update id */
  var resolvedId = parsed.id;
  if (oembed && oembed.resolved_video_id) {
    resolvedId = parsed.platform + ':' + oembed.resolved_video_id;
    parsed.normalizedUrl = parsed.platform + ':' + oembed.resolved_video_id;
    parsed.videoId = oembed.resolved_video_id;
  }

  var title   = (oembed && oembed.title)        || '';
  var creator = (oembed && oembed.author_name)  || '';
  var thumb   = (oembed && oembed.thumbnail_url) || '';

  var video = {
    id:            resolvedId,
    platform:      parsed.platform,
    videoId:       parsed.videoId,
    url:           parsed.url,
    normalizedUrl: parsed.normalizedUrl,
    title:         title,
    creator:       creator,
    creatorHandle: creator,
    thumbnail:     thumb,
    region:        region,
    topics:        [],
    contentTags:   LibraryAnalysis.autoTag(title),
    views:         null,
    likes:         null,
    comments:      null,
    shares:        null,
    postedAt:      null,
    notes:         '',
    hook:          '',
    cta:           '',
    addedAt:       new Date().toISOString(),
    addedBy:       addedBy,
    seen:          false,
    bookmarked:    false,
    viralScore:    null,
    _source:       'import'
  };

  return LibraryStorage.add(video);
}

async function importMany(urls, opts) {
  var results = { imported: [], skipped: [], errors: [] };
  for (var i = 0; i < urls.length; i++) {
    var url     = (urls[i] || '').trim();
    if (!url) continue;
    var r = await importUrl(url, opts);
    if (r.ok)                           results.imported.push(url);
    else if (r.reason === 'duplicate')  results.skipped.push(url);
    else                                results.errors.push({ url: url, reason: r.reason });
  }
  return results;
}

function parseUrlsFromText(text) {
  return (text || '').split(/[\n,]+/)
    .map(function(l){ return l.trim(); })
    .filter(function(l){ return l.indexOf('http') === 0; });
}

function parseUrlsFromCsv(csvText) {
  var lines = (csvText || '').split('\n');
  var urls  = [];
  lines.forEach(function(line) {
    line.split(',').forEach(function(cell) {
      var t = cell.replace(/["'\r]/g, '').trim();
      if (t.indexOf('http') === 0) urls.push(t);
    });
  });
  return urls;
}

var Importer = {
  parseUrl:          parseUrl,
  importUrl:         importUrl,
  importMany:        importMany,
  parseUrlsFromText: parseUrlsFromText,
  parseUrlsFromCsv:  parseUrlsFromCsv
};
