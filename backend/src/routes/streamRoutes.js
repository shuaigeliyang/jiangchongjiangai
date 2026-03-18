import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { parseDocumentFile } from '../services/fileService.js';
import { generateWordDocument } from '../services/docxService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['.txt', '.docx', '.doc'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件格式，请上传 .txt、.docx 或 .doc 文件'));
    }
  }
});

/**
 * ============================================
 * 🚀 带实时进度的文件降重API（使用SSE）
 * ============================================
 *
 * 位置：第50-180行
 * 作用：处理文件降重并实时推送进度
 *
 * API端点：POST /api/rewrite/file-stream
 *
 * 返回格式：Server-Sent Events (SSE)
 *
 * 事件类型：
 * - progress: 进度更新
 * - complete: 单段完成
 * - error: 错误信息
 * - done: 全部完成
 */
router.post('/rewrite/file-stream', upload.single('file'), async (req, res) => {
  // 设置SSE响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // 验证文件
    if (!req.file) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: '请上传文件' })}\n\n`);
      res.end();
      return;
    }

    const { strategy = 'MEDIUM', model = 'zhipu' } = req.body;

    console.log(`\n📄 文件上传成功！`);
    console.log(`   文件名: ${req.file.originalname}`);
    console.log(`   文件大小: ${(req.file.size / 1024).toFixed(2)} KB`);

    // 发送文件上传成功事件
    res.write(`event: uploaded\ndata: ${JSON.stringify({
      success: true,
      message: `✅ 文件上传成功！正在解析...`,
      fileName: req.file.originalname,
      fileSize: `${(req.file.size / 1024).toFixed(2)} KB`,
      step: 'uploaded'
    })}\n\n`);

    console.log(`📝 开始解析文件内容...`);

    // 发送开始事件
    res.write(`event: start\ndata: ${JSON.stringify({
      message: '正在解析文件内容...',
      fileName: req.file.originalname
    })}\n\n`);

    // 解析文件内容
    let texts;
    try {
      texts = await parseDocumentFile(req.file.path);
      console.log(`   ✅ 解析成功，提取到 ${texts.length} 段文本\n`);
    } catch (error) {
      const errorMessage = `文件解析失败: ${error.message}`;
      console.error(`   ✗ ${errorMessage}`);

      res.write(`event: error\ndata: ${JSON.stringify({
        success: false,
        step: 'parse_failed',
        error: errorMessage,
        message: `❌ 文件解析失败\n\n原因：${error.message}\n\n建议：\n1. 确认文件是 .docx 或 .txt 格式\n2. 文件中包含文字内容\n3. 文件未损坏`
      })}\n\n`);
      res.end();
      return;
    }

    if (!texts || texts.length === 0) {
      const errorMessage = '无法从文件中提取文本内容';
      console.error(`   ✗ ${errorMessage}`);

      res.write(`event: error\ndata: ${JSON.stringify({
        success: false,
        step: 'no_content',
        error: errorMessage,
        message: `❌ 文件内容为空\n\n无法从文件中提取到任何文字内容。\n\n建议：\n1. 确认文件包含文字内容\n2. 删除图片、表格等非文字内容\n3. 尝试重新保存文件`
      })}\n\n`);
      res.end();
      return;
    }

    const totalParagraphs = texts.length;
    console.log(`   提取文本: ${totalParagraphs} 段\n`);

    // 发送总段数
    res.write(`event: init\ndata: ${JSON.stringify({
      total: totalParagraphs,
      message: `文件解析完成，共 ${totalParagraphs} 段文本`
    })}\n\n`);

    // 动态导入aiService（避免循环依赖）
    const { rewriteText } = await import('../services/aiService.js');

    const results = [];
    let successCount = 0;
    let failedCount = 0;

    // 逐段处理
    for (let i = 0; i < texts.length; i++) {
      const current = i + 1;
      const progress = Math.round((current / totalParagraphs) * 100);

      // 发送进度事件
      res.write(`event: progress\ndata: ${JSON.stringify({
        current,
        total: totalParagraphs,
        progress,
        message: `正在处理第 ${current}/${totalParagraphs} 段...`
      })}\n\n`);

      console.log(`[${current}/${totalParagraphs}] 进度: ${progress}%`);

      try {
        // 调用AI降重
        const result = await rewriteText(texts[i], { strategy, preferredModel: model });

        results.push(result);
        successCount++;

        // 发送单段完成事件
        res.write(`event: complete\ndata: ${JSON.stringify({
          index: i,
          current,
          total: totalParagraphs,
          progress,
          success: true,
          data: result,
          message: `第 ${current} 段处理完成`
        })}\n\n`);

        console.log(`  ✓ 第 ${current} 段成功`);

      } catch (error) {
        failedCount++;

        // 确保错误信息不为undefined
        const errorMessage = error.message || error.toString() || '未知错误';
        const errorType = error.name || 'Error';

        // 发送错误事件，明确说明是AI降重失败，不是文件上传失败
        res.write(`event: error\ndata: ${JSON.stringify({
          index: i,
          current,
          total: totalParagraphs,
          progress,
          success: false,
          step: 'rewrite_failed',
          error: errorMessage,
          errorType: errorType,
          message: `❌ 第 ${current}/${totalParagraphs} 段降重失败\n\n错误类型：${errorType}\n错误信息：${errorMessage}\n\n说明：\n这是AI降重阶段失败，不是文件上传问题。\n文件上传和解析都已成功，只是这段文字的AI处理失败了。\n其他段落会继续处理。`
        })}\n\n`);

        console.log(`  ✗ 第 ${current} 段失败: ${errorMessage}`);

        // 记录失败结果
        results.push({
          success: false,
          error: errorMessage,
          originalText: texts[i]
        });
      }

      // 添加延迟，避免API限流
      if (i < texts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // 合并所有成功的结果
    let allOriginalText = '';
    let allRewrittenText = '';

    results.forEach((result, index) => {
      if (result.success) {
        allOriginalText += result.originalText + '\n\n';
        allRewrittenText += result.rewrittenText + '\n\n';
      }
    });

    // 生成 Word 文档
    console.log(`\n📝 开始生成 Word 文档...`);
    let docxInfo = null;
    try {
      docxInfo = await generateWordDocument({
        originalText: allOriginalText.trim(),
        rewrittenText: allRewrittenText.trim(),
        fileName: req.file.originalname,
        strategy,
        model
      });
      console.log(`   ✅ Word 文档生成成功！`);
    } catch (error) {
      console.error(`   ✗ Word 文档生成失败: ${error.message}`);
    }

    // 发送完成事件
    res.write(`event: done\ndata: ${JSON.stringify({
      success: true,
      message: '文件处理完成！',
      results,
      fileName: req.file.originalname,
      docxDownloadUrl: docxInfo ? docxInfo.relativePath : null,  // ← 下载路径
      docxFileName: docxInfo ? docxInfo.fileName : null,         // ← 显示文件名
      summary: {
        total: totalParagraphs,
        success: successCount,
        failed: failedCount
      }
    })}\n\n`);

    console.log(`\n✅ 流式处理完成！成功: ${successCount}/${totalParagraphs}\n`);

    res.end();

  } catch (error) {
    console.error('❌ 流式处理失败:', error.message);

    res.write(`event: error\ndata: ${JSON.stringify({
      message: `处理失败: ${error.message}`
    })}\n\n`);

    res.end();
  }
});

export default router;
