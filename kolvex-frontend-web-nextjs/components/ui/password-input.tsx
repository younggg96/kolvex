"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import { Input, type InputProps } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n";

export interface PasswordInputProps extends Omit<InputProps, "type"> {}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, variant, disabled, id, ...props }, ref) => {
    const { t } = useTranslation();
    const [showPassword, setShowPassword] = React.useState(false);
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const label = t(showPassword ? "auth.hidePassword" : "auth.showPassword");

    return (
      <div className="relative">
        <Input
          {...props}
          id={inputId}
          type={showPassword ? "text" : "password"}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          variant={variant}
          disabled={disabled}
          className={cn("pr-12", className)}
          ref={ref}
        />
        <button
          type="button"
          onClick={() => setShowPassword((value) => !value)}
          aria-label={label}
          title={label}
          aria-pressed={showPassword}
          aria-controls={inputId}
          disabled={disabled}
          className={cn(
            "absolute right-1 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/60 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
            variant === "auth" ? "h-10 w-10" : "h-8 w-8",
          )}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
export { PasswordInput };
