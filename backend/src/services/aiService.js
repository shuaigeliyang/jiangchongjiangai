import axios from 'axios';

/**
 * ============================================
 * 🎓 AI降重服务 - 核心文件
 * ============================================
 *
 * 功能说明：
 * 1. 支持三种AI模型：智谱AI、DeepSeek、OpenAI
 * 2. 自动应用降AI检测技巧
 * 3. 支持三种降重强度：轻度、中度、重度
 * 4. 自动模型切换：如果首选模型失败，自动尝试其他模型
 *
 * 文件位置：E:\外包\降重降ai\backend\src\services\aiService.js
 */

// ============================================
// 🔧 配置部分
// ============================================

/**
 * 【关键代码1】降重策略配置
 *
 * 位置：第9-28行
 * 作用：定义三种降重强度及其对应的temperature参数
 *
 * 说明：
 * - temperature 控制AI输出的随机性
 * - 0.0-0.3: 输出更确定，接近原文
 * - 0.4-0.7: 平衡创造性和准确性
 * - 0.8-1.0: 更随机，更有创造力
 */
export const REWRITE_STRATEGIES = {
  LIGHT: {
    name: '轻度降重',
    description: '保持原有结构，主要进行同义词替换',
    temperature: 0.3,  // ← 低温度，变化小
    changeLevel: 'low'
  },
  MEDIUM: {
    name: '中度降重',
    description: '改变句式结构，调整语序，适度改写',
    temperature: 0.7,  // ← 中等温度，推荐使用
    changeLevel: 'medium'
  },
  HEAVY: {
    name: '重度降重',
    description: '大幅改写，重组段落，完全改变表达方式',
    temperature: 1.0,  // ← 高温度，变化大
    changeLevel: 'high'
  }
};

// ============================================
// 🎯 核心函数部分
// ============================================

/**
 * 【关键代码2】降重提示词模板生成器
 *
 * 位置：第33-78行
 * 作用：生成包含降重和降AI技巧的提示词
 *
 * 参数说明：
 * @param {string} text - 需要降重的原文
 * @param {string} strategy - 降重强度（LIGHT/MEDIUM/HEAVY）
 * @param {boolean} reduceAI - 是否启用降AI功能（默认true）
 *
 * 返回：完整的提示词字符串
 */
function generateRewritePrompt(text, strategy = 'MEDIUM', reduceAI = true) {
  const strategyConfig = REWRITE_STRATEGIES[strategy];

  // 基础提示词（8条基础降重要求）
  let prompt = `你是一个专业的学术写作助手。请对以下文本进行降重处理。

**降重要求：**
1. 保持原意完全不变，只改变表达方式
2. 根据降重强度进行不同程度的改写：${strategyConfig.description}
3. 同义词替换：用同义词或近义词替换原文中的词汇
4. 句式重组：改变句子结构（主动/被动语态转换、长短句变换等）
5. 段落调整：适当调整段落内部的句子顺序
6. 保留专业术语：人名、地名、专业术语等专有名词必须保留
7. 保持学术规范：确保改写后的文本符合学术写作规范
8. 避免重复：避免使用原文中相同的短语和句式
`;

  /**
   * 【关键代码3】降AI检测技巧（自动启用）
   *
   * 位置：第49-68行
   * 作用：在提示词中加入10大降AI技巧
   *
   * 触发条件：
   * - reduceAI 参数为 true 时自动加入
   * - 默认就是 true，所以每次降重都会应用
   *
   * 这10大技巧让AI生成的文本更像人类写的
   */
  if (reduceAI) {
    prompt += `

**【重要】降AI检测要求：**
为了降低AI检测率，请使用以下技巧：
1. **增加变化性**：句子长度要有明显变化，有的长有的短，不要规律
2. **自然表达**：使用更自然、更像人类口语的表达方式
3. **避免完美**：偶尔使用稍微不规范的语法（如适度的倒装）
4. **增加细节**：在适当位置添加具体的细节或例子
5. **情感色彩**：在合适的地方加入轻微的情感表达（如"值得注意的是"、"显而易见"）
6. **逻辑连接**：使用更自然的逻辑连接词（如"不过"、"因此"、"换句话说"）
7. **避免模式**：不要使用AI常用的句式（如"首先...其次...最后..."、"一方面...另一方面..."）
8. **人为痕迹**：偶尔加入一些"人为"的标记，如适度的重复强调、转折等
9. **词汇多样性**：同一概念用不同方式表达，不要重复用词
10. **节奏变化**：在段落中创造节奏感，快慢结合

**关键原则：让文本读起来像人类写的，而不是机器生成的！**
`;

  }

  // 添加原文内容
  prompt += `
**原文：**
${text}

**请直接输出降重后的文本，不要添加任何其他说明：**
`;

  return prompt;
}

