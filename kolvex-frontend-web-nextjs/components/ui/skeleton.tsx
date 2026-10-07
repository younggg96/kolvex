import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-foreground/[0.07]",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
