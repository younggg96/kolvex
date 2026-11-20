"use client";

import { Layers, Wrench } from "lucide-react";
import { SettingsGroup, SettingsRow } from "@/components/ui/settings-group";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { InfoTip } from "@/components/ui/info-tip";
import { useCopy } from "@/components/decision/shared";
import { CHAT_SKILLS, type ChatSkill } from "@/components/chat/chatSkills";
import {
  CHAT_AGENT_META,
  chatAgentAbout,
  chatAgentName,
} from "@/components/chat/workspace/chatAgents";
import { useTranslation } from "@/lib/i18n";
import { CHAT_AGENTS, type ChatAgent } from "@/lib/researchWorkspaceApi";
import {
  AGENT_REQUIRED_SKILL,
  MAX_AGENT_OPTIONS,
  saveAiAssistantSettings,
  useAiAssistantSettings,
  type AiAssistantSettings as Settings,
  type MaxAgents,
  type MultiAgentMode,
} from "@/lib/aiAssistantSettings";

/** Default chat skills, which agents may answer, and how several agents start. Kept in this browser. */
export function AiAssistantSettings({ className }: { className?: string }) {
  const c = useCopy();
  const { t } = useTranslation();
  const settings = useAiAssistantSettings();
  const save = (patch: Partial<Settings>) => saveAiAssistantSettings({ ...settings, ...patch });
  const skillName = (skill: ChatSkill) => t(`chat.input.skills.${skill}`);
  const enabledCount = CHAT_AGENTS.length - settings.disabledAgents.length;

  const toggleSkill = (skill: ChatSkill, on: boolean) =>
    save({
      defaultSkills: CHAT_SKILLS.filter((s) =>
        s === skill ? on : settings.defaultSkills.includes(s),
      ),
    });

  const toggleAgent = (agent: ChatAgent, on: boolean) =>
    save({
      disabledAgents: on
        ? settings.disabledAgents.filter((a) => a !== agent)
        : [...settings.disabledAgents, agent],
    });

  return (
    <div className={className}>
      <SettingsGroup
        label={
          <span className="inline-flex items-center gap-1.5">
            {c("Default chat skills", "新对话默认技能")}
            <InfoTip label={c("About default skills", "默认技能说明")}>
              {c(
                "The data tools a new chat starts with. Each chat can still change its own from the skills menu. Saved in this browser.",
                "新对话默认可以使用的数据工具，每个对话仍可在输入框的技能菜单里单独调整。保存在这个浏览器里。",
              )}
            </InfoTip>
          </span>
        }
      >
        {CHAT_SKILLS.map((skill) => (
          <SettingsRow key={skill} icon={Wrench} label={skillName(skill)}>
            <Switch
              checked={settings.defaultSkills.includes(skill)}
              onCheckedChange={(on) => toggleSkill(skill, on)}
              aria-label={skillName(skill)}
            />
          </SettingsRow>
        ))}
      </SettingsGroup>

      <SettingsGroup
        className="mt-6"
        label={
          <span className="inline-flex items-center gap-1.5">
            {c("Agents", "Agent")}
            <InfoTip label={c("About agents", "Agent 说明")}>
              {c(
                "A turned-off agent is never picked for an answer, never started in a workspace and is hidden from the Add agent menu. An agent whose data skill is off in a chat is skipped in that chat.",
                "关闭的 Agent 不会被选来回答，不会在工作区里自动开工，也不出现在「添加 Agent」菜单里。某个对话关掉了 Agent 需要的技能时，这个对话里也会跳过它。",
              )}
            </InfoTip>
          </span>
        }
      >
        {CHAT_AGENTS.map((agent) => {
          const on = !settings.disabledAgents.includes(agent);
          const needed = AGENT_REQUIRED_SKILL[agent];
          const missing = on && needed && !settings.defaultSkills.includes(needed);
          return (
            <SettingsRow
              key={agent}
              icon={CHAT_AGENT_META[agent].icon}
              label={
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    {chatAgentName(agent, c)}
                    <InfoTip label={chatAgentName(agent, c)}>{chatAgentAbout(agent, c)}</InfoTip>
                  </span>
                  {missing && (
                    <span className="block text-xs font-normal text-warning">
                      {c(
                        `Needs the ${skillName(needed)} skill, off by default`,
                        `需要「${skillName(needed)}」技能，默认未开启`,
                      )}
                    </span>
                  )}
                </span>
              }
            >
              <Switch
                checked={on}
                // Keep at least one agent to answer.
                disabled={on && enabledCount === 1}
                onCheckedChange={(next) => toggleAgent(agent, next)}
                aria-label={chatAgentName(agent, c)}
              />
            </SettingsRow>
          );
        })}
      </SettingsGroup>

      <SettingsGroup
        className="mt-6"
        label={
          <span className="inline-flex items-center gap-1.5">
            {c("Several agents", "多 Agent 协作")}
            <InfoTip label={c("About several agents", "多 Agent 协作说明")}>
              {c(
                "When a question needs several agents, they work on it together in a workspace and produce one combined conclusion.",
                "问题需要多个 Agent 时，研究员会在工作区并行分析，并产出一份综合结论。",
              )}
            </InfoTip>
          </span>
        }
      >
        <SettingsRow
          icon={Layers}
          label={c("When a question needs several", "需要多个 Agent 时")}
          stacked
        >
          <SegmentedControl<MultiAgentMode>
            label={c("When a question needs several agents", "需要多个 Agent 时")}
            semantics="radio"
            value={settings.multiAgent}
            onChange={(multiAgent) => save({ multiAgent })}
            options={[
              { value: "auto", label: c("Start them", "自动开始") },
              { value: "ask", label: c("Ask me", "先问我") },
              { value: "off", label: c("Off", "关闭") },
            ]}
            itemClassName="min-h-9 px-3 text-[0.8125rem] sm:px-4"
          />
        </SettingsRow>
        {settings.multiAgent !== "off" && (
          <SettingsRow icon={Layers} label={c("At most", "最多同时")}>
            <SegmentedControl<`${MaxAgents}`>
              label={c("At most this many agents", "最多同时几个 Agent")}
              semantics="radio"
              value={`${settings.maxAgents}`}
              onChange={(value) => save({ maxAgents: Number(value) as MaxAgents })}
              options={MAX_AGENT_OPTIONS.map((n) => ({
                value: `${n}` as `${MaxAgents}`,
                label: c(`${n}`, `${n} 个`),
              }))}
              itemClassName="min-h-9 px-3 text-[0.8125rem]"
            />
          </SettingsRow>
        )}
      </SettingsGroup>
    </div>
  );
}
