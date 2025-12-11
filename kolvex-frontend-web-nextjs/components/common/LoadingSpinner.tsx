import { Sparkles } from "lucide-react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  subText?: string;
  fullScreen?: boolean;
  showCard?: boolean;
}

export default function LoadingSpinner({
  size = "md",
  text = "Loading...",
  subText = "Please wait a moment",
  fullScreen = false,
  showCard = true,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-16 h-16",
    lg: "w-24 h-24",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-6 h-6",
    lg: "w-10 h-10",
  };

  const textSizes = {
    sm: { main: "text-sm", sub: "text-xs" },
    md: { main: "text-lg", sub: "text-sm" },
    lg: { main: "text-2xl", sub: "text-base" },
  };

  const spinnerContent = (
    <div className="flex flex-col items-center gap-4">
      {/* Spinner */}
      <div className={`relative ${sizeClasses[size]}`}>
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border-4 border-gray-200 dark:border-white/10"></div>
        {/* Spinning gradient ring */}
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary border-r-primary animate-spin"></div>
        {/* Inner glow */}
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 animate-pulse"></div>
        {/* Center icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles
            className={`${iconSizes[size]} text-primary animate-pulse`}
          />
        </div>
      </div>

      {/* Loading text */}
      {(text || subText) && (
        <div className="text-center">
          {text && (
            <p
              className={`${textSizes[size].main} font-semibold text-gray-900 dark:text-white mb-1`}
            >
              {text}
            </p>
          )}
          {subText && (
            <p
              className={`${textSizes[size].sub} text-gray-600 dark:text-white/60`}
            >
              {subText}
            </p>
          )}
        </div>
      )}
    </div>
  );

  // Inline loading (no card, no full screen)
  if (!showCard && !fullScreen) {
    return spinnerContent;
  }

  // With card
  const cardContent = (
    <div className="relative bg-white dark:bg-[#0a0e0a] backdrop-blur-xl border border-gray-200 dark:border-[#1a1f1a] rounded-2xl p-8 shadow-2xl">
      {/* Glow Effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-100 transition-opacity duration-500 pointer-events-none"></div>
      <div className="relative z-10">{spinnerContent}</div>
    </div>
  );

  // Full screen loading
  if (fullScreen) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-primary/10 dark:from-background-dark dark:via-background-dark dark:to-primary/5 flex items-center justify-center p-4">
        {/* Animated Grid Background */}
        <div className="absolute inset-0 bg-grid z-0"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background-light/90 dark:via-background-dark/90 to-background-light dark:to-background-dark z-0"></div>

        <div className="relative z-10">
          {showCard ? cardContent : spinnerContent}
        </div>
      </div>
    );
  }

  // Just the card (no full screen)
  return cardContent;
}
