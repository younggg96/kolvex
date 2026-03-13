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
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  const borderWidths = {
    sm: "border-2",
    md: "border-[3px]",
    lg: "border-4",
  };

  const textSizes = {
    sm: { main: "text-sm", sub: "text-xs" },
    md: { main: "text-base", sub: "text-sm" },
    lg: { main: "text-lg", sub: "text-sm" },
  };

  const spinnerContent = (
    <div className="flex flex-col items-center gap-4">
      <div className={`relative ${sizeClasses[size]}`}>
        <div className={`absolute inset-0 rounded-full ${borderWidths[size]} border-border`} />
        <div className={`absolute inset-0 rounded-full ${borderWidths[size]} border-transparent border-t-primary animate-spin`} />
      </div>

      {(text || subText) && (
        <div className="text-center">
          {text && (
            <p className={`${textSizes[size].main} font-semibold text-foreground mb-0.5`}>
              {text}
            </p>
          )}
          {subText && (
            <p className={`${textSizes[size].sub} text-muted-foreground`}>
              {subText}
            </p>
          )}
        </div>
      )}
    </div>
  );

  if (!showCard && !fullScreen) {
    return spinnerContent;
  }

  const cardContent = (
    <div className="bg-card border border-border rounded-2xl p-8">
      {spinnerContent}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        {showCard ? cardContent : spinnerContent}
      </div>
    );
  }

  return cardContent;
}
