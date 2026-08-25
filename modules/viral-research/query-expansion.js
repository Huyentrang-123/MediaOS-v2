/* ============================================================
   MediaOS — Viral Research: Client-side Query Expansion
   Zero-cost, no API calls. Mirrors backend/services/query-expansion.js.
   ============================================================ */

'use strict';

var VR_PHRASE_EXPANSIONS = [
  { pattern: /nám|kem nám|trị nám|đốm nâu|tàn nhang/i,
    vn:     ['serum nám', 'kem trị nám', 'chăm sóc da nám', 'mờ đốm nâu', 'dưỡng sáng da không đều màu'],
    kr:     ['기미 크림', '기미 세럼', '잡티 케어', '미백 크림', '기미 케어'],
    tw:     ['淡斑霜', '斑點保養', '亮白保養', '祛斑精華', '淡斑精華'],
    cn:     ['淡斑霜', '祛斑护肤', '美白面霜', '美白精华', '淡斑精华'],
    global: ['dark spot cream', 'melasma serum', 'pigmentation skincare', 'brightening cream', 'dark spot serum'] },

  { pattern: /serum/i,
    vn:     ['tinh chất dưỡng da', 'serum review', 'serum trước sau', 'tinh chất nám'],
    kr:     ['세럼 추천', '세럼 리뷰', '피부 세럼'],
    tw:     ['精華液推薦', '精華液評測', '精華液心得'],
    cn:     ['精华液推荐', '精华液测评', '护肤精华'],
    global: ['serum review', 'best serum skincare', 'serum before after'] },

  { pattern: /chống nắng|kem chống nắng|sunscreen|SPF/i,
    vn:     ['kem chống nắng tốt', 'SPF review', 'chống nắng da dầu'],
    kr:     ['선크림 추천', '선크림 리뷰', '자외선차단 추천'],
    tw:     ['防曬推薦', '防曬評測', 'SPF保養'],
    cn:     ['防晒霜推荐', '防晒测评', '防晒护肤'],
    global: ['sunscreen review', 'SPF skincare', 'best sunscreen'] },

  { pattern: /làm trắng|dưỡng trắng|whitening|trắng da/i,
    vn:     ['dưỡng sáng da', 'da trắng tự nhiên', 'trắng sáng không đều màu'],
    kr:     ['미백 추천', '피부 밝아짐', '미백 케어'],
    tw:     ['美白保養', '亮膚推薦', '提亮膚色'],
    cn:     ['美白护肤', '亮肤推荐', '提亮肤色'],
    global: ['skin whitening', 'brightening skincare', 'glowing skin routine'] },

  { pattern: /before after|trước sau/i,
    vn:     ['trước và sau dùng', 'kết quả thật', 'review thật'],
    kr:     ['사용 전후', '진짜 리뷰', '피부 변화'],
    tw:     ['使用前後', '真實評測', '皮膚改善'],
    cn:     ['使用前后', '真实测评', '皮肤改善'],
    global: ['before after skincare', 'real results skincare', 'skin transformation'] },

  { pattern: /skincare|dưỡng da|chăm sóc da/i,
    vn:     ['chăm sóc da mặt', 'routine dưỡng da', 'skincare cho da dầu'],
    kr:     ['스킨케어 루틴', '피부관리', '피부케어 추천'],
    tw:     ['護膚保養', '保養品推薦', '護膚程序'],
    cn:     ['护肤日常', '护肤品推荐', '护肤步骤'],
    global: ['skincare routine', 'skincare review', 'skin care tips'] },

  { pattern: /chống lão hóa|anti.?aging/i,
    vn:     ['dưỡng da chống lão hóa', 'kem dưỡng tuổi 30', 'ngăn ngừa lão hóa'],
    kr:     ['안티에이징', '노화방지', '탄력 케어'],
    tw:     ['抗老保養', '緊緻肌膚', '逆齡精華'],
    cn:     ['抗老化护肤', '紧致肌肤', '逆龄精华'],
    global: ['anti-aging skincare', 'anti-wrinkle serum', 'skin firming routine'] },

  { pattern: /kem dưỡng|moisturizer|lotion|cream/i,
    vn:     ['kem dưỡng ẩm', 'kem dưỡng da ban đêm', 'kem dưỡng cho da khô'],
    kr:     ['보습크림 추천', '수분크림 리뷰', '크림 보습'],
    tw:     ['乳霜推薦', '面霜評測', '保濕乳液'],
    cn:     ['面霜推荐', '保湿乳液', '润肤霜测评'],
    global: ['moisturizer review', 'best face cream', 'skin hydration cream'] }
];

