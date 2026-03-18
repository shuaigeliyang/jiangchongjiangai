import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  rewriteSingleText,
  rewriteMultipleTexts,
  getStrategies
} from '../controllers/rewriteController.js';
import { parseDocumentFile } from '../services/fileService.js';

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
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 默认10MB
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
 * @route   POST /api/rewrite/text
 * @desc    单段文本降重
 * @body    { text: string, strategy?: string, model?: string }
 */
router.post('/rewrite/text', rewriteSingleText);

/**
 * @route   POST /api/rewrite/batch
 * @desc    批量文本降重
 * @body    { texts: string[], strategy?: string, model?: string }
 */
router.post('/rewrite/batch', rewriteMultipleTexts);

/**
 * @route   POST /api/rewrite/file
 * @desc    上传文件并降重
 * @form    { file: File, strategy?: string, model?: string }
 */
router.post('/rewrite/file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传文件'
      });
    }

    const { strategy = 'MEDIUM', model = 'deepseek' } = req.body;

    console.log(`\n📄 解析文件: ${req.file.originalname}`);
    console.log(`   文件大小: ${(req.file.size / 1024).toFixed(2)} KB`);

    // 解析文件内容
    const texts = await parseDocumentFile(req.file.path);

    if (!texts || texts.length === 0) {
      return res.status(400).json({
        success: false,
        error: '无法从文件中提取文本内容'
      });
    }

    console.log(`   提取文本: ${texts.length} 段\n`);

    // 如果只有一段，使用单段降重
    if (texts.length === 1) {
      const result = await rewriteText(texts[0], { strategy, preferredModel: model });
      return res.json({
        success: true,
        data: {
          ...result,
          fileName: req.file.originalname
        }
      });
    }

    // 多段文本，使用批量降重
    const { batchRewrite } = await import('../services/aiService.js');
    const results = await batchRewrite(texts, { strategy, preferredModel: model });

    const successCount = results.filter(r => r.success).length;

    res.json({
      success: true,
      data: {
        results,
        fileName: req.file.originalname,
        summary: {
          total: texts.length,
          success: successCount,
          failed: texts.length - successCount
        }
      }
    });

  } catch (error) {
    console.error('❌ 文件处理失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/strategies
 * @desc    获取可用的降重策略
 */
router.get('/strategies', getStrategies);

/**
 * @route   GET /api/health
 * @desc    健康检查
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API服务正常运行～ (￣▽￣)／',
    timestamp: new Date().toISOString()
  });
});

export default router;
