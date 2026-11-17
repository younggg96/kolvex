"use client";

/**
 * AI assistant preferences (Settings → Preferences → AI assistant), kept in this browser.
 *
 * - defaultSkills: the data tools a new chat starts with (each chat can still change its own).
 * - disabledAgents: agents the router never picks, never auto-launches and the workspace menu hides.
 * - multiAgent: what happens when a question needs several agents.
 * - maxAgents: how many agents one question may start at once.
 *
 * Each chat turn sends the agents allowed by these settings and that chat's skills, and the
 * backend routes only among them.
 */

import { useEffect, useState } from "react";
import { CHAT_SKILLS, DEFAULT_CHAT_SKILLS, type ChatSkill } from "@/components/chat/chatSkills";
import { CHAT_AGENTS, isChatAgent, type ChatAgent } from "@/lib/researchWorkspaceApi";

export type MultiAgentMode = "auto" | "ask" | "off";
export const MAX_AGENT_OPTIONS = [2, 3, 4] as const;
export type MaxAgents = (typeof MAX_AGENT_OPTIONS)[number];

export interface AiAssistantSettings {
  defaultSkills: ChatSkill[];
  disabledAgents: ChatAgent[];
  multiAgent: MultiAgentMode;
  maxAgents: MaxAgents;
}

export const DEFAULT_AI_ASSISTANT_SETTINGS: AiAssistantSettings = {
  defaultSkills: [...DEFAULT_CHAT_SKILLS],
  disabledAgents: [],
  multiAgent: "auto",
  maxAgents: 3,
};

/**
 * The skill an agent cannot work without (its main data). research and the general agent's
 * fallbacks need nothing specific.
 */
export const AGENT_REQUIRED_SKILL: Record<ChatAgent, ChatSkill | null> = {
  financial: "market",
  research: null,
  portfolio: "portfolio",
  creators: "creators",
  earnings: "news",
  macro: "news",
  smart_money: "fundamentals",
  valuation: "fundamentals",
  buzz: "news",
  paper_review: "portfolio",
};

const KEY = "kolvex:aiAssistant";
const EVENT = "kolvex:aiAssistant-change";

function parse(raw: string | null): AiAssistantSettings {
  try {
    const value = JSON.parse(raw ?? "null") as Partial<AiAssistantSettings> | null;
    if (!value || typeof value !== "object") return DEFAULT_AI_ASSISTANT_SETTINGS;
    return {
      defaultSkills: Array.isArray(value.defaultSkills)
        ? CHAT_SKILLS.filter((skill) => value.defaultSkills!.includes(skill))
        : DEFAULT_AI_ASSISTANT_SETTINGS.defaultSkills,
      disabledAgents: Array.isArray(value.disabledAgents)
        ? value.disabledAgents.filter(isChatAgent)
        : [],
      multiAgent: (["auto", "ask", "off"] as const).includes(value.multiAgent as MultiAgentMode)
        ? (value.multiAgent as MultiAgentMode)
        : DEFAULT_AI_ASSISTANT_SETTINGS.multiAgent,
      maxAgents: MAX_AGENT_OPTIONS.includes(value.maxAgents as MaxAgents)
        ? (value.maxAgents as MaxAgents)
        : DEFAULT_AI_ASSISTANT_SETTINGS.maxAgents,
    };
  } catch {
    return DEFAULT_AI_ASSISTANT_SETTINGS;
  }
}

export function readAiAssistantSettings(): AiAssistantSettings {
  try {
    return parse(localStorage.getItem(KEY));
  } catch {
    return DEFAULT_AI_ASSISTANT_SETTINGS;
  }
}

export function saveAiAssistantSettings(next: AiAssistantSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

/** The settings, kept current across components and tabs. */
export function useAiAssistantSettings(): AiAssistantSettings {
  const [settings, setSettings] = useState(DEFAULT_AI_ASSISTANT_SETTINGS);
  useEffect(() => {
    const sync = () => setSettings(readAiAssistantSettings());
    sync();
    const onStorage = (event: StorageEvent) => event.key === KEY && sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return settings;
}

/** Agents the router may pick in a chat with these skills: enabled, with their data switched on. */
export function allowedAgents(settings: AiAssistantSettings, skills: readonly ChatSkill[]) {
  return CHAT_AGENTS.filter((agent) => {
    if (settings.disabledAgents.includes(agent)) return false;
    const needed = AGENT_REQUIRED_SKILL[agent];
    return needed === null || skills.includes(needed);
  });
}

/** Skills for a turn in an agent's panel: the default set plus the agent's own data. */
export function panelSkills(settings: AiAssistantSettings, agent: ChatAgent): ChatSkill[] {
  const needed = AGENT_REQUIRED_SKILL[agent];
  return needed && !settings.defaultSkills.includes(needed)
    ? CHAT_SKILLS.filter((skill) => skill === needed || settings.defaultSkills.includes(skill))
    : settings.defaultSkills;
}
