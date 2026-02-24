// scripts/webp-to-mp4.js
// 高品質 WebP 動畫轉 MP4 腳本
// 使用 Sharp 庫拆解影格，確保畫質不受損失
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置路徑
const SOURCES_DIR = path.join(__dirname, '..', 'sources');
const TEMP_DIR = path.join(SOURCES_DIR, 'temp');
const ASSETS_DIR = path.join(__dirname, '..', 'assets');

// 檢查必要工具
function checkTools() {
  console.log('🔍 檢查必要工具...\n');

  // 檢查 Sharp
  try {
    const sharpVersion = sharp.versions;
    console.log(`✓ Sharp ${sharpVersion.sharp} 已就緒（libvips ${sharpVersion.vips}）`);
  } catch (error) {
    console.error('❌ 錯誤：Sharp 未安裝');
    console.log('💡 請執行: npm install');
    process.exit(1);
  }

  // 檢查 FFmpeg
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    console.log('✓ FFmpeg 已就緒');
  } catch (error) {
    console.error('❌ 錯誤：找不到 FFmpeg');
    console.log('💡 請從 https://ffmpeg.org/download.html 下載並加入 PATH');
    process.exit(1);
  }

  console.log('');
}

// 確保目錄存在
function ensureDirectories() {
  if (!fs.existsSync(SOURCES_DIR)) {
    fs.mkdirSync(SOURCES_DIR, { recursive: true });
    console.log(`📁 已創建目錄：${SOURCES_DIR}`);
  }

  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
  }
}

// 取得 WebP 動畫幀率
async function getWebPFrameRate(webpPath) {
  try {
    // 使用 Sharp 讀取元數據
    const metadata = await sharp(webpPath).metadata();
    
    if (!metadata.pages || metadata.pages <= 1) {
      console.warn('   ⚠️  這不是動畫 WebP，或只有一幀');
      return null;
    }
    
    if (!metadata.delay || metadata.delay.length === 0) {
      console.warn('   ⚠️  無法讀取幀延遲訊息，使用預設值 25 fps');
      return 25;
    }
    
    // 計算平均延遲（毫秒）
    const avgDelay = metadata.delay.reduce((a, b) => a + b, 0) / metadata.delay.length;
    // 轉換為幀率
    const fps = Math.round((1000 / avgDelay) * 10) / 10;
    
    return fps > 0 ? fps : 25;
  } catch (error) {
    console.warn('   ⚠️  無法自動偵測幀率，使用預設值 25 fps');
    return 25;
  }
}

// 拆解 WebP 動畫為 PNG 序列
async function extractFrames(webpPath, outputDir) {
  const basename = path.basename(webpPath, '.webp');
  const frameDir = path.join(outputDir, basename);

  // 創建輸出目錄
  if (fs.existsSync(frameDir)) {
    // 清空現有目錄
    fs.rmSync(frameDir, { recursive: true, force: true });
  }
  fs.mkdirSync(frameDir, { recursive: true });

  console.log(`   拆解影格中...`);
  
  try {
    // 讀取 WebP 元數據
    const metadata = await sharp(webpPath).metadata();
    
    if (!metadata.pages || metadata.pages <= 1) {
      throw new Error('這不是動畫 WebP 檔案');
    }
    
    const frameCount = metadata.pages;
    console.log(`   總共 ${frameCount} 幀`);
    
    // 逐幀提取並儲存為 PNG
    for (let i = 0; i < frameCount; i++) {
      const outputPath = path.join(frameDir, `frame_${String(i + 1).padStart(4, '0')}.png`);
      
      await sharp(webpPath, { page: i })
        .png({ compressionLevel: 0, force: true }) // 無壓縮 PNG 保持最高畫質
        .toFile(outputPath);
      
      // 顯示進度（每 20 幀顯示一次）
      if ((i + 1) % 20 === 0 || i === frameCount - 1) {
        process.stdout.write(`\r   進度: ${i + 1}/${frameCount} 幀`);
      }
    }
    
    process.stdout.write('\n');
    console.log(`   ✓ 已提取 ${frameCount} 幀 PNG 圖片`);
    return { frameDir, frameCount };
  } catch (error) {
    console.error(`   ✗ 拆解失敗: ${error.message}`);
    throw error;
  }
}

