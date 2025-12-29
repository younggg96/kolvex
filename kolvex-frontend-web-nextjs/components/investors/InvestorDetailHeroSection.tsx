"use client";

import Link from "next/link";
import { ArrowLeft, Calendar, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { SuperInvestor } from "@/lib/dataromaApi";

interface InvestorDetailHeroSectionProps {
  className?: string;
  investor: SuperInvestor | null;
  loading?: boolean;
}

export function InvestorDetailHeroSection({
  className,
  investor,
  loading = false,
}: InvestorDetailHeroSectionProps) {
  return (
    <div
      className={`relative overflow-hidden ${className} bg-card-light dark:bg-transparent p-4 border-b border-border-light dark:border-0 shadow-sm`}
    >
      {/* Back Button */}
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-3">
        <Link href="/dashboard/investors">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Link>
      </Button>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-96" />
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {investor?.name}
            </h1>
            <Badge variant="outline" className="text-sm">
              {investor?.code}
            </Badge>
          </div>
          {investor?.description && (
            <p className="text-sm text-gray-600 dark:text-white/60 mt-1 max-w-2xl">
              {investor.description}
            </p>
          )}
          <div className="flex items-center gap-4 mt-3 text-sm text-gray-600 dark:text-white/60">
            {investor?.period && (
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {investor.period}
              </span>
            )}
            {investor?.website && (
              <a
                href={investor.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-primary transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Website
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


