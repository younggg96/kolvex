export const CHAT_SKILLS = [
  "market",
  "fundamentals",
  "options",
  "news",
  "creators",
  "portfolio",
] as const;

export type ChatSkill = (typeof CHAT_SKILLS)[number];

export const DEFAULT_CHAT_SKILLS = CHAT_SKILLS.filter((skill) => skill !== "portfolio");

/** A chat's saved skills; `fallback` (the AI settings' default) when it has none. */
export function readChatSkills(
  conversationId: string,
  initialSkills?: string,
  fallback: readonly ChatSkill[] = DEFAULT_CHAT_SKILLS,
): ChatSkill[] {
  try {
    const saved: unknown =
      initialSkills === undefined
        ? JSON.parse(localStorage.getItem(`kolvex:skills:${conversationId}`) ?? "null")
        : initialSkills.split(",");
    if (Array.isArray(saved)) {
      return CHAT_SKILLS.filter((skill) => saved.includes(skill));
    }
  } catch {}
  return [...fallback];
}

export function toggleChatSkill(skills: ChatSkill[], skill: ChatSkill): ChatSkill[] {
  return skills.includes(skill) ? skills.filter((item) => item !== skill) : [...skills, skill];
}
