"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { flushSync } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChatMessageList } from "./ChatMessageList";
import { ChatInput, MODEL_CONFIGS } from "./ChatInput";
import { useChatHistory } from "./useChatHistory";
import { useAvailableProviders } from "@/hooks/useAvailableProviders";
import {
  getAgentStreamStatus,
  readAgentStream,
  stopAgentStream,
  streamAgentMessage,
  type AgentStreamEvent,
  type ChatMessage,
  type QuoteEvidence,
  type RevenueEvidence,
} from "@/lib/chatApi";
import type {
  AgentStatus,
  AIModel,
  SearchSource,
  ToolStatus,
} from "./types";
import { readChatSkills, toggleChatSkill } from "./chatSkills";
import { TOOL_LABELS as toolLabels } from "./types";
import {
  evidenceStorageKey,
  formatEvidenceLabel,
  readPageEvidence,
  visibleQuestion,
} from "./pageEvidence";
import { useTranslation } from "@/lib/i18n";
import { findSymbols } from "@/lib/markdown/stockMentions";
import { PanelRight, SquarePen } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useCopy } from "@/components/decision/shared";
import { useChatWorkspace } from "./workspace/useChatWorkspace";
import { WorkspacePicker } from "./workspace/WorkspacePicker";
import { ChatHistorySheet } from "./ChatHistorySheet";
import { WorkspacePanel } from "./workspace/WorkspacePanel";

// ===== localStorage helpers for persisting chat preferences =====
const PANEL_PREF_KEY = "kolvex:workspacePanel";
/** Below Tailwind's lg the composer floats over the thread and can tuck itself away. */
const FLOATING_COMPOSER_QUERY = "(max-width: 1023px)";
const PREFS_SOURCES_KEY = "kolvex:sources";
const PREFS_MODEL_KEY = "kolvex:model";
const AVAILABLE_SOURCES: SearchSource[] = [
  "plaid",
  "portfolio",
  "web",
];

