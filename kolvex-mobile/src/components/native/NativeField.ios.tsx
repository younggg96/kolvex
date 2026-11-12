import { useEffect } from "react";
import { Host, Text, TextField, useNativeState } from "@expo/ui/swift-ui";
import {
  disabled as disabledModifier,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  onSubmit as onSubmitModifier,
  padding,
} from "@expo/ui/swift-ui/modifiers";
import { useTheme } from "../../lib/theme";
import { phone } from "../UI";
import type { NativeFieldProps } from "./NativeField";

export const nativeFieldAvailable = true;
const inputFont = font({ size: phone(16) });

/** The iOS native text field: a real SwiftUI `TextField`, controlled from JS state. */
export default function NativeField({
  value,
  onChange,
  placeholder,
  editable = true,
  multiline = true,
  autoFocus = false,
  minHeight,
  maxLines,
  onSubmit,
  maxLength,
}: NativeFieldProps) {
  const t = useTheme();
  const state = useNativeState(value);
  // External writes (for example clearing after send) flow back into the native field.
  useEffect(() => {
    if (state.get() !== value) state.set(value);
  }, [value, state]);
  return (
    <Host
      // Yoga places this host; SwiftUI must not push its content away from the
      // status bar or keyboard when the host scrolls under them.
      ignoreSafeArea="all"
      matchContents={{ vertical: true }}
      style={{ width: "100%" }}
      colorScheme={t.dark ? "dark" : "light"}
    >
      <TextField
        text={state}
        placeholder={placeholder}
        axis={multiline ? "vertical" : "horizontal"}
        autoFocus={autoFocus}
        maxLength={maxLength}
        onTextChange={(text) => onChange(text)}
        modifiers={[
          inputFont,
          foregroundStyle(t.text),
          padding({ vertical: 2 }),
          ...(minHeight ? [frame({ minHeight })] : []),
          ...(multiline && maxLines
            ? [lineLimit({ min: 1, max: maxLines })]
            : []),
          ...(onSubmit ? [onSubmitModifier(onSubmit)] : []),
          disabledModifier(!editable),
        ]}
      >
        {placeholder ? (
          <TextField.Placeholder>
            <Text modifiers={[inputFont, foregroundStyle(t.secondary)]}>
              {placeholder}
            </Text>
          </TextField.Placeholder>
        ) : null}
      </TextField>
    </Host>
  );
}
