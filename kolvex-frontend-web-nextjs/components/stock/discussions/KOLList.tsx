"use client";

import { useState } from "react";
import { KOLSummary } from "@/lib/kolTweetsApi";
import KOLAvatar from "./KOLAvatar";
import ExpandButton from "./ExpandButton";

interface KOLListProps {
  kols: KOLSummary[];
}

export default function KOLList({ kols }: KOLListProps) {
  const [showAll, setShowAll] = useState(false);
  const maxVisible = 7; // 显示7个头像 + 1个展开按钮
  const hasMore = kols.length > maxVisible;
  const displayKols = showAll ? kols : kols.slice(0, maxVisible);

  return (
    <div className="flex flex-wrap gap-4 pt-3">
      {displayKols.map((kol) => (
        <KOLAvatar key={kol.username} kol={kol} />
      ))}
      {hasMore && (
        <ExpandButton
          totalCount={kols.length}
          showAll={showAll}
          onClick={() => setShowAll(!showAll)}
        />
      )}
    </div>
  );
}

