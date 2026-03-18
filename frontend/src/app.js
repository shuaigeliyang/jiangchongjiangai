/**
 * ============================================
 * 🎨 前端主应用 - 优化版（带实时进度）
 * ============================================
 *
 * 文件位置：E:\外包\降重降ai\frontend\src\app.js
 *
 * 更新内容：
 * - 使用新的流式API
 * - 实时显示降重进度
 * - 显示进度条和百分比
 * - 支持取消操作
 * - 非阻塞式界面
 */

import { rewriteText, rewriteFileStream } from './services/api.js';
import {
  formatFileSize,
  formatTime,
  truncateText,
  copyToClipboard,
  downloadTextAsFile,
  getTextStats,
  formatTextStats,
  storage,
  showToast,
  generateId,
  escapeHtml,
} from './utils/utils.js';

// 应用状态
const state = {
  currentTab: 'text',
  selectedFile: null,
  selectedStrategy: 'MEDIUM',
  selectedModel: 'zhipu',
  isRewriting: false,
  currentResult: null,
  streamController: null,  // ← 新增：流式控制器
  streamingResults: [],     // ← 新增：流式结果
  docxDownloadUrl: null,    // ← 新增：Word 文档下载路径
  docxFileName: null,       // ← 新增：Word 文档显示文件名
};

// DOM元素
const elements = {};

/**
 * 初始化应用
 */
function init() {
  initElements();
  bindEvents();

  // 先尝试恢复上次的结果
  const restored = loadCurrentResult();

  // 如果没有恢复结果，才加载历史记录
  if (!restored) {
    loadHistory();
  }

  loadSettings();

  // 绑定键盘快捷键
  bindKeyboardShortcuts();

  console.log('🎓 论文降重工具已启动！(带实时进度) (￣▽￣)／');
}

/**
 * 绑定键盘快捷键
 */
function bindKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // 只有在进度条显示时才响应快捷键
    const progressContainer = document.querySelector('.progress-overlay');
    if (!progressContainer) {
      return;
    }

    // 检查是否在输入框中
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    // - 或 _ 键：最小化
    if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      const progressFull = document.querySelector('.progress-container');
      if (progressFull && progressFull.style.display !== 'none') {
        toggleMinimize();
        showToast('已最小化进度条（按 = 或 + 键展开）', 'info');
      }
    }

    // = 或 + 键：展开
    if (e.key === '=' || e.key === '+') {
      e.preventDefault();
      const progressMini = document.querySelector('.progress-mini');
      if (progressMini && progressMini.style.display !== 'none') {
        toggleMinimize();
        showToast('已展开进度条', 'info');
      }
    }
  });

  console.log('⌨️  键盘快捷键已绑定');
}

/**
 * 初始化DOM元素引用
 */
function initElements() {
  // 标签切换
  elements.tabs = document.querySelectorAll('.tab-btn');
  elements.tabContents = document.querySelectorAll('.tab-content');

  // 输入区域
  elements.inputText = document.getElementById('input-text');
  elements.uploadArea = document.getElementById('upload-area');
  elements.fileInput = document.getElementById('file-input');
  elements.selectFileBtn = document.getElementById('select-file-btn');
  elements.fileInfo = document.getElementById('file-info');
  elements.fileName = document.getElementById('file-name');
  elements.fileSize = document.getElementById('file-size');
  elements.removeFileBtn = document.getElementById('remove-file-btn');

  // 选项
  elements.strategyBtns = document.querySelectorAll('.strategy-btn');
  elements.modelSelect = document.getElementById('model-select');

  // 按钮
  elements.rewriteBtn = document.getElementById('rewrite-btn');
  elements.clearBtn = document.getElementById('clear-btn');

  // 结果区域
  elements.resultSection = document.getElementById('result-section');
  elements.originalContent = document.getElementById('original-content');
  elements.rewrittenContent = document.getElementById('rewritten-content');
  elements.originalStats = document.getElementById('original-stats');
  elements.rewrittenStats = document.getElementById('rewritten-stats');
  elements.copyBtn = document.getElementById('copy-btn');
  elements.downloadWordBtn = document.getElementById('download-word-btn');
  elements.downloadBtn = document.getElementById('download-btn');
  elements.closeResultBtn = document.getElementById('close-result-btn');

  // 加载动画
  elements.loadingOverlay = document.getElementById('loading-overlay');

  // 历史记录
  elements.historyList = document.getElementById('history-list');
  elements.clearHistoryBtn = document.getElementById('clear-history-btn');
}

