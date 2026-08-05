/* ============================================================
   MediaOS — App Constants
   ============================================================ */

'use strict';

const CONFIG = {
  defaultPage: 'research',

  platforms: [
    { id: 'all',      label: 'Tất cả' },
    { id: 'tiktok',   label: 'TikTok' },
    { id: 'facebook', label: 'Facebook' }
  ],

  regions: [
    { id: 'global', label: '🌏 Toàn cầu', flag: '🌏' },
    { id: 'vn',     label: '🇻🇳 Việt Nam', flag: '🇻🇳' },
    { id: 'kr',     label: '🇰🇷 Hàn Quốc', flag: '🇰🇷' },
    { id: 'cn',     label: '🇨🇳 Trung Quốc', flag: '🇨🇳' },
    { id: 'tw',     label: '🇹🇼 Đài Loan', flag: '🇹🇼' }
  ],

  pageNames: {
    research:   'Viral Search',
    library:    'Research Library',
    sources:    'Nguồn Nghiên Cứu',
    insights:   'AI Insights',
    campaigns:  'Campaigns',
    ideas:      'Ideas Board',
    aiwriter:   'AI Content Writer',
    team:       'Team',
    guidelines: 'Guidelines & SOP'
  }
};
