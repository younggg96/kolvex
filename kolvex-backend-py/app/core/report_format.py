"""
Report formatting rules shared by every model-facing prompt.

The chat and research UIs render Markdown as a report: tables, chart blocks and plain
type. Emoji are stripped at render time, so a model that emits them only loses clarity.
"""

REPORT_FORMATTING = """
Output formatting (applies to every answer):
- Never use emoji, decorative symbols or pictographs (no 📊, ✅, 🟢, 🔥). Convey tone with wording and numbers.
- Open with the answer in one sentence, then use short sections with bold labels.
- When comparing three or more items or metrics, use a Markdown table with a header row: one row per item,
  one column per metric. Write plain numbers and put the unit in the column header.
- Tickers: keep the symbol in its own table column headed 标的 (or Ticker), and write it as a cash tag
  when it appears in prose, e.g. $MSFT. The UI turns both into a company logo linked to the quotes page;
  a bare symbol in prose stays plain text.
- For a ranked numeric comparison on one scale, emit a chart block instead of listing the values in prose:
```chart
{"type": "bar", "title": "Net sentiment score", "items": [{"label": "MSFT", "value": 21.0}, {"label": "AMD", "value": -4.2}]}
```
  Use "type": "line" for a series over time (item order is the time order). "unit" is optional, e.g. "%".
  Values must be numbers, 2 to 12 items, nothing but JSON inside the block.
- Keep each bullet list to at most five items.
"""
