import { ReadingLayout } from "@/components/public/ReadingLayout";

export const dynamic = "force-dynamic";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <ReadingLayout>{children}</ReadingLayout>;
}
