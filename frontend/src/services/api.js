/**
 * API服务
 * 处理所有与后端的通信
 */

const API_BASE_URL = 'http://localhost:3000/api';

/**
 * API错误处理
 */
class APIError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * 通用请求函数
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const config = { ...defaultOptions, ...options };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new APIError(data.error || '请求失败', response.status);
    }

    return data;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    throw new APIError('网络连接失败，请检查后端服务是否启动', 0);
  }
}

/**
 * 单段文本降重
 */
export async function rewriteText(text, strategy = 'MEDIUM', model = 'deepseek') {
  return await request('/rewrite/text', {
    method: 'POST',
    body: JSON.stringify({ text, strategy, model }),
  });
}

/**
 * 批量文本降重
 */
export async function rewriteBatch(texts, strategy = 'MEDIUM', model = 'deepseek') {
  return await request('/rewrite/batch', {
    method: 'POST',
    body: JSON.stringify({ texts, strategy, model }),
  });
}

/**
 * 文件上传并降重
 */
export async function rewriteFile(file, strategy = 'MEDIUM', model = 'deepseek') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('strategy', strategy);
  formData.append('model', model);

  try {
    const response = await fetch(`${API_BASE_URL}/rewrite/file`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new APIError(data.error || '文件上传失败', response.status);
    }

    return data;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    throw new APIError('文件上传失败，请检查网络连接', 0);
  }
}

/**
 * 获取降重策略列表
 */
export async function getStrategies() {
  return await request('/strategies', {
    method: 'GET',
  });
}

/**
 * 健康检查
 */
export async function healthCheck() {
  return await request('/health', {
    method: 'GET',
  });
}

export default {
  rewriteText,
  rewriteBatch,
  rewriteFile,
  getStrategies,
  healthCheck,
};
