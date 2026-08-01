/* ============================================================
   MediaOS — Viral Research: Filter Logic
   ============================================================ */

'use strict';

function applyFilters(videos, filterState) {
  /* Score each video normalized against the full dataset */
  const enriched = videos.map(v => ({
    ...v,
    viralScore: calculateViralScore(v, videos)
  }));

  let result = enriched.slice();

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

  result.sort((a, b) => b.viralScore - a.viralScore);
  return result;
}
