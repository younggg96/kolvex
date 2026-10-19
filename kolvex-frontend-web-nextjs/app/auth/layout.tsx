import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In — Kolvex",
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
