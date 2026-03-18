/**
 * 论文降重工具 - 主应用
 * by 哈雷酱 (￣▽￣)／
 */

import { rewriteText, rewriteFile } from './services/api.js';
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
};

// DOM元素
const elements = {};

/**
 * 初始化应用
 */
function init() {
  // 获取DOM元素
  initElements();

  // 绑定事件
  bindEvents();

  // 加载历史记录
  loadHistory();

  // 从本地存储恢复上次的选择
  loadSettings();

  console.log('🎓 论文降重工具已启动！(￣▽￣)／');
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
  elements.downloadBtn.addEventListener('click', handleDownload);
  elements.closeResultBtn.addEventListener('click', () => {
    elements.resultSection.style.display = 'none';
  });

  // 历史记录
  elements.clearHistoryBtn.addEventListener('click', handleClearHistory);
}

/**
 * 切换标签
 */
function switchTab(tab) {
  state.currentTab = tab;

  // 更新标签按钮状态
  elements.tabs.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  // 更新内容区域
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

  // 显示文件信息
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

  // 更新按钮状态
  elements.strategyBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.strategy === strategy);
  });

  saveSettings();
}

/**
 * 处理降重
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
      // 文本降重
      result = await rewriteText(input, state.selectedStrategy, state.selectedModel);
    } else {
      // 文件降重
      result = await rewriteFile(input, state.selectedStrategy, state.selectedModel);
    }

    // 显示结果
    displayResult(result.data);

    // 保存到历史记录
    saveToHistory(result.data);

    showToast('降重完成！✨', 'success');

  } catch (error) {
    console.error('降重失败:', error);
    showToast(error.message || '降重失败，请重试', 'error');
  } finally {
    hideLoading();
  }
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
 * 显示降重结果
 */
function displayResult(data) {
  state.currentResult = data;

  // 获取原文和降重后的文本
  const originalText = data.originalText || '';
  const rewrittenText = data.rewrittenText || '';

  // 显示文本统计
  const originalStats = getTextStats(originalText);
  const rewrittenStats = getTextStats(rewrittenText);

  elements.originalStats.textContent = formatTextStats(originalStats);
  elements.rewrittenStats.textContent = formatTextStats(rewrittenStats);

  // 显示文本内容
  elements.originalContent.textContent = originalText;
  elements.rewrittenContent.textContent = rewrittenText;

  // 显示结果区域
  elements.resultSection.style.display = 'block';

  // 滚动到结果区域
  elements.resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
 * 加载历史记录
 */
function loadHistory() {
  const history = storage.getHistory();

  if (history.length === 0) {
    elements.historyList.innerHTML = '<p class="empty-hint">暂无历史记录</p>';
    return;
  }

  elements.historyList.innerHTML = history
    .map(
      item => `
    <div class="history-item" data-id="${item.id}">
      <div class="history-item-header">
        <span class="history-item-title">${escapeHtml(item.originalText.substring(0, 30))}...</span>
        <span class="history-item-time">${formatTime(new Date(item.timestamp))}</span>
      </div>
      <div class="history-item-preview">
        ${escapeHtml(truncateText(item.rewrittenText, 50))}
      </div>
    </div>
  `
    )
    .join('');

  // 添加点击事件
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
 * 清空输入
 */
function handleClear() {
  elements.inputText.value = '';
  if (state.selectedFile) {
    handleRemoveFile();
  }
  elements.resultSection.style.display = 'none';
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
  const filename = `降重结果_${timestamp}.txt`;

  downloadTextAsFile(state.currentResult.rewrittenText, filename);
  showToast('已开始下载', 'success');
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
