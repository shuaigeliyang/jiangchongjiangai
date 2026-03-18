import { rewriteText, batchRewrite, REWRITE_STRATEGIES } from '../services/aiService.js';

/**
 * 降重控制器
 * 处理文本降重的HTTP请求
 */

/**
 * 单段文本降重
 */
export async function rewriteSingleText(req, res) {
  try {
    const { text, strategy = 'MEDIUM', model = 'deepseek' } = req.body;

    // 参数验证
    if (!text) {
      return res.status(400).json({
        success: false,
        error: '请提供需要降重的文本'
      });
    }

    // 验证策略
    if (!REWRITE_STRATEGIES[strategy]) {
      return res.status(400).json({
        success: false,
        error: `无效的降重策略: ${strategy}`
      });
    }

    console.log(`\n📝 开始降重...`);
    console.log(`   文本长度: ${text.length} 字符`);
    console.log(`   降重策略: ${REWRITE_STRATEGIES[strategy].name}`);
    console.log(`   AI模型: ${model}`);

    // 调用AI服务
    const result = await rewriteText(text, { strategy, preferredModel: model });

    console.log(`✅ 降重完成！\n`);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ 降重失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * 批量文本降重
 */
export async function rewriteMultipleTexts(req, res) {
  try {
    const { texts, strategy = 'MEDIUM', model = 'deepseek' } = req.body;

    // 参数验证
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请提供需要降重的文本数组'
      });
    }

    // 验证策略
    if (!REWRITE_STRATEGIES[strategy]) {
      return res.status(400).json({
        success: false,
        error: `无效的降重策略: ${strategy}`
      });
    }

    console.log(`\n📝 开始批量降重...`);
    console.log(`   文本数量: ${texts.length} 段`);
    console.log(`   降重策略: ${REWRITE_STRATEGIES[strategy].name}`);
    console.log(`   AI模型: ${model}`);

    // 调用批量降重
    const results = await batchRewrite(texts, { strategy, preferredModel: model });

    const successCount = results.filter(r => r.success).length;
    console.log(`\n✅ 批量降重完成！成功: ${successCount}/${texts.length}\n`);

    res.json({
      success: true,
      data: {
        results,
        summary: {
          total: texts.length,
          success: successCount,
          failed: texts.length - successCount
        }
      }
    });

  } catch (error) {
    console.error('❌ 批量降重失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * 获取降重策略列表
 */
export async function getStrategies(req, res) {
  try {
    const strategies = Object.entries(REWRITE_STRATEGIES).map(([key, value]) => ({
      key,
      ...value
    }));

    res.json({
      success: true,
      data: strategies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export default {
  rewriteSingleText,
  rewriteMultipleTexts,
  getStrategies
};