/**
 * 绑定事件监听器
 */
function bindEvents() {
  // 标签切换
  elements.tabs.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // 文件上传
  elements.selectFileBtn.addEventListener('click', () => elements.fileInput.click());
  elements.uploadArea.addEventListener('click', () => elements.fileInput.click());
  elements.fileInput.addEventListener('change', handleFileSelect);
  elements.removeFileBtn.addEventListener('click', handleRemoveFile);

  // 拖拽上传
  elements.uploadArea.addEventListener('dragover', handleDragOver);
  elements.uploadArea.addEventListener('dragleave', handleDragLeave);
  elements.uploadArea.addEventListener('drop', handleDrop);

  // 策略选择
  elements.strategyBtns.forEach(btn => {
    btn.addEventListener('click', () => selectStrategy(btn.dataset.strategy));
  });

  // 模型选择
  elements.modelSelect.addEventListener('change', (e) => {
    state.selectedModel = e.target.value;
    saveSettings();
  });

  // 操作按钮
  elements.rewriteBtn.addEventListener('click', handleRewrite);
  elements.clearBtn.addEventListener('click', handleClear);

  // 结果操作
  elements.copyBtn.addEventListener('click', handleCopy);
  elements.downloadWordBtn.addEventListener('click', handleDownloadWord);
  elements.downloadBtn.addEventListener('click', handleDownload);
  elements.closeResultBtn.addEventListener('click', () => {
    elements.resultSection.style.display = 'none';
  });

  // 历史记录
  elements.clearHistoryBtn.addEventListener('click', handleClearHistory);
}

/**
 * ============================================
 * 🚀 核心功能：处理降重请求（支持流式进度）
 * ============================================
 *
 * 位置：第200-320行
 * 作用：根据输入类型选择文本降重或流式文件降重
 *
 * 优化点：
 * - 文件上传使用流式API，实时显示进度
 * - 文本输入保持原有逻辑
 */
