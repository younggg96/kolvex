import { useEffect, useRef, useState } from "react";
export function useMutation() {
  const action = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      action.current?.abort();
    };
  }, []);
  async function run(work: (signal: AbortSignal) => Promise<void>) {
    if (action.current) return;
    const controller = new AbortController();
    action.current = controller;
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    try {
      await work(controller.signal);
      if (alive.current && !controller.signal.aborted)
        setMessage("操作已完成。");
    } catch (e) {
      if (alive.current && !controller.signal.aborted)
        setError(
          e instanceof Error
            ? e.message
            : "操作未确认，请刷新后核对，勿重复提交。",
        );
    } finally {
      action.current = null;
      if (alive.current) setBusy(false);
    }
  }
  return { busy, error, message, run };
}
