/* ============================================================
   MediaOS — Content Analysis (Dictionary-based, zero API cost)
   ============================================================ */

'use strict';

var CONTENT_TAG_RULES = {
  hook:        ['mình đã', 'ai mà', 'không tưởng', 'thật ra', 'sự thật', 'bí quyết', 'lý do', 'tại sao', 'thử thách', 'challenge', 'bạn có biết'],
  cta:         ['link bio', 'link in bio', 'bình luận', 'comment xuống', 'chia sẻ ngay', 'follow mình', 'save lại', 'đặt hàng', 'dm mình', 'inbox'],
  beforeAfter: ['before after', 'trước sau', 'trước và sau', 'kết quả thật', 'sau 7 ngày', 'sau 14 ngày', 'sau 1 tháng'],
  socialProof: ['review thật', 'đánh giá thật', 'honest review', 'unboxing', 'test thử', 'feedback', 'nhận xét thật', 'dùng thật'],
  promotion:   ['sale', 'giảm giá', 'discount', 'voucher', 'ưu đãi', 'flash sale', 'mã giảm', 'freeship', 'buy 1 get'],
  expert:      ['chuyên gia', 'bác sĩ', 'dermatologist', 'da liễu', 'kỹ thuật viên', 'chuyên nghiệp', 'được chứng nhận'],
  factory:     ['nhà máy', 'cơ sở sản xuất', 'factory', 'behind the scene', 'quy trình sản xuất', 'nguyên liệu'],
  livestream:  ['live', 'livestream', 'trực tiếp', 'going live'],
  urgency:     ['hôm nay thôi', 'ngay bây giờ', 'limited', 'cuối cùng', 'hết hàng', 'sắp hết', 'nhanh tay', 'chỉ còn'],
  review:      ['review', 'đánh giá', 'dùng thử', 'skincare routine', 'test thật', 'thử nghiệm'],
  feedback:    ['cảm ơn', 'phản hồi', 'kết quả sau khi dùng', 'update', 'update sau'],
};

function autoTag(text) {
  if (!text) return [];
  var lower = text.toLowerCase();
  return Object.keys(CONTENT_TAG_RULES).filter(function(tag) {
    return CONTENT_TAG_RULES[tag].some(function(kw) { return lower.indexOf(kw) !== -1; });
  });
}

function estimateViralScore(video) {
  var views    = video.views    || 0;
  var shares   = video.shares   || 0;
  var comments = video.comments || 0;
  if (!views || views <= 0) return null;

  var shareRate    = shares   / views;
  var commentRate  = comments / views;
  /* Log-based reach signal: log10(1M views) = 6, scaled to 0–25 */
  var viewScore    = Math.min(25, (Math.log10(Math.max(10, views)) / 8) * 25);

  var score = Math.round(
    (shareRate   * 3500) +
    (commentRate * 3000) +
    viewScore
  );
  return Math.min(100, Math.max(0, score));
}

var LibraryAnalysis = { autoTag: autoTag, estimateViralScore: estimateViralScore };