async function handleRewrite() {
  if (state.isRewriting) return;

  // 验证输入
  let input;
  if (state.currentTab === 'text') {
    input = elements.inputText.value.trim();
    if (!input) {
      showToast('请输入需要降重的文本', 'warning');
      return;
    }
  } else {
    if (!state.selectedFile) {
      showToast('请选择需要降重的文件', 'warning');
      return;
    }
    input = state.selectedFile;
  }

  // 显示加载动画
  showLoading();

  try {
    let result;

    if (state.currentTab === 'text') {
      // 文本降重：保持原有逻辑
      result = await rewriteText(input, state.selectedStrategy, state.selectedModel);
      displayResult(result.data);
      saveToHistory(result.data);
      showToast('降重完成！✨', 'success');

    } else {
      // ============================================
      // 🆕 文件降重：使用新的流式API
      // ============================================
      await handleStreamFileRewrite(input, state.selectedStrategy, state.selectedModel);
    }

  } catch (error) {
    console.error('降重失败:', error);
    showToast(error.message || '降重失败，请重试', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * ============================================
 * 🌊 流式文件降重处理（新功能）
 * ============================================
 *
 * 位置：第280-380行
 * 作用：使用SSE实时接收文件降重进度
 *
 * 功能：
 * - 实时显示进度条
 * - 显示当前处理的段落
 * - 逐段显示结果
 * - 支持取消操作
 */
async function handleStreamFileRewrite(file, strategy, model) {
  console.log(`\n🔄 开始流式处理文件: ${file.name}`);

  // 清空之前的结果
  state.streamingResults = [];
  hideLoading();  // 隐藏转圈动画，显示进度条

  // 创建进度条容器
  const progressContainer = createProgressContainer();
  document.querySelector('.main-content').appendChild(progressContainer);

  try {
    // 调用流式API
    state.streamController = rewriteFileStream(file, strategy, model, {
      // 初始化回调
      onInit: (data) => {
        console.log('初始化:', data);
        updateProgressInfo(progressContainer, {
          total: data.total,
          message: data.message
        });
      },

      // 文件上传成功回调（新增）
      onUploaded: (data) => {
        console.log('文件上传成功:', data);
        updateProgressUploaded(progressContainer, data);
      },

      // 进度更新回调
      onProgress: (data) => {
        console.log('进度:', data);
        updateProgressBar(progressContainer, data);
      },

      // 单段完成回调
      onComplete: (data) => {
        console.log('单段完成:', data);
        state.streamingResults.push(data.data);

        // 更新进度显示
        updateProgressComplete(progressContainer, data);

        // 实时显示结果（可选）
        displayStreamingResult(data.data);
      },

      // 错误回调
      onError: (data) => {
        console.error('段落错误:', data);
        updateProgressError(progressContainer, data);
      },

      // 全部完成回调
      onDone: (data) => {
        console.log('全部完成:', data);

        // 隐藏进度条
        setTimeout(() => {
          progressContainer.remove();
        }, 2000);

        // 显示最终结果
        displayFinalResult(data);

        // 保存到历史记录
        if (data.results && data.results.length > 0) {
          data.results.forEach(result => {
            if (result.success) {
              saveToHistory(result);
            }
          });
        }

        showToast(`文件处理完成！成功: ${data.summary.success}/${data.summary.total}`, 'success');

        // 重置状态
        state.streamController = null;
        state.isRewriting = false;
      }
    });

  } catch (error) {
    console.error('流式处理失败:', error);
    progressContainer.remove();
    throw error;
  }
}

/**
 * 创建进度条容器
 */
function createProgressContainer() {
  const container = document.createElement('div');
  container.className = 'progress-overlay';
  container.innerHTML = `
    <div class="progress-container">
      <div class="progress-header">
        <h3>📄 文件降重中...</h3>
        <div class="header-buttons">
          <button class="btn-minimize" onclick="toggleMinimize()" title="最小化（按 - 键）">─ 最小化</button>
          <button class="btn-cancel" onclick="cancelStreamRewrite()" title="取消">✕ 取消</button>
        </div>
      </div>

      <div class="progress-info">
        <div class="progress-message">正在解析文件...</div>
        <div class="progress-stats">
          <span class="progress-current">0</span> / <span class="progress-total">0</span> 段
          <span class="progress-percent">(0%)</span>
        </div>
      </div>

      <div class="progress-bar-container">
        <div class="progress-bar">
          <div class="progress-fill" style="width: 0%"></div>
        </div>
      </div>

      <div class="keyboard-hint">
        💡 快捷键：按 <kbd>-</kbd> 最小化窗口，按 <kbd>=</kbd> 或 <kbd>+</kbd> 展开窗口
      </div>

      <div class="progress-log">
        <div class="log-title">处理日志：</div>
        <div class="log-content"></div>
      </div>

      <div class="streaming-results">
        <div class="results-title">已完成的内容：</div>
        <div class="results-content"></div>
      </div>
    </div>

    <!-- 最小化状态的小窗口 -->
    <div class="progress-mini" style="display: none;">
      <div class="mini-header">
        <span class="mini-title">📄 降重中...</span>
        <button class="btn-expand" onclick="toggleMinimize()" title="展开（按 + 键）">□ 展开</button>
      </div>
      <div class="mini-progress">
        <div class="mini-bar">
          <div class="mini-fill" style="width: 0%"></div>
        </div>
        <div class="mini-stats">
          <span class="mini-current">0</span>%
        </div>
      </div>
    </div>
  `;

  return container;
}

/**
 * 更新进度信息
 */
function updateProgressInfo(container, data) {
  container.querySelector('.progress-total').textContent = data.total;
  container.querySelector('.progress-message').textContent = data.message;
}

/**
 * 更新文件上传成功状态
 */
function updateProgressUploaded(container, data) {
  // 更新消息显示
  const messageEl = container.querySelector('.progress-message');
  messageEl.textContent = data.message;

  // 添加成功样式
  messageEl.style.color = 'var(--success-color)';
  messageEl.style.fontWeight = '600';

  // 添加日志
  addLog(container, `✅ ${data.message}`, 'success');
  addLog(container, `文件名: ${data.fileName}`, 'info');
  addLog(container, `文件大小: ${data.fileSize}`, 'info');

  // 显示一个明显的成功提示
  messageEl.style.animation = 'pulse 0.5s ease';
}

/**
 * 更新进度条
 */
function updateProgressBar(container, data) {
  const { current, total, progress } = data;

  container.querySelector('.progress-current').textContent = current;
  container.querySelector('.progress-percent').textContent = `(${progress}%)`;
  container.querySelector('.progress-fill').style.width = `${progress}%`;

  // 同时更新最小化窗口的进度
  updateMiniProgress(progress);

  addLog(container, `正在处理第 ${current}/${total} 段... (${progress}%)`);
}

/**
 * 更新单段完成状态
 */
function updateProgressComplete(container, data) {
  const { current, total } = data;
  addLog(container, `✓ 第 ${current}/${total} 段处理完成`, 'success');
}

/**
 * 更新错误状态
 */
function updateProgressError(container, data) {
  // 容错处理：current和total可能不存在
  const current = data.current || data.index || '?';
  const total = data.total || '?';
  const errorMessage = data.error || data.message || '未知错误';

  // 根据是否有current和total显示不同的消息
  let logMessage;
  if (current === '?' && total === '?') {
    // 文件级别的错误（没有current和total）
    logMessage = `✗ 处理失败: ${errorMessage}`;
  } else {
    // 段落级别的错误
    logMessage = `✗ 第 ${current}/${total} 段失败: ${errorMessage}`;
  }

  addLog(container, logMessage, 'error');
}

/**
 * 添加日志
 */
function addLog(container, message, type = 'info') {
  const logContent = container.querySelector('.log-content');
  const logItem = document.createElement('div');
  logItem.className = `log-item log-${type}`;
  logItem.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logContent.appendChild(logItem);

  // 自动滚动到底部
  logContent.scrollTop = logContent.scrollHeight;
}

/**
 * 实时显示单个结果
 */
function displayStreamingResult(data) {
  const resultsContent = document.querySelector('.streaming-results .results-content');
  if (!resultsContent) return;

  const resultItem = document.createElement('div');
  resultItem.className = 'result-item';
  resultItem.innerHTML = `
    <div class="result-header">
      <span class="result-number">第 ${state.streamingResults.length} 段</span>
      <span class="result-model">${data.model}</span>
    </div>
    <div class="result-comparison">
      <div class="result-original">
        <strong>原文：</strong>
        <p>${escapeHtml(data.originalText.substring(0, 100))}${data.originalText.length > 100 ? '...' : ''}</p>
      </div>
      <div class="result-rewritten">
        <strong>降重后：</strong>
        <p>${escapeHtml(data.rewrittenText.substring(0, 100))}${data.rewrittenText.length > 100 ? '...' : ''}</p>
      </div>
    </div>
  `;

  resultsContent.appendChild(resultItem);
  resultsContent.scrollTop = resultsContent.scrollHeight;
}

/**
 * 显示最终结果
 */
function displayFinalResult(data) {
  // 保存 Word 文档下载信息
  if (data.docxDownloadUrl) {
    state.docxDownloadUrl = data.docxDownloadUrl;
    state.docxFileName = data.docxFileName; // ← 保存显示文件名
    console.log('📄 Word 文档下载链接:', data.docxDownloadUrl);
    console.log('📄 文件名:', data.docxFileName);
  }

  // 合并所有成功的结果
  let allOriginalText = '';
  let allRewrittenText = '';

  data.results.forEach((result, index) => {
    if (result.success) {
      allOriginalText += result.originalText + '\n\n';
      allRewrittenText += result.rewrittenText + '\n\n';
    }
  });

  const finalData = {
    originalText: allOriginalText.trim(),
    rewrittenText: allRewrittenText.trim(),
    model: data.results[0]?.model || '智谱AI GLM-4',
    strategy: 'MEDIUM',
    fileName: data.fileName
  };

  displayResult(finalData);
}

/**
 * 取消流式降重
 */
window.cancelStreamRewrite = function() {
  if (state.streamController) {
    if (confirm('确定要取消降重吗？已处理的内容将会保留。')) {
      state.streamController.cancel();
      state.isRewriting = false;

      // 移除进度条
      const progressContainer = document.querySelector('.progress-overlay');
      if (progressContainer) {
        progressContainer.remove();
      }

      showToast('已取消降重', 'info');
      console.log('❌ 用户取消了降重');
    }
  }
};

/**
 * 切换最小化状态
 */
window.toggleMinimize = function() {
  const progressOverlay = document.querySelector('.progress-overlay');
  const progressContainer = document.querySelector('.progress-container');
  const progressMini = document.querySelector('.progress-mini');

  if (progressContainer.style.display === 'none') {
    // 展开状态
    progressContainer.style.display = 'block';
    progressMini.style.display = 'none';
    progressOverlay.classList.remove('minimized');
    console.log('📊 进度条已展开');
  } else {
    // 最小化状态
    progressContainer.style.display = 'none';
    progressMini.style.display = 'block';
    progressOverlay.classList.add('minimized');
    console.log('📊 进度条已最小化');
  }
};

/**
 * 更新最小化窗口的进度
 */
function updateMiniProgress(progress) {
  const miniFill = document.querySelector('.mini-fill');
  const miniCurrent = document.querySelector('.mini-current');

  if (miniFill) {
    miniFill.style.width = `${progress}%`;
  }
  if (miniCurrent) {
    miniCurrent.textContent = `${progress}%`;
  }
}

/**
 * 显示降重结果
 */
function displayResult(data) {
  state.currentResult = data;

  const originalText = data.originalText || '';
  const rewrittenText = data.rewrittenText || '';

  const originalStats = getTextStats(originalText);
  const rewrittenStats = getTextStats(rewrittenText);

  elements.originalStats.textContent = formatTextStats(originalStats);
  elements.rewrittenStats.textContent = formatTextStats(rewrittenStats);

  elements.originalContent.textContent = originalText;
  elements.rewrittenContent.textContent = rewrittenText;

  // 显示或隐藏 Word 文档下载按钮
  if (state.docxDownloadUrl) {
    elements.downloadWordBtn.style.display = 'inline-flex';
    elements.downloadWordBtn.title = '下载 Word 文档（推荐）';
  } else {
    elements.downloadWordBtn.style.display = 'none';
  }

  elements.resultSection.style.display = 'block';

  elements.resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // 保存到本地存储（刷新后可恢复）
  saveCurrentResult();
}

/**
 * 显示加载动画
 */
function showLoading() {
  state.isRewriting = true;
  elements.loadingOverlay.style.display = 'flex';
  elements.rewriteBtn.disabled = true;
}

/**
 * 隐藏加载动画
 */
function hideLoading() {
  state.isRewriting = false;
  elements.loadingOverlay.style.display = 'none';
  elements.rewriteBtn.disabled = false;
}

/**
 * 切换标签
 */
function switchTab(tab) {
  state.currentTab = tab;

  elements.tabs.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  elements.tabContents.forEach(content => {
    content.classList.toggle('active', content.id === `${tab}-tab`);
  });
}

/**
 * 处理文件选择
 */
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  setSelectedFile(file);
}

/**
 * 设置选中的文件
 */
function setSelectedFile(file) {
  state.selectedFile = file;

  elements.fileName.textContent = file.name;
  elements.fileSize.textContent = formatFileSize(file.size);
  elements.uploadArea.style.display = 'none';
  elements.fileInfo.style.display = 'flex';

  showToast(`已选择文件: ${file.name}`, 'success');
}

/**
 * 移除选中的文件
 */
function handleRemoveFile() {
  state.selectedFile = null;
  elements.fileInput.value = '';
  elements.uploadArea.style.display = 'block';
  elements.fileInfo.style.display = 'none';
}

/**
 * 拖拽事件处理
 */
function handleDragOver(e) {
  e.preventDefault();
  elements.uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
  e.preventDefault();
  elements.uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
  e.preventDefault();
  elements.uploadArea.classList.remove('dragover');

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    setSelectedFile(files[0]);
  }
}

/**
 * 选择降重策略
 */
function selectStrategy(strategy) {
  state.selectedStrategy = strategy;

  elements.strategyBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.strategy === strategy);
  });

  saveSettings();
}