function loadSavedSources(conversationId: string): SearchSource[] | null {
  try {
    const raw = localStorage.getItem(`${PREFS_SOURCES_KEY}:${conversationId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as SearchSource[];
      return parsed.filter((source) => AVAILABLE_SOURCES.includes(source));
    }
  } catch {}
  return null;
}

function saveSources(conversationId: string, sources: SearchSource[]) {
  try {
    localStorage.setItem(`${PREFS_SOURCES_KEY}:${conversationId}`, JSON.stringify(sources));
  } catch {}
}

function loadSavedModel(conversationId: string): AIModel | null {
  try {
    const raw = localStorage.getItem(`${PREFS_MODEL_KEY}:${conversationId}`);
    if (raw && MODEL_CONFIGS.some((model) => model.id === raw)) return raw as AIModel;
  } catch {}
  return null;
}

function saveModel(conversationId: string, model: AIModel) {
  try {
    localStorage.setItem(`${PREFS_MODEL_KEY}:${conversationId}`, model);
  } catch {}
}

// ===== Component =====

interface ChatDetailContainerProps {
  className?: string;
  conversationId: string;
  /** Action shown just above the message input */
  inputAction?: React.ReactNode;
  /** First message to auto-send (from welcome page navigation) */
  firstMessage?: string;
  /** Initial sources from welcome page (comma-separated in URL) */
  initialSources?: string;
  initialSkills?: string;
  /** Initial model from welcome page */
  initialModel?: string;
  onConversationChange?: (
    conversation: {
      id: string;
      title: string;
    } | null
  ) => void;
}

/** Default sources when nothing is saved */
const DEFAULT_SOURCES: SearchSource[] = AVAILABLE_SOURCES;

export function ChatDetailContainer({
  className,
  conversationId,
  inputAction,
  firstMessage,
  initialSources,
  initialSkills,
  initialModel,
  onConversationChange,
}: ChatDetailContainerProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [composerTucked, setComposerTucked] = useState(false);

  // Resolve initial sources: URL params > localStorage > defaults
  const [activeSources, setActiveSources] = useState<SearchSource[]>(() => {
    if (initialSources) {
      const parsed = initialSources
        .split(",")
        .filter((source): source is SearchSource =>
          AVAILABLE_SOURCES.includes(source as SearchSource)
        );
      if (parsed.length > 0) return parsed;
    }
    const saved = loadSavedSources(conversationId);
    if (saved && saved.length > 0) return saved;
    return DEFAULT_SOURCES;
  });

  const [activeSkills, setActiveSkills] = useState(() => readChatSkills(conversationId, initialSkills));
  const [isLoading, setIsLoading] = useState(false);
  const [backgroundActive, setBackgroundActive] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingRevenueEvidence, setStreamingRevenueEvidence] = useState<RevenueEvidence[]>([]);
  const [streamingQuoteEvidence, setStreamingQuoteEvidence] = useState<QuoteEvidence[]>([]);
  const [pendingUserMessage, setPendingUserMessage] = useState("");
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [lastSubmittedMessage, setLastSubmittedMessage] = useState("");

  // Resolve initial model: URL params > localStorage > default
  const [pageEvidence, setPageEvidence] = useState(() => {
    try {
      return localStorage.getItem(evidenceStorageKey(conversationId)) || "";
    } catch {
      return "";
    }
  });

  const [selectedModel, setSelectedModel] = useState<AIModel>(() => {
    if (initialModel && MODEL_CONFIGS.some((model) => model.id === initialModel)) return initialModel as AIModel;
    const saved = loadSavedModel(conversationId);
    if (saved) return saved;
    return "deepseek-flash";
  });
  const [activeTools, setActiveTools] = useState<ToolStatus[]>([]);
  const copy = useCopy();
  const workspace = useChatWorkspace(conversationId);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(() => {
    try {
      return localStorage.getItem(PANEL_PREF_KEY) !== "0";
    } catch {
      return true;
    }
  });
  const { availableProviders } = useAvailableProviders();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const sentFirstMessageRef = useRef<string | null>(null);
  const messageIdsBeforePendingRef = useRef<Set<string>>(new Set());
  const isLoadingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const interruptedTurnRef = useRef<{
    content: string;
    startedAt: number;
    userId?: string;
    error?: string;
    stopRequested?: boolean;
  } | null>(null);

  // Persist sources & model to localStorage whenever they change
  useEffect(() => {
    saveSources(conversationId, activeSources);
  }, [conversationId, activeSources]);

  useEffect(() => {
    try {
      localStorage.setItem(`kolvex:skills:${conversationId}`, JSON.stringify(activeSkills));
    } catch {}
  }, [conversationId, activeSkills]);

  useEffect(() => {
    saveModel(conversationId, selectedModel);
  }, [conversationId, selectedModel]);

  const {
    currentConversationId,
    currentConversation,
    messages,
    selectConversation,
    rememberMessages,
    deleteConversation,
  } = useChatHistory();

  // ---- Stream processing helper ----
  const processAgentStream = useCallback(
    async (response: Response, signal: AbortSignal, onAccepted: (message: ChatMessage) => void) => {
      let accumulatedContent = "";
      let completion: AgentStreamEvent | undefined;

      await readAgentStream(response, (event: AgentStreamEvent) => {
        if (signal.aborted) return;
        switch (event.type) {
          case "accepted":
            if (event.user_message) onAccepted(event.user_message);
            break;

          case "status":
            setAgentStatus({
              stage: event.stage || "working",
              message: event.content,
            });
            break;

          case "token":
            if (event.content) {
              accumulatedContent += event.content;
              setStreamingContent(accumulatedContent);
              setAgentStatus({ stage: "writing", message: event.content });
            }
            break;

          case "token_reset":
            accumulatedContent = "";
            setStreamingContent("");
            break;

          case "tool_start":
            if (event.tool) {
              const toolName = event.tool;
              const translationKey = `chat.tools.${toolName}`;
              const translatedLabel = t(translationKey);
              const label =
                translatedLabel === translationKey
                  ? toolLabels[toolName] || toolName
                  : translatedLabel;
              setActiveTools((prev) => [
                ...prev.filter((tool) => tool.name !== toolName),
                { name: toolName, label, status: "running" },
              ]);
            }
            break;

          case "tool_end":
            if (event.tool) {
              setActiveTools((prev) =>
                prev.map((tool) =>
                  tool.name === event.tool ? { ...tool, status: "done" } : tool
                )
              );
            }
            break;

          case "done":
            completion = event;
            if (event.quote_evidence?.length) setStreamingQuoteEvidence(event.quote_evidence);
            if (event.revenue_evidence?.length) setStreamingRevenueEvidence(event.revenue_evidence);
            break;

          case "error":
            throw new Error(event.content || "The AI agent could not complete the response.");
          }
      });

      if (!completion) {
        throw new Error("The response stream ended before completion.");
      }
      return completion;
    },
    [t]
  );

  // ---- Notify parent when conversation changes ----
  useEffect(() => {
    if (onConversationChange) {
      onConversationChange(
        currentConversation
          ? { id: currentConversation.id, title: currentConversation.title }
          : null
      );
    }
  }, [currentConversation, onConversationChange]);

  // ---- Load conversation when ID changes ----
  useEffect(() => {
    let active = true;
    if (conversationId && currentConversationId !== conversationId) {
      selectConversation(conversationId).catch(() => {
        // Conversation not found (deleted or invalid) — redirect to new chat
        if (active) router.replace("/dashboard/chat");
      });
    }
    return () => { active = false; };
  }, [conversationId, currentConversationId, selectConversation, router]);

  useEffect(() => {
    return () => {
      const controller = abortControllerRef.current;
      abortControllerRef.current = null;
      controller?.abort();
    };
  }, [conversationId]);

  const reconcileHistory = useCallback(async () => {
    const history = await selectConversation(conversationId, true);
    const turn = interruptedTurnRef.current;
    if (!history || !turn) return false;

    const index = history.messages.findIndex((message) =>
      turn.userId
        ? message.id === turn.userId
        : message.role === "user" && message.content === turn.content &&
          (message.timestamp?.getTime() ?? 0) >= turn.startedAt
    );
    if (index < 0 || history.messages[index + 1]?.role !== "assistant") return false;
    interruptedTurnRef.current = null;
    setStreamError(null);
    return true;
  }, [conversationId, selectConversation]);

  // A returning tab can follow the server task without resubmitting the prompt.
  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;
    let checking = false;
    const check = async () => {
      if (checking || controller.signal.aborted || isLoadingRef.current) return;
      checking = true;
      window.clearTimeout(timer);
      try {
        const { active } = await getAgentStreamStatus(conversationId, controller.signal);
        if (controller.signal.aborted || isLoadingRef.current) return;
        if (active) {
          setBackgroundActive(true);
          timer = window.setTimeout(check, 3000);
        } else {
          const recovered = await reconcileHistory();
          if (controller.signal.aborted || isLoadingRef.current) return;
          setBackgroundActive(false);
          const turn = interruptedTurnRef.current;
          if (!recovered && turn?.error) setStreamError(turn.error);
        }
      } catch {
        if (!controller.signal.aborted && (backgroundActive || interruptedTurnRef.current)) {
          timer = window.setTimeout(check, 5000);
        }
      } finally {
        checking = false;
      }
    };

    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    void check();
    document.addEventListener("visibilitychange", checkWhenVisible);
    window.addEventListener("pageshow", check);
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", checkWhenVisible);
      window.removeEventListener("pageshow", check);
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
    };
  }, [conversationId, reconcileHistory, backgroundActive, isLoading]);

  // ---- Sidebar events ----
  useEffect(() => {
    const handleSelectChat = (e: CustomEvent<{ id: string }>) => {
      selectConversation(e.detail.id);
      setStreamingContent("");
      setActiveTools([]);
      setAgentStatus(null);
      setStreamError(null);
    };

    const handleDeleteChat = (e: CustomEvent<{ id: string }>) => {
      deleteConversation(e.detail.id);
      // If the deleted chat is the current one, navigate to new chat
      if (e.detail.id === conversationId) {
        router.replace("/dashboard/chat");
      }
    };

    window.addEventListener(
      "kolvex:selectChat",
      handleSelectChat as EventListener
    );
    window.addEventListener(
      "kolvex:deleteChat",
      handleDeleteChat as EventListener
    );

    return () => {
      window.removeEventListener(
        "kolvex:selectChat",
        handleSelectChat as EventListener
      );
      window.removeEventListener(
        "kolvex:deleteChat",
        handleDeleteChat as EventListener
      );
    };
  }, [conversationId, deleteConversation, router, selectConversation]);

  const toggleSource = (source: SearchSource) => {
    setActiveSources((prev) => {
      if (prev.includes(source)) {
        if (prev.length === 1) return prev;
        return prev.filter((s) => s !== source);
      }
      return [...prev, source];
    });
  };

  // Whether the user has any usable model
  const isBlocked =
    availableProviders !== undefined && availableProviders.length === 0;

  // ---- Submit user message from input ----
  const handleSubmit = useCallback(
    async (messageText: string) => {
      if (!messageText.trim() || isLoadingRef.current || backgroundActive || isBlocked) return;

      const trimmedMessage = messageText.trim();
      isLoadingRef.current = true;
      setQuery("");
      setIsLoading(true);
      setStreamingContent("");
      setActiveTools([]);
      setAgentStatus({ stage: "routing" });
      setStreamError(null);
      setLastSubmittedMessage(trimmedMessage);
      const turn: NonNullable<typeof interruptedTurnRef.current> = {
        content: trimmedMessage,
        startedAt: Date.now(),
      };
      interruptedTurnRef.current = turn;

      // Optimistic update: show user message immediately
      messageIdsBeforePendingRef.current = new Set(
        messages.map((message) => message.id)
      );
      setPendingUserMessage(trimmedMessage);

      const controller = new AbortController();
      abortControllerRef.current = controller;
      let userMessage: ChatMessage | undefined;
      try {
        // Stream response from LangGraph Agent via backend
        // The /stream endpoint saves user message + generates AI response
        const response = await streamAgentMessage(
          conversationId,
          trimmedMessage,
          {
            model: selectedModel,
            sources: activeSources,
            skills: activeSkills,
            context: pageEvidence || undefined,
          },
          controller.signal
        );

        const completion = await processAgentStream(response, controller.signal, (message) => {
          userMessage = message;
          turn.userId = message.id;
          if (turn.stopRequested) {
            void stopAgentStream(conversationId).catch((error) =>
              console.error("Unable to stop chat generation:", error)
            );
          }
        });
        if (controller.signal.aborted) return;
        interruptedTurnRef.current = null;
        const committed = userMessage ? [userMessage] : [];
        if (completion.message_id && completion.created_at && completion.content) {
          committed.push({
            id: completion.message_id,
            role: "assistant",
            content: completion.content,
            created_at: completion.created_at,
            quote_evidence: completion.quote_evidence,
            revenue_evidence: completion.revenue_evidence,
            answer_check: completion.answer_check,
          });
        }
        rememberMessages(conversationId, committed);
        await selectConversation(conversationId, true).catch(() => undefined);
      } catch (error) {
        if (abortControllerRef.current !== controller) return;
        console.error("Chat error:", error);
        turn.error = error instanceof Error ? error.message : "The AI agent may be unavailable. Please try again.";
        const state = await getAgentStreamStatus(conversationId, controller.signal).catch(() => null);
        if (abortControllerRef.current !== controller) return;
        if (state?.active) {
          setBackgroundActive(true);
          return;
        }
        const recovered = await reconcileHistory().catch(() => false);
        if (recovered || abortControllerRef.current !== controller) return;
        setStreamError(turn.error);
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
          isLoadingRef.current = false;
          setIsLoading(false);
          setPendingUserMessage("");
          messageIdsBeforePendingRef.current.clear();
          setStreamingContent("");
          setStreamingQuoteEvidence([]);
          setStreamingRevenueEvidence([]);
          setActiveTools([]);
          setAgentStatus(null);
        }
      }
    },
    [
      conversationId,
      backgroundActive,
      isBlocked,
      processAgentStream,
      reconcileHistory,
      rememberMessages,
      selectConversation,
      selectedModel,
      activeSources,
      activeSkills,
      messages,
      pageEvidence,
    ]
  );

  // Defer the initial send until effects have settled. Strict Mode's setup /
  // cleanup replay cancels the first timer instead of aborting a sent request.
  useEffect(() => {
    if (!firstMessage) return;
    const dedupKey = `${conversationId}:${firstMessage}`;
    if (sentFirstMessageRef.current === dedupKey) return;

    const timeout = window.setTimeout(() => {
      if (isLoadingRef.current || isBlocked) return;
      sentFirstMessageRef.current = dedupKey;
      // Preserve Next.js history state when removing the one-shot query params.
      if (pathname) window.history.replaceState(window.history.state, "", pathname);
      void handleSubmit(visibleQuestion(firstMessage));
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [firstMessage, conversationId, pathname, handleSubmit, isBlocked]);

  const handleCancel = useCallback(() => {
    const turn = interruptedTurnRef.current;
    if (isLoadingRef.current && turn && !turn.userId) {
      // The stop request could otherwise reach the server ahead of the POST.
      turn.stopRequested = true;
      return;
    }
    if (turn) turn.error = undefined;
    void stopAgentStream(conversationId).then(() => {
      setBackgroundActive(false);
      return reconcileHistory();
    }).catch((error) => console.error("Unable to stop chat generation:", error));
  }, [conversationId, reconcileHistory]);

  const handleRetry = useCallback(async () => {
    if (!lastSubmittedMessage || isLoadingRef.current || backgroundActive) return;
    try {
      const { active } = await getAgentStreamStatus(conversationId);
      if (active) {
        setBackgroundActive(true);
        setStreamError(null);
        return;
      }
      if (await reconcileHistory()) return;
      void handleSubmit(lastSubmittedMessage);
    } catch (error) {
      console.error("Could not verify the previous chat turn:", error);
    }
  }, [backgroundActive, conversationId, handleSubmit, lastSubmittedMessage, reconcileHistory]);

  const clearEvidence = () => {
    setPageEvidence("");
    try {
      localStorage.removeItem(evidenceStorageKey(conversationId));
    } catch {}
  };

  const evidence = pageEvidence ? readPageEvidence(pageEvidence) : null;
  const evidencePlace = evidence
    ? {
        ticker: t("chat.evidence.ticker"),
        research: t("chat.evidence.research"),
        markets: t("chat.evidence.markets"),
        portfolio: t("chat.evidence.portfolio"),
        page: t("chat.evidence.page"),
      }[evidence.place]
    : "";
  const evidenceLabel = evidence
    ? formatEvidenceLabel(evidence, evidencePlace)
    : undefined;

  // Tickers the reader already named (page context or their own words) get a logo and a
  // link in the answer, without waiting for the answer to build a table.
  const knownSymbols = useMemo(() => {
    const symbols = new Set<string>(evidence?.tickers ?? []);
    for (const message of messages) {
      if (message.role !== "user") continue;
      for (const symbol of findSymbols(message.content)) symbols.add(symbol);
    }
    return [...symbols];
  }, [evidence, messages]);

  // The composer stays open while it is in use, and its API-key notice can't be tucked away.
  const keepComposerOpen = isFocused || query.trim().length > 0;
  const composerCollapsed = composerTucked && !isBlocked;

  const handleUserScroll = useCallback(() => {
    if (keepComposerOpen || !window.matchMedia(FLOATING_COMPOSER_QUERY).matches) return;
    setComposerTucked(true);
  }, [keepComposerOpen]);

  // Focus inside the tap so iOS raises the keyboard; the field is inert until React commits.
  const expandComposer = useCallback(() => {
    flushSync(() => setComposerTucked(false));
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    setComposerTucked(false);
  }, [conversationId]);

  useEffect(() => {
    const floating = window.matchMedia(FLOATING_COMPOSER_QUERY);
    const untuckWhenDocked = () => {
      if (!floating.matches) setComposerTucked(false);
    };
    floating.addEventListener("change", untuckWhenDocked);
    return () => floating.removeEventListener("change", untuckWhenDocked);
  }, []);

  const handleFormSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isBlocked) return;
    handleSubmit(query);
  };

  const normalizedPendingMessage = pendingUserMessage.trim();
  const pendingMessageWasPersisted =
    normalizedPendingMessage.length > 0 &&
    messages.some(
      (message) =>
        message.role === "user" &&
        message.content.trim() === normalizedPendingMessage &&
        !messageIdsBeforePendingRef.current.has(message.id)
    );

  // The composer grows with its text, so the message list's clearance tracks its real height.
  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    const syncHeight = () =>
      composer.parentElement?.style.setProperty("--chat-composer-height", `${composer.offsetHeight}px`);
    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(composer);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const composer = composerRef.current;
    const thread = composer?.parentElement;
    const viewport = window.visualViewport;
    if (!composer || !thread || !viewport) return;

    const floating = window.matchMedia(FLOATING_COMPOSER_QUERY);
    const syncKeyboardInset = () => {
      const editing = document.activeElement === inputRef.current || thread.hasAttribute("data-chat-keyboard");
      // Mobile browsers can shrink or pan the visible area while leaving the layout viewport in place.
      const keyboardOpen = floating.matches && editing && viewport.scale === 1
        && document.documentElement.clientHeight - viewport.height > 120;
      thread.toggleAttribute("data-chat-keyboard", keyboardOpen);
      if (keyboardOpen) {
        const visibleBottom = viewport.offsetTop + viewport.height;
        const inset = Math.max(0, thread.getBoundingClientRect().bottom - visibleBottom);
        thread.style.setProperty("--chat-keyboard-inset", `${inset}px`);
      } else {
        thread.style.removeProperty("--chat-keyboard-inset");
      }
    };

    composer.addEventListener("focusin", syncKeyboardInset);
    viewport.addEventListener("resize", syncKeyboardInset);
    viewport.addEventListener("scroll", syncKeyboardInset);
    floating.addEventListener("change", syncKeyboardInset);
    return () => {
      composer.removeEventListener("focusin", syncKeyboardInset);
      viewport.removeEventListener("resize", syncKeyboardInset);
      viewport.removeEventListener("scroll", syncKeyboardInset);
      floating.removeEventListener("change", syncKeyboardInset);
      thread.removeAttribute("data-chat-keyboard");
      thread.style.removeProperty("--chat-keyboard-inset");
    };
  }, []);

  const hasWorkspace = Boolean(workspace.detail);
  const togglePanel = () => {
    // The docked panel needs the xl width; narrower screens get the same panel as a sheet.
    if (typeof window !== "undefined" && !window.matchMedia("(min-width: 1280px)").matches) {
      setSheetOpen(true);
      return;
    }
    setPanelOpen((open) => {
      try {
        localStorage.setItem(PANEL_PREF_KEY, open ? "0" : "1");
      } catch {}
      return !open;
    });
  };

  return (
    <div className={cn("flex h-full min-h-0", className)}>
      <div data-chat-floating-composer className="flex-1 flex flex-col min-w-0 relative">
        <div className="glass-track glass-track-strong z-30 flex h-14 shrink-0 items-center gap-1 pl-2 pr-2 max-lg:absolute max-lg:inset-x-3 max-lg:top-[max(0.5rem,env(safe-area-inset-top))] max-lg:h-[3.25rem] max-lg:rounded-full md:gap-2 md:px-8 lg:!bg-transparent lg:!shadow-none lg:![-webkit-backdrop-filter:none] lg:![backdrop-filter:none]">
          <ChatHistorySheet className="md:-ml-2" />
          <h1 className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-foreground">
            {currentConversation?.title && currentConversation.title !== "New Chat"
              ? currentConversation.title
              : copy("New chat", "新对话")}
          </h1>
          <Button asChild variant="ghost" size="icon" className="max-md:h-11 max-md:w-11">
            <Link href="/dashboard/chat" aria-label={copy("New chat", "新对话")} title={copy("New chat", "新对话")}>
              <SquarePen className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
          <WorkspacePicker workspace={workspace} suggestedTitle={currentConversation?.title} />
          {hasWorkspace && (
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePanel}
              aria-label={copy("Show workspace research", "查看工作区研究")}
              aria-pressed={panelOpen}
              className={cn("max-md:h-11 max-md:w-11", panelOpen && "xl:bg-foreground/[0.06]")}
            >
              <PanelRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>

        {/* Content Area */}
        <ChatMessageList
          messages={messages}
          pendingUserMessage={
            pendingMessageWasPersisted ? undefined : pendingUserMessage
          }
          streamingContent={streamingContent}
          streamingQuoteEvidence={streamingQuoteEvidence}
          streamingRevenueEvidence={streamingRevenueEvidence}
          isLoading={isLoading || backgroundActive}
          messagesEndRef={messagesEndRef}
          activeTools={activeTools}
          agentStatus={agentStatus ?? (backgroundActive ? { stage: "working" } : null)}
          errorMessage={streamError}
          onRetry={streamError ? handleRetry : undefined}
          modelName={MODEL_CONFIGS.find((m) => m.id === selectedModel)?.name}
          symbols={knownSymbols}
          onUserScroll={handleUserScroll}
          composerCollapsed={composerCollapsed}
        />
        {/* Chat Input */}
        {/* Below lg the composer floats above the dock while messages scroll beneath both. */}
        <div
          ref={composerRef}
          className={cn(
            "z-20 max-lg:pointer-events-none max-lg:absolute max-lg:inset-x-0 max-lg:bottom-[var(--chat-composer-bottom)] lg:sticky lg:bottom-0",
            // Once collapsed, only the round button takes touches; the rest scrolls the thread.
            !composerCollapsed && "max-lg:[&_form]:pointer-events-auto"
          )}
        >
          <div className="mx-auto max-w-3xl px-4 md:pb-4 pt-2">
            {inputAction && <div className="flex justify-end pb-2 [&>*]:pointer-events-auto">{inputAction}</div>}
            <ChatInput
              value={query}
              onChange={setQuery}
              onSubmit={handleFormSubmit}
              onCancel={handleCancel}
              isLoading={isLoading || backgroundActive}
              isFocused={isFocused}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              inputRef={inputRef}
              placeholder={t("chat.input.placeholder")}
              activeSources={activeSources}
              onToggleSource={toggleSource}
              activeSkills={activeSkills}
              onToggleSkill={(skill) => setActiveSkills((skills) => toggleChatSkill(skills, skill))}
              showSourceToggle={false}
              showModelSelector={true}
              selectedModel={selectedModel}
              onSelectModel={(model) => setSelectedModel(model)}
              availableProviders={availableProviders}
              evidenceLabel={evidenceLabel}
              onClearEvidence={evidenceLabel ? clearEvidence : undefined}
              fieldClassName="min-h-24"
              collapsed={composerCollapsed}
              onExpand={expandComposer}
            />
          </div>
        </div>
      </div>

      {hasWorkspace && panelOpen && (
        <aside
          aria-label={copy("Workspace research", "工作区研究")}
          className="hidden w-[24rem] shrink-0 overflow-y-auto border-l border-border xl:block 2xl:w-[26rem]"
        >
          <WorkspacePanel workspace={workspace} conversationId={conversationId} model={selectedModel} />
        </aside>
      )}

      <Sheet open={sheetOpen && hasWorkspace} onOpenChange={setSheetOpen}>
        <SheetContent side="right" closeLabel={copy("Close", "关闭")} className="w-full overflow-y-auto sm:max-w-md">
          <SheetTitle className="sr-only">{copy("Workspace research", "工作区研究")}</SheetTitle>
          <div className="pt-8">
            <WorkspacePanel workspace={workspace} conversationId={conversationId} model={selectedModel} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
