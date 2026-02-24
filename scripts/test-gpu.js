// GPU 編碼器診斷工具
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

console.log('🔍 GPU 硬體加速診斷工具\n');
console.log('='.repeat(60));

// 1. 檢查 FFmpeg 版本
console.log('\n📦 FFmpeg 版本：');
try {
  const version = execSync('ffmpeg -version', { encoding: 'utf-8' });
  const lines = version.split('\n');
  const versionLine = lines[0];
  
  // 提取版本號
  const versionMatch = versionLine.match(/ffmpeg version ([\d.]+)/);
  const ffmpegVersion = versionMatch ? versionMatch[1] : 'unknown';
  console.log(`   版本: ${ffmpegVersion}`);
  
  // 檢查配置中是否包含硬體加速
  const hasNVENC = version.includes('--enable-nvenc');
  const hasQSV = version.includes('--enable-libvpl') || version.includes('--enable-qsv');
  const hasAMF = version.includes('--enable-amf');
  const hasCUDA = version.includes('--enable-cuda');
  
  console.log(`   支援 NVIDIA NVENC: ${hasNVENC ? '✅' : '❌'}`);
  console.log(`   支援 Intel Quick Sync: ${hasQSV ? '✅' : '❌'}`);
  console.log(`   支援 AMD AMF: ${hasAMF ? '✅' : '❌'}`);
  console.log(`   支援 CUDA: ${hasCUDA ? '✅' : '❌'}`);
  
  // 版本建議
  const majorVersion = parseInt(ffmpegVersion.split('.')[0]);
  if (majorVersion >= 8) {
    console.log(`\n   ⚠️  FFmpeg ${ffmpegVersion} (8.x 系列)`);
    console.log(`   注意: NVENC 需要 NVIDIA 驅動 570.0+ (支援 NVENC SDK 13.0)`);
  } else if (majorVersion === 7) {
    console.log(`\n   ✅ FFmpeg ${ffmpegVersion} (7.x 系列)`);
    console.log(`   建議: NVENC 需要 NVIDIA 驅動 560.0+ (支援 NVENC SDK 12.2)`);
  } else if (majorVersion === 6) {
    console.log(`\n   ✅ FFmpeg ${ffmpegVersion} (6.x 系列)`);
    console.log(`   相容性: NVENC 支援較舊的驅動版本`);
  }
} catch (error) {
  console.error('   ❌ FFmpeg 未安裝');
  process.exit(1);
}

