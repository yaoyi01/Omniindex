<p align="center">
  <img src="https://img.shields.io/badge/status-MVP-brightgreen" alt="MVP">
  <img src="https://img.shields.io/badge/agent-.NET%204.8-512BD4" alt=".NET">
  <img src="https://img.shields.io/badge/backend-FastAPI-009688" alt="FastAPI">
  <img src="https://img.shields.io/badge/frontend-React%20%2B%20Tailwind-61DAFB" alt="React">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT">
</p>

<h1 align="center">🛡️ OmniIndex</h1>
<p align="center"><strong>无侵入式终端文件索引与语义检索系统</strong></p>
<p align="center">不装 Agent 也能搜？不。装了 Agent，秒级溯源。</p>

---

## 🎯 这是什么

OmniIndex 是一套**轻量级企业终端文件检索系统**。它在每台 Windows 终端上运行一个不到 2MB 的采集程序，利用 Windows Search 索引即时获取文件元数据，上传至中心服务器进行 AI 向量化，最终通过语义搜索引擎让你在数十万文件中**秒级定位目标**。

## ✨ 核心亮点

- 🪶 **零侵入采集** — 利用 Windows Search Index (SystemIndex)，不扫磁盘、不装驱动、不用管理员权限
- 🔍 **语义搜索** — 搜"财务报表"能找到包含"利润表"、"balance sheet"的文件，不依赖精确关键词
- 🧠 **LLM 查询预处理** — DeepSeek 自动扩展搜索意图，中英文混合理解
- 📊 **可视化仪表盘** — 文件类型分布、向量化覆盖率、终端状态一目了然
- 🔒 **免 API Key 泄露** — 所有密钥通过 `.env` 管理，`.gitignore` 自动排除

## 🏗️ 系统架构

```
Windows 终端                    中心服务器 (WSL / Linux)
┌──────────────┐               ┌─────────────────────────┐
│  Agent (.NET) │──upload────→ │  FastAPI 后端 :8001      │
│  Windows      │              │  ├─ 文件入库 + 去重       │
│  Search Index │←─config──── │  ├─ DashScope 向量化     │
└──────────────┘               │  ├─ DeepSeek 查询扩展    │
                               │  ├─ SQLite / PG 存储     │
                               │  └─ REST API             │
                               └───────────┬─────────────┘
                                           │
                               ┌───────────▼─────────────┐
                               │  React 前端 :5173        │
                               │  ├─ 搜索仪表盘           │
                               │  ├─ 终端管理 + 文件浏览   │
                               │  └─ 系统设置             │
                               └─────────────────────────┘
```

## 🔄 搜索流程

```
用户输入 "财务报表"
  │
  ├─① LLM 查询扩展 (DeepSeek, ~1.5s)
  │    → keywords: [财务报表, 利润表, P&L, balance sheet, ...]
  │    → embedding_text: "财务报表相关文档，包括利润表、资产负债表..."
  │
  ├─② 关键字搜索 (ILIKE OR 匹配扩展关键词)
  │    → 得分 1.0 的直接命中
  │
  └─③ 语义搜索 (DashScope 嵌入 + 余弦相似度)
       → 得分 0.3~0.99 的语义关联命中
       → 合并去重，按分数排序返回
```

## 🔌 API 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/v1/agent/upload` | Agent 批量上传文件元数据 |
| `POST` | `/api/v1/agent/heartbeat` | Agent 心跳 + 注册 |
| `GET` | `/api/v1/agent/list` | 终端列表（含文件数、在线状态） |
| `PATCH` | `/api/v1/agent/{id}` | 更新终端别名 |
| `DELETE` | `/api/v1/agent/{id}` | 移除终端记录 |
| `DELETE` | `/api/v1/agent/{id}/purge` | 彻底清除终端及所有文件 |
| `POST` | `/api/v1/search/semantic` | 语义搜索（LLM 扩展 + 向量检索） |
| `GET` | `/api/v1/files/recent` | 最近文件列表 |
| `GET` | `/api/v1/stats` | 统计信息（文件数、向量数、终端数） |
| `GET` | `/api/v1/config` | 获取 Agent 采集策略 |
| `POST` | `/api/v1/config` | 更新采集策略 |

## 📁 项目结构

