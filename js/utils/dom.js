/* ============================================================
   MediaOS — DOM Utilities
   ============================================================ */

'use strict';

function $(selector, scope) {
  return (scope || document).querySelector(selector);
}

function $$(selector, scope) {
  return Array.from((scope || document).querySelectorAll(selector));
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