// 2. 檢查 NVIDIA GPU
console.log('\n🎮 NVIDIA GPU 狀態：');
try {
  // 先測試基本的 nvidia-smi 命令
  const basicTest = execSync('nvidia-smi', { encoding: 'utf-8', stdio: 'pipe' });
  
  // 如果成功，則執行詳細查詢
  try {
    const nvidiaSmi = execSync('nvidia-smi --query-gpu=name,driver_version,cuda_version --format=csv,noheader', { 
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    
    const parts = nvidiaSmi.trim().split(',').map(s => s.trim());
    if (parts.length >= 2) {
      const gpuName = parts[0];
      const driverVersion = parts[1];
      const cudaVersion = parts.length >= 3 ? parts[2] : 'N/A';
      
      console.log(`   GPU: ${gpuName}`);
      console.log(`   驅動版本: ${driverVersion}`);
      console.log(`   CUDA 版本: ${cudaVersion}`);
      
      // 分析驅動版本與 NVENC SDK 相容性
      const driverNum = parseFloat(driverVersion);
      if (driverNum >= 570.0) {
        console.log(`   ✅ 支援 NVENC SDK 13.0 (FFmpeg 8.x 相容)`);
      } else if (driverNum >= 560.0) {
        console.log(`   ✅ 支援 NVENC SDK 12.2 (FFmpeg 7.x 相容)`);
        console.log(`   ⚠️  不支援 FFmpeg 8.x 的 NVENC`);
      } else if (driverNum >= 550.0) {
        console.log(`   ⚠️  支援 NVENC SDK 12.1`);
        console.log(`   建議: 升級驅動到 560.0+ 以獲得更好的相容性`);
      } else {
        console.log(`   ⚠️  驅動版本較舊，可能不支援最新的 NVENC 功能`);
        console.log(`   建議: 升級到 560.0+ 驅動`);
      }
    } else {
      throw new Error('輸出格式異常');
    }
  } catch (queryError) {
    // 詳細查詢失敗，使用簡單解析
    console.log('   ✅ 偵測到 NVIDIA GPU');
    
    // 嘗試從基本輸出中提取信息
    const lines = basicTest.split('\n');
    for (const line of lines) {
      if (line.includes('NVIDIA') && line.includes('GeForce')) {
        const gpuMatch = line.match(/(GeForce[^\|]+)/);
        if (gpuMatch) {
          console.log(`   GPU: ${gpuMatch[1].trim()}`);
        }
      }
      if (line.includes('Driver Version')) {
        const driverMatch = line.match(/Driver Version:\s*([\d.]+)/);
        if (driverMatch) {
          console.log(`   驅動版本: ${driverMatch[1]}`);
        }
      }
    }
    
    console.log('   ⚠️  無法獲取詳細 GPU 信息，請檢查 nvidia-smi 命令');
  }
} catch (error) {
  console.log('   ℹ️  未偵測到 NVIDIA GPU 或驅動');
  console.log(`   錯誤詳情: ${error.message || '無法執行 nvidia-smi'}`);
}

// 3. 檢查系統 CPU
console.log('\n💻 系統 CPU：');
const cpus = os.cpus();
console.log(`   處理器: ${cpus[0].model}`);
console.log(`   核心數: ${cpus.length}`);

// 4. 測試所有編碼器
console.log('\n🧪 測試硬體編碼器：');
console.log('='.repeat(60));

const testDir = path.join(os.tmpdir(), 'gpu-diagnostic-test');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// 創建測試圖片（256x256 符合 NVENC 最小尺寸要求）
const testFrame = path.join(testDir, 'test.png');
try {
  execSync(`ffmpeg -f lavfi -i color=black:s=256x256:d=0.04 -frames:v 1 "${testFrame}" -y`, 
    { stdio: 'ignore', timeout: 5000 });
} catch (error) {
  console.error('❌ 無法創建測試圖片');
  process.exit(1);
}

const encoders = [
  // 修復 FFmpeg 7.1.x Bug：使用不含 -profile:v 的簡化參數
  { name: 'NVIDIA NVENC (H.265)', id: 'hevc_nvenc', cmd: '-c:v hevc_nvenc -preset fast -pix_fmt yuv420p' },
  { name: 'NVIDIA NVENC (H.264)', id: 'h264_nvenc', cmd: '-c:v h264_nvenc -preset fast -pix_fmt yuv420p' },
  { name: 'Intel Quick Sync (H.265)', id: 'hevc_qsv', cmd: '-c:v hevc_qsv -preset fast -global_quality 23 -pix_fmt yuv420p' },
  { name: 'Intel Quick Sync (H.264)', id: 'h264_qsv', cmd: '-c:v h264_qsv -preset fast -global_quality 23 -pix_fmt yuv420p' },
  { name: 'AMD AMF (H.265)', id: 'hevc_amf', cmd: '-c:v hevc_amf -quality quality -pix_fmt yuv420p' },
  { name: 'AMD AMF (H.264)', id: 'h264_amf', cmd: '-c:v h264_amf -quality quality -pix_fmt yuv420p' },
  { name: 'CPU libx265 (H.265)', id: 'libx265', cmd: '-c:v libx265 -preset ultrafast -x265-params crf=23 -pix_fmt yuv420p' },
  { name: 'CPU libx264 (H.264)', id: 'libx264', cmd: '-c:v libx264 -preset ultrafast -crf 23 -pix_fmt yuv420p' }
];

let availableEncoders = [];

for (const encoder of encoders) {
  const testOutput = path.join(testDir, `test_${encoder.id}.mp4`);
  
  // 檢查編碼器是否存在
  let exists = false;
  try {
    const checkCmd = process.platform === 'win32'
      ? `ffmpeg -hide_banner -encoders 2>&1 | findstr /C:"${encoder.id}"`
      : `ffmpeg -hide_banner -encoders 2>&1 | grep "${encoder.id}"`;
    execSync(checkCmd, { stdio: 'pipe' });
    exists = true;
  } catch {}
  
  if (!exists) {
    console.log(`\n❌ ${encoder.name}`);
    console.log(`   編碼器不存在於此 FFmpeg 版本`);
    continue;
  }
  
  // 測試編碼器
  process.stdout.write(`\n🔄 ${encoder.name} ... `);
  
  try {
    const testCmd = `ffmpeg -framerate 25 -loop 1 -i "${testFrame}" -t 0.04 ${encoder.cmd} "${testOutput}" -y`;
    execSync(testCmd, { stdio: 'ignore', timeout: 15000 });
    
    // 檢查輸出文件
    if (fs.existsSync(testOutput) && fs.statSync(testOutput).size > 0) {
      const sizeMB = (fs.statSync(testOutput).size / 1024).toFixed(2);
      console.log(`✅ 可用 (${sizeMB} KB)`);
      availableEncoders.push(encoder);
    } else {
      console.log(`❌ 失敗 (未生成有效文件)`);
    }
  } catch (error) {
    console.log(`❌ 失敗`);
    
    // 嘗試捕獲錯誤訊息
    try {
      const errorCmd = `ffmpeg -framerate 25 -loop 1 -i "${testFrame}" -t 0.04 ${encoder.cmd} "${testOutput}" -y 2>&1`;
      const errorOutput = execSync(errorCmd, { encoding: 'utf-8', timeout: 10000 });
      
      // 尋找關鍵錯誤信息
      if (errorOutput.includes('Driver does not support')) {
        const requiredMatch = errorOutput.match(/Required: ([\d.]+)/);
        const foundMatch = errorOutput.match(/Found: ([\d.]+)/);
        if (requiredMatch && foundMatch) {
          console.log(`   原因: NVENC SDK 版本不符 (需要 ${requiredMatch[1]}, 當前 ${foundMatch[1]})`);
          
          const required = parseFloat(requiredMatch[1]);
          if (required >= 13.0) {
            console.log(`   解決: 升級驅動到 570.0+ 或降級 FFmpeg 到 7.x`);
          } else if (required >= 12.2) {
            console.log(`   解決: 升級驅動到 560.0+ 或降級 FFmpeg 到 6.x`);
          }
        }
      } else if (errorOutput.includes('not support')) {
        console.log(`   原因: 硬體不支援此編碼器`);
      } else if (errorOutput.includes('Cannot load')) {
        console.log(`   原因: 無法載入編碼器庫`);
      } else if (errorOutput.includes('No device available')) {
        console.log(`   原因: GPU 設備不可用`);
      }
    } catch {
      // 無法獲取詳細錯誤信息
    }
  }
}

// 清理測試文件
try {
  fs.rmSync(testDir, { recursive: true, force: true });
} catch {}

// 5. 總結
console.log('\n' + '='.repeat(60));
console.log('📊 診斷總結');
console.log('='.repeat(60));

// 檢查 FFmpeg 版本
let ffmpegMajorVersion = 0;
try {
  const version = execSync('ffmpeg -version', { encoding: 'utf-8' });
  const versionMatch = version.match(/ffmpeg version ([\d.]+)/);
  if (versionMatch) {
    ffmpegMajorVersion = parseInt(versionMatch[1].split('.')[0]);
  }
} catch {}

if (availableEncoders.length === 0) {
  console.log('\n❌ 沒有找到可用的硬體加速編碼器');
  console.log('   建議：使用 CPU 編碼器 (libx264/libx265)');
  console.log('   注意：CPU 編碼速度較慢，但相容性最好');
} else {
  console.log(`\n✅ 找到 ${availableEncoders.length} 個可用的編碼器：\n`);
  
  availableEncoders.forEach((encoder, index) => {
    const icon = encoder.id.includes('qsv') ? '⚡ Intel QSV' :
                 encoder.id.includes('nvenc') ? '🚀 NVIDIA' :
                 encoder.id.includes('amf') ? '🔥 AMD' : '💻 CPU';
    const recommended = index === 0 ? ' [推薦使用]' : '';
    console.log(`   ${index + 1}. ${icon} - ${encoder.name}${recommended}`);
  });
  
  console.log('\n💡 建議：');
  const best = availableEncoders[0];
  if (best.id.includes('qsv')) {
    console.log('   ✅ 使用 Intel Quick Sync 硬體加速');
    console.log('   速度：比純 CPU 快 3-5 倍');
    console.log('   相容性：FFmpeg 所有版本皆支援');
  } else if (best.id.includes('nvenc')) {
    console.log('   ✅ 使用 NVIDIA NVENC 硬體加速');
    console.log('   速度：比純 CPU 快 5-10 倍');
    if (ffmpegMajorVersion >= 8) {
      console.log('   注意：需要 NVIDIA 驅動 570.0+ (NVENC SDK 13.0)');
    } else if (ffmpegMajorVersion === 7) {
      console.log('   注意：需要 NVIDIA 驅動 560.0+ (NVENC SDK 12.2)');
    }
  } else if (best.id.includes('amf')) {
    console.log('   ✅ 使用 AMD AMF 硬體加速');
    console.log('   速度：比純 CPU 快 3-5 倍');
  } else {
    console.log('   ℹ️  僅找到 CPU 編碼器');
    console.log('   考慮：檢查 GPU 驅動或 FFmpeg 版本');
  }
}

// 額外建議
console.log('\n💡 優化建議：');
if (ffmpegMajorVersion >= 8) {
  console.log('   • 如果 NVENC 無法使用，可降級到 FFmpeg 7.1.1 版本');
  console.log('   • 或升級 NVIDIA 驅動到 570.0+ 版本');
} else if (ffmpegMajorVersion === 7) {
  console.log('   • FFmpeg 7.x 是目前推薦的穩定版本');
  console.log('   • 與大多數 GPU 驅動相容性良好');
}

const hasNVENCAvailable = availableEncoders.some(e => e.id.includes('nvenc'));
const hasQSVAvailable = availableEncoders.some(e => e.id.includes('qsv'));

if (!hasNVENCAvailable && !hasQSVAvailable) {
  console.log('   • 建議啟用 Intel 內顯以使用 Quick Sync 加速');
  console.log('   • 或升級 NVIDIA 驅動以啟用 NVENC 支援');
}

console.log('\n✨ 診斷完成！\n');
