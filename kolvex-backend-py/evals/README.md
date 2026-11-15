# 评测（evals）

衡量 AI 输出质量的脚本。打分逻辑的单元测试在 `tests/` 里，免费、可进 CI；结果写到 `evals/results/`（已 gitignore）。

| 评测 | 测什么 | 调用模型？ | 打分器单测 |
| --- | --- | --- | --- |
| `chat_numbers.py` | 聊天 agent 选对工具、照抄数字、没数据不编数、路由正确 | 是（付费） | `tests/test_chat_numbers_eval.py` |
| `opinion_extraction.py` | 从视频文本抽股票观点：找全股票、方向读对、目标价忠实、不编造股票或方向 | 否，只给抽取结果打分 | `tests/test_opinion_extraction_eval.py` |

## 观点抽取

仓库里没有抽取 prompt。观点由外部 AI 客户端生成导入 JSON，再经 MCP `validate_youtube_import` 导入。所以这个评测只给任何抽取器的输出打分，不绑定某个模型或 prompt。

```bash
venv/bin/python -m evals.opinion_extraction inputs --out /tmp/opinion_inputs.json
# 用你真实导入时的同一个模型和 prompt 处理这些文本，每跑一次存成一个文件：
#   {"<case_id>": {"opinions": [...]}, ...}
venv/bin/python -m evals.opinion_extraction score run1.json run2.json run3.json
venv/bin/python -m evals.opinion_extraction score run*.json --baseline evals/results/opinion_<earlier>.json
```

- 标注集：`opinion_cases.json`。目前 11 条全是**合成文本**，各覆盖一种难点（否定、转述他人、长短期分歧、只说中文公司名、止损和目标价、纯宏观无个股等），绝不能导入网站。真实样本按同样格式追加，`source` 写原视频链接。
- 解析方式与导入一致：比如无法识别的 `sentiment`（`"看多"`、`"strong buy"`）会被导入悄悄存成 neutral，这里按 neutral 计分，同时记为 schema 错误。
- 每个指标的门槛在 `THRESHOLDS`；任一不达标时退出码为 1。同一条用例在多次运行中方向不一致的，会单独列出。
