import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] min-w-0 w-full rounded-xl border border-transparent bg-muted px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:border-foreground/60 focus-visible:bg-background disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-150 resize-y",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
