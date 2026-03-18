import axios from 'axios';

/**
 * AI降重服务
 * 支持多种AI模型：DeepSeek、OpenAI、智谱AI、Claude
 */

// 降重策略配置
export const REWRITE_STRATEGIES = {
  LIGHT: {
    name: '轻度降重',
    description: '保持原有结构，主要进行同义词替换',
    temperature: 0.3,
    changeLevel: 'low'
  },
  MEDIUM: {
    name: '中度降重',
    description: '改变句式结构，调整语序，适度改写',
    temperature: 0.7,
    changeLevel: 'medium'
  },
  HEAVY: {
    name: '重度降重',
    description: '大幅改写，重组段落，完全改变表达方式',
    temperature: 1.0,
    changeLevel: 'high'
  }
};

/**
 * 降重提示词模板
 */
function generateRewritePrompt(text, strategy = 'MEDIUM') {
  const strategyConfig = REWRITE_STRATEGIES[strategy];

  return `你是一个专业的学术写作助手。请对以下文本进行降重处理。

**降重要求：**
1. 保持原意完全不变，只改变表达方式
2. 根据降重强度进行不同程度的改写：${strategyConfig.description}
3. 同义词替换：用同义词或近义词替换原文中的词汇
4. 句式重组：改变句子结构（主动/被动语态转换、长短句变换等）
5. 段落调整：适当调整段落内部的句子顺序
6. 保留专业术语：人名、地名、专业术语等专有名词必须保留
7. 保持学术规范：确保改写后的文本符合学术写作规范
8. 避免重复：避免使用原文中相同的短语和句式

**原文：**
${text}

**请直接输出降重后的文本，不要添加任何其他说明：**
`;
}

/**
 * 调用DeepSeek API进行降重
 */
async function rewriteWithDeepSeek(text, strategy = 'MEDIUM') {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const apiBase = process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com';

  if (!apiKey) {
    throw new Error('DeepSeek API密钥未配置');
  }

  const prompt = generateRewritePrompt(text, strategy);
  const strategyConfig = REWRITE_STRATEGIES[strategy];

  try {
    const response = await axios.post(
      `${apiBase}/v1/chat/completions`,
      {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的学术写作助手，擅长帮助用户降重和改写文本。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: strategyConfig.temperature,
        max_tokens: Math.max(text.length * 2, 1000),
        stream: false
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 60000 // 60秒超时
      }
    );

    const rewrittenText = response.data.choices[0].message.content.trim();

    return {
      success: true,
      originalText: text,
      rewrittenText: rewrittenText,
      model: 'DeepSeek',
      strategy: strategy,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('DeepSeek API调用失败:', error.response?.data || error.message);
    throw new Error(`DeepSeek API调用失败: ${error.message}`);
  }
}

/**
 * 调用OpenAI API进行降重
 */
async function rewriteWithOpenAI(text, strategy = 'MEDIUM') {
  const apiKey = process.env.OPENAI_API_KEY;
  const apiBase = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';

  if (!apiKey) {
    throw new Error('OpenAI API密钥未配置');
  }

  const prompt = generateRewritePrompt(text, strategy);
  const strategyConfig = REWRITE_STRATEGIES[strategy];

  try {
    const response = await axios.post(
      `${apiBase}/chat/completions`,
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的学术写作助手，擅长帮助用户降重和改写文本。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: strategyConfig.temperature,
        max_tokens: Math.max(text.length * 2, 1000)
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 60000
      }
    );

    const rewrittenText = response.data.choices[0].message.content.trim();

    return {
      success: true,
      originalText: text,
      rewrittenText: rewrittenText,
      model: 'GPT-3.5',
      strategy: strategy,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('OpenAI API调用失败:', error.response?.data || error.message);
    throw new Error(`OpenAI API调用失败: ${error.message}`);
  }
}

/**
 * 调用智谱AI API进行降重
 */
async function rewriteWithZhipu(text, strategy = 'MEDIUM') {
  const apiKey = process.env.ZHIPU_API_KEY;
  const apiBase = process.env.ZHIPU_API_BASE || 'https://open.bigmodel.cn/api/paas/v4';

  if (!apiKey) {
    throw new Error('智谱AI API密钥未配置');
  }

  const prompt = generateRewritePrompt(text, strategy);
  const strategyConfig = REWRITE_STRATEGIES[strategy];

  try {
    const response = await axios.post(
      `${apiBase}/chat/completions`,
      {
        model: 'glm-4-flash',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的学术写作助手，擅长帮助用户降重和改写文本。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: strategyConfig.temperature,
        max_tokens: Math.max(text.length * 2, 1000)
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 60000
      }
    );

    const rewrittenText = response.data.choices[0].message.content.trim();

    return {
      success: true,
      originalText: text,
      rewrittenText: rewrittenText,
      model: '智谱AI GLM-4',
      strategy: strategy,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('智谱AI API调用失败:', error.response?.data || error.message);
    throw new Error(`智谱AI API调用失败: ${error.message}`);
  }
}

/**
 * 主降重函数 - 自动选择可用的AI模型
 */
export async function rewriteText(text, options = {}) {
  const {
    strategy = 'MEDIUM',
    preferredModel = 'zhipu' // zhipu | deepseek | openai | claude
  } = options;

  // 验证输入
  if (!text || text.trim().length === 0) {
    throw new Error('输入文本不能为空');
  }

  if (text.length > 10000) {
    throw new Error('文本过长，建议分段处理（最多10000字）');
  }

  // 根据优先级选择模型
  const models = {
    zhipu: async () => {
      if (process.env.ZHIPU_API_KEY) {
        return await rewriteWithZhipu(text, strategy);
      }
      throw new Error('智谱AI未配置');
    },
    deepseek: async () => {
      if (process.env.DEEPSEEK_API_KEY) {
        return await rewriteWithDeepSeek(text, strategy);
      }
      throw new Error('DeepSeek未配置');
    },
    openai: async () => {
      if (process.env.OPENAI_API_KEY) {
        return await rewriteWithOpenAI(text, strategy);
      }
      throw new Error('OpenAI未配置');
    }
  };

  try {
    // 尝试使用首选模型
    return await models[preferredModel]();
  } catch (error) {
    // 首选模型失败，尝试其他可用模型
    console.warn(`${preferredModel} 失败，尝试其他模型...`);

    for (const [modelName, modelFunc] of Object.entries(models)) {
      if (modelName !== preferredModel) {
        try {
          console.log(`尝试使用 ${modelName}...`);
          return await modelFunc();
        } catch (err) {
          console.warn(`${modelName} 也不可用`);
          continue;
        }
      }
    }

    throw new Error('所有AI模型都不可用，请检查API密钥配置');
  }
}

/**
 * 批量降重（分段处理长文本）
 */
export async function batchRewrite(texts, options = {}) {
  const results = [];

  for (let i = 0; i < texts.length; i++) {
    console.log(`正在处理第 ${i + 1}/${texts.length} 段...`);

    try {
      const result = await rewriteText(texts[i], options);
      results.push(result);

      // 添加延迟，避免API限流
      if (i < texts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      results.push({
        success: false,
        error: error.message,
        originalText: texts[i]
      });
    }
  }

  return results;
}

export default {
  rewriteText,
  batchRewrite,
  REWRITE_STRATEGIES
};
