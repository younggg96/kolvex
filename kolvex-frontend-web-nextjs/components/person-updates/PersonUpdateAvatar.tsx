import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function PersonUpdateAvatar({
  label,
  src,
  fedOfficial,
  className,
}: {
  label: string;
  src?: string | null;
  fedOfficial: boolean;
  className?: string;
}) {
  return (
    <Avatar aria-hidden="true" className={className}>
      {!fedOfficial && src && (
        <AvatarImage src={src} alt="" referrerPolicy="no-referrer" className="object-cover" />
      )}
      <AvatarFallback
        className={cn(
          "text-sm font-semibold text-foreground",
          fedOfficial && "bg-foreground font-bold tracking-wide text-background",
        )}
      >
        {fedOfficial ? "FED" : Array.from(label)[0]}
      </AvatarFallback>
    </Avatar>
  );
}
