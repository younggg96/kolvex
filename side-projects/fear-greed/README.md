# CNN 恐慌与贪婪指数采集

用本机浏览器（Playwright + Google Chrome）打开 CNN 指数页，截取页面自己加载的图表 JSON，发给 Kolvex 后端写库。功能说明和解析规则见 [docs/fear-greed.md](../../docs/fear-greed.md)。

```bash
./setup.sh                      # 建 .venv 并安装 Playwright（没装 Chrome 时加 --chromium）
cp .env.worker.example .env.worker   # 填 KOLVEX_API_URL 和 KOLVEX_WORKER_TOKEN
./start.sh --dry-run            # 只抓取并打印摘要，不写库
./start.sh                      # 抓取并同步一次
./install_worker.sh             # 安装 LaunchAgent，每 60 分钟一次（./install_worker.sh 30 改间隔）
./install_worker.sh --uninstall # 移除
```

日志：`logs/collect.log`。失败（CNN 拦截、页面没加载数据、后端拒绝）会记一行原因并以非零状态退出，不写任何数据。
