# 🚀 快速開始指南

## 第一次使用

### 1. 安裝依賴

```bash
npm install
```

### 2. 建置資料庫

```bash
npm run build
```

這會掃描 `assets/` 目錄中的所有 `.webp` 檔案，並產生 `dist/data.bin`

### 3. 啟動開發伺服器

```bash
npm run dev
```

瀏覽器會自動開啟 `http://localhost:8080`

## 📝 開發流程

### 新增動畫

1. 將新的 `.webp` 動畫檔案放入 `assets/` 目錄
2. 重新執行 `npm run build`
3. 重新整理瀏覽器

### 檔案結構

```
aiG/
├── assets/           ← 放置 WebP 動畫檔案
│   ├── 001.webp
│   ├── 002.webp
│   └── ...
├── dist/            ← 建置產物
│   └── data.bin
├── src/             ← 核心引擎
│   └── GalleryEngine.js
├── scripts/         ← 建置腳本
│   └── build-bin.js
└── index.html       ← 範例頁面
```

## 🎯 核心概念

### 建置階段
`npm run build` 會：
- 讀取所有 WebP 動畫
- 提取第一幀作為縮圖
- 計算寬高資訊
- 封裝成單一 `.bin` 檔案

### 執行階段
瀏覽器載入時：
- 一次性載入 `data.bin`
- 預先顯示所有縮圖（極小）
- 點擊時才載入完整動畫
- 同時只播放 1 個動畫
- 離開視窗自動釋放記憶體

## 💡 常見問題

### Q: 為什麼直接開啟 index.html 會失敗？

A: 因為使用了 `fetch()` API，必須透過 HTTP 伺服器執行。請使用 `npm run dev`。

### Q: 如何產生 WebP 動畫？

A: 使用 FFmpeg：

```bash
# 從 GIF 轉換
ffmpeg -i input.gif -c:v libwebp -q:v 80 output.webp

# 從影片轉換
ffmpeg -i input.mp4 -vf "fps=24,scale=800:-1" -c:v libwebp -q:v 75 output.webp
```

### Q: 建置後檔案在哪裡？

A: `dist/data.bin` - 這是唯一需要部署到伺服器的資料檔案（除了 HTML/CSS/JS）。

### Q: 可以與 React/Vue 整合嗎？

A: 可以！這是純 Vanilla JS，可以在任何框架中使用：

```javascript
import { GalleryEngine } from './src/GalleryEngine.js';

// React useEffect
useEffect(() => {
  const engine = new GalleryEngine(containerRef.current);
  engine.load('./dist/data.bin');
  return () => engine.dispose();
}, []);
```

## 🔧 進階使用

### 手動控制動畫

```javascript
const engine = new GalleryEngine(container);
await engine.load('./dist/data.bin');

// 播放指定動畫
const img = document.querySelector('img[data-id="001"]');
engine.playAnimation('001', img);

// 停止當前動畫
engine.stopActiveAnimation();
```

### 整合虛擬滾動

```javascript
// 取得項目資料用於計算高度
const data = engine.getItemData('001');
const aspectRatio = data.height / data.width;
const itemHeight = containerWidth * aspectRatio;
```

---

**開始打造你的極致效能圖庫！** 🎬
