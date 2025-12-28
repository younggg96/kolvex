"use client";

import { useState, useEffect } from "react";
import { Copy, Mail, MessageCircle, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

// Social Media Icons
const XIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const FacebookIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const LinkedInIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const TelegramIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

export interface ShareDropdownProps {
  /** The URL to share */
  shareLink: string;
  /** The text/message to share */
  shareText: string;
  /** Email subject line (optional) */
  emailSubject?: string;
  /** Button variant */
  variant?:
    | "default"
    | "ghost"
    | "outline"
    | "secondary"
    | "destructive"
    | "link";
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon";
  /** Additional class names for the trigger button */
  className?: string;
  /** Show label text on larger screens */
  showLabel?: boolean;
  /** Custom label text */
  label?: string;
  /** Toast message when link is copied */
  copySuccessMessage?: string;
}

export function ShareDropdown({
  shareLink,
  shareText,
  emailSubject,
  variant = "ghost",
  size = "sm",
  className = "",
  showLabel = true,
  label = "Share",
  copySuccessMessage = "Share link copied to clipboard",
}: ShareDropdownProps) {
  const [canUseNativeShare, setCanUseNativeShare] = useState(false);

  useEffect(() => {
    // Check if Web Share API is supported (typically on mobile devices)
    setCanUseNativeShare(
      typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        // Also check if it's likely a mobile device for better UX
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        )
    );
  }, []);

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: emailSubject || shareText,
        text: shareText,
        url: shareLink,
      });
    } catch (error) {
      // User cancelled or share failed - silently ignore
      if ((error as Error).name !== "AbortError") {
        console.error("Share failed:", error);
      }
    }
  };

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    toast.success(copySuccessMessage);
  };

  const handleShareTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      shareText
    )}&url=${encodeURIComponent(shareLink)}`;
    window.open(twitterUrl, "_blank", "noopener,noreferrer");
  };

  const handleShareFacebook = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      shareLink
    )}`;
    window.open(facebookUrl, "_blank", "noopener,noreferrer");
  };

  const handleShareLinkedIn = () => {
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
      shareLink
    )}`;
    window.open(linkedInUrl, "_blank", "noopener,noreferrer");
  };

  const handleShareWhatsApp = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
      `${shareText} ${shareLink}`
    )}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const handleShareTelegram = () => {
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(
      shareLink
    )}&text=${encodeURIComponent(shareText)}`;
    window.open(telegramUrl, "_blank", "noopener,noreferrer");
  };

  const handleShareEmail = () => {
    const subject = encodeURIComponent(emailSubject || shareText);
    const body = encodeURIComponent(`${shareText}\n\n${shareLink}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  // On mobile devices with native share support, use a simple button
  if (canUseNativeShare) {
    return (
      <Button
        variant={variant}
        size={size}
        className={`gap-2 ${className}`}
        onClick={handleNativeShare}
      >
        <Share className="w-4 h-4" />
        {showLabel && <span className="hidden sm:inline">{label}</span>}
      </Button>
    );
  }

  // On desktop, use dropdown menu
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={`gap-2 ${className}`}>
          <Share className="w-4 h-4" />
          {showLabel && <span className="hidden sm:inline">{label}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleCopyShareLink}>
          <Copy className="w-4 h-4" />
          Copy Link
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleShareTwitter}>
          <XIcon />
          Share on X
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleShareFacebook}>
          <FacebookIcon />
          Share on Facebook
        </DropdownMenuItem>
        {/* <DropdownMenuItem onClick={handleShareLinkedIn}>
          <LinkedInIcon />
          Share on LinkedIn
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleShareWhatsApp}>
          <MessageCircle className="w-4 h-4" />
          Share via WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleShareTelegram}>
          <TelegramIcon />
          Share via Telegram
        </DropdownMenuItem> */}
        <DropdownMenuItem onClick={handleShareEmail}>
          <Mail className="w-4 h-4" />
          Share via Email
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
