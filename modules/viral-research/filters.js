/* ============================================================
   MediaOS — Viral Research: Filter Logic
   ============================================================ */

'use strict';

function applyFilters(videos, filterState) {
  let result = videos.slice();

  if (filterState.platform !== 'all') {
    result = result.filter(v => v.platform === filterState.platform);
  }

  if (filterState.region !== 'global') {
    result = result.filter(v => v.region === filterState.region);
  }

  if (filterState.keyword && filterState.keyword.trim()) {
    const q = filterState.keyword.trim().toLowerCase();
    result = result.filter(v =>
      v.title.toLowerCase().includes(q) ||
      v.creator.toLowerCase().includes(q) ||
      v.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  /* AI luôn tự xếp theo viral score — không có user sort */
  result.sort((a, b) => b.viralScore - a.viralScore);
  return result;
}
