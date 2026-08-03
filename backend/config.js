'use strict';

require('dotenv').config();

module.exports = {
  port:           parseInt(process.env.PORT || '3001', 10),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5500',

  tikhub: {
    apiKey:  process.env.TIKHUB_API_KEY || '',
    baseUrl: 'https://api.tikhub.io'
  },

  /* Viral score weights — same formula as frontend */
  scoreWeights: {
    growth:      0.40,
    shareRate:   0.25,
    commentRate: 0.20,
    views:       0.15
  },

  /* Minimum viral score (0–100) to include in results */
  minViralScore: 30,

  /* Max results returned per search */
  maxResults: 30
};
