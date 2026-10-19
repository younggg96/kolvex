import Link from "next/link";

export default function PublicNotFound() {
  return <div className="min-h-[40vh] max-w-lg space-y-5 py-12"><h1 className="text-2xl font-semibold">未找到公开内容</h1><p className="leading-7 text-muted-foreground">内容可能尚未发布、已撤回，或链接有误。</p><Link href="/research" className="inline-block py-3 text-positive underline underline-offset-4">浏览已发布研究</Link></div>;
}
