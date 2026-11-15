/** What the AI chat remembers across conversations (backend app/agent/chat_memory.py). */
export interface ChatMemory {
  language: "zh" | "en" | null;
  tickers: string[];
  updated_at: string | null;
}

const API_PATH = "/api/chat-history/memory";

export async function getChatMemory(): Promise<ChatMemory> {
  const response = await fetch(API_PATH, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load chat memory: ${response.status}`);
  return response.json();
}

export async function clearChatMemory(): Promise<void> {
  const response = await fetch(API_PATH, { method: "DELETE" });
  if (!response.ok) throw new Error(`Failed to clear chat memory: ${response.status}`);
}
