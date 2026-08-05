/* ============================================================
   MediaOS — App Bootstrap
   ============================================================ */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  applyTheme(state.theme);

  /* Theme toggle */
  $('#themeToggle').addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    applyTheme(state.theme);
    saveState();
  });

  /* Sidebar toggle (desktop) */
  $('#sidebarToggle').addEventListener('click', toggleSidebar);

  /* Sidebar menu (mobile topbar) */
  $('#topbarMenu').addEventListener('click', () => {
    $('#sidebar').classList.toggle('mobile-open');
    $('#sidebarOverlay').classList.toggle('visible');
  });

  /* Sidebar overlay click (mobile) */
  $('#sidebarOverlay').addEventListener('click', () => {
    $('#sidebar').classList.remove('mobile-open');
    $('#sidebarOverlay').classList.remove('visible');
  });

  /* Nav links */
  $$('.nav-item').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      navigate(link.dataset.page);
    });
  });

  /* Modal close */
  $('#modalClose').addEventListener('click', closeModal);
  $('#modalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  /* Register modules */
  registerPage('research', renderResearch);
  registerPage('library',  renderLibrary);
  registerPage('sources',  renderSources);

  /* Init router */
  router.init();
});

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = $('#themeToggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function toggleSidebar() {
  const sidebar = $('#sidebar');
  sidebar.classList.toggle('collapsed');
}

function openModal(title, bodyHTML, footerHTML = '') {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = bodyHTML;
  $('#modalFooter').innerHTML = footerHTML;
  $('#modalOverlay').classList.add('visible');
}

function closeModal() {
  $('#modalOverlay').classList.remove('visible');
}