/* Vietnamese term → localized translations */
var VR_DICT = {
  'nám':           { ko: ['기미'],           zh_tw: ['黑斑', '肝斑'],    zh_cn: ['黑斑', '黄褐斑'],    en: ['melasma'] },
  'tàn nhang':     { ko: ['주근깨'],          zh_tw: ['雀斑'],            zh_cn: ['雀斑'],             en: ['freckles'] },
  'đốm nâu':       { ko: ['잡티'],            zh_tw: ['色斑'],            zh_cn: ['色斑'],             en: ['dark spots'] },
  'xỉn màu':       { ko: ['칙칙한 피부'],      zh_tw: ['暗沉'],            zh_cn: ['暗沉'],             en: ['dull skin'] },
  'serum':         { ko: ['세럼'],            zh_tw: ['精華液'],           zh_cn: ['精华液'],           en: [] },
  'kem dưỡng':     { ko: ['보습크림'],         zh_tw: ['乳液'],            zh_cn: ['乳液'],             en: ['moisturizer'] },
  'kem nám':       { ko: ['미백크림'],         zh_tw: ['美白霜'],           zh_cn: ['美白霜'],           en: ['whitening cream'] },
  'chống nắng':    { ko: ['선크림'],           zh_tw: ['防曬'],            zh_cn: ['防晒'],             en: ['sunscreen'] },
  'skincare':      { ko: ['스킨케어'],         zh_tw: ['保養'],            zh_cn: ['护肤'],             en: [] },
  'làm trắng':     { ko: ['미백'],            zh_tw: ['美白'],            zh_cn: ['美白'],             en: ['brightening'] },
  'dưỡng sáng':    { ko: ['발광 피부'],        zh_tw: ['亮膚'],            zh_cn: ['亮肤'],             en: ['glowing skin'] },
  'da đẹp':        { ko: ['피부관리'],         zh_tw: ['美肌'],            zh_cn: ['美肌'],             en: ['perfect skin'] },
  'chống lão hóa': { ko: ['안티에이징'],       zh_tw: ['抗老'],            zh_cn: ['抗老化'],           en: ['anti-aging'] }
};

/* Normalize Vietnamese diacritics for fuzzy matching */
function vrNormVi(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D') /* đ Đ */
    .toLowerCase();
}

function _marketKey(region) {
  if (region === 'kr') return 'kr';
  if (region === 'cn') return 'cn';
  if (region === 'tw') return 'tw';
  if (region === 'vn') return 'vn';
  return 'global';
}

function _dictLang(region) {
  if (region === 'kr') return 'ko';
  if (region === 'cn') return 'zh_cn';
  if (region === 'tw') return 'zh_tw';
  return 'en'; // global, vn fallback
}

/*
 * Market anchor tags appended to localized queries so TikTok Search biases
 * toward content from the target market rather than returning adjacent-market
 * results (e.g. Korean keywords pulling Indonesian K-beauty content).
 */
var VR_MARKET_TAGS = {
  kr: '한국',
  cn: '中国',
  tw: '台灣',
  vn: 'việt nam'
};

/*
 * Get the best single localized query for a region.
 * Tries phrase expansions first, then dict substitution, falls back to original.
 * Appends a market anchor tag so TikTok Search stays in the target market.
 */
