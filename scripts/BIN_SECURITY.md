# BIN 檔案安全機制說明

## 概述

本項目的 `.bin` 檔案採用多層安全機制，確保資料的完整性、來源可信度和防竄改能力。

## 檔案結構

```
┌─────────────────────────────────────────┐
│ Magic Number (8 bytes)                  │  識別碼：aiG.BIN
├─────────────────────────────────────────┤
│ Version (16 bytes)                      │  版本號：1.0.0
├─────────────────────────────────────────┤
│ Signature Length (4 bytes)              │  簽名長度
├─────────────────────────────────────────┤
│ Signature (variable, typically 32 bytes)│  HMAC-SHA256 簽名
├─────────────────────────────────────────┤
│ JSON Index Length (4 bytes)             │  索引長度
├─────────────────────────────────────────┤
│ JSON Index (variable)                   │  動畫索引資料
├─────────────────────────────────────────┤
│ Binary Data (variable)                  │  所有縮圖和動畫資料
└─────────────────────────────────────────┘
```

## 安全機制

### 1. Magic Number（魔數識別）
- **位置**: 檔案開頭 8 bytes
- **內容**: `aiG.BIN`
- **用途**: 快速識別檔案類型，防止錯誤解析

### 2. Version（版本控制）
- **位置**: 第 9-24 bytes
- **內容**: 版本字串（如 `1.0.0`）
- **用途**: 支援向後兼容性，管理格式變更

### 3. HMAC-SHA256 簽名
- **演算法**: HMAC-SHA256
- **密鑰**: 儲存在 `scripts/bin-signature.json`
- **簽名範圍**: 所有資料內容（JSON 索引 + 二進位資料）
- **用途**: 
  - 驗證檔案完整性
  - 偵測任何資料竄改
  - 確保來源可信度

### 4. 驗證機制
提供兩種環境的驗證方式：

#### Node.js 環境
```javascript
import { verifyBinFile } from './scripts/verify-bin.js';

const result = verifyBinFile('./dist/data.bin');
if (result.valid) {
  console.log('驗證通過！', result);
} else {
  console.error('驗證失敗！', result.error);
}
```

#### 瀏覽器環境
```javascript
import { verifyBinSignature, getBinInfo } from './scripts/bin-utils.js';

// 下載 BIN 檔案
const response = await fetch('dist/data.bin');
const buffer = await response.arrayBuffer();

// 驗證簽名
const isValid = await verifyBinSignature(
  buffer, 
  'aiG-binary-package-secret-key-2026',
  'SHA-256'
);

if (isValid) {
  const info = getBinInfo(buffer);
  console.log('驗證通過！', info);
}
```

## 使用方式

### 打包 BIN 檔案
```bash
npm run build
```

### 驗證 BIN 檔案
```bash
npm run verify
```

### 配置檔案
簽名配置儲存在 `scripts/bin-signature.json`：

```json
{
  "secretKey": "aiG-binary-package-secret-key-2026",
  "magicNumber": "aiG.BIN",
  "version": "1.0.0",
  "algorithm": "sha256"
}
```

**注意**: 在生產環境中，應該：
1. 使用環境變數儲存 secretKey
2. 不要將 secretKey 提交到版本控制
3. 定期更換密鑰

## 工具函數

### `bin-utils.js` 提供的函數

- `parseBinHeader(buffer)` - 解析 BIN 檔案頭部
- `verifyBinSignature(buffer, secretKey, algorithm)` - 驗證簽名（瀏覽器）
- `extractFromBin(buffer, id, type)` - 提取指定資料
- `getBinInfo(buffer)` - 取得檔案資訊

### `verify-bin.js` 提供的函數

- `verifyBinFile(binPath)` - 完整驗證 BIN 檔案（Node.js）

## 安全建議

1. **密鑰管理**
   - 不要在客戶端程式碼中硬編碼密鑰
   - 使用環境變數或安全的密鑰管理系統
   - 定期更換密鑰

2. **傳輸安全**
   - 透過 HTTPS 傳輸 BIN 檔案
   - 考慮使用 Subresource Integrity (SRI)

3. **版本控制**
   - 在更新 BIN 格式時遞增版本號
   - 維護不同版本的相容性

4. **錯誤處理**
   - 驗證失敗時拒絕載入資料
   - 記錄驗證失敗事件以便追蹤

## 範例代碼

完整的使用範例請參考：
- `scripts/build-bin.js` - 打包範例
- `scripts/verify-bin.js` - 驗證範例
- `scripts/bin-utils.js` - 工具函數範例
