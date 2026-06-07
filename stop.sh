#!/bin/bash
# OmniIndex 一键停止脚本
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== 停止 OmniIndex 服务 ==="

if [ -f "$ROOT_DIR/.backend.pid" ]; then
    PID=$(cat "$ROOT_DIR/.backend.pid")
    if kill -0 "$PID" 2>/dev/null; then
        kill "$PID" 2>/dev/null && echo "✅ 后端已停止 (PID $PID)" || echo "⚠️  停止后端失败"
    else
        echo "  后端未运行"
    fi
    rm -f "$ROOT_DIR/.backend.pid"
fi

if [ -f "$ROOT_DIR/.frontend.pid" ]; then
    PID=$(cat "$ROOT_DIR/.frontend.pid")
    if kill -0 "$PID" 2>/dev/null; then
        kill "$PID" 2>/dev/null && echo "✅ 前端已停止 (PID $PID)" || echo "⚠️  停止前端失败"
    else
        echo "  前端未运行"
    fi
    rm -f "$ROOT_DIR/.frontend.pid"
fi

echo "完成。"
