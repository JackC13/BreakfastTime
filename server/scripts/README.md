# 菜單更新工具（menu update scripts）

把外送 / 線上訂餐頁的菜單，半自動寫回 `src/app/core/services/menu-data.service.ts`。
已用這套流程更新了 **達利、麥味登、Q Burger、卯時**（四家全部）。

## 🚀 快速指引（下次更新就照這個做）

```bash
# 0. 切到專案目錄，並用 Node 22（一定要）
cd ~/Documents/Work/DIY/BreakfastTime
source ~/.nvm/nvm.sh && nvm use 22

# 1. 擷取：貼上菜單頁網址（UberEats 或 quickclick 都支援）
node server/scripts/extract-menu.js "<菜單頁網址>"
#   → 印出店家資訊 + 分類/品項數，並存成 server/scripts/out/<店名>.json，先看數字合不合理

# 2. 寫回：指定要更新哪家店
node server/scripts/apply-store.js server/scripts/out/<店名>.json --id <storeId> --keep-meta

# 3. 驗證
npx tsc --noEmit -p tsconfig.app.json     # 沒輸出就是過
npm start                                  # 開 http://localhost:4200 點該分頁看看
```

**`--id` 對照：** `daily`（達利）、`mwd`（麥味登）、`qburger`（Q Burger）、`maoshi`（卯時）

**第 2 步兩種選擇：**
- `--keep-meta` → 只換菜單，店名/地址/時間/電話沿用現有值（**最常用**，同一家店更新菜單）。
- `--badge "新分店名"` → 改成不同分店，地址/時間/電話自動帶入來源抓到的值。

**提醒：**
- UberEats 有反爬蟲，`extract-menu.js` 會自動重試最多 8 次。`html=4xxxx` 是被擋（會自動再試），`html=18xxxxx` 才成功——偶爾等 30 秒～1 分鐘屬正常。
- 寫回前自動備份成 `menu-data.service.ts.bak`，改壞可還原。
- emoji 前綴是自動猜的，不滿意就直接編 `menu-data.service.ts` 改那一格，或調 `apply-store.js` 的 `EMOJI_RULES`。

---

## 前置

- **務必用 Node 22**（`server/.nvmrc` 指定）。Node 16 沒有 global `Headers`，Gemini/部分 API 會壞。
  ```bash
  source ~/.nvm/nvm.sh && nvm use 22
  ```
- 依賴 `server/node_modules`（puppeteer 等），若沒裝過先 `cd server && npm install`。

## 兩步驟

### 1. 擷取菜單 → JSON

```bash
node server/scripts/extract-menu.js "<菜單頁 URL>"
```

- 自動辨識平台：
  - **quickclick.cc** — 直接打官方 JSON API（最乾淨，連套餐選項定價都算得出「起價」）。
  - **ubereats.com** — 解析頁面內嵌的 `catalogSectionsMap` JSON。
    UberEats 有反爬蟲，會間歇回空頁，腳本內建最多重試 8 次（看到 `html=4xxxx` 是被擋，`html=18xxxxx` 才是成功）。
- 產出 `server/scripts/out/<店名>.json`，結構：
  ```json
  {
    "store": { "name": "...", "address": "...", "phone": "...", "hours": "..." },
    "menu":  [ { "category": "漢堡", "items": [ { "name": "香雞漢堡", "price": 45 } ] } ],
    "source": { "platform": "ubereats", "url": "..." }
  }
  ```
- 終端會印出分類/品項數摘要，先確認數字合理再進下一步。

### 2. 寫回 service 檔

```bash
# 改為分店資訊（用 JSON 抓到的 address/hours/phone，badge 自己指定）
node server/scripts/apply-store.js server/scripts/out/<店名>.json --id daily --badge 五股工商店

# 只換菜單、店家資訊全部沿用檔案現有值
node server/scripts/apply-store.js server/scripts/out/<店名>.json --id mwd --keep-meta

# 只想看產生的 TS、先不寫檔
node server/scripts/apply-store.js server/scripts/out/<店名>.json --id daily --dry
```

- `--id` 對應 Store id：`daily` / `mwd` / `qburger` / `maoshi`。
- 會自動依分類關鍵字加 emoji 前綴（猜不準可事後手動改 `EMOJI_RULES` 或直接編檔）。
- 寫檔前自動備份成 `menu-data.service.ts.bak`。

### 3. 驗證

```bash
npx tsc --noEmit -p tsconfig.app.json     # 應無輸出
npm start                                  # 或既有的 ng serve，開 http://localhost:4200 點該分頁
```

## 各平台資料特性（已在腳本內處理）

- **UberEats**：品名是「中文English」直接相黏（或用｜分隔），腳本會剝掉英文只留中文；
  會跳過「人氣精選 / 精選商品 / 注意事項」這類重複或非品項區塊；JSON 用 `\uXXXX` 跳脫，已自動解碼。
- **quickclick**：「選項式定價」的套餐 API 價格是 `$0`，腳本用「各必選修飾組最低選項加總」算出起價；
  價格單位本身就是元（UberEats 是分，腳本已 /100）。

## 已知資料來源

| Store id | 平台 | URL |
|---|---|---|
| daily | quickclick | https://order-rc.quickclick.cc/tw/food/P_r86vY84ww/ |
| mwd | UberEats | https://www.ubereats.com/tw/store/麥味登-五股中興店/sjeDNomJS-mtHCMiavROcA |
| qburger | UberEats | https://www.ubereats.com/tw/store/q-burger-早午餐-五股國小店/BlheytNXSR-KyP4f3a8F2A |
| maoshi | UberEats | https://www.ubereats.com/tw/store/卯時早午餐/nBxbv_feSmOPEFuZvTEB8Q |
