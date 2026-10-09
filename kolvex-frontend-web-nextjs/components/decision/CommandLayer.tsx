"use client";

import { createContext, ReactNode, useContext } from "react";

// Compatibility for existing pages: the reader experience has no global composer.
const CommandContext = createContext({
  setContext: (_context: string) => {},
  openAsk: () => {},
  canAsk: false,
});
export const useDecisionCommand = () => useContext(CommandContext);
export default function CommandLayer({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
