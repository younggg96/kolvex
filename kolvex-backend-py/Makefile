# Kolvex Backend Makefile

.PHONY: help install dev build up down logs clean test

# 默认目标
.DEFAULT_GOAL := help

help: ## 显示帮助信息
	@echo "Kolvex Backend - 可用命令："
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## 安装依赖（虚拟环境）
	python3 -m venv venv
	. venv/bin/activate && pip install --upgrade pip
	. venv/bin/activate && pip install -r requirements.txt

dev: ## 启动开发服务器（本地）
	. venv/bin/activate && python3 main.py

docker-dev: ## 使用 Docker 启动开发环境
	docker-compose up -d
	@echo "✅ 开发环境已启动"
	@echo "📍 API: http://localhost:8000"
	@echo "📍 文档: http://localhost:8000/docs"

docker-prod: ## 使用 Docker 启动生产环境
	docker-compose -f docker-compose.prod.yml up -d

build: ## 构建 Docker 镜像
	docker-compose build

up: ## 启动所有服务
	docker-compose up -d

down: ## 停止所有服务
	docker-compose down

logs: ## 查看日志
	docker-compose logs -f backend

logs-db: ## 查看数据库日志
	docker-compose logs -f db

ps: ## 查看运行状态
	docker-compose ps

shell: ## 进入后端容器
	docker-compose exec backend bash

db-shell: ## 进入数据库容器
	docker-compose exec db psql -U kolvex -d kolvex

clean: ## 清理容器和数据卷
	docker-compose down -v
	rm -rf __pycache__
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

test: ## 运行测试
	. venv/bin/activate && pytest

migrate: ## 运行数据库迁移
	docker-compose exec backend alembic upgrade head

migrate-create: ## 创建新的迁移
	@read -p "迁移描述: " desc; \
	docker-compose exec backend alembic revision --autogenerate -m "$$desc"

env: ## 创建 .env 文件
	cp .env.example .env
	@echo "✅ 已创建 .env 文件，请根据需要修改配置"

health: ## 健康检查
	@curl -s http://localhost:8000/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:8000/health

setup: env docker-dev ## 初始化项目（创建 .env + 启动服务）
	@echo ""
	@echo "✅ 项目设置完成！"
	@echo "📍 API: http://localhost:8000"
	@echo "📍 文档: http://localhost:8000/docs"
