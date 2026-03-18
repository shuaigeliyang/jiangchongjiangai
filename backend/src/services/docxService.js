/**
 * ============================================
 * 📄 Word 文档生成服务
 * ============================================
 *
 * 文件位置：E:\外包\降重降ai\backend\src\services\docxService.js
 *
 * 功能：
 * - 生成 Word 文档（.docx 格式）
 * - 保留基本格式
 * - 支持段落和文本样式
 *
 * 作者：哈雷酱 (￣▽￣)／
 */

import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from 'docx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 生成 Word 文档
 *
 * @param {Object} options - 生成选项
 * @param {string} options.originalText - 原文
 * @param {string} options.rewrittenText - 降重后的文本
 * @param {string} options.fileName - 文件名
 * @param {string} options.strategy - 降重策略
 * @param {string} options.model - 使用的模型
 * @returns {Promise<string>} 生成的文件路径
 */
export async function generateWordDocument(options) {
  const {
    originalText,
    rewrittenText,
    fileName = '降重结果',
    strategy = 'MEDIUM',
    model = 'zhipu'
  } = options;

  console.log(`\n📝 开始生成 Word 文档...`);
  console.log(`   文件名: ${fileName}`);
  console.log(`   策略: ${strategy}`);
  console.log(`   模型: ${model}`);

  try {
    // 将文本分割成段落
    const originalParagraphs = originalText.split('\n').filter(p => p.trim());
    const rewrittenParagraphs = rewrittenText.split('\n').filter(p => p.trim());

    // 创建文档
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // 标题
          new Paragraph({
            text: '论文降重结果',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: {
              after: 400,
            },
          }),

          // 元信息
          new Paragraph({
            children: [
              new TextRun({
                text: `文件名：`,
                bold: true,
              }),
              new TextRun({
                text: fileName,
              }),
            ],
            spacing: {
              after: 200,
            },
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: `降重策略：`,
                bold: true,
              }),
              new TextRun({
                text: strategy,
              }),
            ],
            spacing: {
              after: 200,
            },
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: `AI 模型：`,
                bold: true,
              }),
              new TextRun({
                text: model,
              }),
            ],
            spacing: {
              after: 200,
            },
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: `生成时间：`,
                bold: true,
              }),
              new TextRun({
                text: new Date().toLocaleString('zh-CN'),
              }),
            ],
            spacing: {
              after: 400,
            },
          }),

          // 分隔线
          new Paragraph({
            text: '─'.repeat(50),
            alignment: AlignmentType.CENTER,
            spacing: {
              after: 400,
            },
          }),

          // 降重后文本标题
          new Paragraph({
            text: '降重后的文本',
            heading: HeadingLevel.HEADING_2,
            spacing: {
              before: 400,
              after: 300,
            },
          }),

          // 降重后的文本段落
          ...rewrittenParagraphs.map(para => new Paragraph({
            text: para,
            spacing: {
              after: 200,
            },
            indent: {
              firstLine: 200, // 首行缩进
            },
          })),

          // 分隔线
          new Paragraph({
            text: '─'.repeat(50),
            alignment: AlignmentType.CENTER,
            spacing: {
              before: 400,
              after: 400,
            },
          }),

          // 原文标题
          new Paragraph({
            text: '原始文本（对比）',
            heading: HeadingLevel.HEADING_2,
            spacing: {
              after: 300,
            },
          }),

          // 原文段落
          ...originalParagraphs.map(para => new Paragraph({
            text: para,
            spacing: {
              after: 200,
            },
            indent: {
              firstLine: 200, // 首行缩进
            },
          })),
        ],
      }],
    });

    // 生成文件
    const outputDir = path.join(__dirname, '../../downloads');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const baseFileName = fileName.replace(/\.[^/.]+$/, ''); // 移除原扩展名

    // 使用安全的文件名（避免中文编码问题）
    // 生成一个唯一的安全文件名
    const safeFileName = `rewrite_${Date.now()}_${Math.random().toString(36).substring(7)}.docx`;
    const outputPath = path.join(outputDir, safeFileName);

    console.log(`   📝 生成安全文件名: ${safeFileName}`);

    // 打包并保存
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputPath, buffer);

    console.log(`   ✅ Word 文档生成成功！`);
    console.log(`   保存路径: ${outputPath}\n`);

    return {
      path: outputPath,
      fileName: `${baseFileName}_降重结果_${timestamp}.docx`, // 显示用的文件名（包含中文）
      safeFileName: safeFileName, // 实际文件名（安全）
      relativePath: `/downloads/${safeFileName}`
    };

  } catch (error) {
    console.error(`   ✗ Word 文档生成失败: ${error.message}\n`);
    throw error;
  }
}

/**
 * 从文件路径删除文件
 *
 * @param {string} filePath - 文件路径
 */
export function deleteDocument(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️  已删除文件: ${filePath}`);
    }
  } catch (error) {
    console.error(`删除文件失败: ${error.message}`);
  }
}

/**
 * 清理旧的下载文件
 * 删除超过指定时间的文件
 *
 * @param {number} maxAge - 最大保留时间（毫秒），默认 1 小时
 */
export function cleanOldDownloads(maxAge = 60 * 60 * 1000) {
  try {
    const downloadsDir = path.join(__dirname, '../../downloads');

    if (!fs.existsSync(downloadsDir)) {
      return;
    }

    const files = fs.readdirSync(downloadsDir);
    const now = Date.now();

    files.forEach(file => {
      const filePath = path.join(downloadsDir, file);
      const stats = fs.statSync(filePath);

      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
        console.log(`🗑️  已清理旧文件: ${file}`);
      }
    });

  } catch (error) {
    console.error(`清理旧文件失败: ${error.message}`);
  }
}

export default {
  generateWordDocument,
  deleteDocument,
  cleanOldDownloads,
};
