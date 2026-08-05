/* MediaOS Extension — Bridge for MediaOS web pages */
(function () {
  'use strict';

  function requestAndDeliver() {
    chrome.runtime.sendMessage({ type: 'getPendingResults' }, (resp) => {
      if (chrome.runtime.lastError || !resp || !resp.videos) return;
      if (resp.videos.length === 0) return;
      window.dispatchEvent(new CustomEvent('mediaos:import', {
        detail: { videos: resp.videos, meta: resp.meta || {} }
      }));
    });
  }

  /* Peek without consuming — used to check if there's pending data */
  function peekAndDeliver() {
    chrome.runtime.sendMessage({ type: 'peekPendingResults' }, (resp) => {
      if (chrome.runtime.lastError || !resp || !resp.videos) return;
      if (resp.videos.length === 0) return;
      window.dispatchEvent(new CustomEvent('mediaos:import', {
        detail: { videos: resp.videos, meta: resp.meta || {}, peek: true }
      }));
    });
  }

  /* Page requested an import check */
  window.addEventListener('mediaos:checkForImport', requestAndDeliver);
  window.addEventListener('mediaos:peekForImport', peekAndDeliver);

  /* Auto-trigger when hash signals import */
  function checkHash() {
    if (window.location.hash.includes('import')) {
      requestAndDeliver();
    }
  }

  checkHash();
  window.addEventListener('hashchange', checkHash);

  /* Also auto-deliver on load if data is waiting */
  requestAndDeliver();
})();
