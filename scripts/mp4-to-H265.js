// scripts/mp4-to-H265.js
// 高品質 MP4 影片壓縮腳本 (H.265/HEVC)
// 使用與 webp-to-mp4.js 相同的壓縮參數
// 將 sources/ 內所有 .mp4 壓縮為 H.265/HEVC，輸出至 assets/
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置路徑
const SOURCES_DIR = path.join(__dirname, "..", "sources");
const ASSETS_DIR = path.join(__dirname, "..", "assets");

// 編碼器配置（使用 CPU H.265/HEVC）
const ENCODER = {
  name: "CPU 軟體編碼 (H.265/HEVC)",
  id: "libx265",
  params:
    "-preset slow -crf 30 -x265-params keyint=150:bf=4 -color_primaries bt709 -color_trc bt709 -colorspace bt709 -tag:v hvc1",
  description: "💻 CPU 軟體編碼 (HEVC 極致壓縮，較慢但檔案最小)",
};

// 檢查必要工具
function checkTools() {
  console.log("🔍 檢查必要工具...\n");
  // 檢查 FFmpeg
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    console.log("✓ FFmpeg 已就緒");
  } catch (error) {
    console.error("❌ 錯誤：找不到 FFmpeg");
    console.log("💡 請從 https://ffmpeg.org/download.html 下載並加入 PATH");
    process.exit(1);
  }
  console.log("\n");
}

// 確保目錄存在
function ensureDirectories() {
  if (!fs.existsSync(SOURCES_DIR)) {
    fs.mkdirSync(SOURCES_DIR, { recursive: true });
    console.log(`📁 已創建目錄：${SOURCES_DIR}`);
  }
  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
  }
}

// 壓縮單個 MP4
function compressMP4(inputPath, outputPath) {
  const encoderName = ENCODER.name;
  console.log(`   壓縮為 H.265/HEVC [使用 ${encoderName}]...`);
  try {
    const ffmpegCmd = `ffmpeg -i "${inputPath}" -c:v ${ENCODER.id} ${ENCODER.params} -pix_fmt yuv420p -movflags +faststart -an "${outputPath}" -y`;
    const startTime = Date.now();
    execSync(ffmpegCmd, { stdio: "ignore" });
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const stats = fs.statSync(outputPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`   ✓ 已壓縮: ${sizeMB} MB (${duration}秒)`);
    return true;
  } catch (error) {
    console.error(`   ✗ 壓縮失敗: ${error.message}`);
    throw error;
  }
}

// 處理單個 MP4 檔案
function processMP4(mp4Path) {
  const basename = path.basename(mp4Path, ".mp4");
  const outputMP4 = path.join(ASSETS_DIR, `${basename}_h265.mp4`);
  console.log(`\n🎞️ 處理: ${basename}.mp4`);
  try {
    compressMP4(mp4Path, outputMP4);
    console.log(`✅ 完成: ${basename}_h265.mp4`);
    console.log(`   來源: ${mp4Path}`);
    console.log(`   輸出: ${outputMP4}`);
    return { success: true, basename };
  } catch (error) {
    console.error(`❌ 失敗: ${basename}.mp4 - ${error.message}`);
    return { success: false, basename, error: error.message };
  }
}

// 主函數
function main() {
  console.log("🎬 MP4 → H.265/HEVC 高品質壓縮工具\n");
  console.log("✨ iOS Safari 完美支援 - 使用 H.265/HEVC 編碼");
  console.log("💻 使用 CPU 軟體編碼 (libx265)\n");
  // 檢查工具
  checkTools();
  // 確保目錄存在
  ensureDirectories();
  // 掃描 MP4 檔案
  if (!fs.existsSync(SOURCES_DIR)) {
    console.error("❌ 錯誤：sources 目錄不存在");
    console.log(`💡 請創建目錄並放入 MP4 檔案：${SOURCES_DIR}`);
    process.exit(1);
  }
  const mp4Files = fs
    .readdirSync(SOURCES_DIR)
    .filter((f) => f.endsWith(".mp4"))
    .map((f) => path.join(SOURCES_DIR, f));
  if (mp4Files.length === 0) {
    console.error("❌ 錯誤：sources 目錄中沒有找到 .mp4 檔案");
    console.log(`💡 請將 MP4 檔案放入：${SOURCES_DIR}`);
    process.exit(1);
  }
  console.log(`📂 找到 ${mp4Files.length} 個 MP4 檔案\n`);
  // 處理所有檔案
  const results = [];
  for (const mp4Path of mp4Files) {
    const result = processMP4(mp4Path);
    results.push(result);
  }
  // 顯示總結
  console.log("\n" + "=".repeat(60));
  console.log("📊 壓縮總結");
  console.log("=".repeat(60));
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  console.log(`✅ 成功: ${successful} 個`);
  console.log(`❌ 失敗: ${failed} 個`);
  if (failed > 0) {
    console.log("\n失敗的檔案：");
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`   - ${r.basename}.mp4: ${r.error}`);
      });
  }
  console.log(`\n📁 壓縮影片輸出於：${ASSETS_DIR}`);
  console.log(`🚀 使用編碼器：${ENCODER.name}`);
  console.log("� 格式：H.265/HEVC (hvc1) - iOS Safari 完美相容");
  console.log("\n✨ 完成！所有影片已壓縮為 iOS 最佳格式\n");
}

main();
