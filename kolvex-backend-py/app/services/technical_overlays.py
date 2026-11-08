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

    pivots = alternating_pivots(swings)

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
    return ([item for item in overlays if item["category"] != "candlesticks"] + candles
            + price_action_overlays(bars, swings, confirmation_window, locale)
            + zone_overlays(bars, locale) + volume_overlays(bars, locale) + structure_overlays(bars, pivots, locale))


def alternating_pivots(swings):
    """Collapse consecutive same-kind pivots to the extreme; ignore ambiguous outside bars."""
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
    return pivots


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


def _overlay(category, label, points, shape="line", direction="neutral", **extra):
    return {"category": category, "label": label, "points": points, "shape": shape, "direction": direction, **extra}


def _average_ranges(bars, period=14):
    """Mean true range of the `period` bars *before* each index, so no bar sees its own range."""
    ranges = [max(bar["high"] - bar["low"],
                  abs(bar["high"] - bars[i - 1]["close"]) if i else 0,
                  abs(bar["low"] - bars[i - 1]["close"]) if i else 0)
              for i, bar in enumerate(bars)]
    averages = []
    for i in range(len(bars)):
        window = ranges[max(0, i - period):i]
        averages.append(sum(window) / len(window) if window else 0.0)
    return averages


def zone_overlays(bars, locale="zh"):
    """Supply/demand bases before impulse candles, plus unfilled price gaps and fair value gaps.

    A zone is dropped once a later close passes through it; a gap once price trades through it.
    Zones extend to the last bar because they stay relevant until invalidated.
    """
    zh = locale.startswith("zh")
    if len(bars) < 20:
        return []
    avg = _average_ranges(bars)
    last_date = bars[-1]["date"]
    zones = {1: [], -1: []}
    last_impulse = -1
    for i in range(15, len(bars)):
        bar = bars[i]
        body = bar["close"] - bar["open"]
        if avg[i] <= 0 or abs(body) < 1.2 * avg[i] or i <= last_impulse + 1:
            continue
        sign = 1 if body > 0 else -1
        base = []
        for j in range(i - 1, max(i - 4, -1), -1):
            if bars[j]["high"] - bars[j]["low"] > avg[i]:
                break
            base.append(j)
        if not base:
            continue
        start = min(base)
        low = min(bars[j]["low"] for j in base)
        high = max(bars[j]["high"] for j in base)
        if (sign == 1 and bar["close"] <= high) or (sign == -1 and bar["close"] >= low):
            continue
        last_impulse = i
        later = bars[i + 1:]
        if any((b["close"] < low) if sign == 1 else (b["close"] > high) for b in later):
            continue
        tested = any((b["low"] <= high) if sign == 1 else (b["high"] >= low) for b in later)
        name = ("需求区" if sign == 1 else "供给区") if zh else ("Demand zone" if sign == 1 else "Supply zone")
        status = ("已测试" if tested else "未测试") if zh else ("tested" if tested else "fresh")
        zones[sign].append(_overlay(
            "supply_demand", f"{name} · {status}",
            [{"date": bars[start]["date"], "price": round(low, 2)}, {"date": last_date, "price": round(high, 2)}],
            "area", "bullish" if sign == 1 else "bearish", status="tested" if tested else "fresh",
            detected_at=bar["date"]))
    result = zones[1][-3:] + zones[-1][-3:]

    gaps = []
    gapped = set()
    for i in range(1, len(bars)):
        prev, bar = bars[i - 1], bars[i]
        found = []
        if bar["low"] > prev["high"]:
            found.append(("gap", 1, i - 1, prev["high"], bar["low"]))
            gapped.add(i)
        elif bar["high"] < prev["low"]:
            found.append(("gap", -1, i - 1, bar["high"], prev["low"]))
            gapped.add(i)
        elif i >= 2 and i - 1 not in gapped:
            # An FVG spanning a true gap mostly repeats it, so only gap-free FVGs are kept.
            first = bars[i - 2]
            if bar["low"] > first["high"]:
                found.append(("fvg", 1, i - 2, first["high"], bar["low"]))
            elif bar["high"] < first["low"]:
                found.append(("fvg", -1, i - 2, bar["high"], first["low"]))
        for kind, sign, start, low, high in found:
            if high - low < 0.1 * (avg[i] or high - low):
                continue
            later = bars[i + 1:]
            if any((b["low"] <= low) if sign == 1 else (b["high"] >= high) for b in later):
                continue
            if kind == "gap":
                name = ("向上跳空缺口" if sign == 1 else "向下跳空缺口") if zh else ("Gap up" if sign == 1 else "Gap down")
            else:
                name = ("看涨 FVG" if sign == 1 else "看跌 FVG") if zh else ("Bullish FVG" if sign == 1 else "Bearish FVG")
            gaps.append(_overlay(
                "gaps", f"{name} · {'未回补' if zh else 'unfilled'}",
                [{"date": bars[start]["date"], "price": round(low, 2)}, {"date": last_date, "price": round(high, 2)}],
                "area", "bullish" if sign == 1 else "bearish", kind=kind, detected_at=bar["date"]))
    return result + gaps[-4:]


