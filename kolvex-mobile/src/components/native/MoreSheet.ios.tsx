// The ··· tab's menu, shown as a native SwiftUI sheet over the current tab. Lives in an
// .ios file because @expo/ui/swift-ui throws on import anywhere without the ExpoUI module.
import { View } from "react-native";
import { BottomSheet, RNHostView } from "@expo/ui";
import { presentationBackgroundInteraction } from "@expo/ui/swift-ui/modifiers";
import { MoreMenu } from "../MoreMenu";
import { useLiquidGlass } from "../UI";
import { useTheme } from "../../lib/theme";

export type MoreSheetProps = {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
};

export default function MoreSheet({ open, onClose, isAdmin }: MoreSheetProps) {
  const t = useTheme();
  const glass = useLiquidGlass();
  return (
    <BottomSheet
      isPresented={open}
      onDismiss={onClose}
      containerColor={glass ? undefined : t.surface}
      contentPadding={{ top: 28, bottom: 12, left: 16, right: 16 }}
      // No dimmed backdrop: the page behind stays as it is.
      modifiers={[presentationBackgroundInteraction("enabled")]}
    >
      <RNHostView matchContents={{ vertical: true }}>
        <View>
          <MoreMenu onNavigate={onClose} isAdmin={isAdmin} />
        </View>
      </RNHostView>
    </BottomSheet>
  );
}
