// scripts/mp4-to-ios.js
// 批次將 MP4 影片轉換為 iOS Safari 相容的 H.265 格式
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 定義輸入與輸出資料夾路徑
const inputDir = path.join(__dirname, '..', 'mp4');
const outputDir = path.join(__dirname, '..', 'assets');

// 確保輸出資料夾存在，若無則自動建立
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// 將 FFmpeg 指令包裝成 Promise
const runFfmpeg = (inputFile, outputFile) => {
    return new Promise((resolve, reject) => {
        // 拆解 FFmpeg 參數
        const args = [
            '-i', inputFile,
            '-c:v', 'libx265',
            '-tag:v', 'hvc1',
            '-crf', '28',
            '-preset', 'slower',
            '-vf', 'scale=-2:1920',
            '-an',
            '-movflags', '+faststart',
            outputFile
        ];

        // 使用 spawn 執行指令
        const ffmpeg = spawn('ffmpeg', args);

        // FFmpeg 的輸出進度通常寫在 stderr，若想看詳細轉換日誌可取消下方註解
        // ffmpeg.stderr.on('data', (data) => {
        //     console.log(data.toString());
        // });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`FFmpeg 執行失敗，錯誤代碼: ${code}`));
            }
        });
    });
};

// 主執行函式
const processAllVideos = async () => {
    try {
        // 檢查輸入資料夾是否存在
        if (!fs.existsSync(inputDir)) {
            console.error(`❌ 找不到輸入資料夾: ${inputDir}`);
            return;
        }

        // 讀取資料夾並過濾出 .mp4 檔案 (忽略大小寫)
        const files = fs.readdirSync(inputDir).filter(file => 
            file.toLowerCase().endsWith('.mp4')
        );

        if (files.length === 0) {
            console.log('⚠️ 在 mp4/ 目錄中沒有找到任何 MP4 檔案。');
            return;
        }

        console.log(`🚀 找到 ${files.length} 個 MP4 檔案，開始循序批次壓縮...\n`);

        let count = 1;
        for (const file of files) {
            const inputFile = path.join(inputDir, file);
            // 輸出檔名保持與原檔名相同
            const outputFile = path.join(outputDir, file); 

            console.log(`[${count}/${files.length}] 處理中: ${file} ...`);
            
            // 等待當前影片壓縮完成，再進行下一支
            await runFfmpeg(inputFile, outputFile);
            
            console.log(`✅ 完成: ${file} -> 已儲存至 assets/\n`);
            count++;
        }

        console.log('🎉 所有影片壓縮完成！');

    } catch (error) {
        console.error('❌ 發生未預期的錯誤:', error);
    }
};

// 執行腳本
processAllVideos();
