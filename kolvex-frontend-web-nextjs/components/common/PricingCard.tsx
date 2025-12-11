import { Check, X, LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PricingFeature {
  text: string;
  included: boolean;
  highlighted?: boolean;
}

interface PricingCardProps {
  name: string;
  price: number;
  period?: string;
  features: PricingFeature[];
  buttonText: string;
  buttonVariant?: "default" | "outline";
  buttonDisabled?: boolean;
  badge?: {
    icon?: LucideIcon;
    text: string;
  };
  highlight?: boolean;
  popularLabel?: string;
}

export default function PricingCard({
  name,
  price,
  period = "/month",
  features,
  buttonText,
  buttonVariant = "default",
  buttonDisabled = false,
  badge,
  highlight = false,
  popularLabel,
}: PricingCardProps) {
  const cardClasses = highlight
    ? "relative flex flex-col p-3 sm:p-4 md:p-5 bg-gradient-to-br from-primary/5 via-primary/[0.02] to-transparent dark:from-primary/10 dark:via-primary/5 dark:to-transparent border-2 border-primary rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 md:scale-105 mt-4 sm:mt-0"
    : "group relative flex flex-col p-3 sm:p-4 md:p-5 bg-white dark:bg-card-dark border-2 border-gray-200 dark:border-white/10 rounded-xl hover:border-gray-300 dark:hover:border-white/20 hover:shadow-xl transition-all duration-300";

  const priceClasses = highlight
    ? "text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent"
    : "text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white";

  const featureIconBg = highlight
    ? "bg-primary/20 dark:bg-primary/30"
    : "bg-primary/10 dark:bg-primary/20";

  return (
    <div className={cardClasses}>
      {/* Badge */}
      {badge && (
        <div className="absolute -top-2.5 sm:-top-3 left-1/2 -translate-x-1/2 z-10">
          <div className="px-2 py-0.5 sm:px-2.5 sm:py-0.5 md:px-3 md:py-1 bg-gradient-to-r from-primary to-primary text-white text-[10px] sm:text-[11px] md:text-xs font-semibold rounded-full shadow-lg flex items-center gap-0.5 sm:gap-1">
            {badge.text}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-3 sm:mb-4 md:mb-5">
        <div className="flex items-center gap-1 sm:gap-1.5">
          <h3 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 dark:text-white mb-1 sm:mb-1.5 flex flex-wrap items-center gap-1 sm:gap-1.5">
            {name}
          </h3>
          {popularLabel && (
            <span className="h-fit px-1 py-0.5 sm:px-1.5 sm:py-0.5 bg-primary/10 dark:bg-primary/20 text-primary text-[10px] sm:text-[11px] md:text-xs font-semibold rounded">
              {popularLabel}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-0.5 sm:gap-1">
          <span className={priceClasses}>${price}</span>
          <span className="text-gray-500 dark:text-white/50 text-xs sm:text-sm">
            {period}
          </span>
        </div>
      </div>

      {/* Features */}
      <ul className="space-y-1.5 sm:space-y-2 md:space-y-2.5 mb-4 sm:mb-5 md:mb-6 flex-1">
        {features.map((feature, index) => (
          <li
            key={index}
            className={`flex items-start gap-1.5 sm:gap-2 text-[11px] sm:text-xs ${
              feature.included
                ? "text-gray-700 dark:text-white/70"
                : "text-gray-400 dark:text-white/30"
            }`}
          >
            <div
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full ${
                feature.included ? featureIconBg : "bg-gray-100 dark:bg-white/5"
              } flex items-center justify-center flex-shrink-0 mt-0.5`}
            >
              {feature.included ? (
                <Check className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-primary" />
              ) : (
                <X className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
              )}
            </div>
            <span className={feature.highlighted ? "font-medium" : ""}>
              {feature.text}
            </span>
          </li>
        ))}
      </ul>

      {/* Button */}
      <Button
        variant={buttonVariant}
        disabled={buttonDisabled}
        className={`w-full h-8 sm:h-9 md:h-10 text-[11px] sm:text-xs ${
          buttonDisabled ? "opacity-70" : ""
        } ${
          !highlight && !buttonDisabled ? "group-hover:shadow-lg" : ""
        } transition-shadow`}
      >
        {buttonText}
      </Button>
    </div>
  );
}
