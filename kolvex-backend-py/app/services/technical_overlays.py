"""Deterministic chart annotations, anchored only to supplied OHLC bars."""
from typing import Any, Dict, List


def chart_overlays(bars, swings, averages, tolerance, locale="zh"):
    zh = locale.startswith("zh")
    confirmation_window = 2 if len(bars) < 60 else 3 if len(bars) < 200 else 5
    overlays: List[Dict[str, Any]] = []

    def add(category, label, points, shape="line", direction="neutral"):
        overlays.append({"category": category, "label": label, "points": points,
                         "shape": shape, "direction": direction})

    def point(item):
        return {"date": item["date"], "price": item["price"]}

    for period, points in averages.items():
        if len(points) >= 2:
            add("moving_averages", f"EMA{period}", points)

    # Collapse consecutive same-kind pivots to the extreme; ignore ambiguous outside bars.
    ambiguous = {p["index"] for p in swings if sum(q["index"] == p["index"] for q in swings) > 1}
    pivots = []
    for item in sorted(swings, key=lambda p: p["index"]):
        if item["index"] in ambiguous:
            continue
        if pivots and item["kind"] == pivots[-1]["kind"]:
            if (item["price"] > pivots[-1]["price"]) == (item["kind"] == "high"):
                pivots[-1] = item
        else:
            pivots.append(item)

    # Candidate impulse: wave 2 does not cross origin, wave 4 does not overlap 1,
    # wave 3 is not the shortest impulse, and wave 5 exceeds wave 3.
    for start in range(len(pivots) - 6, -1, -1):
        seq = pivots[start:start + 6]
        sign = 1 if seq[0]["kind"] == "low" else -1
        prices = [sign * p["price"] for p in seq]
        p0, p1, p2, p3, p4, p5 = prices
        lengths = [p1-p0, p3-p2, p5-p4]
        if (p0 < p2 < p1 < p4 < p3 < p5 and lengths[1] >= min(lengths[0], lengths[2])):
            for i in range(1, 6):
                label = f"候选浪 {i}" if zh else f"Candidate wave {i}"
                add("waves", label, [point(seq[i-1]), point(seq[i])], direction="bullish" if sign == 1 else "bearish")
            # Optional ABC correction after this impulse, never projected into future bars.
            correction = pivots[start + 6:start + 9]
            if len(correction) == 3:
                a, b, c = [sign * p["price"] for p in correction]
                if a < p5 and a < b < p5 and c < a:
                    chain = [seq[-1], *correction]
                    for i, label in enumerate("ABC", 1):
                        add("waves", f"候选浪 {label}" if zh else f"Candidate wave {label}", [point(chain[i-1]), point(chain[i])])
            break

    for i in range(max(0, len(pivots)-12), len(pivots)-2):
        a, b, c = pivots[i:i+3]
        if abs(a["price"]-c["price"]) <= tolerance and abs(a["price"]-b["price"]) >= tolerance*2:
            top = a["kind"] == "high"
            confirmed = any(bar["close"] < b["price"] if top else bar["close"] > b["price"] for bar in bars[c["index"]+1:])
            label = ("双顶" if top else "双底") if zh else ("Double top" if top else "Double bottom")
            label += (" · 已破颈线" if confirmed else " · 候选") if zh else (" · neckline broken" if confirmed else " · candidate")
            add("patterns", label, [point(a), point(b), point(c)], direction="bearish" if top else "bullish")

    highs = [p for p in pivots if p["kind"] == "high"][-3:]
    lows = [p for p in pivots if p["kind"] == "low"][-3:]
    if len(highs) == len(lows) == 3 and all(highs[i]["price"] < highs[i-1]["price"] for i in (1,2)) and all(lows[i]["price"] > lows[i-1]["price"] for i in (1,2)) and highs[-1]["price"] > lows[-1]["price"]:
        for side in (highs, lows):
            add("patterns", "收敛三角形 · 候选" if zh else "Converging triangle · candidate", [point(p) for p in side])

    # Exact, unmerged candles. Geometric detections do not imply a reversal by themselves.
    for index in range(max(0, len(bars)-40), len(bars)):
        bar = bars[index]
        o, h, l, c = (bar[key] for key in ("open", "high", "low", "close"))
        span, body = h-l, abs(c-o)
        if span <= 0:
            continue
        upper, lower = h-max(o,c), min(o,c)-l
        matches = []
        if body <= span*.1:
            matches.append(("十字星", "Doji", "neutral"))
        elif lower >= body*2 and upper <= body*.5:
            matches.append(("长下影锤形", "Hammer shape", "bullish"))
        elif upper >= body*2 and lower <= body*.5:
            matches.append(("长上影倒锤形", "Inverted hammer shape", "bearish"))
        if index:
            prev = bars[index-1]
            po, pc = prev["open"], prev["close"]
            if c > o and pc < po and o <= pc and c >= po and body > abs(pc-po):
                matches.append(("看涨吞没", "Bullish engulfing", "bullish"))
            if c < o and pc > po and o >= pc and c <= po and body > abs(pc-po):
                matches.append(("看跌吞没", "Bearish engulfing", "bearish"))
        if index >= 2:
            first, middle = bars[index-2:index]
            fb = abs(first["close"]-first["open"])
            mb = abs(middle["close"]-middle["open"])
            if fb > 0 and mb <= fb*.3:
                midpoint = (first["open"]+first["close"])/2
                if first["close"] < first["open"] and max(middle["open"],middle["close"]) < first["close"] and c > o and c > midpoint:
                    matches.append(("启明星", "Morning star", "bullish"))
                if first["close"] > first["open"] and min(middle["open"],middle["close"]) > first["close"] and c < o and c < midpoint:
                    matches.append(("黄昏星", "Evening star", "bearish"))
        for chinese, english, direction in matches:
            start = max(0,index-(2 if english in ("Morning star","Evening star") else 1 if "engulfing" in english else 0))
            end_date = bars[min(index+1,len(bars)-1)]["date"]
            section = bars[start:index+1]
            add("candlesticks", chinese if zh else english,
                [{"date": bars[start]["date"], "price": min(b["low"] for b in section)},
                 {"date": end_date, "price": max(b["high"] for b in section)}], "area", direction)
    # Keep overlays useful in dense charts; retain the most recent candle patterns.
    candles = [item for item in overlays if item["category"] == "candlesticks"][-8:]
    return [item for item in overlays if item["category"] != "candlesticks"] + candles + price_action_overlays(bars, swings, confirmation_window, locale)


