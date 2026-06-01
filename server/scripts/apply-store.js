#!/usr/bin/env node
/*
 * apply-store.js — 把 extract-menu.js 產出的菜單 JSON 寫回 menu-data.service.ts。
 *
 * 用法：
 *   node server/scripts/apply-store.js out/<檔名>.json --id <storeId> [選項]
 *
 * 選項：
 *   --id <id>          要更新的 Store id（必填，例：daily / mwd / qburger / maoshi）
 *   --badge <文字>      覆寫 badge（預設沿用 JSON 店名末段或保留原值）
 *   --name <文字>       覆寫 name
 *   --keep-meta        只換 menu，name/badge/address/hours/phone 全部沿用檔案內現有值
 *   --dry              只印出產生的 TS 區塊，不寫檔
 *
 * 範例（更新達利、改為分店資訊）：
 *   node server/scripts/apply-store.js out/達利早餐_五股工商店.json --id daily --badge 五股工商店
 *
 * 範例（更新麥味登、保留現有店家資訊只換菜單）：
 *   node server/scripts/apply-store.js out/麥味登_五股中興店.json --id mwd --keep-meta
 */
const path = require('path');
const fs = require('fs');

const SERVICE = path.join(__dirname, '..', '..', 'src', 'app', 'core', 'services', 'menu-data.service.ts');

// 依關鍵字猜 emoji；猜不到給通用餐盤。可事後手動微調。
const EMOJI_RULES = [
  [/期間限定|新品|限定|春果|當季|精選/, '✨'],
  [/可頌/, '🥐'],
  [/丹麥/, '🥨'],
  [/滿分|鬆餅|烤餅|厚片/, '🧇'],
  [/果醬/, '🍓'],
  [/套餐|集合|盤餐|特餐|組合|食光/, '🍱'],
  [/漢堡|堡/, '🍔'],
  [/蛋餅|蛋捲|蔥抓/, '🥚'],
  [/墨西哥/, '🌯'],
  [/乳酪|起司|起士/, '🧀'],
  [/吐司|湯種|總匯|麵包/, '🥪'],
  [/義大利|燉飯|鐵板|炒泡|拌麵|炒麵|中式/, '🍝'],
  [/烏龍|鍋燒|湯/, '🍜'],
  [/沙拉|輕食|水耕/, '🥗'],
  [/咖啡|拿鐵/, '☕'],
  [/飲|茶|氣泡|果汁|豆漿|可可/, '🧋'],
  [/碗/, '🍚'],
  [/小點|點心|炸|薯|雞塊/, '🥟'],
];
function guessEmoji(cat) {
  for (const [re, e] of EMOJI_RULES) if (re.test(cat)) return e;
  return '🍽️';
}

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--keep-meta') a.keepMeta = true;
    else if (t === '--dry') a.dry = true;
    else if (t === '--id') a.id = argv[++i];
    else if (t === '--badge') a.badge = argv[++i];
    else if (t === '--name') a.name = argv[++i];
    else a._.push(t);
  }
  return a;
}

const esc = s => String(s).replace(/'/g, "\\'");

// 從 service 檔讀出指定 id 的現有 store 物件文字（用大括號配對，尊重字串）
function findStoreObject(src, id) {
  const idIdx = src.indexOf(`id: '${id}'`);
  if (idIdx < 0) return null;
  const start = src.lastIndexOf('\n    {\n', idIdx) + 1; // 指向 "    {" 行首
  const braceOpen = src.indexOf('{', start);
  let depth = 0, q = null, esc2 = false, close = -1;
  for (let p = braceOpen; p < src.length; p++) {
    const c = src[p];
    if (esc2) { esc2 = false; continue; }
    if (c === '\\') { esc2 = true; continue; }
    if (q) { if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { close = p; break; } }
  }
  if (close < 0) return null;
  return { start, end: close + 1, text: src.slice(start, close + 1) };
}

function readMeta(objText, key) {
  const m = objText.match(new RegExp(`${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`));
  return m ? m[1] : null;
}

function emitBlock(data, opts, existing) {
  const s = data.store || {};
  const pick = (cliVal, jsonVal, existingVal) =>
    opts.keepMeta ? (existingVal ?? jsonVal) : (cliVal ?? existingVal ?? jsonVal);
  const name = opts.name ?? (opts.keepMeta ? existing.name : (existing.name ?? s.name));
  const badge = opts.badge ?? (opts.keepMeta ? existing.badge : (existing.badge ?? s.name));
  const address = pick(null, s.address, existing.address);
  const hours = pick(null, s.hours, existing.hours);
  const phone = pick(null, s.phone, existing.phone);

  let out = '    {\n';
  out += `      id: '${esc(opts.id)}',\n`;
  out += `      name: '${esc(name)}',\n`;
  out += `      badge: '${esc(badge)}',\n`;
  if (address) out += `      address: '${esc(address)}',\n`;
  if (hours) out += `      hours: '${esc(hours)}',\n`;
  if (phone) out += `      phone: '${esc(phone)}',\n`;
  if (existing.website) out += `      website: '${esc(existing.website)}',\n`;
  out += '      menu: {\n';
  for (const c of data.menu) {
    const key = `${guessEmoji(c.category)} ${c.category}`;
    out += `        '${esc(key)}': [\n`;
    for (const it of c.items) out += `          { name: '${esc(it.name)}', price: ${it.price} },\n`;
    out += '        ],\n';
  }
  out += '      },\n';
  out += '    }';
  return out;
}

(async () => {
  const opts = parseArgs(process.argv.slice(2));
  const jsonPath = opts._[0];
  if (!jsonPath || !opts.id) { console.error('用法: node apply-store.js <menu.json> --id <storeId> [--badge ..] [--keep-meta] [--dry]'); process.exit(1); }
  const data = JSON.parse(fs.readFileSync(path.resolve(jsonPath), 'utf-8'));

  let src = fs.readFileSync(SERVICE, 'utf-8');
  const obj = findStoreObject(src, opts.id);
  if (!obj) { console.error(`找不到 id: '${opts.id}' 的 store`); process.exit(1); }
  const existing = {
    name: readMeta(obj.text, 'name'),
    badge: readMeta(obj.text, 'badge'),
    address: readMeta(obj.text, 'address'),
    hours: readMeta(obj.text, 'hours'),
    phone: readMeta(obj.text, 'phone'),
    website: readMeta(obj.text, 'website'),
  };

  const block = emitBlock(data, opts, existing);
  if (opts.dry) { process.stdout.write(block + '\n'); return; }

  const next = src.slice(0, obj.start) + block + src.slice(obj.end);
  const bak = SERVICE + '.bak';
  fs.writeFileSync(bak, src);
  fs.writeFileSync(SERVICE, next);
  const total = data.menu.reduce((n, c) => n + c.items.length, 0);
  console.error(`已更新 '${opts.id}'：${data.menu.length} 分類 / ${total} 品項`);
  console.error(`備份：${bak}`);
  console.error('請執行 `npx tsc --noEmit -p tsconfig.app.json` 確認，再到 http://localhost:4200 檢視。');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
