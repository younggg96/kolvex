import { TextInput } from "react-native";
import { phone } from "../UI";
import { useTheme } from "../../lib/theme";

/** Props shared by the SwiftUI text field and its non-iOS fallback. */
export type NativeFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  editable?: boolean;
  multiline?: boolean;
  autoFocus?: boolean;
  minHeight?: number;
  maxLines?: number;
  /** Called when the reader submits from the keyboard. */
  onSubmit?: () => void;
  maxLength?: number;
};

export const nativeFieldAvailable = false;

/** Non-iOS fallback: the plain React Native field, so web and Android still type. */
export default function NativeField({
  value,
  onChange,
  placeholder,
  editable = true,
  multiline = true,
  autoFocus = false,
  minHeight,
  onSubmit,
  maxLength,
}: NativeFieldProps) {
  const t = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={t.secondary}
      editable={editable}
      multiline={multiline}
      autoFocus={autoFocus}
      maxLength={maxLength}
      returnKeyType={multiline ? "default" : "send"}
      onSubmitEditing={onSubmit}
      // Fields stay 16px on phones so iOS never zooms, as on the Web.
      style={{
        fontSize: phone(16),
        lineHeight: phone(24),
        color: t.text,
        minHeight: minHeight ?? phone(28),
        maxHeight: 160,
        paddingTop: 0,
        textAlignVertical: "top",
      }}
    />
  );
}
