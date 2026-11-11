import { createContext } from "react";

export const TabBarVisibility = createContext<(hidden: boolean) => void>(
  () => {},
);
