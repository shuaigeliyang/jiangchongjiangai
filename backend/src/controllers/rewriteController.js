import { rewriteText, batchRewrite, REWRITE_STRATEGIES } from '../services/aiService.js';

/**
 * ============================================
 * 🎮 降重控制器 - HTTP请求处理层
 * ============================================
 *
 * 文件位置：E:\外包\降重降ai\backend\src\controllers\rewriteController.js
 *
 * 职责说明：
 * - 接收前端发来的HTTP请求
 * - 验证请求参数
 * - 调用AI服务层进行处理
 * - 返回处理结果给前端
 *
 * 与AI服务的关系：
 * 控制器 → 调用 → AI服务（aiService.js）
 */

/**
 * 【关键代码1】单段文本降重接口
 *
 * 位置：第11-53行
 * 作用：处理单段文本的降重请求
 *
 * API端点：POST /api/rewrite/text
 *
 * 请求体格式：
 * {
 *   "text": "需要降重的文本内容",
 *   "strategy": "MEDIUM",      // 可选：LIGHT/MEDIUM/HEAVY
 *   "model": "zhipu"           // 可选：zhipu/deepseek/openai
 * }
 *
 * 响应格式：
 * {
 *   "success": true,
 *   "data": {
 *     "originalText": "原文",
 *     "rewrittenText": "降重后文本",
 *     "model": "智谱AI GLM-4",
 *     "strategy": "MEDIUM"
 *   }
 * }
 */
export async function rewriteSingleText(req, res) {
  try {
    // 步骤1：从请求体中获取参数
    const { text, strategy = 'MEDIUM', model = 'deepseek' } = req.body;

    // 步骤2：参数验证 - 检查文本是否为空
    if (!text) {
      return res.status(400).json({
        success: false,
        error: '请提供需要降重的文本'
      });
    }

    // 步骤3：验证策略是否有效
    if (!REWRITE_STRATEGIES[strategy]) {
      return res.status(400).json({
        success: false,
        error: `无效的降重策略: ${strategy}`
      });
    }

    // 步骤4：打印日志（方便调试）
    console.log(`\n📝 开始降重...`);
    console.log(`   文本长度: ${text.length} 字符`);
    console.log(`   降重策略: ${REWRITE_STRATEGIES[strategy].name}`);
    console.log(`   AI模型: ${model}`);

    /**
     * 【重要】步骤5：调用AI服务层
     *
     * 这里会调用 aiService.js 中的 rewriteText() 函数
     * aiService会根据model参数选择对应的AI模型
     * 并自动应用降AI技巧
     */
    const result = await rewriteText(text, { strategy, preferredModel: model });

    console.log(`✅ 降重完成！\n`);

    // 步骤6：返回结果给前端
    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    // 错误处理
    console.error('❌ 降重失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * 【关键代码2】批量文本降重接口
 *
 * 位置：第58-108行
 * 作用：处理多段文本的批量降重
 *
 * API端点：POST /api/rewrite/batch
 *
 * 请求体格式：
 * {
 *   "texts": ["第一段", "第二段", "第三段"],
 *   "strategy": "MEDIUM",
 *   "model": "zhipu"
 * }
 *
 * 响应格式：
 * {
 *   "success": true,
 *   "data": {
 *     "results": [每段的降重结果],
 *     "summary": {
 *       "total": 3,
 *       "success": 3,
 *       "failed": 0
 *     }
 *   }
 * }
 */
export async function rewriteMultipleTexts(req, res) {
  try {
    // 步骤1：获取参数
    const { texts, strategy = 'MEDIUM', model = 'deepseek' } = req.body;

    // 步骤2：验证texts是否为数组且不为空
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请提供需要降重的文本数组'
      });
    }

    // 步骤3：验证策略
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

    /**
     * 【重要】步骤4：调用批量降重服务
     *
     * 会调用 aiService.js 中的 batchRewrite() 函数
     * 该函数会逐段处理，每段之间延迟1秒
     */
    const results = await batchRewrite(texts, { strategy, preferredModel: model });

    const successCount = results.filter(r => r.success).length;
    console.log(`\n✅ 批量降重完成！成功: ${successCount}/${texts.length}\n`);

    // 步骤5：返回结果和统计信息
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
 * 【关键代码3】获取降重策略列表接口
 *
 * 位置：第113-130行
 * 作用：返回可用的降重策略
 *
 * API端点：GET /api/strategies
 *
 * 响应格式：
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "key": "LIGHT",
 *       "name": "轻度降重",
 *       "description": "保持原有结构，主要进行同义词替换",
 *       "temperature": 0.3,
 *       "changeLevel": "low"
 *     },
 *     // ... MEDIUM, HEAVY
 *   ]
 * }
 */
export async function getStrategies(req, res) {
  try {
    // 将策略对象转换为数组
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

// 导出控制器函数
export default {
  rewriteSingleText,      // ← 单段文本降重
  rewriteMultipleTexts,   // ← 批量文本降重
  getStrategies           // ← 获取策略列表
};

/**
 * ============================================
 * 📋 控制器工作流程总结
 * ============================================
 *
 * 1. 接收请求 → 解析请求参数
 * 2. 参数验证 → 检查文本、策略、模型是否有效
 * 3. 调用服务 → 调用 aiService.js 中的函数
 * 4. 服务处理 → AI模型处理降重（包含降AI技巧）
 * 5. 返回结果 → 将结果以JSON格式返回给前端
 *
 * ============================================
 * 🔄 完整请求流程
 * ============================================
 *
 * 前端用户点击"开始降重"
 *   ↓
 * 前端发送 POST /api/rewrite/text
 *   ↓
 * 路由将请求转发到控制器
 *   ↓
 * 控制器验证参数
 *   ↓
 * 控制器调用 rewriteText(text, { strategy, model })
 *   ↓
 * aiService.js 选择对应的AI模型
 *   ↓
 * 生成包含降AI技巧的提示词
 *   ↓
 * 调用AI公司的API
 *   ↓
 * AI返回降重结果
 *   ↓
 * 控制器返回JSON响应
 *   ↓
 * 前端显示结果
 *
 * ============================================
 * 🎓 by 哈雷酱 (￣▽￣)／
 * ============================================
 */
