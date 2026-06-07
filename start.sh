#!/bin/bash
# OmniIndex 一键启动脚本 (WSL)
# 启动后端API服务 + 前端开发服务器
# 用法: ./start.sh              # SQLite模式（默认，使用现有search_agent.db）
#       DB_MODE=postgres ./start.sh  # PostgreSQL+pgvector模式
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
DB_MODE="${DB_MODE:-sqlite}"

echo "╔═══════════════════════════════════════════════╗"
echo "║         OmniIndex 服务启动脚本                ║"
echo "╚═══════════════════════════════════════════════╝"
echo "项目路径: $ROOT_DIR"
echo "数据库模式: $DB_MODE"
echo ""

# 配置文件生成
if [ ! -f "$ROOT_DIR/server/.env" ]; then
    if [ -n "$DASHSCOPE_API_KEY" ]; then
        echo "DASHSCOPE_API_KEY=$DASHSCOPE_API_KEY" > "$ROOT_DIR/server/.env"
        echo "EMBEDDING_MODEL=text-embedding-v3" >> "$ROOT_DIR/server/.env"
        echo "[配置] server/.env 已从环境变量创建"
    fi
fi

# PostgreSQL 模式检查
if [ "$DB_MODE" = "postgres" ]; then
    echo "[检查] PostgreSQL..."
    if pg_isready -h 127.0.0.1 -q 2>/dev/null; then
        echo "  ✅ PostgreSQL 已运行"
        # Check if database exists
        if sudo -u postgres psql -d terminal_index_db -c "SELECT 1" > /dev/null 2>&1; then
            echo "  ✅ 数据库 terminal_index_db 存在"
        else
            echo "  ⚠️  数据库不存在，正在创建..."
            sudo -u postgres psql -c "CREATE DATABASE terminal_index_db;" 2>/dev/null || true
            sudo -u postgres psql -d terminal_index_db -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || true
        fi
    else
        echo "  ⚠️  PostgreSQL 未运行，尝试启动..."
        sudo pg_ctlcluster 16 main start 2>/dev/null || sudo service postgresql start 2>/dev/null || true
        sleep 2
        pg_isready -h 127.0.0.1 -q && echo "  ✅ PostgreSQL 已启动" || { echo "  ❌ 启动失败"; exit 1; }
    fi
fi

# 后端启动
echo "[启动] 后端 API 服务 (端口 8001)..."
cd "$ROOT_DIR"
PYTHON="python3"

PID_FILE="$ROOT_DIR/.backend.pid"
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo "  停止旧进程 (PID $OLD_PID)..."
        kill "$OLD_PID" 2>/dev/null || true
        sleep 1
    fi
fi

export DB_MODE
nohup "$PYTHON" server/main.py > "$ROOT_DIR/logs/backend.log" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > "$PID_FILE"
echo "  后端 PID: $BACKEND_PID"

# 等待后端就绪
sleep 2
for i in $(seq 1 10); do
    if curl -s http://127.0.0.1:8001/health > /dev/null 2>&1; then
        echo "  ✅ 后端 API 已就绪 (http://127.0.0.1:8001)"
        break
    fi
    sleep 1
done

# 前端启动
echo "[启动] 前端开发服务器 (端口 5173)..."
cd "$ROOT_DIR/web"
if [ ! -d "node_modules" ]; then
    echo "  安装前端依赖..."
    npm install --legacy-peer-deps --silent 2>/dev/null || {
        echo "  ⚠️  npm 安装失败，尝试从备用位置恢复..."
        if [ -d "/tmp/omni-web-frontend/node_modules" ]; then
            cp -rn /tmp/omni-web-frontend/node_modules/. node_modules/ 2>/dev/null
        fi
    }
fi

fuser -k 5173/tcp 2>/dev/null || true
sleep 1

# Use direct node binary (npx has path issues on WSL)
nohup node node_modules/vite/bin/vite.js --host > "$ROOT_DIR/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "$FRONTEND_PID" > "$PID_FILE"
echo "  前端 PID: $FRONTEND_PID"
sleep 3

# 验证前端
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5173/ > /dev/null 2>&1 && \
    echo "  ✅ 前端服务器已就绪 (http://localhost:5173)" || \
    echo "  ⚠️  前端可能未完全就绪，检查 logs/frontend.log"

# 摘要信息
DB_STATUS=$(curl -s http://127.0.0.1:8001/api/v1/stats 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{d[\"files\"]}条文件, {d[\"vectors\"]}条向量, {d[\"total_agents\"]}台终端')" 2>/dev/null || echo "获取中...")

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║              启动完成！                        ║"
echo "╠═══════════════════════════════════════════════╣"
echo "║ 后端 API  : http://127.0.0.1:8001             ║"
echo "║ API 文档  : http://127.0.0.1:8001/docs        ║"
echo "║ 前端界面  : http://localhost:5173              ║"
echo "║ 数据库    : $DB_MODE                           ║"
echo "║ 数据状态  : $DB_STATUS                        ║"
echo "╠═══════════════════════════════════════════════╣"
echo "║ 停止: ./stop.sh                                ║"
echo "║ 日志: tail -f logs/backend.log                 ║"
echo "╚═══════════════════════════════════════════════╝"
