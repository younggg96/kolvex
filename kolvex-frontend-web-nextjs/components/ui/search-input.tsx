import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface SearchInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string;
  iconClassName?: string;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, containerClassName, iconClassName, ...props }, ref) => {
    return (
      <div
        className={cn(
          "relative w-fit bg-white dark:bg-card-dark rounded-lg border border-border-light dark:border-primary/20 transition-colors duration-200",
          containerClassName
        )}
      >
        <Search
          className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-xs text-gray-500 dark:text-white/60",
            iconClassName
          )}
        />
        <Input
          ref={ref}
          className={cn(
            "pl-9 w-full !border-none text-gray-500 dark:text-white/60",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";

export { SearchInput };
