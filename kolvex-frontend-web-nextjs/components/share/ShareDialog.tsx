"use client";

import { useEffect, useId, useState } from "react";
import { Copy, Download, Link2, Loader2, Mail, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCopy } from "@/components/decision/shared";
import { useTranslation } from "@/lib/i18n";
import {
  SHARE_KIND_LABELS,
  shareEmailLink,
  shareHeadline,
  sharePath,
  shareSocialLinks,
  shareText,
  shareUrl,
  type ContentShare,
  type ShareCard,
  type ShareTarget,
} from "@/lib/contentShare";
import { ShareRequestError, createShare, revokeShare } from "@/lib/contentShareApi";
import { SharedCard } from "./SharedCard";

type Phase = "confirm" | "creating" | "ready" | "error" | "revoked";

const canNativeShare = () =>
  typeof navigator !== "undefined" && typeof navigator.share === "function";
function canShareFile(file: File | null) {
  try {
    return Boolean(file && canNativeShare() && navigator.canShare?.({ files: [file] }));
  } catch {
    return false;
  }
}

export interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ShareTarget;
  /** Private sources (chat) show this local preview and wait for an explicit "Create link". */
  preview?: ShareCard;
}

export function ShareDialog({ open, onOpenChange, target, preview }: ShareDialogProps) {
  const c = useCopy();
  const { locale } = useTranslation();
  const zh = locale === "zh";
  const linkId = useId();
  const questionId = useId();
  const confirmFirst = target.kind === "chat";
  const [phase, setPhase] = useState<Phase>(confirmFirst ? "confirm" : "creating");
  const [includeQuestion, setIncludeQuestion] = useState(true);
  const [share, setShare] = useState<ContentShare | null>(null);
  const [errorCode, setErrorCode] = useState("");
  const [status, setStatus] = useState("");
  const [tab, setTab] = useState<"link" | "image">("link");
  const [image, setImage] = useState<{ url: string; file: File } | null>(null);
  const [imageError, setImageError] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [imageAttempt, setImageAttempt] = useState(0);
  const hasQuestion = Boolean(
    preview && typeof preview.data.question === "string" && preview.data.question,
  );

  // Reset whenever the dialog opens for a (possibly different) target.
  useEffect(() => {
    if (!open) return;
    setPhase(confirmFirst ? "confirm" : "creating");
    setShare(null);
    setErrorCode("");
    setStatus("");
    setTab("link");
    setImage(null);
    setImageError(false);
    setConfirmRevoke(false);
  }, [open, confirmFirst, target.kind, target.sourceId, target.excerpt]);

  useEffect(() => {
    if (!open || phase !== "creating") return;
    let cancelled = false;
    createShare(target, zh ? "zh" : "en", includeQuestion)
      .then((result) => {
        if (cancelled) return;
        setShare(result);
        setPhase("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setErrorCode(error instanceof ShareRequestError ? error.code : "unavailable");
        setPhase("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one request per attempt
  }, [open, phase, attempt]);

  useEffect(() => {
    if (!open || tab !== "image" || !share || image) return;
    let disposed = false;
    let url = "";
    setImageError(false);
    fetch(`${sharePath(share.id)}/opengraph-image`)
      .then((response) => {
        if (!response.ok) throw new Error("image");
        return response.blob();
      })
      .then((blob) => {
        if (disposed) return;
        url = URL.createObjectURL(blob);
        setImage({ url, file: new File([blob], `kolvex-${share.id}.png`, { type: "image/png" }) });
      })
      .catch(() => !disposed && setImageError(true));
    return () => {
      disposed = true;
    };
  }, [open, tab, share, image, imageAttempt]);

  useEffect(() => {
    if (!image) return;
    return () => URL.revokeObjectURL(image.url);
  }, [image]);

  const link = share
    ? shareUrl(share.id, typeof window === "undefined" ? undefined : window.location.origin)
    : "";
  const headline = share ? shareHeadline(share, zh) : "";
  const text = share ? shareText(share, zh, link) : "";

  async function copy(value: string, done: string) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(done);
    } catch {
      setStatus(c("Select the link and copy it manually.", "请手动选中链接复制。"));
    }
  }

  async function nativeShare(withImage: boolean) {
    if (!share || busy) return;
    const payload: ShareData =
      withImage && image
        ? { files: [image.file], title: headline, text: link }
        : { title: headline, text: headline, url: link };
    try {
      const pending = navigator.share(payload);
      setBusy(true);
      await pending;
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) {
        setStatus(c("Copy the link or text instead.", "可改用复制链接或文案。"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!share || busy) return;
    setBusy(true);
    try {
      await revokeShare(share.id);
      setPhase("revoked");
    } catch {
      setStatus(c("Could not stop sharing. Please retry.", "停止分享失败，请重试。"));
    } finally {
      setBusy(false);
      setConfirmRevoke(false);
    }
  }

  const errorText: Record<string, string> = {
    excerpt_not_found: c(
      "The selected text could not be matched to this answer. Share the whole answer instead.",
      "所选文字与回答原文对不上，请改为分享整条回答。",
    ),
    not_found: c("This content is no longer available.", "这条内容已不存在。"),
    rate_limited: c(
      "Too many links today. Try again tomorrow.",
      "今天创建的链接太多了，请明天再试。",
    ),
    unauthorized: c("Sign in to create a share link.", "登录后才能创建分享链接。"),
  };

  const shown = share?.card ?? preview;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-xl overflow-y-auto pb-5 pt-8">
        <DialogHeader>
          <DialogTitle>
            {c("Share", "分享")} · {c(...SHARE_KIND_LABELS[target.kind])}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {c("Create a link, text or image of this content.", "为这条内容生成链接、文案或图片。")}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-3 space-y-4 font-sans">
          {shown ? (
            <div className="max-h-[36dvh] overflow-y-auto rounded-3xl">
              <SharedCard
                share={{
                  kind: target.kind,
                  card:
                    phase === "confirm" && !includeQuestion
                      ? { ...shown, data: { ...shown.data, question: "" } }
                      : shown,
                }}
                className="p-4 md:p-5"
              />
            </div>
          ) : (
            phase === "creating" && (
              <div
                role="status"
                aria-label={c("Creating the link…", "正在生成链接…")}
                className="space-y-2.5 rounded-3xl border border-border p-5"
              >
                <Skeleton className="h-4 w-1/3 rounded-md" />
                <Skeleton className="h-3.5 w-full rounded-md" />
                <Skeleton className="h-3.5 w-5/6 rounded-md" />
              </div>
            )
          )}

          {phase === "confirm" && (
            <div className="space-y-3">
              {hasQuestion && (
                <label htmlFor={questionId} className="flex items-center gap-2 text-sm">
                  <input
                    id={questionId}
                    type="checkbox"
                    checked={includeQuestion}
                    onChange={(event) => setIncludeQuestion(event.target.checked)}
                    className="h-4 w-4 accent-positive"
                  />
                  {c("Include my question", "附上我的提问")}
                </label>
              )}
              <p className="text-xs leading-relaxed text-muted-foreground">
                {c(
                  "Anyone with the link can read the content above without signing in. Check it holds nothing private, such as your holdings.",
                  "任何拿到链接的人无需登录即可看到上方内容，请确认其中没有持仓等个人信息。",
                )}
              </p>
              <Button className="w-full gap-2" onClick={() => setPhase("creating")}>
                <Link2 className="h-4 w-4" aria-hidden="true" />
                {c("Create share link", "创建分享链接")}
              </Button>
            </div>
          )}

          {phase === "creating" && shown && (
            <p
              role="status"
              className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
            >
              <Loader2
                className="h-4 w-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              {c("Creating the link…", "正在生成链接…")}
            </p>
          )}

          {phase === "error" && (
            <div role="alert" className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {errorText[errorCode] || c("Could not create the link.", "分享链接生成失败。")}
              </p>
              {errorCode === "unauthorized" ? (
                <Button asChild>
                  <a href="/auth">{c("Sign in", "登录")}</a>
                </Button>
              ) : (
                errorCode !== "not_found" &&
                errorCode !== "excerpt_not_found" && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAttempt((value) => value + 1);
                      setPhase("creating");
                    }}
                  >
                    {c("Retry", "重试")}
                  </Button>
                )
              )}
            </div>
          )}

          {phase === "revoked" && (
            <p role="status" className="text-sm text-muted-foreground">
              {c("Sharing stopped. The link no longer opens.", "已停止分享，链接已失效。")}
            </p>
          )}

          {phase === "ready" && share && (
            <Tabs
              value={tab}
              onValueChange={(value) => setTab(value === "image" ? "image" : "link")}
            >
              <TabsList>
                <TabsTrigger value="link">{c("Link & text", "链接与文案")}</TabsTrigger>
                <TabsTrigger value="image">{c("Image", "图片")}</TabsTrigger>
              </TabsList>

              <TabsContent value="link" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <label htmlFor={linkId} className="text-sm font-medium">
                    {c("Share link", "分享链接")}
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id={linkId}
                      readOnly
                      value={link}
                      onFocus={(event) => event.currentTarget.select()}
                    />
                    <Button
                      className="shrink-0 gap-2"
                      onClick={() => void copy(link, c("Link copied.", "链接已复制。"))}
                    >
                      <Link2 className="h-4 w-4" aria-hidden="true" />
                      {c("Copy", "复制")}
                    </Button>
                  </div>
                  {share.visibility === "signed_in" && (
                    <p className="text-xs text-muted-foreground">
                      {c(
                        "Options data is licensed to signed-in users: recipients sign in to read the details.",
                        "期权数据仅授权给登录用户：接收者需登录 Kolvex 才能看到详情。",
                      )}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {canNativeShare() && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void nativeShare(false)}
                      className="gap-1.5"
                    >
                      <Share2 className="h-4 w-4" aria-hidden="true" />
                      {c("More apps", "更多应用")}
                    </Button>
                  )}
                  {shareSocialLinks(link, headline).map((platform) => (
                    <Button key={platform.name} variant="outline" size="sm" asChild>
                      <a href={platform.href} target="_blank" rel="noopener noreferrer">
                        {zh ? platform.name : platform.nameEn || platform.name}
                      </a>
                    </Button>
                  ))}
                  <Button variant="outline" size="sm" asChild>
                    <a href={shareEmailLink(headline, text)} className="gap-1.5">
                      <Mail className="h-4 w-4" aria-hidden="true" />
                      {c("Email", "邮件")}
                    </a>
                  </Button>
                </div>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() =>
                    void copy(
                      text,
                      c(
                        "Text copied. Paste it into WeChat or any app.",
                        "文案已复制，可粘贴到微信、小红书等应用。",
                      ),
                    )
                  }
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  {c("Copy text with link", "复制文案（含链接）")}
                </Button>
              </TabsContent>

              <TabsContent value="image" className="mt-4 space-y-3">
                <figure className="flex aspect-[1200/630] w-full items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted/40">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image.url}
                      width={1200}
                      height={630}
                      alt={headline}
                      className="h-full w-full object-contain"
                    />
                  ) : imageError ? (
                    <span className="px-6 text-center text-sm text-muted-foreground">
                      {c("The image could not be generated.", "图片生成失败。")}
                    </span>
                  ) : (
                    <Skeleton
                      className="h-full w-full"
                      aria-label={c("Generating the image…", "正在生成图片…")}
                    />
                  )}
                </figure>
                {imageError && (
                  <Button variant="outline" onClick={() => setImageAttempt((value) => value + 1)}>
                    {c("Retry", "重试")}
                  </Button>
                )}
                {image && (
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button asChild className="gap-2">
                      <a href={image.url} download={image.file.name}>
                        <Download className="h-4 w-4" aria-hidden="true" />
                        {c("Save image", "保存图片")}
                      </a>
                    </Button>
                    {canShareFile(image.file) && (
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => void nativeShare(true)}
                        className="gap-2"
                      >
                        <Share2 className="h-4 w-4" aria-hidden="true" />
                        {c("Share image", "分享图片")}
                      </Button>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}

          {phase === "ready" && share && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              {confirmRevoke ? (
                <>
                  <span className="text-xs text-muted-foreground">
                    {c("The link will stop working for everyone.", "链接会对所有人失效。")}
                  </span>
                  <span className="flex gap-2">
                    <Button variant="ghost" size="xs" onClick={() => setConfirmRevoke(false)}>
                      {c("Keep", "保留")}
                    </Button>
                    <Button
                      variant="destructive"
                      size="xs"
                      disabled={busy}
                      onClick={() => void revoke()}
                    >
                      {c("Stop sharing", "停止分享")}
                    </Button>
                  </span>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-muted-foreground"
                  onClick={() => setConfirmRevoke(true)}
                >
                  {c("Stop sharing", "停止分享")}
                </Button>
              )}
            </div>
          )}

          <p
            role="status"
            aria-live="polite"
            className={status ? "text-center text-xs text-muted-foreground" : "sr-only"}
          >
            {status}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
