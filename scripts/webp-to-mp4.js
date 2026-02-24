// scripts/webp-to-mp4.js
// 高品質 WebP 動畫轉 MP4 腳本 (智能 GPU 加速版)
// 使用 Sharp 庫拆解影格，確保畫質不受損失
// 支援 NVIDIA, AMD, Intel GPU 硬體加速，自動回退到 CPU 編碼
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置路徑
const SOURCES_DIR = path.join(__dirname, '..', 'sources');
const TEMP_DIR = path.join(SOURCES_DIR, 'temp');
const ASSETS_DIR = path.join(__dirname, '..', 'assets');

// GPU 編碼器配置（全域變數）
let GPU_ENCODER = null;

// 測試編碼器是否真正可用（運行時測試）
function testEncoder(encoderId, params) {
  try {
    // 創建一個 1x1 的測試圖片
    const testDir = path.join(os.tmpdir(), 'ffmpeg-test-' + Date.now());
    const testFrame = path.join(testDir, 'test.png');
    const testOutput = path.join(testDir, 'test.mp4');
    
    // 創建測試目錄
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // 生成一個簡單的測試影格（1x1 黑色像素）
    execSync(`ffmpeg -f lavfi -i color=black:s=64x64:d=0.1 -frames:v 1 "${testFrame}" -y`, 
      { stdio: 'ignore', timeout: 5000 });
    
    // 測試編碼器
    const testCmd = `ffmpeg -framerate 25 -i "${testFrame}" -frames:v 1 -c:v ${encoderId} ${params} -pix_fmt yuv420p "${testOutput}" -y`;
    execSync(testCmd, { stdio: 'ignore', timeout: 10000 });
    
    // 清理測試檔案
    fs.rmSync(testDir, { recursive: true, force: true });
    
    return true;
  } catch (error) {
    // 清理失敗的測試檔案
    try {
      const testDir = path.join(os.tmpdir(), 'ffmpeg-test-' + Date.now());
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch {}
    
    return false;
  }
}

// 檢測可用的 GPU 編碼器
function detectGPUEncoder() {
  console.log('🔍 檢測可用的 GPU 硬體加速...\n');
  
  // iOS 優化：優先使用 HEVC (H.265) 編碼器
  const encoders = [
    {
      name: 'NVIDIA NVENC (H.265/HEVC)',
      id: 'hevc_nvenc',
      params: '-preset p7 -tune hq -rc vbr -cq 24 -b:v 0 -tag:v hvc1',
      description: '🚀 NVIDIA GPU (HEVC iOS 最佳化)'
    },
    {
      name: 'AMD AMF (H.265/HEVC)',
      id: 'hevc_amf',
      params: '-quality quality -rc cqp -qp_i 24 -qp_p 24 -tag:v hvc1',
      description: '🚀 AMD GPU (HEVC iOS 最佳化)'
    },
    {
      name: 'Intel Quick Sync (H.265/HEVC)',
      id: 'hevc_qsv',
      params: '-preset veryslow -global_quality 24 -tag:v hvc1',
      description: '🚀 Intel GPU (HEVC iOS 最佳化)'
    },
    {
      name: 'NVIDIA NVENC (H.264)',
      id: 'h264_nvenc',
      params: '-preset p7 -tune hq -rc vbr -cq 18 -b:v 0',
      description: '🚀 NVIDIA GPU 硬體加速 (H.264 回退)'
    },
    {
      name: 'AMD AMF (H.264)',
      id: 'h264_amf',
      params: '-quality quality -rc cqp -qp_i 18 -qp_p 18',
      description: '🚀 AMD GPU 硬體加速 (H.264 回退)'
    },
    {
      name: 'Intel Quick Sync (H.264)',
      id: 'h264_qsv',
      params: '-preset veryslow -global_quality 18',
      description: '🚀 Intel GPU 硬體加速 (H.264 回退)'
    }
  ];
  
  for (const encoder of encoders) {
    // 先檢查編碼器是否存在
    try {
      const checkCmd = process.platform === 'win32' 
        ? `ffmpeg -hide_banner -encoders 2>&1 | findstr /C:"${encoder.id}"`
        : `ffmpeg -hide_banner -encoders 2>&1 | grep "${encoder.id}"`;
      
      execSync(checkCmd, { stdio: 'pipe' });
    } catch {
      continue; // 編碼器不存在，跳過
    }
    
    // 運行時測試編碼器
    console.log(`   測試 ${encoder.name}...`);
    if (testEncoder(encoder.id, encoder.params)) {
      console.log(`   ✓ ${encoder.name} 可用\n`);
      console.log(`   ${encoder.description}\n`);
      return encoder;
    } else {
      console.log(`   ✗ ${encoder.name} 無法使用（可能是驅動或硬體問題）`);
    }
  }
  
  // 沒有找到可用的 GPU 編碼器，使用 CPU HEVC 編碼（iOS 優化）
  console.log('   ⚠️  未偵測到可用的 GPU 硬體加速');
  console.log('   將使用 CPU 軟體編碼 (libx265 HEVC - iOS 優化)\n');
  
  return {
    name: 'CPU 軟體編碼 (H.265/HEVC)',
    id: 'libx265',
    params: '-preset medium -crf 24 -tag:v hvc1',
    description: '💻 CPU 軟體編碼 (HEVC iOS 最佳化，較慢但檔案更小)'
  };
}

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

  console.log('\n');
  
  // 檢測並設置 GPU 編碼器
  GPU_ENCODER = detectGPUEncoder();
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
    
    // 優化：使用批量並行處理提取影格
    const batchSize = 10; // 每批處理 10 個影格
    const startTime = Date.now();
    
    for (let i = 0; i < frameCount; i += batchSize) {
      const batch = [];
      const end = Math.min(i + batchSize, frameCount);
      
      for (let j = i; j < end; j++) {
        const outputPath = path.join(frameDir, `frame_${String(j + 1).padStart(4, '0')}.png`);
        
        // 批次處理，減少 I/O 開銷
        const promise = sharp(webpPath, { page: j })
          .png({ 
            compressionLevel: 0,  // 無壓縮以保持速度
            force: true 
          })
          .toFile(outputPath);
        
        batch.push(promise);
      }
      
      // 等待當前批次完成
      await Promise.all(batch);
      
      // 顯示進度
      const percent = ((end / frameCount) * 100).toFixed(1);
      process.stdout.write(`\r   進度: ${end}/${frameCount} 幀 (${percent}%)`);
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    process.stdout.write('\n');
    console.log(`   ✓ 已提取 ${frameCount} 幀 PNG 圖片 (${duration}秒)`);
    return { frameDir, frameCount };
  } catch (error) {
    console.error(`   ✗ 拆解失敗: ${error.message}`);
    throw error;
  }
}

