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
    <div className="bg-white dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
      <Accordion
        type="single"
        collapsible
        defaultValue="company-profile"
        className="w-full"
      >
        <AccordionItem value="company-profile" className="!border-b-0">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-50 dark:hover:bg-white/5">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
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
            <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-white/5">
              <div className="flex xl:flex-row lg:flex-col flex-row xl:items-center lg:items-start items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Sector
                </span>
                <span className="text-xs font-medium text-gray-900 dark:text-white">
                  {company.sector}
                </span>
              </div>
              <div className="flex xl:flex-row lg:flex-col flex-row xl:items-center lg:items-start items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Industry
                </span>
                <span className="text-xs font-medium text-gray-900 dark:text-white xl:text-right lg:text-left text-left max-w-[60%]">
                  {company.industry}
                </span>
              </div>
              <div className="flex xl:flex-row lg:flex-col flex-row xl:items-center lg:items-start items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
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
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Employees
                </span>
                <span className="text-xs font-medium text-gray-900 dark:text-white">
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