/**
 * 清空输入
 */
function handleClear() {
  elements.inputText.value = '';
  if (state.selectedFile) {
    handleRemoveFile();
  }
  elements.resultSection.style.display = 'none';

  // 清除保存的当前结果
  state.currentResult = null;
  state.docxDownloadUrl = null;
  state.docxFileName = null;
  clearCurrentResult();

  showToast('已清空内容', 'info');
}

/**
 * 复制结果
 */
async function handleCopy() {
  if (!state.currentResult) return;

  const success = await copyToClipboard(state.currentResult.rewrittenText);
  if (success) {
    showToast('已复制到剪贴板', 'success');
  } else {
    showToast('复制失败', 'error');
  }
}

/**
 * 下载结果
 */
function handleDownload() {
  if (!state.currentResult) return;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const fileName = state.currentResult.fileName
    ? `${state.currentResult.fileName}_降重结果.txt`
    : `降重结果_${timestamp}.txt`;

  downloadTextAsFile(state.currentResult.rewrittenText, fileName);
  showToast('已开始下载 TXT 文件', 'success');
}

/**
 * 下载 Word 文档
 */
async function handleDownloadWord() {
  if (!state.docxDownloadUrl) {
    showToast('Word 文档不可用', 'error');
    return;
  }

  try {
    // 使用当前域名 + 下载路径
    const downloadUrl = `http://localhost:3000${state.docxDownloadUrl}`;

    console.log('📥 开始下载 Word 文档:', downloadUrl);

    // 使用 fetch 下载文件
    const response = await fetch(downloadUrl);

    if (!response.ok) {
      throw new Error(`下载失败: ${response.status}`);
    }

    // 使用显示文件名（包含中文）
    const fileName = state.docxFileName || '降重结果.docx';

    console.log('📄 文件名:', fileName);

    // 转换为 blob
    const blob = await response.blob();

    // 创建下载链接
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName; // 使用显示文件名

    // 触发下载
    document.body.appendChild(link);
    link.click();

    // 清理
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    showToast('✅ Word 文档下载成功！', 'success');

  } catch (error) {
    console.error('❌ 下载失败:', error);
    showToast(`下载失败: ${error.message}`, 'error');
  }
}

