"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { proxyImageUrl } from "@/lib/utils";
import Image from "next/image";

interface ImageGalleryProps {
  imageUrls: string[];
  imageSize?: number;
  className?: string;
}

export default function ImageGallery({
  imageUrls,
  imageSize = 120,
  className = "",
}: ImageGalleryProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const imageCount = imageUrls.length;

  const openModal = (index: number) => {
    setSelectedImageIndex(index);
    setIsModalOpen(true);
  };

  const goToPrevImage = useCallback(() => {
    setSelectedImageIndex((prev) => (prev === 0 ? imageCount - 1 : prev - 1));
  }, [imageCount]);

  const goToNextImage = useCallback(() => {
    setSelectedImageIndex((prev) => (prev === imageCount - 1 ? 0 : prev + 1));
  }, [imageCount]);

  // 键盘导航
  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goToPrevImage();
      else if (e.key === "ArrowRight") goToNextImage();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, goToPrevImage, goToNextImage]);

  if (imageUrls.length === 0) return null;

  return (
    <>
      {/* 图片网格 */}
      <div className={`flex flex-wrap gap-1.5 ${className}`}>
        {imageUrls.map((url, index) => (
          <div
            key={index}
            style={{ width: imageSize, height: imageSize }}
            className="relative rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => openModal(index)}
          >
            <Image
              src={proxyImageUrl(url)}
              alt={`Image ${index + 1}`}
              fill
              sizes={`${imageSize}px`}
              className="object-cover"
            />
          </div>
        ))}
      </div>

      {/* 图片查看 Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="!p-0 max-w-[90vw] w-[90vw] lg:!max-w-[600px] !h-fit !mx-auto border-none overflow-hidden">
          <DialogTitle className="sr-only">Image view</DialogTitle>

          {/* 主图片区域 */}
          <div className="relative flex items-center justify-center h-fit px-2 py-2 md:py-6">
            {imageUrls[selectedImageIndex] && (
              <Image
                src={proxyImageUrl(imageUrls[selectedImageIndex])}
                alt={`Image ${selectedImageIndex + 1}`}
                width={1200}
                height={900}
                className="max-h-[80vh] max-w-full w-auto object-contain"
                priority
              />
            )}

            {/* 左右切换箭头 */}
            {imageCount > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToPrevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 !rounded-full !p-0"
                >
                  <ChevronLeft className="w-8 h-8 text-white hover:text-white/80 bg-black/50 hover:bg-black/80 p-1 rounded-full" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToNextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 !rounded-full !p-0"
                >
                  <ChevronRight className="w-8 h-8 text-white hover:text-white/80 bg-black/50 hover:bg-black/80 p-1 rounded-full" />
                </Button>
              </>
            )}
          </div>

          {/* 底部导航点 + 计数器 */}
          {imageCount > 1 && (
            <div className="flex items-center justify-center gap-2 py-3">
              <span className="text-white/70 text-xs mr-2">
                {selectedImageIndex + 1} / {imageCount}
              </span>
              {imageUrls.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImageIndex(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === selectedImageIndex
                      ? "bg-white"
                      : "bg-white/30 hover:bg-white/50"
                  }`}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
