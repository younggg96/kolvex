# Kolvex 内容管理 MCP

管理员可以让支持 MCP 的 AI 客户端查询、新增和修改网站内容。此实现通过已有 Kolvex 后端 API 操作，沿用每个接口的 `verify_admin`、数据校验和日报版本检查；不直接连接数据库，也不需要数据库服务端密钥。

当前提供 18 个工具：

| 内容 | 工具 |
| --- | --- |
| 字段与示例 | `get_content_guide` |
| 日报（盘前／盘中／盘后，含中英双语） | `list_briefs`、`get_brief`、`validate_brief`、`create_brief`、`update_brief`、`delete_brief` |
| YouTube 创作者 | `list_creators`、`update_creator` |
| 股票观点 | `list_creator_opinions`、`create_opinion`、`update_opinion`、`delete_opinion` |
| 视频观点 JSON | `validate_youtube_import`、`import_youtube_opinions` |
| 市场事件 | `list_market_events`、`validate_market_events`、`save_market_events` |

例如：“列出今天的盘中简报，把英文标题改为……，保留其他内容。”、“修改这个创作者的头像。”、“新增一个市场事件，先保存为草稿。”、“把这个市场事件下架。”

## 本地启动

使用 Python 3.11+，从仓库根目录执行：

```bash
cd kolvex-backend-py
python3.11 -m venv .venv-mcp
.venv-mcp/bin/python -m pip install -r requirements-mcp.txt
cp .env.mcp.example .env.mcp.local
chmod 600 .env.mcp.local
```

编辑 `.env.mcp.local`：

- `KOLVEX_API_URL`：已部署或本地运行的 **FastAPI 后端**根地址，例如 `http://127.0.0.1:8080`，也允许末尾 `/api/v1`。远程后端必须使用 HTTPS；不填 Next.js 前端地址。
- `KOLVEX_ADMIN_ACCESS_TOKEN`：已登录 Kolvex 管理员的 `access_token`。可以从自己的登录响应 `session.access_token` 取得；不要将凭证粘贴到聊天或提交 Git。不能使用 anon key 或 service_role key 替代用户会话。

环境文件只在明确传入 `--env-file` 时加载，不会自动读取后端 `.env`。已经设置的进程环境变量优先于文件。`.env.mcp.local` 已匹配仓库现有忽略规则。

```bash
.venv-mcp/bin/python -m mcp_server --env-file .env.mcp.local
```

默认使用 stdio；启动后等待 MCP 客户端输入，不显示交互式菜单。客户端应自行启动此进程，无需先手动运行。会话到期后工具会报认证错误；更新 `KOLVEX_ADMIN_ACCESS_TOKEN` 并重启 MCP。此版本不保存或轮换 refresh token。

MCP 使用独立虚拟环境和依赖文件，不需要安装完整后端依赖。不要将 `requirements-mcp.txt` 安装进现有后端虚拟环境：新版 MCP 的 HTTP 依赖与后端当前固定的 FastAPI/httpx 版本不同。

## 生成客户端配置

```bash
.venv-mcp/bin/python -m mcp_server --env-file .env.mcp.local --print-client-config
```

命令输出标准 `mcpServers` JSON，自动填入当前 Python、环境文件和工作目录的绝对路径，不包含凭证。将输出合并进支持该格式的客户端配置即可。Muse 的具体产品和版本尚未指定；若支持 stdio MCP，可按输出中的 command、args、cwd 配置，其设置位置以该客户端文档为准。

## Streamable HTTP

HTTP 模式面向能设置 Bearer 请求头的受信任客户端，使用单个配置好的管理员身份。`KOLVEX_MCP_AUTH_TOKEN` 是访问 MCP 的独立随机密钥，不能与后端会话令牌相同。拥有该密钥的客户端可使用所有已列出的内容管理工具。

生成密钥并填入 `.env.mcp.local`：

```bash
.venv-mcp/bin/python -c 'import secrets; print(secrets.token_urlsafe(32))'
.venv-mcp/bin/python -m mcp_server --env-file .env.mcp.local --transport streamable-http
```

