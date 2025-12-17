"use client";

import { Crown, Medal, Trophy } from "lucide-react";

interface RankBadgeProps {
  rank: number;
}

export function RankBadge({ rank }: RankBadgeProps) {
  if (rank === 1) {
    return (
      <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-yellow-500/30">
        <Crown className="w-2.5 h-2.5 text-white" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-gray-300 to-gray-400 rounded-full flex items-center justify-center shadow-lg">
        <Medal className="w-2.5 h-2.5 text-white" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-amber-600 to-amber-700 rounded-full flex items-center justify-center shadow-lg">
        <Trophy className="w-2.5 h-2.5 text-white" />
      </div>
    );
  }
  return null;
}

