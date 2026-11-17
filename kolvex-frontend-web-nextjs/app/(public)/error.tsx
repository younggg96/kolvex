"use client";

import { ReadingText } from "@/components/public/ReadingElements";
import { Button } from "@/components/ui/button";

export default function PublicReadingError() {
  return (
    <div className="min-h-[40vh] max-w-lg space-y-5 py-12" role="alert">
      <h1 className="text-2xl font-semibold">
        <ReadingText en="Content could not be loaded" zh="暂时无法加载内容" />
      </h1>
      <Button onClick={() => window.location.reload()}>
        <ReadingText en="Retry" zh="重试" />
      </Button>
    </div>
  );
}
