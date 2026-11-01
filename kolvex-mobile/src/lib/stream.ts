import type { ProgressEvent } from "./contentTypes";
import { apiResponse } from "./http";
export async function consumeEvents(
  response: Response,
  onEvent: (event: ProgressEvent) => void,
) {
  if (!response.body) throw new Error("对话未返回可读取的内容。");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;
  function block(value: string) {
    const data = value
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data || data === "[DONE]") return;
    const event = JSON.parse(data) as ProgressEvent;
    if (event.type === "error")
      throw new Error("AI 回复中断。请刷新对话确认已保存的内容。");
    if (event.type === "done") completed = true;
    onEvent(event);
  }
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      if (buffer.length > 2_000_000)
        throw new Error("回复过长，请刷新对话查看。");
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? "";
      blocks.forEach(block);
      if (done) break;
    }
    if (buffer.trim()) block(buffer);
    if (!completed)
      throw new Error("连接提前结束。请刷新对话确认已保存的内容。");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export async function sendChat(
  id: string,
  user: string,
  content: string,
  signal: AbortSignal,
  onEvent: (event: ProgressEvent) => void,
  context?: string,
  sources: string[] = ["web"],
) {
  const response = await apiResponse(
    `/chat/conversations/${encodeURIComponent(id)}/stream`,
    {
      method: "POST",
      body: { content, context, sources },
      signal,
      authenticated: true,
      expectedUser: user,
      stream: true,
      timeout: 180000,
    },
  );
  await consumeEvents(response, onEvent);
}
