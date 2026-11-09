"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { useCopy } from "@/components/decision/shared";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ChatSidebarContent } from "./ChatSidebarContent";

/** Past conversations in a side sheet; the list loads only while the sheet is open. */
export function ChatHistorySheet({ className }: { className?: string }) {
  const copy = useCopy();
  const [open, setOpen] = useState(false);
  // The sheet is translucent glass, so the app sidebar under it would blur through.
  // Hiding it (not collapsing it) keeps the layout and the user's sidebar preference.
  useEffect(() => {
    if (!open) return;
    document.documentElement.dataset.chatHistoryOpen = "";
    return () => {
      delete document.documentElement.dataset.chatHistoryOpen;
    };
  }, [open]);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={copy("Chat history", "历史对话")} title={copy("Chat history", "历史对话")} className={cn("max-md:h-11 max-md:w-11", className)}>
          <History className="h-4 w-4" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" closeLabel={copy("Close", "关闭")} className="flex w-[85%] flex-col overflow-hidden rounded-r-[28px] pb-[env(safe-area-inset-bottom)] sm:max-w-sm">
        <SheetTitle className="px-5 pb-2 pt-[max(1.25rem,env(safe-area-inset-top))] text-base font-semibold">{copy("Chat history", "历史对话")}</SheetTitle>
        <div className="min-h-0 flex-1 pr-2">
          <ChatSidebarContent enabled={open} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
