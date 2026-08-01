/* ============================================================
   MediaOS — App Constants
   ============================================================ */

'use strict';

const CONFIG = {
  defaultPage: 'research',

  platforms: [
    { id: 'all',      label: 'Tất cả nền tảng' },
    { id: 'tiktok',   label: 'TikTok' },
    { id: 'facebook', label: 'Facebook' }
  ],

  regions: [
    { id: 'global', label: '🌏 Toàn cầu',  flag: '🌏' },
    { id: 'vn',     label: '🇻🇳 Việt Nam',  flag: '🇻🇳' },
    { id: 'kr',     label: '🇰🇷 Hàn Quốc', flag: '🇰🇷' },
    { id: 'cn',     label: '🇨🇳 Trung Quốc',flag: '🇨🇳' },
    { id: 'tw',     label: '🇹🇼 Đài Loan',  flag: '🇹🇼' }
  ],

  sortOptions: [
    { id: 'viral_score', label: '🔥 Viral Score' },
    { id: 'growth',      label: '📈 Tăng trưởng 7 ngày' },
    { id: 'views',       label: '👁️ Nhiều view nhất' },
    { id: 'comments',    label: '💬 Nhiều bình luận' },
    { id: 'shares',      label: '🔗 Nhiều chia sẻ' }
  ],

  pageNames: {
    research:   'Viral Research',
    trends:     'Trend Analysis',
    knowledge:  'Knowledge Base',
    campaigns:  'Campaigns',
    ideas:      'Ideas Board',
    team:       'Team',
    guidelines: 'Guidelines & SOP'
  }
};
