# 股票估值开发记录

产品范围见 [PRD](./PRD.md)。网页端优先，手机端复用后端和指标口径，不购买新的数据 API。

## 当前交付：公司估值计算器与历史 PE 走势

股票详情的“估值”Tab 默认进入“公司估值计算”，可切换“历史估值走势”。两个视图保留当前页内参数；带旧 `valuation_view` / `valuation_range` 的链接仍进入历史视图。

### 公司估值计算器

- **DCF**：按营收、营业利润率、税率和净再投资预测5年或10年 FCFF，用 WACC 折现；终值现金流扣除 `永续增长率 / 永续 ROIC` 对应的必要再投资。展示企业价值、加现金减债务及其他请求权后的股权价值、每股价值、预测现金流和3×3敏感性。
- **PE**：`模型每股价值 = 供应商 TTM EPS × 用户目标 PE`，`股权价值 = 每股价值 × 输入股数`；不额外套用未来 EPS 增长。目标 PE 必须手动输入，不能循环使用当前 PE 当作合理估值。
- **PEG**：`隐含 PE = 目标 PEG × EPS 年增长率（百分数）`，再按 PE 法计算。增长率须为正，不用于亏损或盈利不稳定的公司。
- 三情景独立计算，不将不同模型混合平均。PE／PEG 不伪造企业价值。股权价值非正时保留计算值，不输出负的每股价格；终值现金流非正时明确不适用。
- 自动取数支持美元上市、美元财报的美国普通股，复用已有 Yahoo Finance / yfinance，不新增付费服务。当前输入与 SEC 历史重建是不同数据管线，不能用供应商当前财务数据回填过去。
- 优先汇总连续四季度营收、营业利润、税前利润和所得税；缺季则回退最近完整财年，在结果上方显示“非TTM”和期间。现金、债务使用同一期最新季度资产负债表；缺失不自动补0。
- 股数默认是当前流通在外股数，并非完全稀释股数；现金默认全部现金和短期投资，用户需复核非经营部分；少数股东及优先股缺失项暂按0并标明。税率无法由财报计算时暂按21%并标明。供应商财报期为其标准化日期，不能当作SEC原始期末日。
- DCF 初始参数仅用于试算：零营收增长、沿用财报营业利润率、预测期再投资0%、WACC为12%／10%／8%、永续增长率2%、ROIC为10%。不宣称已估算资本成本或校准公司预测。PEG 初始0.75／1／1.25同样为试算值，增长率须由用户填写。
- 参数350ms后重算，可取消过时请求；无效输入或情景交叉保留上次有效结果并标注。刷新财务数据保留用户修改项，更新未修改的来源输入。金融、保险、REIT等需要专用模型，禁用普通 FCFF DCF；仍可使用符合条件的 PE／PEG。

### AI 一键估值

登录用户选择模型后点击“开始 AI 估值”。AI 只提出假设，所有估值都由同一份确定性模型计算，结果和普通假设一样可以修改。

- **Key：** 只使用用户在设置里保存的 API Key，不回退到服务端 Key，避免其他用户消耗站点额度。
- **发给 AI 的数据：** 财务快照和 Yahoo 分析师预期。当前股价、市值和目标价不发送，避免模型从现价倒推假设。
- **模型选择：** EPS 为正时生成 DCF、PE、PEG；亏损公司只生成 DCF；金融、保险、REIT 不生成 DCF。
- **校验：** 超范围、情景交叉或终值现金流非正时，把原因反馈给模型重试一次，仍失败则报错。保守情景股权价值≤0 是合法结果，不会被重试掉。
- **限制：** 同一用户、快照、模型和语言缓存30分钟；每位用户10分钟最多调用10次。限流和缓存都在单进程内存中。
- **保存：** 每次真实调用写入 `company_valuation_ai_runs`，包括假设、依据、当时模型结果、财务输入和行情，不含 API Key 和提示词。记录不可修改，只有本人可读，不同于对所有登录用户公开的 AI 分析。保存失败不影响当次结果，页面会提示。
- **恢复：** 打开页面时载入该公司最新一次结果，可切换最近20次。财务数据更新后，页面把旧假设用在最新数据上，同时显示生成时的基准值和股价。

### 利润率过渡

DCF 新增起始营业利润率，默认等于财报值，逐年直线过渡到预测期末值，终值使用期末值。亏损年份不计税，也不计再投资，FCFF 等于营业亏损；未建模税损结转。

### P/S 历史

NVDA、AAPL、MSFT 之外的公司显示 P/S 历史，亏损公司同样适用。TTM 营收＝最近财年＋本年累计−上年同期累计，每个交易日只使用此前已公开的财报，同一期间取最早申报值。市值＝收盘价×SEC 加权平均基本股数（按拆股调整）。

以下情况留缺口或不显示：营收超过200天未更新、股本无拆股却跳变超过2倍（更早的点留空）、最新股本与 Yahoo 市值反推值相差超过25%、最新交易日没有有效值。2026-11-05 抽样15只：13只可显示；JPM 因营收数据过旧、BRK-B 因股本口径不符未显示。部分公司早年有缺口，例如 GOOGL 仅约573个有效交易日。

