"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validTicker } from "@/lib/decision";
import { useCopy } from "./shared";

/** Direct market navigation is independent of the creator coverage catalogue. */
export default function StockLookup() {
  const c = useCopy();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);

  function openStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (composing.current) return;
    const ticker = value.trim().toUpperCase();
    if (!validTicker(ticker)) {
      setInvalid(true);
      input.current?.focus();
      return;
    }
    router.push(`/dashboard/market/${encodeURIComponent(ticker)}`);
  }

  return (
    <form noValidate onSubmit={openStock} className="space-y-2" aria-label={c("Open a stock", "查看股票")}>
      <label htmlFor="market-stock-code" className="block text-sm font-semibold">
        {c("Look up any stock", "查看任意股票")}
      </label>
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Input
            ref={input}
            id="market-stock-code"
            value={value}
            placeholder={c("Stock symbol, e.g. AAPL or BRK-B", "输入股票代码，如 AAPL、BRK-B")}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={20}
            aria-invalid={invalid}
            aria-describedby="market-stock-help"
            className="pr-11"
            onChange={(event) => { setValue(event.target.value); setInvalid(false); }}
            onCompositionStart={() => { composing.current = true; }}
            onCompositionEnd={() => { composing.current = false; }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.nativeEvent.isComposing || composing.current || event.keyCode === 229)) event.preventDefault();
            }}
          />
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-10 w-10"
              aria-label={c("Clear stock symbol", "清空股票代码")}
              onClick={() => { setValue(""); setInvalid(false); input.current?.focus(); }}
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          )}
        </div>
        <Button type="submit" className="shrink-0">{c("View stock", "查看股票")}</Button>
      </div>
      <p id="market-stock-help" role={invalid ? "alert" : undefined} className={`min-h-5 text-xs ${invalid ? "text-negative" : "text-muted-foreground"}`}>
        {invalid
          ? c("Enter a valid stock symbol, e.g. AAPL or BRK-B.", "请输入有效的股票代码，如 AAPL、BRK-B。")
          : c("Open quotes and AI analysis, even without creator coverage.", "查看行情和 AI 分析，无需博主覆盖。")}
      </p>
    </form>
  );
}
