'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

module.exports = {
  port: parseInt(process.env.PORT || '3001', 10),

  tikhub: {
    apiKey:  process.env.TIKHUB_API_KEY || '',
    baseUrl: 'https://api.tikhub.io'
  },

  /* Facebook oEmbed token — optional; set FACEBOOK_APP_TOKEN in .env */
  facebookAppToken: process.env.FACEBOOK_APP_TOKEN || '',

  /*
   * Viral score weights (Phase 1 — no historical growth data).
   * shareRate + commentRate dominate so old popular videos aren't penalized.
   * viewsPerHour = totalViews/totalHours (since posting), not recent growth.
   */
  scoreWeights: {
    shareRate:    0.35,
    commentRate:  0.30,
    views:        0.25,
    viewsPerHour: 0.10
  },

  minViralScore: 30,
  maxResults:    30
};
