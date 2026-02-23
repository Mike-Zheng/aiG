// src/GalleryEngine.js
// 前端核心引擎：JIT 記憶體管控與動畫播放
export class GalleryEngine {
  constructor(containerElement) {
    this.container = containerElement;
    this.buffer = null;
    this.indexMap = null;
    this.payloadStart = 0;

    // 狀態管理
    this.thumbUrls = new Map(); 
    this.activeState = { 
      id: null, 
      imgEl: null, 
      animUrl: null 
    };

    // 離開視窗自動回收機制 (防 iOS 崩潰核心)
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting && entry.target === this.activeState.imgEl) {
          this.stopActiveAnimation();
        }
      });
    }, { threshold: 0 });

    // 綁定事件代理 (Fast Click)
    this.handleTap = this.handleTap.bind(this);
    this.container.addEventListener('click', this.handleTap);
  }

  /**
   * 載入 .bin 檔案並初始化
   * @param {string} binUrl - .bin 檔案的 URL 路徑
   */
  async load(binUrl) {
    console.log('🔄 正在載入資料庫...');
    
    try {
      const res = await fetch(binUrl);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      this.buffer = await res.arrayBuffer();
      const dataView = new DataView(this.buffer);
      
      // 讀取 Header (4 bytes)：JSON 索引長度
      const headerLen = dataView.getUint32(0, true);
      
      // 解析 JSON 索引
      const jsonStr = new TextDecoder().decode(
        new Uint8Array(this.buffer, 4, headerLen)
      );
      this.indexMap = JSON.parse(jsonStr);
      
      // 計算 Payload 起始位置
      this.payloadStart = 4 + headerLen;

      console.log(`✅ 載入完成：共 ${Object.keys(this.indexMap).length} 個項目`);
      console.log(`   資料大小：${(this.buffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

      // 初始化所有縮圖
      this.initThumbnails();
      
      return this.indexMap;
    } catch (error) {
      console.error('❌ 載入失敗:', error);
      throw error;
    }
  }

  /**
   * 預先建立所有靜態縮圖的 Blob URL
   * 縮圖檔案極小，不會造成記憶體負擔
   */
  initThumbnails() {
    console.log('🖼️  正在初始化縮圖...');
    
    for (const [id, meta] of Object.entries(this.indexMap)) {
      const slice = this.buffer.slice(
        this.payloadStart + meta.thumb.offset, 
        this.payloadStart + meta.thumb.offset + meta.thumb.length
      );
      this.thumbUrls.set(
        id, 
        URL.createObjectURL(new Blob([slice], { type: 'image/webp' }))
      );
    }
    
    console.log(`✅ 縮圖初始化完成：${this.thumbUrls.size} 個`);
  }

  /**
   * 提供給外部呼叫，獲取項目的 Metadata
   * @param {string} id - 項目 ID
   * @returns {Object} { url, width, height }
   */
  getItemData(id) {
    if (!this.indexMap || !this.indexMap[id]) {
      console.warn(`⚠️  項目不存在: ${id}`);
      return null;
    }
    
    return {
      url: this.thumbUrls.get(id),
      width: this.indexMap[id].width,
      height: this.indexMap[id].height
    };
  }

  /**
   * 獲取所有項目的 ID 列表
   * @returns {Array<string>}
   */
  getAllIds() {
    return this.indexMap ? Object.keys(this.indexMap) : [];
  }

  /**
   * 點擊事件處理器 (事件代理)
   * @param {Event} e - 點擊事件
   */
  handleTap(e) {
    const target = e.target;
    if (target.tagName !== 'IMG' || !target.dataset.id) return;
    
    const id = target.dataset.id;

    // 點擊同一個正在播放的 -> 停止
    if (this.activeState.id === id) {
      console.log(`⏹️  停止動畫: ${id}`);
      this.stopActiveAnimation();
      return;
    }

    // 點擊新的 -> 先停止舊的，再播新的
    if (this.activeState.id) {
      console.log(`⏹️  停止前一個動畫: ${this.activeState.id}`);
      this.stopActiveAnimation();
    }

    // JIT 建立動畫 Blob
    console.log(`▶️  播放動畫: ${id}`);
    this.playAnimation(id, target);
  }

  /**
   * 播放指定 ID 的動畫
   * @param {string} id - 項目 ID
   * @param {HTMLImageElement} imgEl - 圖片元素
   */
  playAnimation(id, imgEl) {
    const meta = this.indexMap[id];
    if (!meta) {
      console.warn(`⚠️  動畫不存在: ${id}`);
      return;
    }

    // 從 ArrayBuffer 切割動畫資料 (Zero-copy)
    const slice = this.buffer.slice(
      this.payloadStart + meta.anim.offset, 
      this.payloadStart + meta.anim.offset + meta.anim.length
    );
    
    // 建立 Blob URL
    const animUrl = URL.createObjectURL(
      new Blob([slice], { type: 'image/webp' })
    );

    // 更新狀態與畫面
    this.activeState = { id, imgEl, animUrl };
    imgEl.src = animUrl;
    
    // 開始監聽是否離開視窗
    this.observer.observe(imgEl);
  }

  /**
   * 停止當前播放的動畫並釋放記憶體
   */
  stopActiveAnimation() {
    if (!this.activeState.id) return;
    
    // 停止監聽
    this.observer.unobserve(this.activeState.imgEl);
    
    // 恢復縮圖
    this.activeState.imgEl.src = this.thumbUrls.get(this.activeState.id);
    
    // 釋放動畫 Blob URL 記憶體
    URL.revokeObjectURL(this.activeState.animUrl);
    
    // 重置狀態
    this.activeState = { id: null, imgEl: null, animUrl: null };
  }

  /**
   * 徹底銷毀引擎並釋放所有資源
   * 用於 SPA 路由切換或頁面卸載
   */
  dispose() {
    console.log('🗑️  正在銷毀 GalleryEngine...');
    
    // 停止當前動畫
    this.stopActiveAnimation();
    
    // 移除事件監聽
    this.container.removeEventListener('click', this.handleTap);
    
    // 停止 Intersection Observer
    this.observer.disconnect();
    
    // 釋放所有縮圖 Blob URL
    for (const url of this.thumbUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.thumbUrls.clear();
    
    // 清空 buffer 引用
    this.buffer = null;
    this.indexMap = null;
    
    // 清空容器
    this.container.innerHTML = '';
    
    console.log('✅ 銷毀完成');
  }
}