function vrLocalizeQuery(keyword, region) {
  var tag = VR_MARKET_TAGS[region] || null;

  if (!region || region === 'global') return keyword;

  /* VN: no translation needed, just append tag */
  if (region === 'vn') return tag ? keyword + ' ' + tag : keyword;

  var mkey = _marketKey(region);
  for (var i = 0; i < VR_PHRASE_EXPANSIONS.length; i++) {
    var exp = VR_PHRASE_EXPANSIONS[i];
    if (exp.pattern.test(keyword)) {
      var variants = exp[mkey];
      if (variants && variants.length > 0) {
        return tag ? variants[0] + ' ' + tag : variants[0];
      }
    }
  }

  var lang = _dictLang(region);
  var kwLow = keyword.toLowerCase();
  var kwNorm = vrNormVi(keyword);
  var terms = Object.keys(VR_DICT);
  for (var j = 0; j < terms.length; j++) {
    var term = terms[j];
    if (kwNorm.indexOf(vrNormVi(term)) !== -1 || kwLow.indexOf(term.toLowerCase()) !== -1) {
      var trans = VR_DICT[term][lang];
      if (trans && trans.length > 0) {
        return tag ? trans[0] + ' ' + tag : trans[0];
      }
    }
  }

  /* No translation found: still append market tag to the original keyword */
  return tag ? keyword + ' ' + tag : keyword;
}

/*
 * Get cross-language synonyms for a keyword — used to widen Library search.
 * Returns lowercase strings from all dict translations.
 */
function vrGetSynonyms(keyword) {
  var kw     = keyword.toLowerCase();
  var kwNorm = vrNormVi(kw);
  var syns   = [];
  var terms  = Object.keys(VR_DICT);

  for (var i = 0; i < terms.length; i++) {
    var term = terms[i];
    if (kwNorm.indexOf(vrNormVi(term)) !== -1 || kw.indexOf(term.toLowerCase()) !== -1) {
      var entry = VR_DICT[term];
      var langs = ['ko', 'zh_tw', 'zh_cn', 'en'];
      for (var j = 0; j < langs.length; j++) {
        var t = entry[langs[j]];
        if (t) {
          for (var k = 0; k < t.length; k++) {
            syns.push(t[k].toLowerCase());
          }
        }
      }
    }
  }

  return syns;
}

/*
 * Generate suggestion chips for a keyword+region.
 * Index 0 = original keyword; rest = localized/expanded variants.
 */
function vrAllVariants(keyword, region) {
  var kw = (keyword || '').trim();
  if (!kw) return [];

  var result = [kw];
  var seen   = {};
  seen[kw.toLowerCase()] = true;

  function add(v) {
    if (v && !seen[v.toLowerCase()]) {
      result.push(v);
      seen[v.toLowerCase()] = true;
    }
  }

  var mkey = _marketKey(region);

  /* Phrase-level expansions */
  for (var i = 0; i < VR_PHRASE_EXPANSIONS.length; i++) {
    var exp = VR_PHRASE_EXPANSIONS[i];
    if (exp.pattern.test(kw)) {
      var targetVars = exp[mkey] || exp.global || [];
      for (var j = 0; j < targetVars.length; j++) add(targetVars[j]);

      /* Also add VN alternatives for non-VN markets */
      if (mkey !== 'vn' && exp.vn) {
        for (var k = 0; k < exp.vn.length; k++) add(exp.vn[k]);
      }
      /* Add global English too */
      if (mkey !== 'global' && exp.global) {
        for (var l = 0; l < exp.global.length; l++) add(exp.global[l]);
      }
      break;
    }
  }

  /* Dict-level cross-language translations */
  var kwNorm = vrNormVi(kw);
  var terms  = Object.keys(VR_DICT);
  for (var t = 0; t < terms.length; t++) {
    var term = terms[t];
    if (kwNorm.indexOf(vrNormVi(term)) !== -1 || kw.toLowerCase().indexOf(term.toLowerCase()) !== -1) {
      var entry = VR_DICT[term];
      var langs = ['ko', 'zh_tw', 'zh_cn', 'en'];
      for (var u = 0; u < langs.length; u++) {
        var trans = entry[langs[u]];
        if (trans) {
          for (var v = 0; v < trans.length; v++) add(trans[v]);
        }
      }
      break;
    }
  }

  return result;
}