端点为 `http://127.0.0.1:8081/mcp`；请求头为 `Authorization: Bearer <KOLVEX_MCP_AUTH_TOKEN>`。密钥只在 MCP 验证，不转发给后端。后端请求始终使用服务器配置的管理员会话。HTTP 初始化、列工具和调用工具都要求认证；无凭据或错误凭据返回 401。

远程运行时使用 HTTPS 反向代理，并在 `KOLVEX_MCP_ALLOWED_HOSTS` 中填写实际 Host，例如 `mcp.example.com`。带非默认端口时写明端口。仅浏览器客户端需要添加对应 `KOLVEX_MCP_ALLOWED_ORIGINS`；没有 Origin 的原生客户端请求不受此限制。Host/Origin 校验始终启用，不要用通配域名替代明确的主机名。

服务默认监听 `PORT` 环境变量指定的端口，未设置时为 8081；显式 `--port` 优先。`GET /health` 是不需要认证的存活检查，仅返回 `{"status":"ok"}`，不访问后端，也不代表管理员会话有效。所有 `/mcp` 请求继续要求认证。

可独立构建容器（从后端目录运行）：

```bash
docker build -f Dockerfile.mcp -t kolvex-mcp .
docker run --rm --env-file .env.mcp.local -p 127.0.0.1:8081:8081 kolvex-mcp
```

容器里的 `127.0.0.1` 指容器自身。容器模式请把 `KOLVEX_API_URL` 配成可访问的 HTTPS 后端地址；需要连宿主机开发后端时，优先在宿主机直接运行本 MCP。

## 在 Railway 上线，供 Muse 远程连接

本仓库已提供独立部署文件 `kolvex-backend-py/railway.mcp.toml`。在现有 Kolvex 项目内新增一个 `kolvex-mcp` 服务，复用现有 HTTPS 后端。配置只应用到新 MCP 服务。

1. 连接包含 MCP 代码的 GitHub 分支。Root Directory 设置为 `/kolvex-backend-py`。
2. Railway Config File 设置为 `/kolvex-backend-py/railway.mcp.toml`。该配置使用 `Dockerfile.mcp` 构建，健康检查为 `/health`，启动命令由镜像提供。不要沿用普通后端的 `main:app` 启动命令。
3. 在新服务 Variables 中设置：

   | 变量 | 内容 |
   | --- | --- |
   | `KOLVEX_API_URL` | 现有 Kolvex FastAPI 后端的 HTTPS 根地址 |
   | `KOLVEX_ADMIN_ACCESS_TOKEN` | 管理员的有效 access_token；仅保存在服务端 |
   | `KOLVEX_MCP_AUTH_TOKEN` | 独立生成的至少 32 字符随机密钥，供 Muse 连接使用 |

4. 在 Networking 生成公开域名。服务会将 Railway 提供的 `RAILWAY_PUBLIC_DOMAIN` 自动加入 Host 白名单。使用自定义域名时，另外设置 `KOLVEX_MCP_ALLOWED_HOSTS` 为该域名。
5. 发布后检查 HTTPS `/health` 返回 200；无凭据访问 `/mcp` 应返回 401。然后用已认证的 MCP 客户端初始化、列出 18 个工具，并调用 `list_briefs` 验证后端管理员权限。

Muse 若支持远程 Streamable HTTP 和自定义请求头，填写：

| 配置 | 值 |
| --- | --- |
| 名称 | `kolvex-admin` |
| 传输 | Streamable HTTP |
| MCP URL | Railway 分配的 HTTPS 地址，路径为 `/mcp` |
| Authorization 请求头 | `Bearer ` 后接 `KOLVEX_MCP_AUTH_TOKEN` |

连接后先说：“使用 kolvex-admin 列出已有日报，不修改任何内容。” 若 Muse 只支持 OAuth 或本地 stdio，需要按该产品支持的方式另做连接；具体入口取决于 Muse 的产品和版本。

当前管理员会话到期仍需替换 `KOLVEX_ADMIN_ACCESS_TOKEN` 并重启或重新部署服务。MCP 连接密钥不会延长后端登录会话。不要把用户会话 refresh token 放到 Muse。