/**
 * 清空历史记录
 */
function handleClearHistory() {
  if (confirm('确定要清空所有历史记录吗？')) {
    storage.clearHistory();
    loadHistory();
    showToast('已清空历史记录', 'success');
  }
}

/**
 * 保存到历史记录
 */
function saveToHistory(data) {
  const historyItem = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    originalText: data.originalText,
    rewrittenText: data.rewrittenText,
    strategy: data.strategy,
    model: data.model,
  };

  storage.saveHistory(historyItem);
  loadHistory();
}

/**
 * 保存当前结果到本地存储（用于刷新后恢复）
 */
function saveCurrentResult() {
  if (!state.currentResult) {
    return;
  }

  const currentResultData = {
    result: state.currentResult,
    docxDownloadUrl: state.docxDownloadUrl,
    docxFileName: state.docxFileName,
    timestamp: new Date().toISOString()
  };

  localStorage.setItem('current_result', JSON.stringify(currentResultData));
  console.log('💾 当前结果已保存到本地存储');
}

/**
 * 从本地存储加载当前结果
 */
function loadCurrentResult() {
  const saved = localStorage.getItem('current_result');

  if (!saved) {
    return false;
  }

  try {
    const data = JSON.parse(saved);
    const resultTime = new Date(data.timestamp);
    const now = new Date();
    const hoursDiff = (now - resultTime) / (1000 * 60 * 60);

    // 如果超过24小时，不恢复
    if (hoursDiff > 24) {
      console.log('⏰ 保存的结果已超过24小时，不恢复');
      localStorage.removeItem('current_result');
      return false;
    }

    // 恢复状态
    state.currentResult = data.result;
    state.docxDownloadUrl = data.docxDownloadUrl;
    state.docxFileName = data.docxFileName;

    // 显示结果
    displayResult(state.currentResult);

    console.log('✅ 已从本地存储恢复上次的结果');
    showToast(`已恢复上次的降重结果（${Math.round(hoursDiff * 60)}分钟前）`, 'success');

    return true;

  } catch (error) {
    console.error('❌ 加载保存的结果失败:', error);
    localStorage.removeItem('current_result');
    return false;
  }
}

