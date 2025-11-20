# Kolvex Backend API

基于 FastAPI 的后端服务，为 Kolvex 股票分析平台提供 API 支持。

## 技术栈

- **FastAPI** - 现代、快速的 Web 框架
- **SQLAlchemy** - ORM 数据库操作
- **PostgreSQL** - 主数据库
- **Alembic** - 数据库迁移工具
- **Pydantic** - 数据验证
- **JWT** - 用户认证

## 快速开始

### 1. 创建虚拟环境

```bash
python -m venv venv
source venv/bin/activate  # macOS/Linux
# 或
.\venv\Scripts\activate  # Windows
```

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，填入你的配置
```

### 4. 运行开发服务器

```bash
python main.py
```

或者使用 uvicorn：

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务器将在 http://localhost:8000 启动

## API 文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 项目结构

```
kolvex-backend-py/
├── app/
│   ├── api/          # API 路由
│   ├── core/         # 核心配置
│   ├── models/       # 数据库模型
│   ├── schemas/      # Pydantic 模式
│   ├── services/     # 业务逻辑
│   └── utils/        # 工具函数
├── alembic/          # 数据库迁移
├── tests/            # 测试文件
├── main.py           # 应用入口
├── requirements.txt  # 依赖列表
└── .env              # 环境变量
```

## 开发指南

### 添加新的 API 路由

1. 在 `app/api/routes/` 创建新的路由文件
2. 在 `app/api/routes/__init__.py` 中注册路由
3. 在 `main.py` 中引入

### 数据库迁移

```bash
# 创建迁移
alembic revision --autogenerate -m "描述"

# 执行迁移
alembic upgrade head

# 回滚
alembic downgrade -1
```

## 测试

```bash
pytest
```

## 部署

待添加部署说明

## 许可证

MIT

