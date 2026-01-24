"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { UserPlus, Loader2, AtSign, Info } from "lucide-react";

interface RequestKOLModalProps {
  onSuccess?: () => void;
}

export function RequestKOLModal({ onSuccess }: RequestKOLModalProps) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanUsername = username.trim().replace(/^@/, "");
    if (!cleanUsername) {
      toast.error("Please enter a valid username");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/kol-tracking-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platform: "twitter",
          platform_user_id: cleanUsername,
          user_notes: notes.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit request");
      }

      toast.success(`Request submitted for @${cleanUsername}`, {
        description: "Your request will be reviewed by our team.",
      });

      setUsername("");
      setNotes("");
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit request"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <UserPlus className="w-4 h-4" />
          Request KOL
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image
              src="/logo/x.svg"
              alt="X"
              width={20}
              height={20}
              className="dark:invert"
            />
            Request New KOL
          </DialogTitle>
          <DialogDescription>
            Submit a request to track a KOL on X (Twitter). Our team will review
            and approve valid requests.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label
              htmlFor="username"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              X Username <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="username"
                placeholder="elonmusk"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="pl-9"
                disabled={isSubmitting}
                autoComplete="off"
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Enter the username without the @ symbol
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="notes"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Notes (Optional)
            </label>
            <Textarea
              id="notes"
              placeholder="Why do you want to track this KOL? (e.g., Financial expert, Stock analyst...)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none"
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Requests are typically reviewed within 24-48 hours. Approved KOLs
              will be automatically added to the tracking system.
            </p>
          </div>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting || !username.trim()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Request"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
