import { useTranslated } from "../lib/useTranslated";
import { Button, Copy, Failure } from "./UI";
export function TranslateToggle({
  state,
}: {
  state: ReturnType<typeof useTranslated>;
}) {
  if (!state.available) return null;
  return (
    <>
      <Button
        disabled={state.busy}
        selected={state.show}
        onPress={() => void state.toggle()}
      >
        {state.busy ? "正在翻译…" : state.show ? "显示原文" : "翻译"}
      </Button>
      {state.failed && <Failure message="翻译失败，请重试。" />}
    </>
  );
}
/** Source text with a reader-controlled machine translation; originals stay untouched. */
export function TranslatableText({
  text,
  size,
  muted,
}: {
  text: string;
  size?: number;
  muted?: boolean;
}) {
  const state = useTranslated(text);
  return (
    <>
      <Copy size={size} muted={muted} localize={false} selectable>
        {state.shown}
      </Copy>
      <TranslateToggle state={state} />
    </>
  );
}
