import { SymbolView } from "expo-symbols";
import { Pressable } from "react-native";
import { useTheme } from "../../lib/theme";
import { Copy } from "../UI";

export type ChatGlassButtonProps = {
  icon: "history" | "new" | "workspace" | "workspaceFilled";
  label: string;
  showLabel?: boolean;
  onPress: () => void;
};

export default function ChatGlassButton({
  icon,
  label,
  showLabel,
  onPress,
}: ChatGlassButtonProps) {
  const t = useTheme();
  const color = showLabel ? t.onBrand : t.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: 44,
        minHeight: 44,
        paddingHorizontal: showLabel ? 14 : 0,
        borderRadius: 22,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: showLabel ? t.brand : t.wash,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <SymbolView
        name={
          icon === "history"
            ? {
                ios: "line.3.horizontal.decrease",
                android: "menu",
                web: "menu",
              }
            : icon === "new"
              ? { ios: "square.and.pencil", android: "edit", web: "edit" }
              : {
                  ios: icon === "workspace" ? "folder" : "folder.fill",
                  android: "folder",
                  web: "folder",
                }
        }
        size={18}
        tintColor={color}
      />
      {showLabel && (
        <Copy color={color} bold localize={false}>
          {label}
        </Copy>
      )}
    </Pressable>
  );
}
