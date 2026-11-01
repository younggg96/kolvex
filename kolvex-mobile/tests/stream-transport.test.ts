import assert from "node:assert/strict";
import { test } from "node:test";
process.env.EXPO_PUBLIC_API_URL = "https://backend.example.test/api/v1";
test("stop aborts the active stream after headers have already arrived", async () => {
  const { configureIdentity } = await import("../src/lib/http");
  const { sendChat } = await import("../src/lib/stream");
  configureIdentity(async () => ({ userId: "alice", token: "test" }));
  const controller = new AbortController();
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  globalThis.fetch = async (_, options) =>
    new Response(
      new ReadableStream({
        start(stream) {
          assert.equal(options?.signal, controller.signal);
          options?.signal?.addEventListener(
            "abort",
            () => stream.error(new DOMException("Cancelled", "AbortError")),
            { once: true },
          );
          stream.enqueue(
            new TextEncoder().encode(
              'data: {"type":"status","stage":"routing"}\n\n',
            ),
          );
          started();
        },
      }),
    );
  const sending = sendChat(
    "chat",
    "alice",
    "question",
    controller.signal,
    () => {},
  );
  await ready;
  controller.abort();
  await assert.rejects(sending, { name: "AbortError" });
});