// 將 PNG 序列轉換為 MP4 (智能 GPU 加速版)
function convertToMP4(frameDir, outputPath, fps) {
  const encoderName = GPU_ENCODER.name;
  console.log(`   轉換為 MP4 (${fps} fps) [使用 ${encoderName}]...`);

  try {
    const inputPattern = path.join(frameDir, 'frame_%04d.png');
    
    // 使用檢測到的最佳編碼器
    const ffmpegCmd = `ffmpeg -framerate ${fps} -i "${inputPattern}" -c:v ${GPU_ENCODER.id} ${GPU_ENCODER.params} -pix_fmt yuv420p -movflags +faststart "${outputPath}" -y`;
    
    const startTime = Date.now();
    execSync(ffmpegCmd, { stdio: 'ignore' });
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    const stats = fs.statSync(outputPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`   ✓ 已轉換為 MP4: ${sizeMB} MB (${duration}秒)`);
    
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
  console.log('🎬 WebP 動畫 → MP4 (iOS 優化) 高品質轉換工具\n');
  console.log('✨ iOS Safari 完美支援 - 自動使用 H.265/HEVC 編碼');
  console.log('🚀 支援 NVIDIA、AMD、Intel GPU 硬體加速');
  console.log('📦 使用 Sharp 庫提取影格，確保畫質不受損失\n');

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
  console.log(`🚀 使用編碼器：${GPU_ENCODER.name}`);
  console.log('� 格式：H.265/HEVC (hvc1) - iOS Safari 完美相容');
  console.log('💡 臨時 PNG 影格已自動清理');
  console.log('\n✨ 完成！所有影片已優化為 iOS 最佳格式\n');
}

// 執行
main().catch(err => {
  console.error('❌ 執行失敗:', err);
  process.exit(1);
});