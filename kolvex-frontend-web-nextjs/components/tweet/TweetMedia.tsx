"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { proxyImageUrl } from "@/lib/utils";

interface TweetMediaProps {
  mediaUrls: string[];
}

export default function TweetMedia({ mediaUrls }: TweetMediaProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (mediaUrls.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-3">
        {mediaUrls.map((url, index) => {
          const isVideo = url.includes(".mp4");
          return isVideo ? (
            <div key={index} className="relative w-[120px] h-[120px]">
              <video
                src={url}
                controls
                className="w-full h-full rounded-lg object-cover"
              />
            </div>
          ) : (
            <div
              key={index}
              className="relative w-[120px] h-[120px] cursor-pointer group"
              onClick={() => setSelectedImage(url)}
            >
              <img
                src={proxyImageUrl(url)}
                alt={`Media ${index + 1}`}
                className="w-full h-full rounded-lg object-cover transition-opacity group-hover:opacity-90"
              />
            </div>
          );
        })}
      </div>

      <Dialog
        open={!!selectedImage}
        onOpenChange={(open) => !open && setSelectedImage(null)}
      >
        <DialogContent
          className="max-w-screen-lg w-fit p-0 bg-transparent border-none shadow-none overflow-hidden"
          aria-describedby={undefined}
        >
          <VisuallyHidden>
            <DialogTitle>Media Preview</DialogTitle>
          </VisuallyHidden>
          {selectedImage && (
            <img
              src={proxyImageUrl(selectedImage)}
              alt="Full size media"
              className="max-h-[90vh] w-auto h-auto object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
