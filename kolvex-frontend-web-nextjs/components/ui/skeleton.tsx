import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse motion-reduce:animate-none rounded-2xl bg-foreground/[0.07]",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