DCF 口径参考 [CFA Institute 的自由现金流估值](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/free-cash-flow-valuation)和 [Damodaran 的 FCFF 说明](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/lectures/fcff.html)。

### 历史 PE 试点

个股工作台增加“估值”Tab，支持 `?tab=valuation`。历史曲线首批覆盖 NVDA、AAPL、MSFT；其他股票的历史视图明确显示试点范围，不补造结果。公司计算器覆盖范围独立于历史曲线。

- 当前卡片：保守、基准、乐观参考值，价格位置、价格空间与溢价/折价。比较基准为标明日期的最近完整交易日收盘价，区别于页首即时行情。
- 历史：股价与参考值、PE 倍数、溢价/折价三个视图，支持1年、3年、5年。点击图表或使用上一/下一交易日按钮选择日期，可展开该日财务来源。
- 系统倍数：财报事件前五年有效日 PE 的 P25/P50/P75，至少252日与四个财务输入版本。事件间冻结倍数，单独更新报价不会重新校准。
- 个人模拟：修改三情景 PE 和 EPS 年增长率，300ms 后由后端按同一快照重算；不会改写系统历史。默认增长率0%，明确为盈利不变假设。
- 未来表格：3、6、9个日历月的目标日期，按实际天数/365.25推演；本版不将这些日期称为公司财季末。
- 中文/英文、明/暗主题、窄屏堆叠与横向表格；复用现有组件和客户端缓存。目标价表优先展示，参数位于“调整假设”披露内。

本版尚未包含账户方案保存、经营条件自动预测、真实预测档案或原生手机端组件，也未部署到线上。私人参数仅保留在当前组件内存中。

## 真实数据验证

[最新机器报告](../../artifacts/valuation-data-audit-20261104/pe-verification.json)记录真实 HTTP 读取与试算结果、快照、财务来源及公告证据。截止2026-11-04的五年窗口，三家公司各取得1254个完整交易日，按当前试点规则均能生成 EPS 与 PE 参考值。

[初轮审计](../../artifacts/valuation-data-audit-20261104/REPORT.md)只使用 Company Facts，曾得到约24%–25%的候选完整率。该报告保留用于记录补充公告前的缺口，不是当前网页管线的覆盖结果。

Q4 补充值直接来自 SEC 原始8-K业绩公告的 GAAP 季度表，保存链接、披露日、原始值、解析器版本、证据行和内容哈希。不以全年 EPS 减累计 EPS 补造季度，不使用 AI 或搜索摘要填数。期间、GAAP标记或多个候选值无法对齐时保持缺失。

股本基准采用 `pilot-original-period-split-policy-v1`：申报须含首次披露的当期数据，再结合有官方依据的拆股记录对齐同一申报内的比较 EPS。没有当期锚点、接近拆股生效日，或行情公司行动与已审核清单不一致时不输出估值。覆盖始于2015年，不能直接推广至其他公司。原始值、统一后的值、展示股本基准和依据链接共同保留。

价格和 EPS 统一到此次行情读取的最后交易日股本口径，仅按拆股调整，不使用分红复权价计算 PE。后来的拆股只统一展示单位，后来申报的盈利不能提前进入历史；财务重表达从其允许使用的申报时点开始生效。

## 运行与接口

沿用现有 FastAPI 与 Next.js 启动方式。网页代理使用现有 `NEXT_PUBLIC_BACKEND_API_URL`，本地默认 `http://127.0.0.1:8080`。

网页示例：`http://localhost:3000/dashboard/market/NVDA?tab=valuation`。工作台保留现有登录要求，没有添加绕过登录的路由。

| 接口 | 用途 |
| --- | --- |
| `GET /api/v1/valuation/{symbol}/inputs` | 当前公司财务快照、输入来源、行情时间及模型适用性 |
| `POST /api/v1/valuation/{symbol}/calculate` | 指定快照、模型、财务覆盖项及三情景，返回确定性计算结果 |
| `GET /api/v1/valuation/{symbol}/history?years=3` | 当前值、限定范围历史点和来源；首访可能返回202 |
| `GET /api/v1/valuation/{symbol}/summary` | 同一快照入口，当前与历史入口共享响应结构 |
| `GET /api/v1/valuation/jobs/{id}` | 排队、运行、完成或失败状态 |
| `POST /api/v1/valuation/{symbol}/ai-assumptions` | 需登录；用用户的 API Key 生成并校验三情景假设，不返回估值 |
| `GET /api/v1/valuation/{symbol}/ai-runs` | 需登录；当前用户对该公司已保存的 AI 结果，最新在前 |
| `GET /api/v1/valuation/{symbol}/sales-history?years=5` | P/S 历史、分位数和 SEC 来源 |
| `POST /api/v1/valuation/{symbol}/simulate` | 指定快照、PE、增长率和最多三个未来日期，无持久化写入 |
| `/api/market/valuation/...` | 对应网页同源代理 |

