/* ============================================================
   MediaOS — Viral Research: Filter Logic
   ============================================================ */

'use strict';

function applyFilters(videos, filterState) {
  let result = videos.slice();

  /* Platform filter */
  if (filterState.platform !== 'all') {
    result = result.filter(v => v.platform === filterState.platform);
  }

  /* Region filter */
  if (filterState.region !== 'global') {
    result = result.filter(v => v.region === filterState.region);
  }

  /* Sort */
  switch (filterState.sortBy) {
    case 'viral_score':
      result.sort((a, b) => b.viralScore - a.viralScore);
      break;
    case 'growth':
      result.sort((a, b) => b.viewsGrowth7d - a.viewsGrowth7d);
      break;
    case 'views':
      result.sort((a, b) => b.views - a.views);
      break;
    case 'comments':
      result.sort((a, b) => b.comments - a.comments);
      break;
    case 'shares':
      result.sort((a, b) => b.shares - a.shares);
      break;
  }

  return result;
}
