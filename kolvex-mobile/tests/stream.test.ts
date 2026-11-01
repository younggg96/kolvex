import assert from "node:assert/strict";
import { test } from "node:test";
import { consumeEvents } from "../src/lib/stream";
import type { ProgressEvent } from "../src/lib/contentTypes";
function fragmented(text: string) {
  const bytes = new TextEncoder().encode(text);
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let i = 0; i < bytes.length; i += 3)
          controller.enqueue(bytes.slice(i, i + 3));
        controller.close();
      },
    }),
  );
}
test("SSE handles split UTF-8/JSON, CRLF and heartbeat blocks", async () => {
  const events: ProgressEvent[] = [];
  await consumeEvents(
    fragmented(
      ': keepalive\r\n\r\ndata: {"type":"token","content":"中文😀"}\r\n\r\ndata: {"type":"done","message_id":"saved"}\r\n\r\n',
    ),
    (event) => events.push(event),
  );
  assert.equal(events[0].content, "中文😀");
  assert.equal(events[1].message_id, "saved");
});
test("EOF without a done event remains an uncertain result", async () => {
  await assert.rejects(
    consumeEvents(
      fragmented('data: {"type":"token","content":"partial"}\n\n'),
      () => {},
    ),
    /连接提前结束/,
  );
});
test("server errors do not expose internal exception messages", async () => {
  await assert.rejects(
    consumeEvents(
      fragmented('data: {"type":"error","content":"secret upstream key"}\n\n'),
      () => {},
    ),
    (error) => error instanceof Error && !error.message.includes("secret"),
  );
});
