import mammoth from 'mammoth';
import fs from 'fs/promises';
import path from 'path';

/**
 * 文件处理服务
 * 支持解析 .txt、.docx 文件
 */

/**
 * 解析文档文件，提取文本内容
 * @param {string} filePath - 文件路径
 * @returns {Promise<string[]>} 返回文本段落数组
 */
export async function parseDocumentFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  try {
    let content = '';
    let paragraphs = [];

    switch (ext) {
      case '.txt':
        content = await parseTxtFile(filePath);
        paragraphs = splitIntoParagraphs(content);
        break;

      case '.docx':
      case '.doc':
        paragraphs = await parseDocxFile(filePath);
        break;

      default:
        throw new Error(`不支持的文件格式: ${ext}`);
    }

    // 过滤空段落
    paragraphs = paragraphs.filter(p => p && p.trim().length > 0);

    return paragraphs;

  } catch (error) {
    console.error('文件解析失败:', error.message);
    throw new Error(`文件解析失败: ${error.message}`);
  }
}

/**
 * 解析TXT文件
 */
async function parseTxtFile(filePath) {
  const buffer = await fs.readFile(filePath);
  const content = buffer.toString('utf-8');
  return content;
}

/**
 * 解析DOCX文件
 */
async function parseDocxFile(filePath) {
  const buffer = await fs.readFile(filePath);

  try {
    const result = await mammoth.extractRawText({ buffer: buffer });
    const content = result.value;
    const paragraphs = splitIntoParagraphs(content);

    return paragraphs;

  } catch (error) {
    throw new Error(`DOCX解析失败: ${error.message}`);
  }
}

/**
 * 将文本分割成段落
 * 按照换行符分割，并过滤空行
 */
function splitIntoParagraphs(text) {
  // 按照换行符分割
  let paragraphs = text.split(/\n+/);

  // 过滤空段落和过短的段落
  paragraphs = paragraphs
    .map(p => p.trim())
    .filter(p => p.length > 10); // 至少10个字符

  return paragraphs;
}

/**
 * 清理上传的临时文件
 */
export async function cleanupFile(filePath) {
  try {
    await fs.unlink(filePath);
    console.log(`✓ 已删除临时文件: ${filePath}`);
  } catch (error) {
    console.warn(`⚠ 删除文件失败: ${filePath}`, error.message);
  }
}

/**
 * 批量清理临时文件
 */
export async function cleanupFiles(filePaths) {
  const promises = filePaths.map(filePath => cleanupFile(filePath));
  await Promise.allSettled(promises);
}

export default {
  parseDocumentFile,
  cleanupFile,
  cleanupFiles
};
