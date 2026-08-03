'use strict';

const path    = require('path');
const fs      = require('fs');
const Database = require('better-sqlite3');

const DB_PATH  = path.join(__dirname, '..', 'data', 'mediaos.db');
const SQL_PATH = path.join(__dirname, 'schema.sql');

let db;

function init() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  const schema = fs.readFileSync(SQL_PATH, 'utf8');
  db.exec(schema);
  console.log('Database ready:', DB_PATH);
}

function getDb() {
  if (!db) throw new Error('Database not initialized. Call db.init() first.');
  return db;
}

/* Upsert a video + insert snapshot */
function upsertVideo(video, snapshot) {
  const conn = getDb();
  const now  = new Date().toISOString();

  conn.prepare(`
    INSERT INTO tracked_videos (id, platform, video_id, region, url, thumbnail, caption, creator, posted_at, first_seen, last_seen)
    VALUES (@id, @platform, @video_id, @region, @url, @thumbnail, @caption, @creator, @posted_at, @first_seen, @last_seen)
    ON CONFLICT(id) DO UPDATE SET
      thumbnail = excluded.thumbnail,
      caption   = excluded.caption,
      last_seen = excluded.last_seen
  `).run({ ...video, first_seen: now, last_seen: now });

  conn.prepare(`
    INSERT INTO snapshots (video_ref, views, comments, shares, likes, crawled_at)
    VALUES (@video_ref, @views, @comments, @shares, @likes, @crawled_at)
  `).run({ video_ref: video.id, crawled_at: now, ...snapshot });
}

/* Get latest snapshot + 7-day-ago snapshot for a video */
function getGrowthData(videoRef) {
  const conn    = getDb();
  const now     = new Date();
  const ago7    = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const latest  = conn.prepare(`SELECT * FROM snapshots WHERE video_ref = ? ORDER BY crawled_at DESC LIMIT 1`).get(videoRef);
  const week    = conn.prepare(`SELECT * FROM snapshots WHERE video_ref = ? AND crawled_at <= ? ORDER BY crawled_at DESC LIMIT 1`).get(videoRef, ago7);
  return { latest, week };
}

module.exports = { init, getDb, upsertVideo, getGrowthData };