def price_action_overlays(bars, swings, confirmation_window=3, locale="zh"):
    """Chronological rules: levels must have been confirmed before the event.

    Two consecutive closes confirm a break. A return through the level within
    five bars marks a failed break; a held retest is searched within ten bars.
    Thresholds use only bars preceding the event, never later volatility.
    """
    zh = locale.startswith("zh")
    events = []
    active = {}

    def emit(category, label_zh, label_en, pivot, index, direction, status):
        event = {"category": category, "label": label_zh if zh else label_en,
                 "shape": "line", "direction": direction, "status": status,
                 "level": pivot["price"], "detected_at": bars[index]["date"],
                 "points": [{"date": pivot["date"], "price": pivot["price"]},
                            {"date": bars[index]["date"], "price": pivot["price"]}]}
        events.append(event)
        return event

    for i in range(1, len(bars)):
        # ATR-like tolerance from preceding candles, kept fixed for an active setup.
        ranges = [max(bars[j]["high"]-bars[j]["low"],
                      abs(bars[j]["high"]-bars[j-1]["close"]) if j else 0,
                      abs(bars[j]["low"]-bars[j-1]["close"]) if j else 0)
                  for j in range(max(0,i-14),i)]
        threshold = max(sum(ranges)/len(ranges)*.15, abs(bars[i-1]["close"])*.001)
        bar = bars[i]
        for sign,kind in ((1,"high"),(-1,"low")):
            state = active.get(sign)
            if state:
                pivot, start, epsilon = state["pivot"], state["start"], state["epsilon"]
                level = pivot["price"]
                beyond = sign*(bar["close"]-level)
                elapsed = i-start
                if elapsed <= 5 and beyond < -epsilon:
                    emit("false_breakouts", "假突破 · 收回阻力下方" if sign==1 else "假跌破 · 收回支撑上方",
                         "Failed breakout · back below resistance" if sign==1 else "Failed breakdown · back above support",
                         pivot,i,"bearish" if sign==1 else "bullish","confirmed")
                    state["event"]["label"] = ("突破失效" if sign==1 else "跌破失效") if zh else ("Breakout failed" if sign==1 else "Breakdown failed")
                    state["event"]["status"] = "failed"
                    del active[sign]
                    continue
                if elapsed == 1 and beyond > epsilon:
                    state["confirmed"] = True
                    state["event"]["status"] = "confirmed"
                    state["event"]["label"] = ("突破 · 连续收盘确认" if sign==1 else "跌破 · 连续收盘确认") if zh else ("Breakout · consecutive closes" if sign==1 else "Breakdown · consecutive closes")
                    # Mark confirmation at the bar that actually confirms, not the earlier bar.
                    state["event"]["detected_at"] = bar["date"]
                    state["event"]["points"][-1]["date"] = bar["date"]
                touched = bar["low"] <= level+epsilon and bar["high"] >= level-epsilon
                if 2 <= elapsed <= 10 and state["confirmed"] and touched and beyond > epsilon and not state["retested"]:
                    emit("retests", "回踩确认 · 原阻力转支撑" if sign==1 else "反抽确认 · 原支撑转压力",
                         "Retest held · resistance becomes support" if sign==1 else "Retest rejected · support becomes resistance",
                         pivot,i,"bullish" if sign==1 else "bearish","confirmed")
                    state["retested"] = True
                if elapsed > 10 or (elapsed > 1 and not state["confirmed"]):
                    if not state["confirmed"]:
                        state["event"]["status"] = "unconfirmed"
                        state["event"]["label"] = ("突破尝试 · 未确认" if sign==1 else "跌破尝试 · 未确认") if zh else ("Breakout attempt · unconfirmed" if sign==1 else "Breakdown attempt · unconfirmed")
                    del active[sign]
                else:
                    continue
            eligible = [p for p in swings if p["kind"]==kind and p["index"]+confirmation_window < i]
            if not eligible:
                continue
            pivot = max(eligible,key=lambda p:p["index"])
            level = pivot["price"]
            previous = sign*(bars[i-1]["close"]-level)
            closing = sign*(bar["close"]-level)
            extreme = sign*((bar["high"] if sign==1 else bar["low"])-level)
            if previous <= threshold and closing > threshold:
                event = emit("breakouts", "突破 · 待连续收盘确认" if sign==1 else "跌破 · 待连续收盘确认",
                             "Breakout · awaiting consecutive close" if sign==1 else "Breakdown · awaiting consecutive close",
                             pivot,i,"bullish" if sign==1 else "bearish","pending")
                active[sign] = {"pivot":pivot,"start":i,"epsilon":threshold,"event":event,"confirmed":False,"retested":False}
            elif previous <= threshold and extreme > threshold and closing < -threshold:
                emit("false_breakouts", "假突破 · 影线穿越后收回" if sign==1 else "假跌破 · 影线穿越后收回",
                     "False breakout · wick rejected" if sign==1 else "False breakdown · wick rejected",
                     pivot,i,"bearish" if sign==1 else "bullish","confirmed")
    # Retain a small recent set per category so one category cannot crowd out others.
    return [event for category in ("breakouts","retests","false_breakouts")
            for event in [e for e in events if e["category"]==category][-4:]]
