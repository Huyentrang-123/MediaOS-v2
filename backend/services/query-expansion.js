'use strict';

/*
 * Phrase-level expansion table.
 * Each entry has a `pattern` (regex tested against the keyword) and per-market
 * arrays of variant queries. Index 0 of allVariants() is always the original
 * keyword; index 1+ are these phrases, used one per "Tìm thêm gợi ý" click.
 */
const PHRASE_EXPANSIONS = [
  {
    pattern: /nám|kem nám|trị nám|đốm nâu|tàn nhang/i,
    vn:      ['chăm sóc da nám', 'mờ đốm nâu', 'dưỡng sáng da không đều màu'],
    kr:      ['기미 크림', '기미 케어', '잡티 케어', '미백 크림'],
    tw:      ['淡斑霜', '斑點保養', '改善暗沉', '亮白保養'],
    cn:      ['淡斑霜', '祛斑护肤', '改善暗沉', '美白面霜'],
    global:  ['dark spot cream', 'pigmentation skincare', 'melasma skincare', 'brightening cream'],
  },
  {
    pattern: /serum/i,
    vn:      ['tinh chất dưỡng da', 'serum review', 'serum trước sau'],
    kr:      ['세럼 추천', '세럼 리뷰', '피부 세럼'],
    tw:      ['精華液推薦', '精華液評測', '精華液心得'],
    cn:      ['精华液推荐', '精华液测评', '护肤精华'],
    global:  ['serum review', 'best serum skincare', 'serum before after'],
  },
  {
    pattern: /chống nắng|kem chống nắng|sunscreen|SPF/i,
    vn:      ['kem chống nắng tốt', 'SPF review', 'chống nắng da dầu'],
    kr:      ['선크림 추천', '선크림 리뷰', '자외선차단 추천'],
    tw:      ['防曬推薦', '防曬評測', 'SPF保養'],
    cn:      ['防晒霜推荐', '防晒测评', '防晒护肤'],
    global:  ['sunscreen review', 'SPF skincare', 'best sunscreen'],
  },
  {
    pattern: /làm trắng|dưỡng trắng|whitening|trắng da/i,
    vn:      ['dưỡng sáng da', 'da trắng tự nhiên', 'trắng sáng không đều màu'],
    kr:      ['미백 추천', '피부 밝아짐', '미백 케어'],
    tw:      ['美白保養', '亮膚推薦', '提亮膚色'],
    cn:      ['美白护肤', '亮肤推荐', '提亮肤色'],
    global:  ['skin whitening', 'brightening skincare', 'glowing skin routine'],
  },
  {
    pattern: /before after|trước sau/i,
    vn:      ['trước và sau dùng', 'kết quả thật', 'review thật'],
    kr:      ['사용 전후', '진짜 리뷰', '피부 변화'],
    tw:      ['使用前後', '真實評測', '皮膚改善'],
    cn:      ['使用前后', '真实测评', '皮肤改善'],
    global:  ['before after skincare', 'real results skincare', 'skin transformation'],
  },
  {
    pattern: /skincare|dưỡng da|chăm sóc da/i,
    vn:      ['chăm sóc da mặt', 'routine dưỡng da', 'skincare cho da dầu'],
    kr:      ['스킨케어 루틴', '피부관리', '피부케어 추천'],
    tw:      ['護膚保養', '保養品推薦', '護膚程序'],
    cn:      ['护肤日常', '护肤品推荐', '护肤步骤'],
    global:  ['skincare routine', 'skincare review', 'skin care tips'],
  },
  {
    pattern: /chống lão hóa|anti.?aging|anti-aging/i,
    vn:      ['dưỡng da chống lão hóa', 'kem dưỡng tuổi 30', 'ngăn ngừa lão hóa'],
    kr:      ['안티에이징', '노화방지', '탄력 케어'],
    tw:      ['抗老保養', '緊緻肌膚', '逆齡精華'],
    cn:      ['抗老化护肤', '紧致肌肤', '逆龄精华'],
    global:  ['anti-aging skincare', 'anti-wrinkle serum', 'skin firming routine'],
  },
  {
    pattern: /kem dưỡng|moisturizer|lotion|cream/i,
    vn:      ['kem dưỡng ẩm', 'kem dưỡng da ban đêm', 'kem dưỡng cho da khô'],
    kr:      ['보습크림 추천', '수분크림 리뷰', '크림 보습'],
    tw:      ['乳霜推薦', '面霜評測', '保濕乳液'],
    cn:      ['面霜推荐', '保湿乳液', '润肤霜测评'],
    global:  ['moisturizer review', 'best face cream', 'skin hydration cream'],
  },
];

