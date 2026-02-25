// scripts/bin-utils.js
// BIN 檔案工具函數（可在瀏覽器和 Node.js 環境使用）

/**
 * 解析 BIN 檔案頭部資訊
 * @param {ArrayBuffer} buffer - BIN 檔案的 ArrayBuffer
 * @returns {Object} 解析結果
 */
export function parseBinHeader(buffer) {
  const view = new DataView(buffer);
  let offset = 0;

  // 1. Magic Number (8 bytes)
  const magicBytes = new Uint8Array(buffer, offset, 8);
  const magic = new TextDecoder().decode(magicBytes).replace(/\0/g, '');
  offset += 8;

  // 2. Version (16 bytes)
  const versionBytes = new Uint8Array(buffer, offset, 16);
  const version = new TextDecoder().decode(versionBytes).replace(/\0/g, '');
  offset += 16;

  // 3. Signature Length (4 bytes)
  const signatureLength = view.getUint32(offset, true);
  offset += 4;

  // 4. Signature
  const signature = new Uint8Array(buffer, offset, signatureLength);
  offset += signatureLength;

  // 5. Data Length (4 bytes)
  const dataStartOffset = offset;
  const jsonLength = view.getUint32(offset, true);
  offset += 4;

  // 6. JSON Index
  const jsonBytes = new Uint8Array(buffer, offset, jsonLength);
  const indexMap = JSON.parse(new TextDecoder().decode(jsonBytes));
  offset += jsonLength;

  return {
    magic,
    version,
    signature,
    signatureLength,
    dataStartOffset,
    jsonLength,
    indexMap,
    binaryDataOffset: offset
  };
}

/**
 * 驗證 BIN 檔案簽名（僅瀏覽器環境，使用 Web Crypto API）
 * @param {ArrayBuffer} buffer - BIN 檔案的 ArrayBuffer
 * @param {string} secretKey - 密鑰
 * @param {string} algorithm - 演算法（預設 'SHA-256'）
 * @returns {Promise<boolean>} 是否驗證通過
 */
export async function verifyBinSignature(buffer, secretKey, algorithm = 'SHA-256') {
  try {
    const view = new DataView(buffer);
    let offset = 0;

    // 跳過 Magic Number (8 bytes)
    offset += 8;

    // 跳過 Version (16 bytes)
    offset += 16;

    // 讀取簽名長度
    const signatureLength = view.getUint32(offset, true);
    offset += 4;

    // 讀取儲存的簽名
    const storedSignature = new Uint8Array(buffer, offset, signatureLength);
    offset += signatureLength;

    // 剩餘的資料內容
    const dataBuffer = buffer.slice(offset);

    // 使用 Web Crypto API 計算 HMAC
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: algorithm },
      false,
      ['sign']
    );

    const calculatedSignature = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      dataBuffer
    );

    // 比較簽名
    const calculated = new Uint8Array(calculatedSignature);
    
    if (calculated.length !== storedSignature.length) {
      return false;
    }

    for (let i = 0; i < calculated.length; i++) {
      if (calculated[i] !== storedSignature[i]) {
        return false;
      }
    }

    return true;

  } catch (error) {
    console.error('驗證簽名時發生錯誤:', error);
    return false;
  }
}

/**
 * 從 BIN 檔案中提取指定 ID 的資料
 * @param {ArrayBuffer} buffer - BIN 檔案的 ArrayBuffer
 * @param {string} id - 動畫 ID
 * @param {string} type - 'thumb' 或 'anim'
 * @returns {Object|null} 資料物件或 null
 */
export function extractFromBin(buffer, id, type = 'anim') {
  try {
    const header = parseBinHeader(buffer);
    const item = header.indexMap[id];
    
    if (!item) {
      console.warn(`找不到 ID: ${id}`);
      return null;
    }

    const resource = item[type];
    if (!resource) {
      console.warn(`ID ${id} 沒有 ${type} 資源`);
      return null;
    }

    // 計算實際偏移（要加上二進位資料的起始位置）
    const actualOffset = header.binaryDataOffset + resource.offset;
    const data = buffer.slice(actualOffset, actualOffset + resource.length);

    return {
      id,
      type: item.type,
      width: item.width,
      height: item.height,
      data: data,
      blob: new Blob([data], { 
        type: type === 'thumb' ? 'image/webp' : `${item.type === 'mp4' ? 'video' : 'image'}/${item.type}`
      })
    };

  } catch (error) {
    console.error('提取資料時發生錯誤:', error);
    return null;
  }
}

/**
 * 取得 BIN 檔案的完整資訊
 * @param {ArrayBuffer} buffer - BIN 檔案的 ArrayBuffer
 * @returns {Object} 資訊物件
 */
export function getBinInfo(buffer) {
  const header = parseBinHeader(buffer);
  const items = Object.keys(header.indexMap);
  
  return {
    magic: header.magic,
    version: header.version,
    itemCount: items.length,
    items: items,
    totalSize: buffer.byteLength,
    indexMap: header.indexMap
  };
}
