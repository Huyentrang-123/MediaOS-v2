/* ============================================================
   MediaOS — Viral Research: Score Labels
   Actual scoring happens in backend/services/viral-score.js.
   ============================================================ */

'use strict';

function getScoreLabel(score) {
  if (score >= 90) return { label: 'Bùng nổ',    cls: 'badge-error'   };
  if (score >= 75) return { label: 'Viral mạnh', cls: 'badge-warning' };
  if (score >= 60) return { label: 'Đang trend', cls: 'badge-info'    };
  return               { label: 'Tham khảo',  cls: 'badge-gray'    };
}