/*
 * Term-level dictionary: Vietnamese trigger → localized term lists.
 * Used as fallback when no phrase-level pattern matches.
 */
const DICT = {
  'nám':          { ko: ['기미'],          zh_tw: ['黑斑', '肝斑'],   zh_cn: ['黑斑', '黄褐斑'],   en: ['melasma'] },
  'tàn nhang':    { ko: ['주근깨'],         zh_tw: ['雀斑'],           zh_cn: ['雀斑'],             en: ['freckles'] },
  'đốm nâu':      { ko: ['잡티'],           zh_tw: ['色斑'],           zh_cn: ['色斑'],             en: ['dark spots'] },
  'xỉn màu':      { ko: ['칙칙한 피부'],    zh_tw: ['暗沉'],           zh_cn: ['暗沉'],             en: ['dull skin'] },
  'serum':        { ko: ['세럼'],           zh_tw: ['精華液'],          zh_cn: ['精华液'],           en: [] },
  'kem dưỡng':    { ko: ['보습크림'],        zh_tw: ['乳液'],            zh_cn: ['乳液'],             en: ['moisturizer'] },
  'kem nám':      { ko: ['미백크림'],        zh_tw: ['美白霜'],          zh_cn: ['美白霜'],           en: ['whitening cream'] },
  'chống nắng':   { ko: ['선크림'],          zh_tw: ['防曬'],            zh_cn: ['防晒'],             en: ['sunscreen'] },
  'skincare':     { ko: ['스킨케어'],        zh_tw: ['保養'],            zh_cn: ['护肤'],             en: [] },
  'làm trắng':    { ko: ['미백'],           zh_tw: ['美白'],            zh_cn: ['美白'],             en: ['brightening'] },
  'dưỡng sáng':   { ko: ['발광 피부'],       zh_tw: ['亮膚'],            zh_cn: ['亮肤'],             en: ['glowing skin'] },
  'da đẹp':       { ko: ['피부관리'],        zh_tw: ['美肌'],            zh_cn: ['美肌'],             en: ['perfect skin'] },
  'chống lão hóa':{ ko: ['안티에이징'],      zh_tw: ['抗老'],            zh_cn: ['抗老化'],           en: ['anti-aging'] },
};

function dedupe(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function dictExpand(keyword, lang) {
  const kw  = keyword.toLowerCase();
  const out = new Set();
  for (const [term, langs] of Object.entries(DICT)) {
    if (kw.includes(term) && Array.isArray(langs[lang])) {
      langs[lang].forEach(t => out.add(t));
    }
  }
  return Array.from(out).slice(0, 4);
}

/*
 * Returns ALL query variants for a keyword+market combination.
 * - Index 0: initial search query (always the original keyword, or Chinese first for CN)
 * - Index 1+: expansion variants used one per "Tìm thêm gợi ý" click
 *
 * First matching phrase pattern wins; falls back to term-level dict.
 * Never fabricates — if nothing matches, returns only the original keyword.
 */
function allVariants(keyword, market) {
  const kw = keyword.trim();

  for (const entry of PHRASE_EXPANSIONS) {
    if (entry.pattern.test(kw)) {
      const marketVariants = entry[market] || entry.global || [];
      return market === 'cn'
        ? dedupe([...marketVariants, kw])
        : dedupe([kw, ...marketVariants]);
    }
  }

  /* Dict-based fallback */
  const langMap = { vn: 'en', kr: 'ko', tw: 'zh_tw', cn: 'zh_cn', global: 'en' };
  const lang    = langMap[market];
  const expanded = lang ? dictExpand(kw, lang) : [];
  return market === 'cn'
    ? dedupe([...expanded, kw])
    : dedupe([kw, ...expanded]);
}

function initialQuery(keyword, market) {
  return allVariants(keyword, market)[0] || keyword.trim();
}

module.exports = { allVariants, initialQuery };
