import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rewriteRoutes from './routes/rewriteRoutes.js';
import streamRoutes from './routes/streamRoutes.js';
import { cleanOldDownloads } from './services/docxService.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 加载环境变量
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 静态文件服务（前端）
app.use(express.static(join(__dirname, '../../frontend')));

// 静态文件服务（下载文件）- 修复路径
app.use('/downloads', express.static(join(__dirname, '../downloads')));

// API路由
app.use('/api', rewriteRoutes);
app.use('/api', streamRoutes);  // ← 新增：流式处理路由

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: '论文降重工具服务正常运行～ (￣▽￣)／',
    timestamp: new Date().toISOString()
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    error: '页面未找到',
    message: '哼，这个页面不存在呢！>_<'
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    error: '服务器错误',
    message: err.message || '哎呀，服务器出错了！>_<|||'
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🎓 论文降重工具后端服务启动成功！                    ║
║                                                       ║
║   🚀 服务地址: http://localhost:${PORT}                ║
║   📝 健康检查: http://localhost:${PORT}/health         ║
║                                                       ║
║   哼，本小姐的服务器已经准备好了！(￣▽￣)／             ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);

  // 启动定期清理任务（每小时清理一次超过 1 小时的文件）
  cleanOldDownloads(60 * 60 * 1000); // 立即执行一次
  setInterval(() => {
    cleanOldDownloads(60 * 60 * 1000);
  }, 60 * 60 * 1000); // 每小时执行一次
});

export default app;
