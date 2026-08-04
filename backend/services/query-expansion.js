'use strict';

/*
 * Vietnamese cosmetic term dictionary → localized queries per market language.
 * Each entry maps a Vietnamese trigger term to per-language equivalents.
 * Keys must be lowercase. Add new terms here only when translations are certain.
 */
const DICT = {
  'nám':            { ko: ['기미'],           zh_tw: ['黑斑', '肝斑'],   zh_cn: ['黑斑', '黄褐斑'],  en: ['melasma'] },
  'tàn nhang':      { ko: ['주근깨'],          zh_tw: ['雀斑'],           zh_cn: ['雀斑'],            en: ['freckles'] },
  'đốm nâu':        { ko: ['잡티'],            zh_tw: ['色斑'],           zh_cn: ['色斑'],            en: ['dark spots', 'hyperpigmentation'] },
  'xỉn màu':        { ko: ['칙칙한 피부'],     zh_tw: ['暗沉'],           zh_cn: ['暗沉'],            en: ['dull skin'] },
  'serum':          { ko: ['세럼'],            zh_tw: ['精華液'],          zh_cn: ['精华液'],          en: [] },
  'kem dưỡng':      { ko: ['보습크림', '로션'], zh_tw: ['乳液', '面霜'],   zh_cn: ['乳液', '面霜'],    en: ['moisturizer', 'cream'] },
  'kem nám':        { ko: ['미백크림'],         zh_tw: ['美白霜'],          zh_cn: ['美白霜'],          en: ['whitening cream'] },
  'chống nắng':     { ko: ['선크림'],           zh_tw: ['防曬'],            zh_cn: ['防晒'],            en: ['sunscreen', 'SPF'] },
  'skincare':       { ko: ['스킨케어'],         zh_tw: ['保養', '護膚'],    zh_cn: ['护肤'],            en: [] },
  'before after':   { ko: ['비포 애프터'],      zh_tw: ['前後對比'],        zh_cn: ['前后对比'],        en: [] },
  'review':         { ko: ['리뷰'],            zh_tw: ['評測', '開箱'],    zh_cn: ['测评', '开箱'],    en: [] },
  'feedback':       { ko: ['후기'],            zh_tw: ['使用心得'],        zh_cn: ['使用心得'],        en: ['honest review'] },
  'làm trắng':      { ko: ['미백'],            zh_tw: ['美白'],            zh_cn: ['美白'],            en: ['skin whitening', 'brightening'] },
  'dưỡng sáng':     { ko: ['발광 피부'],        zh_tw: ['亮膚'],            zh_cn: ['亮肤'],            en: ['glowing skin', 'brightening'] },
  'da đẹp':         { ko: ['피부관리'],         zh_tw: ['美肌'],            zh_cn: ['美肌'],            en: ['perfect skin'] },
  'chống lão hóa':  { ko: ['안티에이징'],        zh_tw: ['抗老'],            zh_cn: ['抗老化'],          en: ['anti-aging'] },
};

/*
 * Expand a keyword against the dictionary for a target language.
 * Returns at most 3 unique localized terms.
 */
function expand(keyword, lang) {
  const kw  = keyword.trim().toLowerCase();
  const out = new Set();
  for (const [term, langs] of Object.entries(DICT)) {
    if (kw.includes(term) && Array.isArray(langs[lang])) {
      langs[lang].forEach(t => out.add(t));
    }
  }
  return Array.from(out).slice(0, 3);
}

/*
 * Build ordered query list for a given market.
 * Always begins with the original keyword so user intent is preserved.
 * CN market puts localized queries first — Douyin content is in Chinese.
 */
function queriesForMarket(keyword, market) {
  const kw = keyword.trim();
  switch (market) {
    case 'global':
      return [kw, ...expand(kw, 'en')].filter(Boolean).slice(0, 3);
    case 'vn':
      return [kw, ...expand(kw, 'en')].filter(Boolean).slice(0, 3);
    case 'kr':
      return [kw, ...expand(kw, 'ko')].filter(Boolean).slice(0, 4);
    case 'tw':
      return [kw, ...expand(kw, 'zh_tw')].filter(Boolean).slice(0, 4);
    case 'cn':
      return [...expand(kw, 'zh_cn'), kw].filter(Boolean).slice(0, 4);
    default:
      return [kw];
  }
}

module.exports = { queriesForMarket };
