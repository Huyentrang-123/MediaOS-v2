/* ============================================================
   MediaOS — Viral Research: Viral Score & Analysis
   ============================================================ */

'use strict';

/* Dynamic score computed from engagement metrics normalized across the dataset.
   Weights: growth 40%, share rate 25%, comment rate 20%, total views 15%.
   (Front-end approximation for mock data — actual scores come from the backend.) */
function calculateViralScore(video, dataset) {
  function normalize(val, arr) {
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    if (max === min) return 1;
    return (val - min) / (max - min);
  }

  const growths      = dataset.map(v => v.viewsGrowth7d || 0);
  const shareRates   = dataset.map(v => v.views > 0 ? v.shares / v.views : 0);
  const commentRates = dataset.map(v => v.views > 0 ? v.comments / v.views : 0);
  const views        = dataset.map(v => v.views);

  const growth7d   = video.viewsGrowth7d || 0;
  const shareRate  = video.views > 0 ? video.shares  / video.views  : 0;
  const commentRate = video.views > 0 ? video.comments / video.views : 0;

  const score =
    0.40 * normalize(growth7d,    growths)      +
    0.25 * normalize(shareRate,   shareRates)   +
    0.20 * normalize(commentRate, commentRates) +
    0.15 * normalize(video.views, views);

  return Math.round(score * 100);
}

function getScoreLabel(score) {
  if (score >= 95) return { label: '🔥 Bùng nổ',  cls: 'badge-error' };
  if (score >= 85) return { label: '📈 Viral mạnh', cls: 'badge-warning' };
  if (score >= 70) return { label: '⭐ Đang trend', cls: 'badge-info' };
  return               { label: '📊 Tăng trưởng', cls: 'badge-gray' };
}

function generateViralReason(video) {
  /* Phase 1 has no 7-day growth data — guard against null */
  let openingLine;
  if (video.viewsGrowth7d != null) {
    const growthLabel = video.viewsGrowth7d >= 400
      ? `tăng trưởng <strong>${video.viewsGrowth7d}%</strong> lượt xem trong 7 ngày — thuộc top bùng nổ của nền tảng`
      : `tăng <strong>${video.viewsGrowth7d}%</strong> lượt xem trong 7 ngày gần nhất`;
    openingLine = `Video ${growthLabel}.`;
  } else {
    openingLine = `Video đạt <strong>${formatNumber(video.views)}</strong> lượt xem.`;
  }

  const shareRate   = video.views > 0 ? ((video.shares   / video.views) * 100).toFixed(1) : '0.0';
  const commentRate = video.views > 0 ? ((video.comments / video.views) * 100).toFixed(2) : '0.00';

  const platformPush = video.platform === 'tiktok'
    ? 'Thuật toán TikTok FYP đang đẩy mạnh video này đến nhiều tệp người dùng mới.'
    : video.platform === 'douyin'
    ? 'Douyin đang đẩy video này trong feed khám phá Trung Quốc.'
    : 'Facebook Reels đang đề xuất video vào feed của nhiều nhóm beauty liên quan.';

  const regionInsight = {
    vn: 'Nội dung tiếng Việt phù hợp, đúng tệp người dùng quan tâm mỹ phẩm tại Việt Nam.',
    kr: 'K-Beauty luôn có sức hút lớn, nội dung từ Hàn Quốc được đón nhận mạnh trên toàn châu Á.',
    cn: 'Thị trường mỹ phẩm Trung Quốc lớn và sôi động — video đang bùng nổ trong cộng đồng beauty CN.',
    tw: 'Đài Loan là thị trường trend nhạy, video từ TW thường lan ra toàn Đông Nam Á nhanh chóng.'
  };

  const scoreTag = video.viralScore >= 90
    ? 'Đây là loại nội dung có khả năng lan truyền cực mạnh — nên nghiên cứu format và hook đầu video.'
    : 'Nội dung đang tăng trưởng tốt, phù hợp để tham khảo cho chiến lược content giai đoạn này.';

  return `${openingLine} Tỷ lệ chia sẻ <strong>${shareRate}%</strong> (benchmark ngành ~0.8%) và tỷ lệ bình luận <strong>${commentRate}%</strong> cho thấy mức độ tương tác rất cao. ${platformPush} ${regionInsight[video.region] || ''} ${scoreTag}`;
}
