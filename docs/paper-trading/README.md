# 虚拟交易：运行与验证

功能范围及后续规划见 [PLAN.md](PLAN.md)。Web 入口为 `/dashboard/paper-trading`，桌面侧栏和手机菜单均有「虚拟交易」。股票技术计划和 AI 划线计划中的「用此计划模拟交易」会打开订单草稿。

## 启用

1. 在目标开发/预览数据库应用 `kolvex-backend-py/supabase/migrations/20261103090502_paper_trading.sql`。它只新增 `paper_accounts` 和 `paper_reviews`，不修改真实券商持仓。部署前按项目既有迁移流程审核和应用；本次开发没有修改线上数据库。
2. 后端使用现有 `SUPABASE_URL`、`SUPABASE_KEY`、`SUPABASE_SERVICE_KEY`。必须有服务端 service role 凭据；浏览器不能直接写虚拟账本。不要把 service role 放进 `NEXT_PUBLIC_*`。
3. 后端环境增加 `PAPER_TRADING_WORKER_ENABLED=true`，重启 FastAPI。后台每 60 秒扫描一次。默认关闭，避免尚未迁移的环境不断扫描缺失表；关闭后台时，打开工作台的用户仍可手动同步和每分钟自动同步。
4. Web 继续使用现有 `NEXT_PUBLIC_BACKEND_API_URL` 和 Supabase 登录配置，无新依赖。启动项目原有 Web 和 API 服务后登录，访问上述入口。

## 撮合模型

- 每账户初始 USD 100,000，无重置按钮，不连接真实交易接口。
- 仅美元股票/ETF，整股。多单扣本金；空单扣等额现金抵押，卖空所得不可再次使用。现金可以因空单跳空损失而变为负数，届时不能新增超出可用资金的仓位。
- 限价和突破 GTC 单冻结预计金额；平仓挂单冻结指定 lot 股数。每个 lot 的止盈和止损适用于其全部剩余数量，两者互斥。
- 每次成交按金额收 0.01% 模拟费用。成交价按交易方向加入 0.05% 不利滑点，限价不得差于用户限价。限价达到条件后可能成交得更好。
- 纽约常规时段且供应商时间戳在 20 分钟内才可撮合。只有带供应商时间戳的 Yahoo 报价可以使用；支持延迟报价，页面展示来源时间。不使用浏览器报价、日线高低点、未来价格或离线价格路径。
- 空单价格损失达到抵押本金时按下一个有效观察价关闭，可发生超额损失。不模拟借券可用性、借券费、股息、拆股或真实订单簿。
- 浮盈亏是价格差，未分摊仍持有 lot 的入场费用；账户净值已即时扣除所有费用。完整平仓后，初始资金加已实现净盈亏等于现金与净值。胜率按完全平仓的 lot 统计，包含入场和退出费用。

## API

所有接口都需要现有 Supabase Bearer 认证，前端通过 `/api/paper-trading/*` 转发。

| API（后端前缀 `/api/v1/paper-trading`） | 行为 |
| --- | --- |
| `GET /account` | 懒创建或读取当前用户的虚拟账户，不成交 |
| `GET /quote/{symbol}` | 读取经过币种、类型和时间校验的报价 |
| `POST /commands` | `order`、`cancel`、`bracket`、`sync`；要求 UUID `request_id` |
| `GET /reviews?offset=0` | 读取每页 20 条公开给登录用户的复盘 |
| `POST /reviews` | 指定已关闭 `position_id` 和复盘文字；快照仅由服务端生成 |
| `DELETE /reviews/{id}` | 仅作者撤回公开复盘 |

账户更新通过 `user_id + version` 条件原子更新整个账本；版本冲突最多重试四次。成功订单的 `request_id` 保存到账本，网络结果不明时应重试同一个 ID。市价单必须不传 `price`；限价/突破单必须传 `price`。客户端不能传 `user_id` 或复盘 `snapshot`。

## 已执行的验证

```sh
cd kolvex-backend-py
venv/bin/python -m unittest tests.test_paper_trading tests.test_paper_trading_routes tests.test_chart_drawings tests.test_yfinance_quotes -q
```

数据库测试使用临时 PostgreSQL，项目只读挂载，容器无网络且退出自动删除：

```sh
docker run --rm --network none \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -v "$PWD":/work:ro \
  postgres:17-alpine sh /work/tests/run_paper_trading_db.sh
```

```sh
cd kolvex-frontend-web-nextjs
npx tsc --noEmit
node --test scripts/paper-trading.test.cjs
npm run build
```

本次验证中，后端 50 项测试、前端 7 项 API/草稿测试、迁移/RLS/GRANT/CAS SQL 测试、Web 类型检查和生产构建通过。构建保留原有 `VideoPlayer.tsx` 图片提示和 Browserslist 数据过期提示。
真实浏览器验收未执行：Mac 锁定，且 Work 设置禁用了浏览器控制。发布前应实测桌面/手机下单确认、网络失败后同 ID 重试、Select 键盘操作、深浅主题、平仓、复盘发布与撤回，以及一轮真实开发账户的行情→数据库→界面闭环。
全项目 Premium 静态审计发现 4 个既有问题（设置/Reddit 原生 select 所有权、设置按钮、全局滚动条类），不在本次改动范围；新虚拟交易文件无对应发现。
