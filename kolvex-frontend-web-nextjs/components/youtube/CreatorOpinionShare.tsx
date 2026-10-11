"use client";

import { useEffect, useId, useState } from "react";
import { ChevronLeft, ChevronRight, Download, ImagePlus, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import { useCopy } from "@/components/decision/shared";
import { getCreatorLatestVideo, type YouTubeCreatorSummary } from "@/lib/youtubeOpinionsApi";
import type { CreatorShareDocument } from "@/lib/creatorShareImage";

type Preview = { url: string; file: File; page: number; document: CreatorShareDocument };

function canShareFile(file?: File) {
  try {
    return Boolean(file && typeof navigator !== "undefined" && typeof navigator.share === "function" && navigator.canShare?.({ files: [file] }));
  } catch { return false; }
}

export default function CreatorOpinionShare({ creator }: { creator: YouTubeCreatorSummary }) {
  const c = useCopy();
  const { locale } = useTranslation();
  const transcriptId = useId();
  const [open, setOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [doc, setDoc] = useState<CreatorShareDocument | null>(null);
  const [page, setPage] = useState(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [empty, setEmpty] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setDoc(null);
    setPreview(null);
    setEmpty(false);
    setError("");
    setStatus("");
    setPage(0);
    async function load() {
      try {
        const [data, image] = await Promise.all([
          getCreatorLatestVideo(creator.channel_id, controller.signal),
          import("@/lib/creatorShareImage"),
          document.fonts.ready,
        ]);
        if (controller.signal.aborted) return;
        if (!data.creator || !data.video || !data.opinions.length) { setEmpty(true); return; }
        const ctx = document.createElement("canvas").getContext("2d");
        if (!ctx) throw new Error("Canvas is unavailable");
        setDoc(image.planCreatorShare(data, locale === "zh" ? "zh" : "en", ctx));
      } catch {
        if (!controller.signal.aborted) setError(locale === "zh" ? "图片生成失败，请重试。" : "Could not generate the images. Please retry.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [open, creator.channel_id, locale, revision]);

  useEffect(() => {
    if (!open || !doc) return;
    let disposed = false;
    let url = "";
    setPreview(null);
    setError("");
    setStatus("");
    async function render() {
      try {
        const image = await import("@/lib/creatorShareImage");
        const blob = await image.renderCreatorSharePage(doc!, page);
        if (disposed) return;
        url = URL.createObjectURL(blob);
        setPreview({ url, file: new File([blob], image.creatorShareFilename(doc!, page), { type: "image/png" }), page, document: doc! });
      } catch {
        if (!disposed) setError(locale === "zh" ? "图片导出失败，请重试。" : "Could not export the image. Please retry.");
      }
    }
    void render();
    return () => { disposed = true; if (url) URL.revokeObjectURL(url); };
  }, [open, doc, page, locale]);

  const ready = open && doc && preview?.document === doc && preview.page === page ? preview : null;
  function changeOpen(next: boolean) {
    setOpen(next);
    setDoc(null);
    setPreview(null);
    setLoading(next);
    setEmpty(false);
    setError("");
    setStatus("");
    setPage(0);
  }
  async function share() {
    if (!ready || !canShareFile(ready.file) || sharing) return;
    try {
      // PNG is ready before this click, preserving the browser's user activation.
      const result = navigator.share({ files: [ready.file], title: doc?.creator });
      setSharing(true);
      setStatus("");
      await result;
      setStatus(c("Opened the system share menu.", "已打开系统分享菜单。"));
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) {
        setStatus(c("Sharing is unavailable. Save the image and share it from your photos.", "无法打开分享，请先保存图片，再从相册分享。"));
      }
    } finally { setSharing(false); }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0 gap-1.5">
          <ImagePlus className="h-4 w-4" aria-hidden="true" />{c("Share image", "分享图片")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{c("Share the latest opinions", "分享博主最新观点")}</DialogTitle>
          <DialogDescription>{c("All stock summaries from the latest imported video. Long content is split across images.", "生成最新一期已收录视频的全部股票观点摘要，内容较多时自动分图。")}</DialogDescription>
        </DialogHeader>
        <div className="mt-5 space-y-4">
          {(loading || (doc && !ready && !error)) && (
            <div role="status" className="mx-auto flex aspect-[3/4] w-full max-w-[360px] items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              {c("Generating the image…", "正在生成图片…")}
            </div>
          )}
          {empty && <p className="py-12 text-center text-sm text-muted-foreground">{c("This creator has no imported opinions yet.", "这位博主暂无已收录观点。")}</p>}
          {error && <div role="alert" className="space-y-3 py-8 text-center"><p className="text-sm text-muted-foreground">{error}</p><Button variant="outline" onClick={() => setRevision((value) => value + 1)}>{c("Retry", "重试")}</Button></div>}
          {ready && doc && (
            <>
              <figure className="mx-auto max-w-[360px] overflow-hidden rounded-xl border border-border bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ready.url} width={1080} height={1440} alt={c(`${doc.creator}, latest opinions, image ${page + 1} of ${doc.pages.length}`, `${doc.creator}最新观点，第 ${page + 1} / ${doc.pages.length} 张`)} aria-describedby={transcriptId} className="block h-auto w-full" />
              </figure>
              <div id={transcriptId} className="sr-only">{doc.pages[page].map((fragment, index) => <p key={index}>{fragment.ticker} · {fragment.sentiment} · {fragment.lines.join("")}</p>)}</div>
            </>
          )}
          {doc && doc.pages.length > 1 && <div className="flex items-center justify-center gap-4">
            <Button variant="ghost" size="icon" aria-label={c("Previous image", "上一张图片")} disabled={page === 0 || sharing} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span role="status" className="text-sm tabular-nums">{page + 1} / {doc.pages.length}</span>
            <Button variant="ghost" size="icon" aria-label={c("Next image", "下一张图片")} disabled={page === doc.pages.length - 1 || sharing} onClick={() => setPage((value) => value + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>}
          {ready && <div className="flex flex-wrap justify-center gap-2">
            <Button asChild className="gap-2"><a href={ready.url} download={ready.file.name} onClick={() => setStatus(c("Image download started.", "已开始下载图片。"))}><Download className="h-4 w-4" aria-hidden="true" />{c("Save image", "保存图片")}</a></Button>
            {canShareFile(ready.file) && <Button variant="outline" disabled={sharing} onClick={() => void share()} className="gap-2"><Share2 className="h-4 w-4" aria-hidden="true" />{c("Share image", "分享图片")}</Button>}
          </div>}
          {ready && <p className="text-center text-xs text-muted-foreground">{c("Save each image or press and hold it, then share it in your preferred app.", "可逐张保存或长按图片，再发送到微信、小红书等应用。")}</p>}
          {doc?.source && <p className="text-center text-xs"><a href={doc.source} target="_blank" rel="noopener noreferrer" className="text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{c("View source video", "查看原视频")}</a></p>}
          <p role="status" aria-live="polite" className="min-h-5 text-center text-xs text-muted-foreground">{status}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
