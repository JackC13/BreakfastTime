#!/usr/bin/env node
/*
 * extract-menu.js — 從外送/線上訂餐頁擷取菜單，輸出乾淨 JSON。
 *
 * 支援平台：
 *   - UberEats   (ubereats.com)      解析頁面內嵌 catalogSectionsMap JSON
 *   - quickclick (quickclick.cc)     直接打官方 JSON API（含套餐選項定價）
 *
 * 用法（務必用 Node 22，見 ../.nvmrc）：
 *   nvm use 22
 *   node server/scripts/extract-menu.js "<URL>"
 *
 * 產出：server/scripts/out/<key>.json
 *   { store: {name, address, phone, hours}, menu: [ {category, items:[{name,price}]} ] }
 *
 * 下一步：用 build-store-block.js 轉成 TS，再用 apply-store.js 寫回 menu-data.service.ts。
 */
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(__dirname, '..', 'node_modules', 'puppeteer'));

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const OUT_DIR = path.join(__dirname, 'out');

function detectPlatform(url) {
  if (/ubereats\.com/i.test(url)) return 'ubereats';
  if (/quickclick\.cc/i.test(url)) return 'quickclick';
  return null;
}

// ---------- shared name cleaning ----------
function unq(s) { try { return JSON.parse('"' + s + '"'); } catch (e) { return s; } }
function urlfix(s) {
  let t = s;
  try { t = decodeURIComponent(s); } catch (e) {
    t = s.replace(/%5Cn/gi, ' ').replace(/%5C/gi, '').replace(/%25/g, '%');
  }
  return t.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function cleanName(t) {
  let n = urlfix(t || '').split('｜')[0].split('|')[0];
  n = n.replace(/\s+[A-Za-z][\x00-\x7F]*$/, '');      // strip trailing " English"
  n = n.replace(/[A-Za-z][A-Za-z0-9\-&'.() ]*$/, ''); // strip trailing glued English
  n = n.replace(/[\s.．。·・、，,]+$/, '');              // strip trailing punctuation/dots
  return n.trim();
}

// ---------- UberEats ----------
async function fetchUberHtml(url) {
  for (let i = 1; i <= 8; i++) {
    const b = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    try {
      const p = await b.newPage();
      await p.setUserAgent(UA);
      await p.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
      await new Promise(r => setTimeout(r, 2000));
      const html = await p.content();
      process.stderr.write(`  uber fetch attempt ${i}: html=${html.length}\n`);
      if (html.length > 500000 && html.includes('catalogSectionsMap')) return html;
    } finally { await b.close(); }
  }
  throw new Error('UberEats 頁面抓取失敗（反爬蟲擋下，請重試）');
}

function extractUber(html) {
  const re = /<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g;
  let m, blobs = [];
  while ((m = re.exec(html))) blobs.push(m[1]);
  const htmlDecode = s => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const unescU = s => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  blobs.sort((a, b) => b.length - a.length);
  let big = '';
  for (const blob of blobs) { const t = unescU(htmlDecode(blob)); if (t.includes('catalogSectionsMap')) { big = t; break; } }
  if (!big) throw new Error('找不到 catalogSectionsMap 區塊');

  const grab = key => { const mm = big.match(new RegExp('"' + key + '":"((?:[^"\\\\]|\\\\.)*)"')); return mm ? unq(mm[1]) : null; };
  const store = {
    name: grab('title'),
    address: grab('streetAddress'),
    phone: grab('phoneNumber') || null,
    hours: null,
  };

  const cats = [];
  const catRe = /"standardItemsPayload":\{"title":\{"text":"((?:[^"\\]|\\.)*)"\}/g;
  while ((m = catRe.exec(big))) cats.push({ idx: m.index, name: cleanName(unq(m[1])) });
  const itemRe = /"title":"((?:[^"\\]|\\.)*)","itemDescription":"((?:[^"\\]|\\.)*)","price":(\d+),"priceTagline"/g;
  const items = [];
  while ((m = itemRe.exec(big))) items.push({ idx: m.index, name: cleanName(unq(m[1])), price: Math.round(parseInt(m[3], 10) / 100) });

  const SKIP = name => /^(人氣精選|精選商品|注意事項)/.test(name);
  const catFor = idx => { let best = '其他'; for (const c of cats) { if (c.idx < idx) best = c.name; else break; } return best; };
  const grouped = {}, order = [], seen = new Set();
  for (const it of items) {
    const cat = catFor(it.idx);
    if (SKIP(cat) || !it.price || seen.has(it.name)) continue;
    seen.add(it.name);
    if (!grouped[cat]) { grouped[cat] = []; order.push(cat); }
    grouped[cat].push({ name: it.name, price: it.price });
  }
  return { store, menu: order.map(c => ({ category: c, items: grouped[c] })) };
}

// ---------- quickclick ----------
async function extractQuickclick(url) {
  const shopId = (url.match(/\/food\/([^/?#]+)/) || [])[1];
  if (!shopId) throw new Error('無法從 URL 取得 quickclick shopId');
  const origin = new URL(url).origin;
  const b = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  const hits = {};
  try {
    const p = await b.newPage();
    await p.setUserAgent(UA);
    p.on('response', async res => {
      const u = res.url();
      const ct = res.headers()['content-type'] || '';
      if (!ct.includes('application/json')) return;
      try {
        if (/\/menu\/\d+\/products/.test(u)) hits.products = await res.json();
        else if (/\/menu\/\d+\/category/.test(u)) hits.category = await res.json();
        else if (/\/menus\/\d+$/.test(u)) hits.menus = await res.json();
        else if (new RegExp('/apis/shops/' + shopId + '$').test(u)) hits.shop = await res.json();
      } catch (e) {}
    });
    await p.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise(r => setTimeout(r, 3000));
  } finally { await b.close(); }

  if (!hits.products || !hits.category) throw new Error('未攔截到 quickclick 菜單 API（products/category）');

  // shop info: 直接打穩定端點（攔截常因時序失敗）
  if (!hits.shop) {
    try { hits.shop = await (await fetch(`${origin}/apis/shops/${shopId}`, { headers: { 'User-Agent': UA } })).json(); }
    catch (e) {}
  }

  // starting price for option-priced (amount 0) combos
  const startByTitle = new Map();
  if (hits.menus && hits.menus.modifierOptions) {
    const oById = new Map(hits.menus.modifierOptions.map(o => [o.id, o]));
    for (const p of hits.menus.products) {
      if (p.price !== 0) continue;
      let sum = 0;
      for (const g of p.modifierGroupIds || []) {
        const min = g.constraintRules?.quantity?.min || 0;
        if (min < 1) continue;
        const prices = g.modifierOptionIds.map(o => oById.get(o.id)?.price || 0).filter(x => x > 0);
        if (prices.length) sum += Math.min(...prices);
      }
      if (sum > 0) startByTitle.set(p.title, sum);
    }
  }

  const catById = new Map(hits.category.map(c => [c.categoryId, c]));
  const catSorted = [...hits.category].sort((a, b) => a.categoryPriority - b.categoryPriority);
  const menu = [];
  for (const c of catSorted) {
    const items = hits.products
      .filter(p => p.productCategoryId === c.categoryId && p.isVisibled === 1)
      .sort((a, b) => (a.productPriority - b.productPriority) || (a.productMapPriority - b.productMapPriority))
      .map(p => ({ name: p.productName, price: p.productAmount || startByTitle.get(p.productName) || 0 }))
      .filter(it => it.price > 0);
    if (items.length) menu.push({ category: c.categoryName, items });
  }
  const shop = hits.shop || {};
  const store = {
    name: shop.name || null,
    address: shop.address || null,
    phone: shop.phone || null,
    hours: (shop.info || '').replace(/\n/g, ' / ') || null,
  };
  return { store, menu };
}

// ---------- main ----------
(async () => {
  const url = process.argv[2];
  if (!url) { console.error('用法: node extract-menu.js "<URL>"'); process.exit(1); }
  const platform = detectPlatform(url);
  if (!platform) { console.error('不支援的網址（僅支援 ubereats.com / quickclick.cc）'); process.exit(1); }
  process.stderr.write(`platform = ${platform}\n`);

  let result;
  if (platform === 'ubereats') result = extractUber(await fetchUberHtml(url));
  else result = await extractQuickclick(url);
  result.source = { platform, url, fetchedWith: 'extract-menu.js' };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const key = (result.store.name || 'store').replace(/[^\w一-鿿]+/g, '_').slice(0, 40);
  const file = path.join(OUT_DIR, key + '.json');
  fs.writeFileSync(file, JSON.stringify(result, null, 2));

  const total = result.menu.reduce((n, c) => n + c.items.length, 0);
  process.stderr.write(`\n店家: ${result.store.name}\n地址: ${result.store.address}\n電話: ${result.store.phone}\n時間: ${result.store.hours}\n`);
  process.stderr.write(`分類 ${result.menu.length}、品項 ${total}\n`);
  result.menu.forEach(c => process.stderr.write(`  ${String(c.items.length).padStart(3)}  ${c.category}\n`));
  process.stderr.write(`\n已寫出: ${file}\n`);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
