-- Videos được phát hiện qua search
CREATE TABLE IF NOT EXISTS tracked_videos (
  id          TEXT PRIMARY KEY,        -- platform:video_id
  platform    TEXT NOT NULL,           -- tiktok | facebook
  video_id    TEXT NOT NULL,
  region      TEXT,
  url         TEXT NOT NULL,
  thumbnail   TEXT,
  caption     TEXT,
  creator     TEXT,
  posted_at   TEXT,
  first_seen  TEXT NOT NULL,
  last_seen   TEXT NOT NULL
);

-- Snapshot số liệu mỗi lần crawl
CREATE TABLE IF NOT EXISTS snapshots (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  video_ref  TEXT NOT NULL REFERENCES tracked_videos(id),
  views      INTEGER DEFAULT 0,
  comments   INTEGER DEFAULT 0,
  shares     INTEGER DEFAULT 0,
  likes      INTEGER DEFAULT 0,
  crawled_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snapshots_video_ref  ON snapshots(video_ref);
CREATE INDEX IF NOT EXISTS idx_snapshots_crawled_at ON snapshots(crawled_at);
