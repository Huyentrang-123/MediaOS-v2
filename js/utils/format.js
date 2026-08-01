/* ============================================================
   MediaOS — Format Utilities
   ============================================================ */

'use strict';

function formatNumber(n) {
  if (typeof n === 'string') {
    n = parseFloat(n.replace(/[^0-9.]/g, ''));
    if (n.toString().includes('M')) n *= 1e6;
    if (n.toString().includes('K')) n *= 1e3;
  }
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 3600)    return Math.floor(diff / 60) + ' phút trước';
  if (diff < 86400)   return Math.floor(diff / 3600) + ' giờ trước';
  if (diff < 604800)  return Math.floor(diff / 86400) + ' ngày trước';
  if (diff < 2592000) return Math.floor(diff / 604800) + ' tuần trước';
  return Math.floor(diff / 2592000) + ' tháng trước';
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
