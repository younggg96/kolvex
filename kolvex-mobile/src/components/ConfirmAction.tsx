import { useState } from "react";
import { Modal, View } from "react-native";
import { Button, Copy, Glass } from "./UI";
export function ConfirmAction({
  label,
  description,
  onConfirm,
  disabled = false,
}: {
  label: string;
  description: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button disabled={disabled} onPress={() => setOpen(true)}>
        {label}
      </Button>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View
          accessibilityViewIsModal
          style={{
            flex: 1,
            justifyContent: "center",
            padding: 24,
            backgroundColor: "rgba(0,0,0,0.55)",
          }}
        >
          <Glass style={{ padding: 24, gap: 16 }}>
            <Copy size={20} bold>
              {label}
            </Copy>
            <Copy>{description}</Copy>
            <Button onPress={() => setOpen(false)}>取消</Button>
            <Button
              onPress={() => {
                setOpen(false);
                onConfirm();
              }}
            >
              {label}
            </Button>
          </Glass>
        </View>
      </Modal>
    </>
  );
}
