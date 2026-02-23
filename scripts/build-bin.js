// scripts/build-bin.js
// 建置期打包腳本：將所有 WebP 動畫與縮圖封裝成單一 .bin 檔案
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const DIST_DIR = path.join(__dirname, '..', 'dist');
const OUTPUT_FILE = path.join(DIST_DIR, 'data.bin');

async function build() {
  console.log('🚀 開始建置 WebP 動畫資料庫...\n');

  // 確保 assets 目錄存在
  if (!fs.existsSync(ASSETS_DIR)) {
    console.error('❌ 錯誤：assets 目錄不存在');
    process.exit(1);
  }

  // 讀取所有 .webp 檔案
  const files = fs.readdirSync(ASSETS_DIR).filter(f => f.endsWith('.webp'));
  
  if (files.length === 0) {
    console.error('❌ 錯誤：assets 目錄中沒有找到 .webp 檔案');
    console.log('💡 提示：請將 WebP 動畫檔案放置在 assets/ 目錄中');
    process.exit(1);
  }

  console.log(`📂 找到 ${files.length} 個 WebP 檔案`);

  let offset = 0;
  const indexMap = {};
  const buffers = [];

  // 處理每個 WebP 檔案
  for (const file of files) {
    const id = file.replace('.webp', '');
    const filePath = path.join(ASSETS_DIR, file);
    const animBuffer = fs.readFileSync(filePath);
    
    console.log(`   處理中: ${file}`);

    try {
      // 取得 Metadata (寬高)
      const metadata = await sharp(animBuffer).metadata();
      
      // 抽出第一幀轉為靜態 WebP 縮圖
      const thumbBuffer = await sharp(animBuffer)
        .webp({ quality: 80 })
        .toBuffer();

      // 記錄索引資訊
      indexMap[id] = {
        width: metadata.width,
        height: metadata.height,
        thumb: { 
          offset, 
          length: thumbBuffer.length 
        },
        anim: { 
          offset: offset + thumbBuffer.length, 
          length: animBuffer.length 
        }
      };

      // 加入緩衝區陣列
      buffers.push(thumbBuffer, animBuffer);
      offset += (thumbBuffer.length + animBuffer.length);

      console.log(`      ✓ ${metadata.width}x${metadata.height} | 縮圖: ${(thumbBuffer.length / 1024).toFixed(2)}KB | 動畫: ${(animBuffer.length / 1024).toFixed(2)}KB`);
    } catch (error) {
      console.error(`      ✗ 處理失敗: ${error.message}`);
      continue;
    }
  }

  // 建立 JSON 索引緩衝區
  const jsonBuffer = Buffer.from(JSON.stringify(indexMap), 'utf-8');
  const headerBuffer = Buffer.alloc(4);
  headerBuffer.writeUInt32LE(jsonBuffer.length, 0);

  // 確保 dist 目錄存在
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  // 寫入最終 .bin 檔案
  const finalBuffer = Buffer.concat([headerBuffer, jsonBuffer, ...buffers]);
  fs.writeFileSync(OUTPUT_FILE, finalBuffer);

  console.log(`\n✅ 打包完成！`);
  console.log(`   檔案位置: ${OUTPUT_FILE}`);
  console.log(`   總大小: ${(finalBuffer.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   包含項目: ${Object.keys(indexMap).length} 個動畫\n`);
}

// 執行建置
build().catch(err => {
  console.error('❌ 建置失敗:', err);
  process.exit(1);
});
