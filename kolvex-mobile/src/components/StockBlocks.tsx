// Shared pieces for the stock workspace tabs, following the Web's phone rules (DESIGN.md):
// in-view controls are 32pt segmented pills with 13px labels; secondary options sit
// behind one icon button on the same row and open the shared OptionSheet; collection
// lists drop the card surface and divide rows with hairlines.
import { useState, type ReactNode } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { SymbolView } from "expo-symbols";
import { useText } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { Filters } from "./Content";
import { OptionGroup, OptionSheet } from "./OptionSheet";
import { Copy, Glass, phone, styles } from "./UI";

/** Body, label and meta sizes in the app's Web-px scale (Copy scales them for phones). */
export const type = {
  title: 18,
  item: 15,
  body: 14,
  meta: 12,
  figure: 24,
} as const;

/**
 * One row of view choices. Extra options (period, display, filters) go behind the
 * slider icon into the shared bottom sheet instead of stacking more rows.
 */
export function ViewControls({
  values,
  value,
  onChange,
  options,
  optionsTitle = "显示选项",
  changed = false,
  onReset,
}: {
  values: readonly (readonly [string, string])[];
  value: string;
  onChange: (value: string) => void;
  /** Sheet content; omit when the view has no secondary options. */
  options?: ReactNode;
  optionsTitle?: string;
  /** Marks the icon while an option differs from its default. */
  changed?: boolean;
  onReset?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { width } = useWindowDimensions();
  return (
    <View style={[styles.row, { gap: phone(8) }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Filters
          size="sm"
          maxWidth={Math.max(120, width - 32 - (options ? 48 : 0))}
          values={values}
          value={value}
          onChange={onChange}
        />
      </View>
      {options && (
        <>
          <OptionsButton
            label={optionsTitle}
            changed={changed}
            onPress={() => setOpen(true)}
          />
          <OptionSheet
            title={optionsTitle}
            visible={open}
            onClose={() => setOpen(false)}
            onReset={changed ? onReset : undefined}
          >
            {options}
          </OptionSheet>
        </>
      )}
    </View>
  );
}

/** The slider icon that opens a view's options sheet, sized like the 32pt controls. */
export function OptionsButton({
  label,
  changed = false,
  onPress,
}: {
  label: string;
  changed?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const text = useText();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text(label)}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <Glass
        style={{
          width: phone(36),
          height: phone(36),
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <SymbolView
          name="slider.horizontal.3"
          size={phone(15)}
          tintColor={t.text}
        />
      </Glass>
      {changed && (
        <View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: t.accent,
          }}
        />
      )}
    </Pressable>
  );
}

/** A label on the left and a value on the right, divided from the next row. */
export function DataRow({
  label,
  value,
  color,
  last = false,
  localize = true,
}: {
  label: string;
  value: string;
  color?: string;
  last?: boolean;
  localize?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.row,
        {
          minHeight: 44,
          gap: 12,
          borderBottomWidth: last ? 0 : 0.5,
          borderBottomColor: t.border,
        },
      ]}
    >
      <View style={{ flexShrink: 1 }}>
        <Copy size={type.body} muted localize={localize}>
          {label}
        </Copy>
      </View>
      <Copy size={type.body} bold color={color} localize={false}>
        {value}
      </Copy>
    </View>
  );
}

/** A collection row without a card: content, then a hairline before the next row. */
export function ListItem({
  children,
  last = false,
}: {
  children: ReactNode;
  last?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        paddingVertical: 14,
        gap: 4,
        borderBottomWidth: last ? 0 : 0.5,
        borderBottomColor: t.border,
      }}
    >
      {children}
    </View>
  );
}

/**
 * A choice shown as one row ("模型  DeepSeek V4.1 Flash ⇕") that opens the shared sheet,
 * instead of a long chip row that clips on phones.
 */
export function SelectRow({
  label,
  title,
  options,
  value,
  onChange,
  disabled = false,
  localize = false,
}: {
  label: string;
  title: string;
  options: readonly (readonly [string, string])[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  localize?: boolean;
}) {
  const t = useTheme();
  const text = useText();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={text(title)}
        disabled={disabled || !options.length}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          minHeight: 44,
          paddingHorizontal: 14,
          borderRadius: 14,
          backgroundColor: t.wash,
          opacity: disabled ? 0.5 : pressed ? 0.65 : 1,
        })}
      >
        <Copy size={13} muted>
          {label}
        </Copy>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Copy size={type.body} bold lines={1} localize={localize}>
            {options.find(([key]) => key === value)?.[1] ?? "—"}
          </Copy>
        </View>
        <SymbolView
          name={{
            ios: "chevron.up.chevron.down",
            android: "unfold_more",
            web: "unfold_more",
          }}
          size={12}
          weight="semibold"
          tintColor={t.secondary}
        />
      </Pressable>
      <OptionSheet title={title} visible={open} onClose={() => setOpen(false)}>
        <OptionGroup
          label={label}
          localize={localize}
          options={options}
          value={value}
          onChange={(next) => {
            onChange(next);
            setOpen(false);
          }}
        />
      </OptionSheet>
    </>
  );
}