def volume_overlays(bars, locale="zh", bins=40, value_area=0.7):
    """Volume profile (POC / value area) and VWAPs anchored at the view's high and low."""
    zh = locale.startswith("zh")
    volumes = [bar.get("volume") or 0 for bar in bars]
    if len(bars) < 2 or sum(volumes) <= 0:
        return []
    low = min(bar["low"] for bar in bars)
    high = max(bar["high"] for bar in bars)
    overlays = []
    if high > low:
        step = (high - low) / bins
        hist = [0.0] * bins
        for bar, volume in zip(bars, volumes):
            if volume <= 0:
                continue
            first = min(bins - 1, int((bar["low"] - low) / step))
            last = min(bins - 1, int((bar["high"] - low) / step))
            share = volume / (last - first + 1)
            for k in range(first, last + 1):
                hist[k] += share
        poc = max(range(bins), key=hist.__getitem__)
        total, covered, lo, hi = sum(hist), hist[poc], poc, poc
        while covered < total * value_area and (lo > 0 or hi < bins - 1):
            below = hist[lo - 1] if lo > 0 else -1
            above = hist[hi + 1] if hi < bins - 1 else -1
            if above >= below:
                hi += 1
                covered += above
            else:
                lo -= 1
                covered += below
        start, end = bars[0]["date"], bars[-1]["date"]
        for label, price in (("POC", low + step * (poc + 0.5)), ("VAH", low + step * (hi + 1)), ("VAL", low + step * lo)):
            price = round(price, 2)
            overlays.append(_overlay("volume_profile", label,
                                     [{"date": start, "price": price}, {"date": end, "price": price}], level=price))

    highest = max(range(len(bars)), key=lambda i: bars[i]["high"])
    lowest = min(range(len(bars)), key=lambda i: bars[i]["low"])
    for index, sign in ((highest, -1), (lowest, 1)):
        weighted = cumulative = 0.0
        points = []
        for bar, volume in zip(bars[index:], volumes[index:]):
            weighted += (bar["high"] + bar["low"] + bar["close"]) / 3 * volume
            cumulative += volume
            if cumulative > 0:
                points.append({"date": bar["date"], "price": round(weighted / cumulative, 4)})
        if len(points) < 2:
            continue
        day = str(bars[index]["date"])[5:10]
        label = f"AVWAP · {'自高点' if sign == -1 else '自低点'} {day}" if zh else f"AVWAP · from {'high' if sign == -1 else 'low'} {day}"
        overlays.append(_overlay("anchored_vwap", label, points,
                                 direction="bearish" if sign == -1 else "bullish", anchor=bars[index]["date"]))
    return overlays


def structure_overlays(bars, pivots, locale="zh"):
    """A parallel channel on the latest pivot pair and an Andrews pitchfork on the last three pivots.

    Channel points: two base pivots and the opposite extreme between them that sets the width.
    Pitchfork points: P0 (handle) then P1, P2; the median runs from P0 through mid(P1, P2).
    """
    zh = locale.startswith("zh")
    overlays = []
    point = lambda p: {"date": p["date"], "price": p["price"]}

    candidates = []
    for kind in ("low", "high"):
        side = [p for p in pivots if p["kind"] == kind]
        if len(side) >= 2:
            candidates.append((side[-1]["index"], kind, side[-2], side[-1]))
    if candidates:
        _, kind, a, b = max(candidates, key=lambda item: item[0])
        segment = range(a["index"], b["index"] + 1)
        if kind == "low":
            c_index = max(segment, key=lambda i: bars[i]["high"])
            c_price = bars[c_index]["high"]
        else:
            c_index = min(segment, key=lambda i: bars[i]["low"])
            c_price = bars[c_index]["low"]
        slope = (b["price"] - a["price"]) / (b["index"] - a["index"])
        offset = c_price - (a["price"] + slope * (c_index - a["index"]))
        last = len(bars) - 1
        base_now = a["price"] + slope * (last - a["index"])
        lower, upper = sorted((base_now, base_now + offset))
        close = bars[-1]["close"]
        width = abs(offset)
        if width > 0 and (offset > 0) == (kind == "low") and lower - width * 0.5 <= close <= upper + width * 0.5:
            if abs(slope * (b["index"] - a["index"])) < 0.25 * width:
                label, direction = ("横盘区间" if zh else "Range channel"), "neutral"
            elif slope > 0:
                label, direction = ("上升通道" if zh else "Rising channel"), "bullish"
            else:
                label, direction = ("下降通道" if zh else "Falling channel"), "bearish"
            overlays.append(_overlay("channels", label,
                                     [point(a), point(b), {"date": bars[c_index]["date"], "price": c_price}],
                                     "channel", direction))

    if len(pivots) >= 3:
        p0, p1, p2 = pivots[-3:]
        middle = (p1["price"] + p2["price"]) / 2
        direction = "bullish" if middle > p0["price"] else "bearish"
        overlays.append(_overlay("pitchfork", "安德鲁斯叉" if zh else "Andrews pitchfork",
                                 [point(p0), point(p1), point(p2)], "pitchfork", direction))
    return overlays
