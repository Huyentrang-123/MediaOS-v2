/* parseCount unit tests — covers both TikTok and Facebook parser logic */

/* TikTok version (K/M/B/T) */
function parseCountTikTok(text) {
  if (!text) return null;
  const s = text.replace(/,/g, '').trim();
  const m = s.match(/^([\d.]+)\s*([KkMmBbTt]?)$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (isNaN(n)) return null;
  const mul = { k: 1e3, m: 1e6, b: 1e9, t: 1e9 }[m[2].toLowerCase()] || 1;
  return Math.round(n * mul);
}

/* Facebook version (K/M/B + Vietnamese nghìn/triệu/tỷ) */
function parseCountFacebook(text) {
  if (!text) return null;
  const vn = text.match(/([\d,]+(?:[.,]\d+)?)\s*(nghìn|triệu|tỷ)/i);
  if (vn) {
    const n   = parseFloat(vn[1].replace(',', '.'));
    const mul = { nghìn: 1e3, triệu: 1e6, tỷ: 1e9 }[vn[2].toLowerCase()];
    return Math.round(n * mul);
  }
  const s = text.replace(/,/g, '').trim();
  const m = s.match(/^([\d.]+)\s*([KkMmBb]?)$/);
  if (!m) return null;
  const n   = parseFloat(m[1]);
  if (isNaN(n)) return null;
  const mul = { k: 1e3, m: 1e6, b: 1e9 }[m[2].toLowerCase()] || 1;
  return Math.round(n * mul);
}

let pass = 0, fail = 0;
function check(label, got, expected) {
  if (got === expected) {
    console.log('  PASS:', label, '→', got);
    pass++;
  } else {
    console.log('  FAIL:', label, '→ got', got, 'expected', expected);
    fail++;
  }
}

console.log('\n=== TikTok parseCount ===');
check('"450K"',    parseCountTikTok('450K'),    450000);
check('"2.3M"',    parseCountTikTok('2.3M'),    2300000);
check('"1.1M"',    parseCountTikTok('1.1M'),    1100000);
check('"89K"',     parseCountTikTok('89K'),     89000);
check('"12.5K"',   parseCountTikTok('12.5K'),   12500);
check('"5.2K"',    parseCountTikTok('5.2K'),    5200);
check('"1B"',      parseCountTikTok('1B'),      1000000000);
check('"100"',     parseCountTikTok('100'),     100);
check('"1,200"',   parseCountTikTok('1,200'),   1200);
check('""',        parseCountTikTok(''),        null);
check('"abc"',     parseCountTikTok('abc'),     null);
check('"null"',    parseCountTikTok(null),      null);

console.log('\n=== Facebook parseCount ===');
check('"1.2M"',          parseCountFacebook('1.2M'),          1200000);
check('"45K"',           parseCountFacebook('45K'),           45000);
check('"890"',           parseCountFacebook('890'),           890);
check('"1,2 nghìn"',     parseCountFacebook('1,2 nghìn'),     1200);
check('"1,5 triệu"',     parseCountFacebook('1,5 triệu'),     1500000);
check('"850.000 lượt"',  parseCountFacebook('850000'),        850000);
check('"2 tỷ"',          parseCountFacebook('2 tỷ'),          2000000000);
check('"12.000"',        parseCountFacebook('12000'),         12000);
check('"abc"',           parseCountFacebook('abc'),           null);
check('"null"',          parseCountFacebook(null),            null);

console.log('\n=== Summary ===');
console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
