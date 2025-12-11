"use client";

import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ContentWithModalProps {
  children: React.ReactNode;
  onOpenModal: () => void;
  ariaLabel?: string;
  className?: string;
}

/**
 * A reusable component that displays content with an external link button
 * that opens a modal when clicked.
 *
 * @param children - The content to display (text, summary, or any React node)
 * @param onOpenModal - Callback function to open the modal
 * @param ariaLabel - Accessible label for the button (default: "Open in modal")
 * @param className - Additional CSS classes for the container
 */
export default function ContentWithModal({
  children,
  onOpenModal,
  ariaLabel = "Open in modal",
  className = "",
}: ContentWithModalProps) {
  return (
    <div className={`text-sm ${className}`}>
      <div className="flex items-start gap-2 group">
        <div className="flex-1">{children}</div>
        <Button
          variant="link"
          size="xs"
          onClick={(e) => {
            e.stopPropagation();
            onOpenModal();
          }}
          aria-label={ariaLabel}
          className="flex items-center gap-1 text-[8px]"
        >
          Details <ExternalLink className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}
