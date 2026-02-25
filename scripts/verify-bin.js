// scripts/verify-bin.js
// 驗證 .bin 檔案的完整性與簽名
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.join(__dirname, '..', 'dist');
const BIN_FILE = path.join(DIST_DIR, 'data.bin');
const SIGNATURE_CONFIG = path.join(__dirname, 'bin-signature.json');

/**
 * 驗證 BIN 檔案
 * @param {string} binPath - BIN 檔案路徑
 * @returns {Object} 驗證結果
 */
export function verifyBinFile(binPath = BIN_FILE) {
  try {
    // 讀取簽名配置
    const signatureConfig = JSON.parse(fs.readFileSync(SIGNATURE_CONFIG, 'utf-8'));
    
    // 讀取 BIN 檔案
    if (!fs.existsSync(binPath)) {
      return {
        valid: false,
        error: 'BIN 檔案不存在'
      };
    }

    const binBuffer = fs.readFileSync(binPath);

    // 驗證最小檔案大小（至少要有 header）
    if (binBuffer.length < 28) { // 8 + 16 + 4 = 28 bytes minimum
      return {
        valid: false,
        error: '檔案大小不正確，可能已損壞'
      };
    }

    let offset = 0;

    // 1. 驗證 Magic Number (8 bytes)
    const magicBuffer = binBuffer.subarray(offset, offset + 8);
    const magic = magicBuffer.toString('utf-8').replace(/\0/g, '');
    offset += 8;

    if (magic !== signatureConfig.magicNumber) {
      return {
        valid: false,
        error: `Magic Number 不符，預期: ${signatureConfig.magicNumber}, 實際: ${magic}`
      };
    }

    // 2. 讀取版本號 (16 bytes)
    const versionBuffer = binBuffer.subarray(offset, offset + 16);
    const version = versionBuffer.toString('utf-8').replace(/\0/g, '');
    offset += 16;

    // 3. 讀取簽名長度 (4 bytes)
    const signatureLength = binBuffer.readUInt32LE(offset);
    offset += 4;

    if (signatureLength <= 0 || signatureLength > 1024) {
      return {
        valid: false,
        error: `簽名長度異常: ${signatureLength}`
      };
    }

    // 4. 讀取簽名
    const signature = binBuffer.subarray(offset, offset + signatureLength);
    offset += signatureLength;

    // 5. 讀取剩餘的資料內容
    const dataBuffer = binBuffer.subarray(offset);

    // 6. 計算資料的簽名
    const hash = crypto.createHmac(signatureConfig.algorithm, signatureConfig.secretKey);
    hash.update(dataBuffer);
    const calculatedSignature = hash.digest();

    // 7. 比對簽名
    const signatureMatch = Buffer.compare(signature, calculatedSignature) === 0;

    if (!signatureMatch) {
      return {
        valid: false,
        error: '簽名驗證失敗，檔案可能已被竄改'
      };
    }

    // 8. 讀取 JSON 索引
    const jsonLength = dataBuffer.readUInt32LE(0);
    const jsonBuffer = dataBuffer.subarray(4, 4 + jsonLength);
    const indexMap = JSON.parse(jsonBuffer.toString('utf-8'));

    return {
      valid: true,
      magic,
      version,
      algorithm: signatureConfig.algorithm,
      fileSize: binBuffer.length,
      itemCount: Object.keys(indexMap).length,
      items: Object.keys(indexMap)
    };

  } catch (error) {
    return {
      valid: false,
      error: `驗證過程發生錯誤: ${error.message}`
    };
  }
}

// 若直接執行此腳本，則進行驗證
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🔐 開始驗證 BIN 檔案...\n');
  
  const result = verifyBinFile();
  
  if (result.valid) {
    console.log('✅ 驗證通過！');
    console.log(`   Magic Number: ${result.magic}`);
    console.log(`   版本: ${result.version}`);
    console.log(`   簽名演算法: ${result.algorithm.toUpperCase()}`);
    console.log(`   檔案大小: ${(result.fileSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   包含項目: ${result.itemCount} 個動畫`);
    console.log(`   項目列表: ${result.items.join(', ')}\n`);
  } else {
    console.error('❌ 驗證失敗！');
    console.error(`   錯誤: ${result.error}\n`);
    process.exit(1);
  }
}