```
Omniindex/
├── agent/                       # Windows 采集客户端 (C# .NET 4.8)
│   ├── Program.cs               # 主循环：心跳 → 拉配置 → 采集 → 上传
│   ├── SearchService.cs         # Windows Search OLE DB 查询封装
│   ├── AgentIdentity.cs         # 终端唯一标识生成
│   ├── Logger.cs                # 本地日志
│   └── desktop-search-agent.csproj
├── server/                      # 后端服务 (Python FastAPI)
│   ├── main.py                  # API 入口 + 搜索逻辑
│   ├── app/
│   │   ├── api/                 # (预留) 额外路由
│   │   ├── core/config.py       # 配置管理 (.env 加载)
│   │   ├── db/session.py        # SQLAlchemy 会话
│   │   ├── models/files.py      # ORM 模型 (Agent, FileIndex)
│   │   ├── routers/agents.py    # Agent 管理路由
│   │   ├── schemas/agent.py     # Pydantic 请求/响应模型
│   │   └── services/
│   │       ├── ingestion.py     # 文件入库 + DashScope 向量化
│   │       └── query_expander.py # DeepSeek LLM 查询扩展
│   └── .env.example             # 环境变量模板
├── web/                         # 前端界面 (React + Tailwind)
│   ├── src/
│   │   ├── App.jsx              # 主应用（仪表盘/终端/设置/文件）
│   │   ├── api.js               # API 地址配置
│   │   ├── components/ui/       # shadcn/ui 组件
│   │   └── lib/utils.js         # 工具函数
│   └── .env.example
├── start.sh                     # WSL 一键启动脚本
├── stop.sh                      # 停止脚本
├── re_vectorize.py              # 存量文件重向量化工具
└── docker-compose.yml           # PostgreSQL 模式部署
```

## 🚀 快速开始

### 1. 启动后端

```bash
cd Omniindex

# 复制环境变量模板并填入真实 Key
cp server/.env.example server/.env
# 编辑 server/.env，填入你的 DashScope 和 DeepSeek API Key

# 启动后端 + 前端
./start.sh
```

### 2. 部署 Agent

```bash
# 在 Windows 终端执行
cd agent
dotnet publish -c Release -o dist

# 将 dist/desktop-search-agent.exe 拷贝到目标 Windows 机器
# 在同目录创建 config.json：
#   {"ServerUrl": "http://服务器IP:8001"}
# 双击运行
```

### 3. 访问前端

浏览器打开 `http://localhost:5173`，开始搜索。

## 📦 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 采集 Agent | C# .NET Framework 4.8 | OLE DB 直连 Windows Search |
| 后端框架 | Python FastAPI | 异步 HTTP，自动 OpenAPI 文档 |
| 数据库 | SQLite / PostgreSQL + pgvector | 支持双模式，SQLite 开箱即用 |
| 向量嵌入 | DashScope text-embedding-v3 | 1024 维稠密向量 |
| 查询扩展 | DeepSeek Chat API | 中文语义理解 + 关键词生成 |
| 前端 | React 18 + TailwindCSS 3 | 暗色主题，响应式布局 |
| 图表 | Recharts | 饼图 + 柱状图仪表盘 |

## 🔧 配置说明

所有配置通过 `server/.env` 管理：

```bash
# 必需
DASHSCOPE_API_KEY=sk-xxx      # 阿里云 DashScope（向量嵌入）
DEEPSEEK_API_KEY=sk-xxx       # DeepSeek（查询扩展，可选）

# 可选
DB_MODE=sqlite                # sqlite | postgres
EMBEDDING_MODEL=text-embedding-v3
DEEPSEEK_MODEL=deepseek-chat
```

前端 `web/.env`：
```bash
VITE_API_BASE=http://127.0.0.1:8001  # 后端地址
```

## 🖥️ Agent 工作原理

```
1. 首次运行生成 AgentID（基于硬件特征哈希）
2. 发送心跳注册到服务器，获取采集策略（间隔、文件类型限制）
3. 查询 Windows Search SystemIndex：
   SELECT TOP N System.ItemName, System.ItemPathDisplay,
          System.DateModified, System.Size, System.Search.AutoSummary
   FROM SystemIndex WHERE Scope='file:'
4. 每批 50 条上传至服务器
5. 按配置的间隔重复（默认1小时）
```

Agent 使用 `Costura.Fody` 将所有依赖打包为单文件 exe，目标机只需 .NET Framework 4.8 Runtime。

## ⚠️ 已知限制

- **Windows Search 依赖**：Agent 仅支持 Windows，依赖系统 Search 索引服务正常运行
- **文件内容索引受限**：部分文件类型（图片、加密文档）的文本摘要可能为空
- **大事务删除慢**：SQLite 模式下删除大量文件需分批执行
- **无权限控制**：当前 MVP 无用户认证，适合内网或单用户场景
- **向量模型依赖云 API**：无网络时回退为纯关键字搜索

## 📋 Roadmap

- [ ] HTTPS + API Key 鉴权
- [ ] PostgreSQL + pgvector 生产部署
- [ ] Windows Service 封装（开机自启）
- [ ] 增量采集（基于 LastModifiedTime）
- [ ] 文件内容全文索引（非仅元数据）
- [ ] 多用户/多租户支持

## 📄 License

MIT
