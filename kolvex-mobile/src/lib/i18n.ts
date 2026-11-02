import { Children, type ReactNode } from "react";
import { usePreferences } from "../state/Preferences";
import { translate, type UILocale } from "./translation";
export { translate } from "./translation";
export const translateNodes = (children: ReactNode, locale: UILocale) =>
  Children.map(children, (child) =>
    typeof child === "string" ? translate(child, locale) : child,
  );
export function useText() {
  const { locale } = usePreferences();
  return (value: string) => translate(value, locale);
}