/**
 * 清除保存的当前结果
 */
function clearCurrentResult() {
  localStorage.removeItem('current_result');
  console.log('🗑️  已清除保存的当前结果');
}

/**
 * 加载历史记录
 */
function loadHistory() {
  const history = storage.getHistory();

  if (history.length === 0) {
    elements.historyList.innerHTML = '<p class="empty-hint">暂无历史记录</p>';
    return;
  }

  elements.historyList.innerHTML = history
    .map(item => `
      <div class="history-item" data-id="${item.id}">
        <div class="history-item-header">
          <span class="history-item-title">${escapeHtml(truncateText(item.originalText, 30))}...</span>
          <span class="history-item-time">${formatTime(new Date(item.timestamp))}</span>
        </div>
        <div class="history-item-preview">
          ${escapeHtml(truncateText(item.rewrittenText, 50))}
        </div>
      </div>
    `)
    .join('');

  elements.historyList.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      const historyItem = history.find(h => h.id === id);
      if (historyItem) {
        displayResult(historyItem);
      }
    });
  });
}

/**
 * 保存设置到本地存储
 */
function saveSettings() {
  localStorage.setItem(
    'rewrite_settings',
    JSON.stringify({
      strategy: state.selectedStrategy,
      model: state.selectedModel,
    })
  );
}

/**
 * 从本地存储加载设置
 */
function loadSettings() {
  const settings = localStorage.getItem('rewrite_settings');
  if (settings) {
    const { strategy, model } = JSON.parse(settings);
    if (strategy) selectStrategy(strategy);
    if (model) {
      state.selectedModel = model;
      elements.modelSelect.value = model;
    }
  }
}

// 启动应用
init();
