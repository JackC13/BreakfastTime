# 🍳 早餐店菜單網站

收錄四家早餐店菜單：**達利早餐**、**麥味登**、**Q Burger**、**卯時早午餐**

純靜態網頁，支援 GitHub Pages 部署。

## 📋 收錄店家

| 店家 | 特色 | 官網 |
|------|------|------|
| 達利早餐 | 蛋餅、鮮奶漢堡、鹽可頌、水耕沙拉 | [dailybreakfast.com.tw](https://dailybreakfast.com.tw) |
| 麥味登 | 滿分堡、鐵板麵、手工蔥抓蛋餅 | - |
| Q Burger | 漢堡、鍋燒麵、韓國站系列 | [qburger.com.tw](https://www.qburger.com.tw) |
| 卯時早午餐 | 獨門炒麵、三杯蘿蔔糕、凍檸茶 | - |

## 🚀 部署到 GitHub Pages

### 步驟 1：建立 Repository
1. 登入 GitHub → 點擊 `+` → `New repository`
2. 命名為 `breakfast-menu`，選擇 `Public`

### 步驟 2：上傳檔案
直接將 `index.html` 拖曳上傳到 repository

### 步驟 3：啟用 Pages
Settings → Pages → Source 選擇 `main` branch → Save

### 步驟 4：完成！
網址：`https://你的帳號.github.io/breakfast-menu/`

---

## ✏️ 修改菜單

編輯 `index.html` 中的 `const stores = [...]`：

```javascript
{
    id: 'store-id',
    name: '店家名稱',
    badge: '標籤',
    address: '地址',
    hours: '營業時間',
    menu: {
        '🥪 分類名稱': [
            { name: '品項', price: 50 },
            { name: '人氣品項', price: 60, popular: true },
        ],
    }
}
```

---

## 📱 功能

- ✅ 四家店菜單切換
- ✅ 分類篩選
- ✅ 🔥 人氣商品標示
- ✅ 響應式設計
- ✅ 純靜態，免後端

## 📄 授權

MIT License
