'use strict';

require('dotenv').config();

module.exports = {
  port:           parseInt(process.env.PORT || '3001', 10),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5500',

  tikhub: {
    apiKey:  process.env.TIKHUB_API_KEY || '',
    baseUrl: 'https://api.tikhub.io'
  },

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

  /* Minimum viral score (0–100) to include in results */
  minViralScore: 30,

  /* Max results returned per search */
  maxResults: 30
};