首次计算后台合并同一股票的请求，最多两项并行。前端轮询有时间上限，失败后显式重试。有缓存内容时不以加载状态替换正文。无效参数返回422；快照丢失或不匹配返回409，需要刷新估值。

公司财务输入合并同一股票请求，最多两项并行、16项待处理；单次等待40秒，快照缓存5分钟、最多32家公司。修改假设只读取内存快照，不再次请求供应商。请求的快照已被替换时返回409。

SEC公开响应缓存于后端 `.cache/valuation-sec/`，可由 `VALUATION_SOURCE_CACHE` 指定。内容按 SHA-256 命名，读取校验哈希；申报附件使用不可变缓存。Company Facts与生成结果缓存六小时，生成结果另按纽约日期失效。

本版任务和生成快照在单个进程内管理，验证配置为一个后端worker。多worker/多实例上线前需共享任务和快照存储；进程重启会使原任务与快照失效，读取可重新计算。没有修改数据库或用户权限。

## 阶段A审计和离线重放

旧独立审计器不批准股本基准，也不使用补充公告，用于复现最初的可行性检查。其 `ready_for_pe=false` 不代表当前试点管线失败。

在仓库根目录执行：

```bash
kolvex-backend-py/venv/bin/python kolvex-backend-py/scripts/audit_valuation_data.py \
  --as-of 2026-11-04 --output artifacts/valuation-data-audit-20261104

kolvex-backend-py/venv/bin/python kolvex-backend-py/scripts/audit_valuation_data.py \
  --as-of 2026-11-04 --offline --output .cache/valuation-audit-replay
```

原始响应在 `.cache/valuation-audit/{日期}/{股票}/`，不加入版本控制。`--symbols`选择试点，`--years`选择1至10年。离线检查日期、窗口、公司、长度和哈希。退出0表示审计完成，1表示来源/审计失败；增加`--require-ready`后，条件未通过退出2。

候选完整率以实际取得的有效收盘日为分母，不代表独立核对了完整交易所日历。旧审计90%阈值为诊断规则。财务新鲜度采用150天申报年龄和200天期间年龄；季度和十二个月分别使用70–120天和330–385天的识别容差。

## 验证与限制

后端在 `kolvex-backend-py` 执行：

```bash
venv/bin/python -m unittest tests.test_company_valuation tests.test_valuation_pe tests.test_valuation_inputs tests.test_valuation_pipeline -q
venv/bin/python -m unittest discover -s tests -p 'test_sec_parsers.py' -q
venv/bin/python -m unittest discover -s tests -p 'test_yfinance_history.py' -q
```

89项估值测试及7项相关回归通过，覆盖未来信息隔离、缺季、来源冲突、拆股、未知公司行动、冻结倍数、公告格式、任务合并、失败重试和 HTTP 验证。三家公司的真实 HTTP 读取与参数试算通过。

网页在 `kolvex-frontend-web-nextjs` 执行：

```bash
node --test scripts/stock-valuation.test.cjs scripts/company-valuation.test.cjs
./node_modules/.bin/tsc --noEmit --incremental false
./node_modules/.bin/next lint --file components/decision/StockValuation.tsx \
  --file components/decision/StockWorkspace.tsx --file lib/stockValuation.ts \
  --file 'app/api/market/valuation/[...path]/route.ts'
```

浏览器使用独立、本机的组件预览检查中英文、明暗主题、390px/1280px布局、无效/有效/恢复参数、历史视图/范围、键盘日期切换和来源展开。未完成正式登录工作台的端到端会话验证；预览挂载相同组件与公开股票接口，没有改变登录规则。

生产构建使用隔离复制目录，保留正在运行的开发服务。构建通过，存在仓库原有的 Supabase Edge 兼容与 VideoPlayer 图片告警。全项目严格 UI 静态审计仍有4项既有问题，位于未修改的 Reddit 页、设置页和滚动条样式，见[审计记录](../../artifacts/valuation-data-audit-20261104/ui-audit.json)。没有为该审计扩大修改范围。

未核验行情公开展示授权。本轮用于内部开发验证，不承诺免费公开商业上线。

公司计算器的新增21项后端测试、7项前端测试通过；累计96项相关后端测试和15项前端测试通过。最终生产构建、类型检查与增量ESLint通过。桌面与手机验证DCF／PE／PEG、快照刷新保留修改项、情景交叉、财务来源、历史切换、金融行业限制及503恢复，见[完整验证记录](../../artifacts/company-valuation-20261104/verification.json)。

公司计算器的真实 HTTP 证据见[验证记录](../../artifacts/company-valuation-20261104/http-verification.json)：NVDA、AMZN通过三种模型，JPM正确拒绝普通DCF。验证包括股权价值桥接、股数分母及PE／PEG不输出企业价值；使用实际财务快照配合显式试算参数，不代表估值推荐。

## 后续范围

账户级私人方案和版本保存、公司实际财季目标日期、历史自定义假设重算、逐年预测参数、专用行业模型、正式上线数据授权。扩大历史股票范围前须补充公司财报解析、股本口径依据和质量测试。
