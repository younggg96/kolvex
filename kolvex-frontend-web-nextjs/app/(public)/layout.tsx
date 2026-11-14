import { ReadingLayout } from "@/components/public/ReadingLayout";

// Cache rendered reading pages (ISR); keep in sync with PUBLIC_CONTENT_REVALIDATE_SECONDS.
export const revalidate = 600;

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <ReadingLayout>{children}</ReadingLayout>;
}
