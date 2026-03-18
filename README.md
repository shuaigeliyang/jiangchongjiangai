# 🎓 论文降重工具 - Paper Rewriter

> **哼，这是本小姐为你打造的优雅降重工具！** (￣▽￣)／

一个简洁高效的论文降重工具，帮助你降低论文的重复率和AI检测率。

## ✨ 功能特点

- ✅ **智能降重** - 使用AI模型进行文本改写，保持原意的同时改变表达方式
- ✅ **文件上传** - 支持 `.docx`、`.txt` 等格式文件上传
- ✅ **实时对比** - 原文与降重文本实时对比展示
- ✅ **历史记录** - 本地保存降重历史，方便查看
- ✅ **简洁优雅** - 界面简洁，操作方便

## 🛠️ 技术栈

### 后端
- Node.js + Express
- AI模型集成（DeepSeek/OpenAI/Claude）
- 文件处理（mammoth.js）

### 前端
- 原生 HTML/CSS/JavaScript
- 或可选：React + Tailwind CSS

## 📦 安装使用

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd 降重降ai
```

### 2. 安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖（如果使用React）
cd ../frontend
npm install
```

### 3. 配置环境变量

在 `backend` 目录下创建 `.env` 文件：

```env
# 服务器端口
PORT=3000

# AI API配置（选择一个）
# DeepSeek API
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_API_BASE=https://api.deepseek.com

# 或使用 OpenAI
OPENAI_API_KEY=your_openai_api_key

# 或使用 Claude
ANTHROPIC_API_KEY=your_anthropic_api_key
```

### 4. 启动服务

```bash
# 启动后端服务
cd backend
npm run dev

# 启动前端服务（如果是React项目）
cd frontend
npm run dev
```

### 5. 访问应用

打开浏览器访问：`http://localhost:5173`（前端）或 `http://localhost:3000`（如果使用纯前端）

## 🎯 使用方法

1. **输入文本** - 在输入框中粘贴需要降重的文本，或上传文档
2. **选择参数** - 选择降重强度和改写策略
3. **开始降重** - 点击"开始降重"按钮
4. **查看结果** - 在结果区域查看降重后的文本
5. **保存记录** - 系统会自动保存降重历史

## 📁 项目结构

```
降重降ai/
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── controllers/     # 控制器
│   │   ├── services/        # 业务逻辑（AI服务、文件处理）
│   │   ├── routes/          # API路由
│   │   ├── utils/           # 工具函数
│   │   └── models/          # 数据模型
│   ├── package.json
│   └── .env                 # 环境变量配置
│
├── frontend/                # 前端界面
│   ├── src/
│   │   ├── components/      # 组件
│   │   ├── services/        # API调用
│   │   ├── utils/           # 工具函数
│   │   └── styles/          # 样式文件
│   ├── package.json
│   └── index.html           # 入口页面（纯HTML版本）
│
└── README.md
```

## 🔑 获取API密钥

### DeepSeek（推荐，性价比高）
- 官网：https://platform.deepseek.com/
- 价格：输入 ¥0.001/千tokens，输出 ¥0.002/千tokens

### OpenAI
- 官网：https://platform.openai.com/
- 需要国际信用卡

### Claude
- 官网：https://console.anthropic.com/
- 效果最好，价格稍高

## ⚠️ 注意事项

1. **API费用** - 使用AI API需要消耗费用，建议使用DeepSeek（性价比最高）
2. **学术诚信** - 本工具仅用于学习参考，请勿直接抄袭
3. **隐私保护** - 所有数据仅保存在本地，不会上传到其他服务器
4. **文件大小** - 建议上传文件不超过10MB

## 📄 开源协议

MIT License

---

**Made with ❤️ by 哈雷酱（大小姐）**

> 哼，虽然是你自己用，但本小姐也要做得优雅完美！(￣▽￣)／
