import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  containerClassName?: string;
  iconClassName?: string;
  size?: "sm" | "md" | "lg";
}

const sizeConfig = {
  sm: {
    container: "rounded-md",
    input: "h-8 px-3 text-xs pl-8",
    icon: "w-3.5 h-3.5 left-2.5",
  },
  md: {
    container: "rounded-lg",
    input: "h-10 px-4 text-sm pl-9",
    icon: "w-4 h-4 left-3",
  },
  lg: {
    container: "rounded-lg",
    input: "h-12 px-6 text-base pl-11",
    icon: "w-5 h-5 left-3.5",
  },
};

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    { className, containerClassName, iconClassName, size = "md", ...props },
    ref
  ) => {
    const config = sizeConfig[size];

    return (
      <div
        className={cn(
          "relative w-fit bg-white dark:bg-card-dark border border-border-light dark:border-primary/20 transition-colors duration-200",
          config.container,
          containerClassName
        )}
      >
        <Search
          className={cn(
            "absolute top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 dark:text-white/60",
            config.icon,
            iconClassName
          )}
        />
        <input
          ref={ref}
          type="text"
          className={cn(
            "w-full bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-0 transition-colors duration-200",
            config.input,
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