// 將 PNG 序列轉換為 MP4
function convertToMP4(frameDir, outputPath, fps) {
  console.log(`   轉換為 MP4 (${fps} fps)...`);

  try {
    const inputPattern = path.join(frameDir, 'frame_%04d.png');
    
    // 使用 FFmpeg 高品質轉換
    // -c:v libx264: 使用 H.264 編碼
    // -preset slow: 較慢但品質更好
    // -crf 18: 高品質（0-51，越小品質越好，18 接近無損）
    // -pix_fmt yuv420p: 確保相容性
    // -r: 設定幀率
    const ffmpegCmd = `ffmpeg -framerate ${fps} -i "${inputPattern}" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart "${outputPath}" -y`;
    
    execSync(ffmpegCmd, { stdio: 'ignore' });

    const stats = fs.statSync(outputPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`   ✓ 已轉換為 MP4: ${sizeMB} MB`);
    
    return true;
  } catch (error) {
    console.error(`   ✗ 轉換失敗: ${error.message}`);
    throw error;
  }
}

// 處理單個 WebP 檔案
async function processWebP(webpPath) {
  const basename = path.basename(webpPath, '.webp');
  const outputMP4 = path.join(ASSETS_DIR, `${basename}.mp4`);

  console.log(`\n📹 處理: ${basename}.webp`);

  try {
    // 1. 偵測幀率
    const fps = await getWebPFrameRate(webpPath);
    
    if (fps === null) {
      throw new Error('不是有效的動畫 WebP 檔案');
    }
    
    console.log(`   幀率: ${fps} fps`);

    // 2. 拆解影格
    const { frameDir, frameCount } = await extractFrames(webpPath, TEMP_DIR);

    // 3. 轉換為 MP4
    convertToMP4(frameDir, outputMP4, fps);

    // 4. 刪除臨時 PNG 影格
    console.log(`   清理臨時檔案...`);
    fs.rmSync(frameDir, { recursive: true, force: true });
    console.log(`   ✓ 已刪除臨時 PNG 影格`);

    console.log(`✅ 完成: ${basename}.mp4`);
    console.log(`   來源: ${webpPath}`);
    console.log(`   輸出: ${outputMP4}`);
    console.log(`   影格: ${frameCount} 幀`);

    return { success: true, basename };
  } catch (error) {
    console.error(`❌ 失敗: ${basename}.webp - ${error.message}`);
    return { success: false, basename, error: error.message };
  }
}

// 主函數
async function main() {
  console.log('🎬 WebP 動畫 → MP4 高品質轉換工具\n');
  console.log('使用 Sharp 庫提取影格，確保畫質不受損失\n');

  // 檢查工具
  checkTools();

  // 確保目錄存在
  ensureDirectories();

  // 掃描 WebP 檔案
  if (!fs.existsSync(SOURCES_DIR)) {
    console.error('❌ 錯誤：sources 目錄不存在');
    console.log(`💡 請創建目錄並放入 WebP 動畫檔案：${SOURCES_DIR}`);
    process.exit(1);
  }

  const webpFiles = fs.readdirSync(SOURCES_DIR)
    .filter(f => f.endsWith('.webp'))
    .map(f => path.join(SOURCES_DIR, f));

  if (webpFiles.length === 0) {
    console.error('❌ 錯誤：sources 目錄中沒有找到 .webp 檔案');
    console.log(`💡 請將 WebP 動畫檔案放入：${SOURCES_DIR}`);
    process.exit(1);
  }

  console.log(`📂 找到 ${webpFiles.length} 個 WebP 動畫檔案\n`);

  // 處理所有檔案
  const results = [];
  for (const webpPath of webpFiles) {
    const result = await processWebP(webpPath);
    results.push(result);
  }

  // 顯示總結
  console.log('\n' + '='.repeat(60));
  console.log('📊 轉換總結');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`✅ 成功: ${successful} 個`);
  console.log(`❌ 失敗: ${failed} 個`);

  if (failed > 0) {
    console.log('\n失敗的檔案：');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.basename}.webp: ${r.error}`);
    });
  }

  console.log(`\n📁 MP4 影片輸出於：${ASSETS_DIR}`);
  console.log('💡 臨時 PNG 影格已自動清理');
  console.log('\n✨ 完成！\n');
}

// 執行
main().catch(err => {
  console.error('❌ 執行失敗:', err);
  process.exit(1);
});
