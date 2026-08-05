'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

module.exports = {
  port: parseInt(process.env.PORT || '3001', 10),

  /* TikHub — optional. When apiKey is empty, TikTok/Douyin providers are inactive. */
  tikhub: {
    apiKey:  process.env.TIKHUB_API_KEY || '',
    baseUrl: 'https://api.tikhub.io'
  },

  /* YouTube Data API v3 — optional. Free tier: 10,000 quota units/day. */
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY || ''
  },

  scoreWeights: {
    shareRate:    0.35,
    commentRate:  0.30,
    views:        0.25,
    viewsPerHour: 0.10
  },

  maxResults:   50,
  cacheMinutes: 30
};
