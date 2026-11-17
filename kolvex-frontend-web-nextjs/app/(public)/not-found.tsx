import { ReadingText } from "@/components/public/ReadingElements";
import Link from "next/link";

export default function PublicNotFound() {
  return (
    <div className="min-h-[40vh] max-w-lg space-y-5 py-12">
      <h1 className="text-2xl font-semibold">
        <ReadingText en="Public content not found" zh="未找到公开内容" />
      </h1>
      <Link
        href="/research"
        className="inline-block py-3 text-positive underline underline-offset-4"
      >
        <ReadingText en="Browse published reports" zh="浏览已发布研究" />
      </Link>
    </div>
  );
}
