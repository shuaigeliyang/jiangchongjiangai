/**
 * ============================================
 * 🌐 API服务 - 前后端通信
 * ============================================
 *
 * 文件位置：E:\外包\降重降ai\frontend\src\services\api.js
 *
 * 更新说明：
 * - 新增流式文件降重API（使用SSE）
 * - 实时接收进度更新
 * - 支持取消操作
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
export async function rewriteText(text, strategy = 'MEDIUM', model = 'zhipu') {
  return await request('/rewrite/text', {
    method: 'POST',
    body: JSON.stringify({ text, strategy, model }),
  });
}

/**
 * 批量文本降重
 */
export async function rewriteBatch(texts, strategy = 'MEDIUM', model = 'zhipu') {
  return await request('/rewrite/batch', {
    method: 'POST',
    body: JSON.stringify({ texts, strategy, model }),
  });
}

/**
 * 文件上传并降重（旧版，等待完成）
 */
export async function rewriteFile(file, strategy = 'MEDIUM', model = 'zhipu') {
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
 * ============================================
 * 🚀 新功能：流式文件降重（带实时进度）
 * ============================================
 *
 * 位置：第124-220行
 * 作用：使用Server-Sent Events (SSE)实时接收降重进度
 *
 * 参数：
 * @param {File} file - 文件对象
 * @param {string} strategy - 降重强度
 * @param {string} model - AI模型
 * @param {Object} callbacks - 回调函数集合
 *   @param {Function} onProgress - 进度更新回调
 *   @param {Function} onComplete - 单段完成回调
 *   @param {Function} onError - 错误回调
 *   @param {Function} onDone - 全部完成回调
 * @param {Function} onInit - 初始化回调
 *
 * 返回：
 * @returns {Object} 包含cancel方法的对象，用于取消操作
 *
 * 使用示例：
 * const controller = rewriteFileStream(
 *   file,
 *   'MEDIUM',
 *   'zhipu',
 *   {
 *     onProgress: (data) => console.log('进度:', data.progress),
 *     onComplete: (data) => console.log('完成一段:', data.data),
 *     onDone: (data) => console.log('全部完成:', data.summary)
 *   }
 * );
 *
 * // 取消操作
 * controller.cancel();
 */
export function rewriteFileStream(file, strategy = 'MEDIUM', model = 'zhipu', callbacks = {}) {
  const {
    onProgress = () => {},
    onComplete = () => {},
    onError = () => {},
    onDone = () => {},
    onInit = () => {}
  } = callbacks;

  // 创建AbortController用于取消请求
  const abortController = new AbortController();

  // 创建FormData
  const formData = new FormData();
  formData.append('file', file);
  formData.append('strategy', strategy);
  formData.append('model', model);

  // 使用fetch获取SSE流
  fetch(`${API_BASE_URL}/rewrite/file-stream`, {
    method: 'POST',
    body: formData,
    signal: abortController.signal
  })
  .then(response => {
    if (!response.ok) {
      throw new APIError('文件上传失败', response.status);
    }

    // 创建ReadableStream读取器
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // 读取流
    function read() {
      reader.read().then(({ done, value }) => {
        if (done) {
          console.log('流式读取完成');
          return;
        }

        // 解码数据
        buffer += decoder.decode(value, { stream: true });

        // 按行分割
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        // 处理每一行
        for (const line of lines) {
          if (!line.trim()) continue;

          // SSE格式：event: xxx\ndata: xxx\n\n
          if (line.startsWith('event:')) {
            const event = line.replace('event:', '').trim();
            continue;
          }

          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.replace('data:', '').trim());

              // 根据事件类型调用不同的回调
              // 注意：判断顺序很重要！先判断最具体的条件，再判断通用条件

              // 1. 优先判断错误事件（最重要的！）
              if (data.success === false) {
                // error事件
                onError(data);
              }
              // 2. 判断特定步骤事件（uploaded等，需要step字段）
              else if (data.step && data.success === true) {
                // 根据step值分发到不同的回调
                if (data.step === 'uploaded') {
                  onUploaded(data);
                } else {
                  console.log('未知步骤事件:', data.step, data);
                }
              }
              // 3. 判断完成事件（包含data字段）
              else if (data.data && data.success === true) {
                // complete事件（单段完成）
                onComplete(data);
              }
              // 4. 全部完成事件（包含summary）
              else if (data.summary) {
                // done事件（全部完成）
                onDone(data);
              }
              // 5. 初始化事件（只有total，没有current）
              else if (data.total !== undefined && data.current === undefined) {
                // init事件
                onInit(data);
              }
              // 6. 进度事件（包含progress，但不包含data）
              else if (data.progress !== undefined && !data.data) {
                // progress事件
                onProgress(data);
              }
              // 7. 其他只有message的错误（兼容处理）
              else if (data.message && !data.total && !data.progress) {
                // 纯错误消息（兼容旧格式）
                onError({
                  success: false,
                  error: data.message,
                  message: data.message
                });
              }
              // 8. 其他通用消息
              else if (data.message) {
                // 可以记录日志，但不触发特定回调
                console.log('SSE消息:', data.message);
              }

            } catch (e) {
              console.error('解析SSE数据失败:', e, line);
            }
          }
        }

        // 继续读取
        read();
      });
    }

    read();
  })
  .catch(error => {
    if (error.name === 'AbortError') {
      console.log('文件降重已取消');
    } else {
      console.error('流式请求失败:', error);
      onError({
        message: error.message || '流式处理失败'
      });
    }
  });

  // 返回控制器，支持取消
  return {
    cancel: () => {
      abortController.abort();
      console.log('文件降重已取消');
    }
  };
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
  rewriteFileStream,  // ← 新增：流式文件降重
  getStrategies,
  healthCheck,
};
