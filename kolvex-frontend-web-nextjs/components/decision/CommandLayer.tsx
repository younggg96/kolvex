"use client";
import { createContext, ReactNode, useContext, useState } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
const ChatSidebarContent = dynamic(
  () =>
    import("@/components/chat/ChatSidebarContent").then(
      (module) => module.ChatSidebarContent,
    ),
  { ssr: false },
);

const CommandContext = createContext<{ setContext: (context: string) => void }>(
  { setContext: () => {} },
);
export const useDecisionCommand = () => useContext(CommandContext);

export default function CommandLayer({ children }: { children: ReactNode }) {
  const c = useCopy();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState("");
  return (
    <CommandContext.Provider value={{ setContext }}>
      {children}
      {!pathname.startsWith("/dashboard/chat") && !pathname.startsWith("/dashboard/admin") && (
        <Button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 z-30 rounded-full shadow-lg lg:bottom-6 lg:right-6"
        >
          <MessageCircle className="mr-2 h-4 w-4" />
          {c("Ask Kolvex", "询问 Kolvex")}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[min(760px,90dvh)] max-w-3xl flex-col overflow-hidden">
          <DialogTitle>{c("Ask Kolvex", "询问 Kolvex")}</DialogTitle>
          <DialogDescription>
            {c(
              "Research a stock, understand your exposure, or challenge your thesis.",
              "研究股票、了解持仓风险，或检验自己的判断。",
            )}
          </DialogDescription>
          <div className="grid min-h-0 flex-1 md:grid-cols-[160px_minmax(0,1fr)]">
            <aside
              className="hidden overflow-y-auto border-r border-border pr-3 md:block"
              aria-label={c("Previous questions", "历史提问")}
            >
              <ChatSidebarContent
                enabled={open}
                onNavigate={() => setOpen(false)}
              />
            </aside>
            <ChatWelcomeContainer
              className="h-full"
              decisionContext={context || `Current workspace: ${pathname}`}
              onSubmitted={() => setOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </CommandContext.Provider>
  );
}
