# Sources 目錄

這個目錄用於存放需要轉換的原始 WebP 動畫檔案。

## 使用方法

1. **放置 WebP 動畫**
   - 將你的 `.webp` 動畫檔案複製到這個目錄中

2. **執行轉換**
   ```bash
   npm run webp2mp4
   ```

3. **查看結果**
   - 轉換後的 MP4 影片會輸出到 `assets/` 目錄
   - 拆解的 PNG 影格會保留在 `temp/` 子目錄中

## 目錄結構

```
sources/
├── README.md           ← 你正在閱讀的檔案
├── animation1.webp     ← 放置你的 WebP 動畫
├── animation2.webp
└── temp/               ← 自動創建，存放 PNG 影格
    ├── animation1/
    │   ├── frame_0001.png
    │   ├── frame_0002.png
    │   └── ...
    └── animation2/
        └── ...
```

## 注意事項

- `temp/` 目錄中的 PNG 影格不會自動刪除
- 如需清理空間，可手動刪除 `temp/` 目錄
- 支援處理多個 WebP 檔案
- 支援不同大小和幀數的動畫

## 詳細說明

請參閱專案根目錄的 `WEBP_TO_MP4_GUIDE.md` 檔案。
