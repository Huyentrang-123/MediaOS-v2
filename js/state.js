/* ============================================================
   MediaOS — State Store
   ============================================================ */

'use strict';

const state = {
  page: 'research',
  theme: 'light',

  viralResearch: {
    platform: 'all',
    region:   'global',
    keyword:  '',
    saved:    []
  }
};

function saveState() {
  try {
    localStorage.setItem('mediaos_state', JSON.stringify({
      theme:              state.theme,
      viralResearchSaved: state.viralResearch.saved
    }));
  } catch (e) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem('mediaos_state');
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.theme) state.theme = saved.theme;
    if (Array.isArray(saved.viralResearchSaved)) {
      state.viralResearch.saved = saved.viralResearchSaved;
    }
  } catch (e) {}
}
