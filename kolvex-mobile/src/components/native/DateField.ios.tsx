import { DatePicker, Host } from "@expo/ui/swift-ui";
import {
  datePickerStyle,
  tint,
  environment,
} from "@expo/ui/swift-ui/modifiers";
import { useText } from "../../lib/i18n";
import { usePreferences } from "../../state/Preferences";
import { useTheme } from "../../lib/theme";
import { calendarDate } from "../../lib/technicalData";
import type { DateFieldProps } from "./DateField";
export default function DateField({ value, onChange, label }: DateFieldProps) {
  const t = useTheme();
  const text = useText();
  const { locale } = usePreferences();
  const date = calendarDate(value) ? new Date(`${value}T12:00:00`) : new Date();
  return (
    <Host
      // Yoga places this host; SwiftUI must not push its content away from the
      // status bar or keyboard when the host scrolls under them.
      ignoreSafeArea="all"
      matchContents={{ vertical: true }}
      style={{ width: "100%" }}
      colorScheme={t.dark ? "dark" : "light"}
    >
      <DatePicker
        title={text(label)}
        displayedComponents={["date"]}
        selection={date}
        onDateChange={(date) =>
          onChange(
            `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
          )
        }
        modifiers={[
          datePickerStyle("compact"),
          tint(t.accent),
          environment("locale", locale === "en" ? "en_US" : "zh_CN"),
        ]}
      />
    </Host>
  );
}
