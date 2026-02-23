# Assets 目錄

此目錄用於存放 WebP 動畫原始檔案。

## 📂 使用說明

1. **放置檔案**: 將所有 `.webp` 動畫檔案放入此目錄
2. **執行建置**: 運行 `npm run build` 來產生 `dist/data.bin`
3. **檔案命名**: 檔案名稱會作為動畫 ID，建議使用有意義的名稱

## 📝 範例結構

```
assets/
├── cat-walking.webp
├── dog-running.webp
├── bird-flying.webp
└── fish-swimming.webp
```

## 🎨 如何產生 WebP 動畫

### 從 GIF 轉換

```bash
ffmpeg -i input.gif -c:v libwebp -lossless 0 -q:v 80 output.webp
```

### 從影片轉換

```bash
ffmpeg -i input.mp4 -vf "fps=24,scale=800:-1" -c:v libwebp -lossless 0 -q:v 75 -loop 0 output.webp
```

### 參數說明

- `-q:v 80`: 品質 (0-100，數值越小品質越高但檔案越大)
- `-lossless 0`: 使用有損壓縮 (行動端建議)
- `-loop 0`: 無限循環播放
- `fps=24`: 每秒 24 幀 (可調整)

## ⚠️ 注意事項

- 確保檔案是 **WebP 動畫格式**，而非靜態 WebP
- 建議單檔大小控制在 **50-200KB** 之間以獲得最佳效能
- 動畫尺寸建議不超過 **1000x1000px**
- 檔案名稱請使用 **英文、數字、底線、連字號**，避免特殊字元

## 🔍 驗證檔案

確認 WebP 是否為動畫格式：

```bash
ffprobe your-file.webp
```

輸出應該包含 `Duration: 00:00:XX.XX`（動畫有時長）

## 📊 建議規格

| 屬性 | 建議值 | 說明 |
|------|--------|------|
| 尺寸 | 500-800px | 適合行動裝置 |
| 品質 | 70-80 | 平衡品質與檔案大小 |
| 幀率 | 15-24 fps | 流暢度與效能平衡 |
| 時長 | 1-3 秒 | 循環播放體驗佳 |
| 檔案大小 | < 200KB | 快速載入 |

---

放置好檔案後，執行 `npm run build` 開始建置！🚀
