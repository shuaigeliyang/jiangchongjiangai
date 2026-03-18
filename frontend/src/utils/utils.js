/**
 * 工具函数库
 * 提供各种辅助功能
 */

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * 格式化时间
 */
export function formatTime(date) {
  const now = new Date();
  const diff = now - date;

  // 小于1分钟
  if (diff < 60000) {
    return '刚刚';
  }

  // 小于1小时
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}分钟前`;
  }

  // 小于1天
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}小时前`;
  }

  // 大于1天
  const days = Math.floor(diff / 86400000);
  if (days === 1) {
    return '昨天';
  } else if (days < 7) {
    return `${days}天前`;
  }

  // 显示具体日期
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 截断文本
 */
export function truncateText(text, maxLength = 50) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * 复制文本到剪贴板
 */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // 兼容旧浏览器
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    }
  } catch (error) {
    console.error('复制失败:', error);
    return false;
  }
}

/**
 * 下载文本为文件
 */
export function downloadTextAsFile(text, filename = '降重结果.txt') {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 统计文本信息
 */
export function getTextStats(text) {
  const chars = text.length;
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0).length;

  return { chars, words, paragraphs };
}

/**
 * 格式化文本统计信息
 */
export function formatTextStats(stats) {
  const parts = [];

  if (stats.chars > 0) {
    parts.push(`${stats.chars} 字`);
  }

  if (stats.words > 0) {
    parts.push(`${stats.words} 词`);
  }

  if (stats.paragraphs > 0) {
    parts.push(`${stats.paragraphs} 段`);
  }

  return parts.join(' · ');
}

/**
 * 本地存储管理
 */
export const storage = {
  /**
   * 保存历史记录
   */
  saveHistory(item) {
    const history = this.getHistory();
    history.unshift(item);

    // 最多保存50条记录
    if (history.length > 50) {
      history.pop();
    }

    localStorage.setItem('rewrite_history', JSON.stringify(history));
  },

  /**
   * 获取历史记录
   */
  getHistory() {
    const data = localStorage.getItem('rewrite_history');
    return data ? JSON.parse(data) : [];
  },

  /**
   * 清空历史记录
   */
  clearHistory() {
    localStorage.removeItem('rewrite_history');
  },

  /**
   * 删除单条历史记录
   */
  deleteHistoryItem(id) {
    const history = this.getHistory();
    const filtered = history.filter(item => item.id !== id);
    localStorage.setItem('rewrite_history', JSON.stringify(filtered));
  },
};

/**
 * 显示Toast提示
 */
export function showToast(message, type = 'info', duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast ${type} show`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

/**
 * 防抖函数
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * 节流函数
 */
export function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * 生成唯一ID
 */
export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 转义HTML特殊字符
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 高亮差异
 */
export function highlightDiff(original, rewritten) {
  // 简单的差异高亮实现
  const originalWords = original.split(/\s+/);
  const rewrittenWords = rewritten.split(/\s+/);

  let html = '';
  let i = 0;
  let j = 0;

  while (i < originalWords.length || j < rewrittenWords.length) {
    if (i < originalWords.length && j < rewrittenWords.length) {
      if (originalWords[i] === rewrittenWords[j]) {
        html += `<span class="diff-same">${originalWords[i]}</span> `;
        i++;
        j++;
      } else {
        html += `<span class="diff-removed">${originalWords[i]}</span> `;
        html += `<span class="diff-added">${rewrittenWords[j]}</span> `;
        i++;
        j++;
      }
    } else if (i < originalWords.length) {
      html += `<span class="diff-removed">${originalWords[i]}</span> `;
      i++;
    } else if (j < rewrittenWords.length) {
      html += `<span class="diff-added">${rewrittenWords[j]}</span> `;
      j++;
    }
  }

  return html;
}

export default {
  formatFileSize,
  formatTime,
  truncateText,
  copyToClipboard,
  downloadTextAsFile,
  getTextStats,
  formatTextStats,
  storage,
  showToast,
  debounce,
  throttle,
  generateId,
  escapeHtml,
  highlightDiff,
};
