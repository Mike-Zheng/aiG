// scripts/build-bin.js
// 建置期打包腳本：將所有 WebP/GIF/MP4 動畫與縮圖封裝成單一 .bin 檔案
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const DIST_DIR = path.join(__dirname, '..', 'dist');
const OUTPUT_FILE = path.join(DIST_DIR, 'data.bin');
const SIGNATURE_CONFIG = path.join(__dirname, 'bin-signature.json');

// 讀取簽名配置
const signatureConfig = JSON.parse(fs.readFileSync(SIGNATURE_CONFIG, 'utf-8'));

async function build() {
  console.log('🚀 開始建置 WebP/GIF/MP4 動畫資料庫...\n');

  // 確保 assets 目錄存在
  if (!fs.existsSync(ASSETS_DIR)) {
    console.error('❌ 錯誤：assets 目錄不存在');
    process.exit(1);
  }

  // 讀取所有支援的動畫檔案 (.webp, .gif, .mp4)
  const files = fs.readdirSync(ASSETS_DIR).filter(f => 
    f.endsWith('.webp') || f.endsWith('.gif') || f.endsWith('.mp4')
  );
  
  if (files.length === 0) {
    console.error('❌ 錯誤：assets 目錄中沒有找到支援的動畫檔案');
    console.log('💡 提示：請將 WebP/GIF/MP4 動畫檔案放置在 assets/ 目錄中');
    process.exit(1);
  }

  // 依類型分組統計
  const stats = { webp: 0, gif: 0, mp4: 0 };
  files.forEach(f => {
    if (f.endsWith('.webp')) stats.webp++;
    else if (f.endsWith('.gif')) stats.gif++;
    else if (f.endsWith('.mp4')) stats.mp4++;
  });
  
  console.log(`📂 找到 ${files.length} 個動畫檔案`);
  console.log(`   WebP: ${stats.webp} | GIF: ${stats.gif} | MP4: ${stats.mp4}`);

  let offset = 0;
  const indexMap = {};
  const buffers = [];

  // 處理每個動畫檔案
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const id = file.replace(ext, '');
    const filePath = path.join(ASSETS_DIR, file);
    const animBuffer = fs.readFileSync(filePath);
    
    console.log(`   處理中: ${file}`);

    try {
      let thumbBuffer;
      let width, height;
      let type = ext.replace('.', ''); // 'webp', 'gif', 'mp4'

      if (ext === '.webp' || ext === '.gif') {
        // WebP 和 GIF 使用 sharp 處理
        const metadata = await sharp(animBuffer).metadata();
        width = metadata.width;
        height = metadata.height;

        // 提取首幀轉為 WebP 縮圖
        thumbBuffer = await sharp(animBuffer)
          .webp({ quality: 80 })
          .toBuffer();

      } else if (ext === '.mp4') {
        // MP4 使用 ffmpeg 提取首幀
        const tempInput = path.join(ASSETS_DIR, `temp_${id}.mp4`);
        const tempOutput = path.join(ASSETS_DIR, `temp_${id}_thumb.webp`);
        
        try {
          // 寫入臨時檔案
          fs.writeFileSync(tempInput, animBuffer);
          
          // 使用 ffmpeg 提取第一幀並轉為 WebP
          execSync(
            `ffmpeg -i "${tempInput}" -vframes 1 -q:v 2 "${tempOutput}" -y`,
            { stdio: 'ignore' }
          );
          
          // 讀取縮圖並取得尺寸
          thumbBuffer = fs.readFileSync(tempOutput);
          const metadata = await sharp(thumbBuffer).metadata();
          width = metadata.width;
          height = metadata.height;
          
          // 清理臨時檔案
          fs.unlinkSync(tempInput);
          fs.unlinkSync(tempOutput);
        } catch (error) {
          console.error(`      ✗ FFmpeg 處理失敗: ${error.message}`);
          console.log(`      💡 請確認已安裝 ffmpeg 並加入 PATH`);
          continue;
        }
      }

      // 記錄索引資訊
      indexMap[id] = {
        type,
        width,
        height,
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

      console.log(`      ✓ [${type.toUpperCase()}] ${width}x${height} | 縮圖: ${(thumbBuffer.length / 1024).toFixed(2)}KB | 動畫: ${(animBuffer.length / 1024).toFixed(2)}KB`);
    } catch (error) {
      console.error(`      ✗ 處理失敗: ${error.message}`);
      continue;
    }
  }

  // 建立 JSON 索引緩衝區
  const jsonBuffer = Buffer.from(JSON.stringify(indexMap), 'utf-8');
  const jsonLengthBuffer = Buffer.alloc(4);
  jsonLengthBuffer.writeUInt32LE(jsonBuffer.length, 0);

  // 合併資料緩衝區（JSON索引 + 所有二進位資料）
  const dataBuffer = Buffer.concat([jsonLengthBuffer, jsonBuffer, ...buffers]);

  // 建立檔案頭部（Magic Number + Version + Signature）
  // 1. Magic Number (8 bytes): 識別專用 bin 檔案
  const magicBuffer = Buffer.alloc(8);
  magicBuffer.write(signatureConfig.magicNumber, 0, 'utf-8');
  
  // 2. Version (16 bytes): 版本號
  const versionBuffer = Buffer.alloc(16);
  versionBuffer.write(signatureConfig.version, 0, 'utf-8');
  
  // 3. Signature: 對資料內容進行加密簽名
  const hash = crypto.createHmac(signatureConfig.algorithm, signatureConfig.secretKey);
  hash.update(dataBuffer);
  const signatureBuffer = hash.digest();
  
  const signatureLengthBuffer = Buffer.alloc(4);
  signatureLengthBuffer.writeUInt32LE(signatureBuffer.length, 0);

  // 確保 dist 目錄存在
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  // 寫入最終 .bin 檔案
  // 結構：Magic + Version + SigLen + Signature + DataLen + Data
  const finalBuffer = Buffer.concat([
    magicBuffer,           // 8 bytes
    versionBuffer,         // 16 bytes
    signatureLengthBuffer, // 4 bytes
    signatureBuffer,       // variable (通常 32 bytes for SHA-256)
    dataBuffer             // variable
  ]);
  fs.writeFileSync(OUTPUT_FILE, finalBuffer);

  console.log(`\n✅ 打包完成！`);
  console.log(`   檔案位置: ${OUTPUT_FILE}`);
  console.log(`   Magic Number: ${signatureConfig.magicNumber}`);
  console.log(`   版本: ${signatureConfig.version}`);
  console.log(`   簽名演算法: ${signatureConfig.algorithm.toUpperCase()}`);
  console.log(`   簽名長度: ${signatureBuffer.length} bytes`);
  console.log(`   總大小: ${(finalBuffer.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   包含項目: ${Object.keys(indexMap).length} 個動畫\n`);
}

// 執行建置
build().catch(err => {
  console.error('❌ 建置失敗:', err);
  process.exit(1);
});
