/* ============================================================
   MediaOS — Hash-Based SPA Router
   ============================================================ */

'use strict';

const RENDERERS = {};

function registerPage(id, renderFn) {
  RENDERERS[id] = renderFn;
}

function navigate(page) {
  if (!CONFIG.pageNames[page]) page = CONFIG.defaultPage;
  state.page = page;

  $$('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  const titleEl = $('#topbarTitle');
  if (titleEl) titleEl.textContent = CONFIG.pageNames[page];
  window.location.hash = page;

  const container = $('#pageContainer');
  if (!container) return;

  if (RENDERERS[page]) {
    RENDERERS[page](container);
  } else {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🚧</div>
        <div class="empty-title">Module đang phát triển</div>
        <div class="empty-desc">Tính năng này sẽ có trong giai đoạn tiếp theo.</div>
      </div>`;
  }

  $('#sidebar').classList.remove('mobile-open');
  $('#sidebarOverlay').classList.remove('visible');
}

const router = {
  init() {
    const hash = window.location.hash.replace('#', '') || CONFIG.defaultPage;
    navigate(hash);
    window.addEventListener('hashchange', () => {
      navigate(window.location.hash.replace('#', ''));
    });
  }
};
