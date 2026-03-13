"use client";

import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { APICompanyProfile } from "./types";

interface StockCompanyProfileProps {
  company: APICompanyProfile;
}

export default function StockCompanyProfile({
  company,
}: StockCompanyProfileProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <Accordion
        type="single"
        collapsible
        defaultValue="company-profile"
        className="w-full"
      >
        <AccordionItem value="company-profile" className="!border-b-0">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted">
            <span className="text-sm font-semibold text-foreground">
              Company Profile
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 pt-2">
            {/* Summary */}
            <div className="mb-4">
              <p
                className={cn(
                  "text-sm text-gray-600 dark:text-gray-300 leading-relaxed",
                  !isExpanded && "line-clamp-3"
                )}
              >
                {company.business_summary}
              </p>
              {company.business_summary &&
                company.business_summary.length > 150 && (
                  <Button
                    variant="text"
                    size="xs"
                    onClick={() => setIsExpanded(!isExpanded)}
                  >
                    {isExpanded ? "Show less" : "Show more"}
                  </Button>
                )}
            </div>

            {/* Key Info */}
            <div className="space-y-3 pt-3 border-t border-border">
              <div className="flex xl:flex-row lg:flex-col flex-row xl:items-center lg:items-start items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Sector
                </span>
                <span className="text-xs font-medium text-foreground">
                  {company.sector}
                </span>
              </div>
              <div className="flex xl:flex-row lg:flex-col flex-row xl:items-center lg:items-start items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Industry
                </span>
                <span className="text-xs font-medium text-foreground xl:text-right lg:text-left text-left max-w-[60%]">
                  {company.industry}
                </span>
              </div>
              <div className="flex xl:flex-row lg:flex-col flex-row xl:items-center lg:items-start items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Website
                </span>
                {company.website ? (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-gery-500 hover:text-blue-600 truncate max-w-[60%]"
                  >
                    {company.website.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  <span className="text-xs text-gray-400">N/A</span>
                )}
              </div>
              <div className="flex xl:flex-row lg:flex-col flex-row xl:items-center lg:items-start items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Employees
                </span>
                <span className="text-xs font-medium text-foreground">
                  {company.employees?.toLocaleString() || "N/A"}
                </span>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