// ============================================
// 🤖 AI模型调用函数部分
// ============================================

/**
 * 【关键代码4】智谱AI API调用
 *
 * 位置：第200-253行
 * 作用：调用智谱AI GLM-4模型进行降重
 *
 * API信息：
 * - API地址：https://open.bigmodel.cn/api/paas/v4
 * - 使用模型：glm-4-flash（快速版）
 * - 认证方式：Bearer Token
 *
 * 流程：
 * 1. 读取环境变量 ZHIPU_API_KEY
 * 2. 生成包含降AI技巧的提示词（第208行，reduceAI=true）
 * 3. 调用智谱AI API
 * 4. 返回降重结果
 */
async function rewriteWithZhipu(text, strategy = 'MEDIUM') {
  // 步骤1：从环境变量读取API密钥
  const apiKey = process.env.ZHIPU_API_KEY;
  const apiBase = process.env.ZHIPU_API_BASE || 'https://open.bigmodel.cn/api/paas/v4';

  if (!apiKey) {
    throw new Error('智谱AI API密钥未配置');
  }

  // 步骤2：生成提示词（reduceAI=true 自动启用降AI功能）
  const prompt = generateRewritePrompt(text, strategy, true);  // ← 这里true表示启用降AI
  const strategyConfig = REWRITE_STRATEGIES[strategy];

  try {
    // 步骤3：调用智谱AI API
    const response = await axios.post(
      `${apiBase}/chat/completions`,
      {
        model: 'glm-4-flash',  // ← 使用的模型
        messages: [
          {
            role: 'system',
            content: '你是一个专业的学术写作助手，擅长帮助用户降重和改写文本。'
          },
          {
            role: 'user',
            content: prompt  // ← 包含降AI技巧的完整提示词
          }
        ],
        temperature: strategyConfig.temperature,  // ← 根据策略设置温度
        max_tokens: Math.max(text.length * 2, 1000)
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`  // ← API认证
        },
        timeout: 60000
      }
    );

    // 步骤4：提取结果并返回
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
 * 【关键代码5】DeepSeek API调用
 *
 * 位置：第83-137行
 * 作用：调用DeepSeek模型进行降重
 *
 * API信息：
 * - API地址：https://api.deepseek.com
 * - 使用模型：deepseek-chat
 *
 * 说明：实现逻辑与智谱AI完全相同，只是API地址和模型不同
 */
async function rewriteWithDeepSeek(text, strategy = 'MEDIUM') {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const apiBase = process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com';

  if (!apiKey) {
    throw new Error('DeepSeek API密钥未配置');
  }

  const prompt = generateRewritePrompt(text, strategy, true);  // ← 启用降AI
  const strategyConfig = REWRITE_STRATEGIES[strategy];

  try {
    const response = await axios.post(
      `${apiBase}/v1/chat/completions`,
      {
        model: 'deepseek-chat',  // ← DeepSeek模型
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
        timeout: 60000
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
 * 【关键代码6】OpenAI API调用
 *
 * 位置：第142-195行
 * 作用：调用OpenAI GPT-3.5进行降重
 *
 * API信息：
 * - API地址：https://api.openai.com/v1
 * - 使用模型：gpt-3.5-turbo
 */
async function rewriteWithOpenAI(text, strategy = 'MEDIUM') {
  const apiKey = process.env.OPENAI_API_KEY;
  const apiBase = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';

  if (!apiKey) {
    throw new Error('OpenAI API密钥未配置');
  }

  const prompt = generateRewritePrompt(text, strategy, true);  // ← 启用降AI
  const strategyConfig = REWRITE_STRATEGIES[strategy];

  try {
    const response = await axios.post(
      `${apiBase}/chat/completions`,
      {
        model: 'gpt-3.5-turbo',  // ← GPT-3.5模型
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

// ============================================
// 🎮 主控制器部分
// ============================================

/**
 * 【关键代码7】主降重函数 - 模型选择和调度
 *
 * 位置：第258-316行
 * 作用：根据用户选择的模型调用对应的API
 *
 * 重要功能：
 * 1. 验证输入文本
 * 2. 根据preferredModel参数选择模型
 * 3. 自动容错：如果首选模型失败，自动尝试其他模型
 *
 * 参数：
 * @param {string} text - 需要降重的文本
 * @param {object} options - 配置选项
 *   @param {string} options.strategy - 降重强度（LIGHT/MEDIUM/HEAVY）
 *   @param {string} options.preferredModel - 首选模型（zhipu/deepseek/openai）
 */
export async function rewriteText(text, options = {}) {
  const {
    strategy = 'MEDIUM',           // ← 默认中度降重
    preferredModel = 'zhipu'       // ← 默认使用智谱AI
  } = options;

  // 验证输入
  if (!text || text.trim().length === 0) {
    throw new Error('输入文本不能为空');
  }

  if (text.length > 10000) {
    throw new Error('文本过长，建议分段处理（最多10000字）');
  }

  /**
   * 【重要】模型映射表
   *
   * 定义了三种AI模型的调用函数
   * 系统会根据preferredModel参数选择对应的函数
   */
  const models = {
    zhipu: async () => {
      if (process.env.ZHIPU_API_KEY) {
        return await rewriteWithZhipu(text, strategy);  // ← 调用智谱AI
      }
      throw new Error('智谱AI未配置');
    },
    deepseek: async () => {
      if (process.env.DEEPSEEK_API_KEY) {
        return await rewriteWithDeepSeek(text, strategy);  // ← 调用DeepSeek
      }
      throw new Error('DeepSeek未配置');
    },
    openai: async () => {
      if (process.env.OPENAI_API_KEY) {
        return await rewriteWithOpenAI(text, strategy);  // ← 调用OpenAI
      }
      throw new Error('OpenAI未配置');
    }
  };

  try {
    // 尝试使用首选模型
    return await models[preferredModel]();  // ← 调用用户选择的模型
  } catch (error) {
    /**
     * 【重要】自动容错机制
     *
     * 如果首选模型失败（比如API密钥未配置或网络错误），
     * 系统会自动尝试其他可用的模型
     */
    console.warn(`${preferredModel} 失败，尝试其他模型...`);

    for (const [modelName, modelFunc] of Object.entries(models)) {
      if (modelName !== preferredModel) {
        try {
          console.log(`尝试使用 ${modelName}...`);
          return await modelFunc();  // ← 尝试备用模型
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
 * 【关键代码8】批量降重函数
 *
 * 位置：第321-345行
 * 作用：处理多段文本的批量降重
 *
 * 特点：
 * - 逐段处理
 * - 每段之间延迟1秒（避免API限流）
 * - 错误处理：某段失败不影响其他段
 */
export async function batchRewrite(texts, options = {}) {
  const results = [];

  for (let i = 0; i < texts.length; i++) {
    console.log(`正在处理第 ${i + 1}/${texts.length} 段...`);

    try {
      const result = await rewriteText(texts[i], options);  // ← 调用主降重函数
      results.push(result);

      // 添加延迟，避免API限流
      if (i < texts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));  // ← 延迟1秒
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

// 导出函数
export default {
  rewriteText,           // ← 主降重函数
  batchRewrite,          // ← 批量降重函数
  REWRITE_STRATEGIES     // ← 策略配置
};

/**
 * ============================================
 * 📋 代码结构总结
 * ============================================
 *
 * 本文件包含以下关键部分：
 *
 * 1. 【第9-28行】策略配置 - 定义三种降重强度
 * 2. 【第33-78行】提示词生成器 - 生成包含降AI技巧的提示词
 * 3. 【第200-253行】智谱AI调用 - 你当前使用的模型
 * 4. 【第83-137行】DeepSeek调用 - 可选模型
 * 5. 【第142-195行】OpenAI调用 - 可选模型
 * 6. 【第258-316行】主控制器 - 模型选择和调度
 * 7. 【第321-345行】批量处理 - 处理多段文本
 *
 * ============================================
 * 🎯 降AI功能的实现位置
 * ============================================
 *
 * 降AI功能不是单独的模块，而是融入到提示词中：
 *
 * - 位置：第49-68行
 * - 触发：第208行（智谱）、第91行（DeepSeek）、第150行（OpenAI）
 * - 参数：reduceAI = true
 * - 效果：每次降重都会自动应用10大降AI技巧
 *
 * ============================================
 * 🔄 完整调用流程
 * ============================================
 *
 * 用户在前端选择模型
 *   ↓
 * 前端发送请求到后端API
 *   ↓
 * 控制器调用 rewriteText() 函数
 *   ↓
 * rewriteText() 根据preferredModel选择对应函数
 *   ↓
 * 调用 generateRewritePrompt(text, strategy, true)
 *   ↓
 * generateRewritePrompt() 生成包含降AI技巧的提示词
 *   ↓
 * 调用对应AI公司的API
 *   ↓
 * AI返回降重结果
 *   ↓
 * 返回给前端显示
 *
 * ============================================
 * 🎓 by 哈雷酱 (￣▽￣)／
 * ============================================
 */
