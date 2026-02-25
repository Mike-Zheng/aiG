# BIN 檔案驗證機制

## 概述

本專案的 BIN 檔案讀取已升級為安全驗證模式，確保只載入合法且未被篡改的資原始檔。

## 驗證流程

當使用者上傳 `.bin` 檔案時，系統會執行以下驗證步驟：

### 1. 檔案大小檢查

- 最小檔案大小：28 bytes（包含檔案頭）
- 不滿足則拒絕載入

### 2. Magic Number 驗證

- **預期值**: `aiG.BIN`
- **位置**: 檔案開頭 8 bytes
- **用途**: 快速識別檔案型別
- 不正確則顯示錯誤：`無效的檔案格式！預期: aiG.BIN, 實際: XXX`

### 3. 版本號讀取

- **位置**: 第 9-24 bytes
- **用途**: 標識檔案格式版本
- 當前支援版本：`1.0.0`

### 4. 簽名驗證（核心安全機制）

- **演算法**: HMAC-SHA256
- **金鑰**: `aiG-binary-package-secret-key-2026`
- **驗證範圍**: 所有資料內容（JSON 索引 + 二進位制資料）
- **驗證失敗**則顯示：`簽名驗證失敗！檔案可能已被篡改或損壞`

### 5. 資料解析

驗證透過後，系統將解析：

- JSON 索引（動畫後設資料）
- 二進位制資料（縮圖和動畫檔案）

## 檔案結構

```
┌─────────────────────────────────────────┐
│ Magic Number (8 bytes)                  │  "aiG.BIN"
├─────────────────────────────────────────┤
│ Version (16 bytes)                      │  "1.0.0"
├─────────────────────────────────────────┤
│ Signature Length (4 bytes)              │  通常為 32
├─────────────────────────────────────────┤
│ Signature (32 bytes)                    │  HMAC-SHA256
├─────────────────────────────────────────┤
│ JSON Index Length (4 bytes)             │
├─────────────────────────────────────────┤
│ JSON Index (variable)                   │
├─────────────────────────────────────────┤
│ Binary Data (variable)                  │
└─────────────────────────────────────────┘
```

## 錯誤處理

### 常見錯誤及解決方案

| 錯誤資訊 | 原因 | 解決方案 |
|---------|------|---------|
| 檔案大小不正確 | 檔案損壞或不是 BIN 檔案 | 重新生成 BIN 檔案 |
| 無效的檔案格式 | Magic Number 不匹配 | 確認檔案由 `npm run build` 生成 |
| 簽名驗證失敗 | 檔案被修改或金鑰不匹配 | 重新打包或檢查 bin-signature.json |

## 使用說明

### 打包檔案

```bash
npm run build
```

生成的 `dist/data.bin` 檔案會包含：

- 正確的 Magic Number
- 版本資訊
- HMAC-SHA256 簽名

### 驗證檔案（Node.js）

```bash
npm run verify
```

### 在瀏覽器中使用

1. 點選頁面 20 次解鎖上傳功能
2. 選擇 `.bin` 檔案
3. 系統自動驗證
4. 驗證透過後顯示相簿

## 安全注意事項

### ⚠️ 金鑰管理

- 當前金鑰寫在程式碼中，僅用於基本完整性驗證
- **生產環境建議**：
  - 使用環境變數儲存金鑰
  - 實現伺服器端驗證
  - 定期更換金鑰

### 🔒 傳輸安全

- 建議透過 HTTPS 傳輸 BIN 檔案
- 可考慮使用 Subresource Integrity (SRI)

### 📝 版本相容

- 系統會顯示 BIN 檔案版本
- 未來可實現多版本相容邏輯

## 開發資訊

### 相關檔案

- [index.html](index.html#L471) - 驗證邏輯實現
- [scripts/build-bin.js](scripts/build-bin.js) - 打包指令碼
- [scripts/verify-bin.js](scripts/verify-bin.js) - 驗證工具
- [scripts/bin-signature.json](scripts/bin-signature.json) - 簽名配置

### 驗證方法

瀏覽器環境使用 Web Crypto API：

```javascript
const cryptoKey = await crypto.subtle.importKey(
  'raw',
  keyData,
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign']
);

const signature = await crypto.subtle.sign(
  'HMAC',
  cryptoKey,
  dataBuffer
);
```

## 除錯

### 檢視驗證日誌

開啟瀏覽器開發者工具（F12），Console 標籤會顯示：

- ✅ 簽名驗證透過
- 📦 BIN 檔案版本: 1.0.0
- 📋 檔案資訊: aiG.BIN v1.0.0

### 測試無效檔案

上傳非 BIN 檔案或舊格式檔案會看到友好的錯誤提示。
