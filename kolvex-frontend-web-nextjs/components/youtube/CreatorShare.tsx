"use client";

import { ContentLoading } from "@/components/ui/content-loading";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Link2,
  Loader2,
  Mail,
  Share2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import OpinionStrength from "./OpinionStrength";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useCopy } from "@/components/decision/shared";
import {
  getCreatorLatestVideo,
  getCreatorVideo,
  type CreatorLatestVideo,
} from "@/lib/youtubeOpinionsApi";
import {
  creatorEmailLink,
  creatorShareContent,
  creatorSocialLinks,
  creatorVideoSummary,
  sourceVideoUrl,
  type CreatorShareIdentity,
} from "@/lib/creatorSharing";
import type { CreatorShareDocument } from "@/lib/creatorShareImage";

type Preview = {
  url: string;
  file: File;
  page: number;
  document: CreatorShareDocument;
  height: number;
};
const canNativeShare = () =>
  typeof navigator !== "undefined" && typeof navigator.share === "function";
function canShareFile(file?: File) {
  try {
    return Boolean(file && canNativeShare() && navigator.canShare?.({ files: [file] }));
  } catch {
    return false;
  }
}

export default function CreatorShare({
  creator,
  videoId,
}: {
  creator: CreatorShareIdentity;
  videoId?: string;
}) {
  const scope = videoId ? "video" : "latest";
  const initialMode = videoId ? "image" : "link";
  const previewHeight = "h-[min(48dvh,28rem)]";
  const c = useCopy();
  const { locale, t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const appearanceRef = useRef<HTMLSpanElement>(null);
  const transcriptId = useId();
  const linkId = useId();
  const textId = useId();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"link" | "image">(initialMode);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CreatorLatestVideo | null>(null);
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(() => new Set());
  const [includeSummary, setIncludeSummary] = useState(true);
  const [plan, setPlan] = useState<{
    doc: CreatorShareDocument;
    selection: CreatorLatestVideo;
    revision: number;
  } | null>(null);
  const [page, setPage] = useState(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [sharing, setSharing] = useState(false);
  const videoSummary = creatorVideoSummary(data);
  const selection = useMemo(
    () =>
      data && {
        ...data,
        video: data.video && {
          ...data.video,
          video_summary: includeSummary ? creatorVideoSummary(data) || null : null,
        },
        opinions: data.opinions.filter((opinion) => !excluded.has(opinion.id)),
      },
    [data, excluded, includeSummary],
  );
  const language = locale === "zh" ? "zh" : "en";
  const content = creatorShareContent(creator, selection, language, scope);
  const empty = data && !data.opinions.length;
  const hasSelection = Boolean(selection?.opinions.length || selection?.video?.video_summary);
  const doc =
    plan &&
    plan.selection === selection &&
    plan.revision === revision &&
    plan.doc.locale === language &&
    plan.doc.appearance.mode === (resolvedTheme === "dark" ? "dark" : "light")
      ? plan.doc
      : null;

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    const request = videoId
      ? getCreatorVideo(creator.channel_id, videoId, controller.signal)
      : getCreatorLatestVideo(creator.channel_id, controller.signal);
    void request
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, creator.channel_id, videoId, revision]);

  useEffect(() => {
    if (
      !open ||
      mode !== "image" ||
      !selection?.creator ||
      !selection.video ||
      !(selection.opinions.length || selection.video.video_summary)
    )
      return;
    let disposed = false;
    setError("");
    async function prepare(data: CreatorLatestVideo) {
      try {
        const [image] = await Promise.all([
          import("@/lib/creatorShareImage"),
          document.fonts.ready,
        ]);
        if (disposed) return;
        const ctx = document.createElement("canvas").getContext("2d");
        if (!ctx || !appearanceRef.current) throw new Error("Share preview is unavailable");
        const doc = image.planCreatorShare(
          data,
          language,
          ctx,
          image.readCreatorShareAppearance(appearanceRef.current),
          t,
          scope,
        );
        setPage(0);
        setPlan({ doc, selection: data, revision });
      } catch {
        if (!disposed)
          setError(
            language === "zh"
              ? "图片生成失败，请重试。"
              : "Could not generate the images. Please retry.",
          );
      }
    }
    void prepare(selection);
    return () => {
      disposed = true;
    };
  }, [open, mode, selection, language, revision, resolvedTheme, scope, t]);

  // The displayed preview owns its URL until a replacement is committed or closed.
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview.url);
  }, [preview]);

  useEffect(() => {
    if (!open || mode !== "image" || !doc) return;
    let disposed = false;
    let url = "";
    let committed = false;
    setError("");
    setStatus("");
    async function render() {
      try {
        const image = await import("@/lib/creatorShareImage");
        const blob = await image.renderCreatorSharePage(doc!, page);
        if (disposed) return;
        url = URL.createObjectURL(blob);
        const decoded = new Image();
        decoded.src = url;
        await decoded.decode();
        if (disposed) return;
        committed = true;
        setPreview({
          url,
          file: new File([blob], image.creatorShareFilename(doc!, page), { type: "image/png" }),
          page,
          document: doc!,
          height: image.creatorSharePageHeight(doc!, page),
        });
      } catch {
        if (!disposed && url && !committed) {
          URL.revokeObjectURL(url);
          url = "";
        }
        if (!disposed)
          setError(
            locale === "zh"
              ? "图片导出失败，请重试。"
              : "Could not export the image. Please retry.",
          );
      }
    }
    void render();
    return () => {
      disposed = true;
      if (url && !committed) URL.revokeObjectURL(url);
    };
  }, [open, mode, doc, page, locale]);

  const visible = open && mode === "image" && doc && preview?.document === doc ? preview : null;
  const ready = visible?.page === page ? visible : null;
  function changeOpen(next: boolean) {
    setOpen(next);
    setMode(initialMode);
    setData(null);
    setPlan(null);
    setPreview(null);
    setExcluded(new Set());
    setIncludeSummary(true);
    setLoading(next);
    setLoadError(false);
    setError("");
    setStatus("");
    setPage(0);
  }
  function changeSelection(next: ReadonlySet<string>, summary = includeSummary) {
    setExcluded(next);
    setIncludeSummary(summary);
    setPlan(null);
    setPreview(null);
    setPage(0);
    setError("");
    setStatus("");
  }
  function retry() {
    setError("");
    setPlan(null);
    setPreview(null);
    setPage(0);
    setRevision((value) => value + 1);
  }
  async function copy(value: string) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setStatus(
        c("Copied. Paste it into your preferred app.", "已复制，可粘贴到社交媒体或聊天应用。"),
      );
    } catch {
      setStatus(
        c(
          "Select the link or text below and copy it manually.",
          "请选中下方链接或文案，手动复制。",
        ),
      );
    }
  }
  async function share(asImage: boolean) {
    if (!canNativeShare() || sharing || (asImage && (!ready || !canShareFile(ready.file)))) return;
    try {
      let payload: ShareData =
        asImage && ready
          ? {
              files: [ready.file],
              title: content.title,
              text: [content.headline, content.url].filter(Boolean).join("\n"),
            }
          : videoId
            ? { title: content.title, text: content.text }
            : { title: content.title, text: content.headline, url: content.url };
      if (asImage && ready && !navigator.canShare?.(payload)) payload = { files: [ready.file] };
      // Call immediately inside the click; PNGs are already prepared.
      const result = navigator.share(payload);
      setSharing(true);
      setStatus("");
      await result;
      setStatus(c("Opened the system share menu.", "已打开系统分享菜单。"));
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) {
        setStatus(
          c(
            "Use Copy link, Copy text or Save image to share in another app.",
            "可使用复制链接、复制文案或保存图片，在其他应用中分享。",
          ),
        );
      }
    } finally {
      setSharing(false);
    }
  }

  const label = videoId
    ? c("Share video opinions", "分享视频观点")
    : c("Share creator opinions", "分享博主观点");
  const source = sourceVideoUrl(data?.video);
  const totalCount = (data?.opinions.length ?? 0) + (videoSummary ? 1 : 0);
  const selectedCount =
    (selection?.opinions.length ?? 0) + (selection?.video?.video_summary ? 1 : 0);
  const allSelected = !excluded.size && (includeSummary || !videoSummary);
  const textOption = {
    value: "link" as const,
    label: videoId ? c("Text", "文案") : c("Link", "链接"),
    disabled: sharing,
  };
  const imageOption = { value: "image" as const, label: c("Image", "图片"), disabled: sharing };
  const textLoading = (
    <ContentLoading label={c("Loading opinions…", "正在加载观点…")} className="min-h-0">
      <div className="flex h-[10rem] flex-col gap-2.5 rounded-2xl border border-input px-3 py-2.5">
        <Skeleton className="h-3.5 w-full rounded-md" />
        <Skeleton className="h-3.5 w-11/12 rounded-md" />
        <Skeleton className="h-3.5 w-full rounded-md" />
        <Skeleton className="h-3.5 w-1/2 rounded-md" />
      </div>
    </ContentLoading>
  );
  const shareText = (
    <Textarea
      id={textId}
      aria-label={c("Share text", "分享文案")}
      readOnly
      value={content.text}
      rows={videoId ? 10 : 5}
      onFocus={(event) => event.currentTarget.select()}
      className="resize-none text-[0.8125rem] leading-6"
    />
  );

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          title={label}
          className="h-11 w-11 shrink-0 sm:h-9 sm:w-9"
        >
          <Share2 className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent layout="sheet" className="flex flex-col p-0 sm:max-h-[min(90dvh,54rem)]">
        {/* Snapshot of the site's tokens for the canvas export; never visible. */}
        <span ref={appearanceRef} aria-hidden="true" className="hidden rounded-3xl font-sans" />
        <DialogHeader className="shrink-0 space-y-1 px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription
            className={cn("mt-0 line-clamp-1 break-words", !data?.video?.video_title && "sr-only")}
          >
            {data?.video?.video_title ||
              (videoId
                ? c("Choose what to include.", "选择要分享的内容。")
                : c("Share the latest imported opinions.", "分享最新一期已收录观点。"))}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pb-4 sm:px-6">
          <SegmentedControl
            label={c("Share format", "分享形式")}
            semantics="tabs"
            options={videoId ? [imageOption, textOption] : [textOption, imageOption]}
            value={mode}
            onChange={(value) => {
              if (sharing) return;
              setMode(value);
              setStatus("");
            }}
            className="flex w-full"
            itemClassName="flex-1"
          />

          {mode === "image" && (
            <>
              {(loading || (hasSelection && !visible && !error && !loadError)) && (
                <ContentLoading
                  label={c("Generating the image…", "正在生成图片…")}
                  className={cn("mx-auto w-full min-h-0 items-center", previewHeight)}
                >
                  <Skeleton className="aspect-[4/5] h-full max-w-full rounded-3xl" />
                </ContentLoading>
              )}
              {visible && doc && (
                <>
                  <figure
                    aria-busy={!ready && !error}
                    className={cn(
                      "relative mx-auto flex w-full items-center justify-center",
                      previewHeight,
                    )}
                  >
                    {!ready && !error && (
                      <span
                        role="status"
                        className="absolute right-2 top-2 rounded-full bg-background p-2 text-muted-foreground"
                      >
                        <Loader2
                          className="h-4 w-4 animate-spin motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                        <span className="sr-only">
                          {c("Generating the image…", "正在生成图片…")}
                        </span>
                      </span>
                    )}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={visible.url}
                      width={1080}
                      height={visible.height}
                      alt={c(
                        `${doc.creator}, opinions, image ${visible.page + 1} of ${doc.pages.length}`,
                        `${doc.creator}观点，第 ${visible.page + 1} / ${doc.pages.length} 张`,
                      )}
                      aria-describedby={transcriptId}
                      className="block h-auto max-h-full w-auto max-w-full rounded-3xl border border-border bg-background"
                    />
                  </figure>
                  <div id={transcriptId} className="sr-only">
                    {doc.pages[visible.page].map((fragment, index) => (
                      <p key={index}>
                        {fragment.ticker}
                        {fragment.strength ? ` · ${fragment.strength.label}` : ""} ·{" "}
                        {fragment.lines.join("")}
                      </p>
                    ))}
                  </div>
                </>
              )}
              {doc && doc.pages.length > 1 && (
                <div className="flex items-center justify-center gap-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={c("Previous image", "上一张图片")}
                    disabled={page === 0 || sharing}
                    onClick={() => setPage((value) => value - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span role="status" className="text-sm tabular-nums">
                    {page + 1} / {doc.pages.length}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={c("Next image", "下一张图片")}
                    disabled={page === doc.pages.length - 1 || sharing}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}

          {mode === "link" && !videoId && (
            <>
              <div className="space-y-2">
                <label htmlFor={linkId} className="text-sm font-medium">
                  {c("Public share link", "公开分享链接")}
                </label>
                <Input
                  id={linkId}
                  readOnly
                  value={content.url}
                  onFocus={(event) => event.currentTarget.select()}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {creatorSocialLinks(content).map((platform) => (
                  <Button key={platform.name} variant="outline" size="sm" asChild>
                    <a href={platform.href} target="_blank" rel="noopener noreferrer">
                      {platform.name}
                    </a>
                  </Button>
                ))}
                <Button variant="outline" size="sm" asChild>
                  <a href={creatorEmailLink(content)} className="gap-2">
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    {c("Email", "邮件")}
                  </a>
                </Button>
              </div>
              <div className="space-y-2">
                <label htmlFor={textId} className="text-sm font-medium">
                  {c("Share text", "分享文案")}
                </label>
                {loading ? textLoading : shareText}
              </div>
            </>
          )}

          {mode === "link" && videoId && (loading ? textLoading : hasSelection && shareText)}

          {!loading && !loadError && (empty || (videoId && data && !hasSelection)) && (
            <p className="py-3 text-center text-sm text-muted-foreground">
              {empty && !videoSummary
                ? videoId
                  ? c("This video has no imported opinions.", "这支视频暂无已收录观点。")
                  : c("This creator has no imported opinions yet.", "这位博主暂无已收录观点。")
                : c("Select at least one item to share.", "请至少选择一项内容。")}
            </p>
          )}
          {(loadError || error) && (
            <div role="alert" className="flex flex-col items-center gap-3 py-2 text-center">
              <p className="text-sm text-muted-foreground">
                {loadError
                  ? videoId
                    ? c("Could not load this video's opinions.", "这支视频的观点加载失败。")
                    : c(
                        "Latest opinions could not be loaded. You can still share the link.",
                        "最新观点加载失败，仍可分享链接。",
                      )
                  : error}
              </p>
              <Button variant="outline" size="sm" onClick={retry}>
                {c("Retry", "重试")}
              </Button>
            </div>
          )}

          {videoId && data && totalCount > 0 && (
            <div role="group" aria-labelledby={`${transcriptId}-include`} className="min-w-0">
              <div className="flex items-center justify-between gap-3 pb-1">
                <h3 id={`${transcriptId}-include`} className="text-sm font-semibold">
                  {c("Include", "包含内容")}
                  <span className="ml-2 font-normal tabular-nums text-muted-foreground">
                    {selectedCount} / {totalCount}
                  </span>
                </h3>
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={sharing}
                  onClick={() =>
                    allSelected
                      ? changeSelection(new Set(data.opinions.map(({ id }) => id)), false)
                      : changeSelection(new Set(), true)
                  }
                >
                  {allSelected ? c("Clear all", "取消全选") : c("Select all", "全选")}
                </Button>
              </div>
              <ul className="divide-y divide-border/70">
                {videoSummary && (
                  <li>
                    <label
                      htmlFor={`${transcriptId}-summary`}
                      className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl py-2.5 pr-1 focus-within:bg-muted"
                    >
                      <Checkbox
                        id={`${transcriptId}-summary`}
                        checked={includeSummary}
                        disabled={sharing}
                        className="mt-0.5 h-5 w-5 focus-visible:ring-2 focus-visible:ring-ring"
                        onCheckedChange={(checked) => changeSelection(excluded, checked === true)}
                      />
                      <span className="min-w-0 space-y-0.5">
                        <span className="block text-sm font-semibold">
                          {c("Video summary", "视频概括")}
                        </span>
                        <span className="line-clamp-2 break-words text-xs leading-5 text-muted-foreground">
                          {videoSummary}
                        </span>
                      </span>
                    </label>
                  </li>
                )}
                {data.opinions.map((opinion, index) => {
                  const id = `${transcriptId}-option-${index}`;
                  const summary =
                    opinion.summary || opinion.thesis || opinion.key_points?.join(" ");
                  return (
                    <li key={opinion.id}>
                      <label
                        htmlFor={id}
                        className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl py-2.5 pr-1 focus-within:bg-muted"
                      >
                        <Checkbox
                          id={id}
                          aria-label={opinion.ticker}
                          checked={!excluded.has(opinion.id)}
                          disabled={sharing}
                          className="mt-0.5 h-5 w-5 focus-visible:ring-2 focus-visible:ring-ring"
                          onCheckedChange={(checked) => {
                            const next = new Set(excluded);
                            if (checked) next.delete(opinion.id);
                            else next.add(opinion.id);
                            changeSelection(next);
                          }}
                        />
                        <span className="min-w-0 space-y-0.5">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
                            {opinion.ticker}
                            <OpinionStrength value={opinion.direction_score} />
                            {opinion.sentiment === "mixed" && (
                              <span className="text-xs text-warning">
                                {t("youtubeOpinions.mixed")}
                              </span>
                            )}
                          </span>
                          {summary && (
                            <span className="line-clamp-2 break-words text-xs leading-5 text-muted-foreground">
                              {summary}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <div className="shrink-0 space-y-2 border-t border-border/70 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-5">
          <p
            role="status"
            aria-live="polite"
            className={status ? "text-center text-xs text-muted-foreground" : "sr-only"}
          >
            {status}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {mode === "image" && visible && (
              <>
                <Button asChild disabled={!ready} className="flex-1 gap-2 sm:flex-none">
                  <a
                    href={ready?.url}
                    download={ready?.file.name}
                    aria-disabled={!ready}
                    onClick={(event) => {
                      if (!ready) {
                        event.preventDefault();
                        return;
                      }
                      setStatus(c("Image download started.", "已开始下载图片。"));
                    }}
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {c("Save image", "保存图片")}
                  </a>
                </Button>
                {canShareFile(visible.file) && (
                  <Button
                    variant="outline"
                    disabled={sharing || !ready}
                    onClick={() => void share(true)}
                    className="flex-1 gap-2 sm:flex-none"
                  >
                    <Share2 className="h-4 w-4" aria-hidden="true" />
                    {c("Share image", "分享图片")}
                  </Button>
                )}
              </>
            )}
            {mode === "link" && !videoId && (
              <>
                <Button
                  onClick={() => void copy(content.url)}
                  className="flex-1 gap-2 sm:flex-none"
                >
                  <Link2 className="h-4 w-4" aria-hidden="true" />
                  {c("Copy link", "复制链接")}
                </Button>
                <Button
                  variant="outline"
                  disabled={loading}
                  onClick={() => void copy(content.text)}
                  className="flex-1 gap-2 sm:flex-none"
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  {c("Copy text", "复制文案")}
                </Button>
                {canNativeShare() && (
                  <Button
                    variant="outline"
                    disabled={sharing}
                    onClick={() => void share(false)}
                    className="flex-1 gap-2 sm:flex-none"
                  >
                    <Share2 className="h-4 w-4" aria-hidden="true" />
                    {c("More apps", "更多应用")}
                  </Button>
                )}
              </>
            )}
            {mode === "link" && videoId && hasSelection && !loading && (
              <>
                <Button
                  onClick={() => void copy(content.text)}
                  className="flex-1 gap-2 sm:flex-none"
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  {c("Copy text", "复制文案")}
                </Button>
                {canNativeShare() && (
                  <Button
                    variant="outline"
                    disabled={sharing}
                    className="flex-1 gap-2 sm:flex-none"
                    onClick={() => void share(false)}
                  >
                    <Share2 className="h-4 w-4" aria-hidden="true" />
                    {c("Share text", "分享文案")}
                  </Button>
                )}
              </>
            )}
            {videoId && source && (
              <Button variant="ghost" size="sm" asChild className="ml-auto gap-1.5">
                <a href={source} target="_blank" rel="noopener noreferrer">
                  {c("Source video", "原视频")}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