Railway 的 [Dockerfile 配置](https://docs.railway.com/builds/dockerfiles)、[monorepo 路径规则](https://docs.railway.com/deployments/monorepo)和[健康检查](https://docs.railway.com/deployments/healthchecks)说明了这些平台设置。本次仅准备并本地验证部署文件；是否已上线应以实际部署结果为准。

## GPT / ChatGPT 接入边界

GPT 应用或 Responses API 可以通过远程 MCP URL 和单独的 `authorization` 字段传入 MCP 密钥；不要传入 Kolvex 管理员令牌。[官方 MCP 工具文档](https://developers.openai.com/api/docs/guides/tools-remote-mcp)说明了 API 侧远程服务器连接方式。

**本实现没有 OAuth 服务。** ChatGPT 的“添加自定义 MCP”界面不能假定支持手填这个 Bearer 密钥，因此此版本不声称可直接完成 ChatGPT 网页账户绑定。需要网页内直接连接时，应在前面接入符合 MCP 的 OAuth 2.1 网关，并配置受保护资源发现、PKCE、客户端注册和令牌的 audience/scope 检查。不能把本服务改为免认证来绕过绑定。

接入要求以 [OpenAI 自定义 MCP 文档](https://developers.openai.com/api/docs/guides/custom-mcp-server)和[认证文档](https://developers.openai.com/plugins/build/auth)为准。实现尚未部署，也未绑定任何 GPT/Muse 账户。

## 写入行为

- 日报保存或修改后可由现有读者接口读取，**没有草稿／单独发布状态**。先 `get_brief`，保留完整 `payload`，使用返回的字符串 `revision` 更新或删除。MCP 将版本放入 `If-Match`；409 表示版本冲突，应重新读取并合并修改。
- 创作者只修改现有记录的名称、handle、主页、头像；未提供的字段保持原状，部分可选字段可用 `null` 清空。现有后端没有独立新增创作者或编辑简介的接口。
- 观点创建和修改立即生效；修改需要完整 `OpinionWrite`，不是任意字段的稀疏更新。先读取现有观点，保留原有可选字段。
- 批量视频导入先校验；校验响应中有 `errors` 时不调用写入。**导入同一视频会替换该视频的所有观点，删除此次省略的股票观点。** 后端还会校验真实视频发布时间和频道信息。
- 市场事件默认 `draft`；保存完整事件并设置 `published` 发布，设置 `draft` 或 `cancelled` 下架。同 ID 完整替换，未提供的 ID 不受影响。事件未提供并发版本号，最后保存生效。
- 日报、市场事件和视频导入会在写入前调用已有校验接口；后端保存时仍自行校验。工具保留只读、写入、删除等 MCP 注解供客户端决定交互策略。
- 写入超时不自动重试：先读回确认是否已经生效，再决定是否重试。删除为永久删除；本次未新增历史版本或回滚存储。

本 MCP 不提供任意 SQL、任意 HTTP、修改管理员权限、账户密钥、投资账户、首页源码或静态文案的工具。需要管理新内容类型时，应先有对应的后端内容模型和管理员接口。

## 验证

```bash
cd kolvex-backend-py
.venv-mcp/bin/python -m unittest discover -s tests -p test_mcp_server.py
.venv-mcp/bin/python -m unittest discover -s tests -p test_mcp_live_http.py
```

测试覆盖真实 MCP 初始化、工具发现、stdio 子进程、HTTP 初始化和调用、独立传输认证、接口映射、日报版本号、参数与体积检查、无效导入停止写入、401/403/409/422 和网络错误。业务 API 使用内存 HTTP 传输替身，不写真实数据库。现有后端业务测试使用原后端虚拟环境运行。

线上入口测试还会启动真实 HTTP 进程，使用平台 `PORT` 和自动公开域名白名单，通过 TCP 完成健康检查、拒绝未认证请求、SDK 初始化、工具发现和一次只读指南调用。该测试不需要有效业务凭证，不访问生产数据库。
