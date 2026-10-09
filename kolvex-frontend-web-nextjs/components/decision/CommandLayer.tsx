"use client";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowRight, Sparkles, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useCopy } from "./shared";

const ChatWelcomeContainer = dynamic(
  () =>
    import("@/components/chat/ChatWelcomeContainer").then(
      (module) => module.ChatWelcomeContainer,
    ),
  { ssr: false },
);

interface CommandContextValue {
  setContext: (context: string) => void;
  openAsk: () => void;
  canAsk: boolean;
}

const CommandContext = createContext<CommandContextValue>({
  setContext: () => {},
  openAsk: () => {},
  canAsk: false,
});
export const useDecisionCommand = () => useContext(CommandContext);

type Copy = ReturnType<typeof useCopy>;

function describeContext(raw: string, c: Copy) {
  let parsed: { ticker?: string; workspace?: string } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {}
  if (parsed.ticker) {
    const t = parsed.ticker;
    return {
      label: t,
      suggestions: [
        c(`What changed for ${t} recently?`, `${t} 最近有什么变化？`),
        c(`Stress-test my thesis on ${t}`, `检验我对 ${t} 的判断`),
        c(`How exposed am I to ${t}?`, `我在 ${t} 上的风险敞口有多大？`),
      ],
    };
  }
  switch (parsed.workspace) {
    case "Markets":
      return {
        label: c("Markets", "市场"),
        suggestions: [
          c("What is driving the market today?", "今天市场的主要驱动因素是什么？"),
          c("Which names on my watchlist moved most?", "我的关注列表里哪些波动最大？"),
        ],
      };
    case "Research":
      return {
        label: c("Research", "研究"),
        suggestions: [
          c("Which creators changed their view recently?", "最近哪些博主改变了观点？"),
          c("Where do creators disagree the most?", "博主们分歧最大的是哪些股票？"),
        ],
      };
    case "Decision journal":
    case "Portfolio thesis review":
      return {
        label: c("Journal", "决策日志"),
        suggestions: [
          c("Which of my theses need review?", "我的哪些判断需要复盘？"),
          c("Where is my reasoning weakest?", "我的哪条逻辑最薄弱？"),
        ],
      };
  }
  return null;
}

export default function CommandLayer({ children }: { children: ReactNode }) {
  const c = useCopy();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState("");
  const [detached, setDetached] = useState(false);
  const canAsk =
    !pathname.startsWith("/dashboard/chat") &&
    !pathname.startsWith("/dashboard/admin");

  const openAsk = useCallback(() => {
    setDetached(false);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!canAsk) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setDetached(false);
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canAsk]);

  const described = context ? describeContext(context, c) : null;
  const attached = !!context && !detached;
  const contextLabel = described?.label ?? c("This page", "当前页面");
  const value = useMemo(
    () => ({ setContext, openAsk, canAsk }),
    [openAsk, canAsk],
  );

  return (
    <CommandContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="top-[10dvh] flex max-h-[80dvh] max-w-2xl translate-y-0 flex-col gap-0 overflow-hidden p-0 data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2"
        >
          <div className="flex items-center gap-2 px-5 pb-1 pt-4 pr-12">
            <Sparkles className="h-4 w-4 text-primary" />
            <DialogTitle className="pr-0 text-sm font-medium">
              {c("Ask Kolvex", "询问 Kolvex")}
            </DialogTitle>
            {attached && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 py-0.5 pl-2.5 pr-1 text-xs text-muted-foreground">
                {c("Using", "已附带")}{" "}
                <span className="font-medium text-foreground">{contextLabel}</span>
                <button
                  type="button"
                  onClick={() => setDetached(true)}
                  className="rounded-full p-0.5 hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label={c("Ask without this context", "不附带此上下文")}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
          <DialogDescription className="sr-only">
            {c(
              "Research a stock, understand your exposure, or challenge your thesis.",
              "研究股票、了解持仓风险，或检验自己的判断。",
            )}
          </DialogDescription>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            <ChatWelcomeContainer
              variant="compact"
              suggestions={attached ? described?.suggestions : undefined}
              decisionContext={attached ? context : undefined}
              onSubmitted={() => setOpen(false)}
            />
          </div>
          <div className="flex items-center justify-between border-t border-border px-5 py-2.5 text-xs text-muted-foreground">
            <Link
              href="/dashboard/chat"
              onClick={() => setOpen(false)}
              className="group inline-flex items-center gap-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {c("Previous conversations", "历史对话")}
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <span className="hidden sm:inline">
              <kbd className="font-sans">Esc</kbd> {c("to close", "关闭")}
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </CommandContext.Provider>
  );
}
