import { View } from "react-native";
import { Backdrop } from "../../../components/UI";
import { useTheme } from "../../../lib/theme";

// The ··· tab opens a sheet (see the tabs layout), so this route is never shown;
// it only gives the (more) group a root screen.
export default function More() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <Backdrop />
    </View>
  );
}
