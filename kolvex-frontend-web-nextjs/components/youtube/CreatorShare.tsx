"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { ChevronLeft, ChevronRight, Copy, Download, Link2, Loader2, Mail, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import { useCopy } from "@/components/decision/shared";
import { getCreatorLatestVideo, type CreatorLatestVideo } from "@/lib/youtubeOpinionsApi";
import { creatorEmailLink, creatorShareContent, creatorSocialLinks, sourceVideoUrl, type CreatorShareIdentity } from "@/lib/creatorSharing";
import type { CreatorShareDocument } from "@/lib/creatorShareImage";

type Preview = { url: string; file: File; page: number; document: CreatorShareDocument; height: number };
const canNativeShare = () => typeof navigator !== "undefined" && typeof navigator.share === "function";
function canShareFile(file?: File) {
  try { return Boolean(file && canNativeShare() && navigator.canShare?.({ files: [file] })); }
  catch { return false; }
}

export default function CreatorShare({ creator }: { creator: CreatorShareIdentity }) {
  const c = useCopy();
  const { locale, t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const appearanceRef = useRef<HTMLDivElement>(null);
  const transcriptId = useId();
  const linkId = useId();
  const textId = useId();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"link" | "image">("link");
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CreatorLatestVideo | null>(null);
  const [doc, setDoc] = useState<CreatorShareDocument | null>(null);
  const [page, setPage] = useState(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [empty, setEmpty] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [sharing, setSharing] = useState(false);
  const content = creatorShareContent(creator, data, locale === "zh" ? "zh" : "en");

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true); setData(null); setDoc(null); setPreview(null);
    setEmpty(false); setError(""); setStatus(""); setPage(0);
    async function load() {
      try {
        const result = await getCreatorLatestVideo(creator.channel_id, controller.signal);
        if (controller.signal.aborted) return;
        setData(result);
        if (!result.creator || !result.video || !result.opinions.length) { setEmpty(true); return; }
        // Link/social sharing never pays the cost of loading fonts and drawing PNGs.
        if (mode !== "image") return;
        const [image] = await Promise.all([import("@/lib/creatorShareImage"), document.fonts.ready]);
        if (controller.signal.aborted) return;
        const ctx = document.createElement("canvas").getContext("2d");
        if (!ctx || !appearanceRef.current) throw new Error("Share preview is unavailable");
        setDoc(image.planCreatorShare(result, locale === "zh" ? "zh" : "en", ctx, image.readCreatorShareAppearance(appearanceRef.current), t));
      } catch {
        if (!controller.signal.aborted) setError(mode === "image"
          ? locale === "zh" ? "图片生成失败，请重试。" : "Could not generate the images. Please retry."
          : locale === "zh" ? "最新观点加载失败，仍可分享链接。" : "Latest opinions could not be loaded. You can still share the link.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [open, mode, creator.channel_id, locale, revision, resolvedTheme, t]);

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
    setError(""); setStatus("");
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
        setPreview({ url, file: new File([blob], image.creatorShareFilename(doc!, page), { type: "image/png" }), page, document: doc!, height: image.creatorSharePageHeight(doc!, page) });
      } catch {
        if (!disposed && url && !committed) { URL.revokeObjectURL(url); url = ""; }
        if (!disposed) setError(locale === "zh" ? "图片导出失败，请重试。" : "Could not export the image. Please retry.");
      }
    }
    void render();
    return () => { disposed = true; if (url && !committed) URL.revokeObjectURL(url); };
  }, [open, mode, doc, page, locale]);

  const visible = open && mode === "image" && doc && doc.appearance.mode === (resolvedTheme === "dark" ? "dark" : "light") && preview?.document === doc ? preview : null;
  const ready = visible?.page === page ? visible : null;
  function changeOpen(next: boolean) {
    setOpen(next); setMode("link"); setData(null); setDoc(null); setPreview(null);
    setLoading(next); setEmpty(false); setError(""); setStatus(""); setPage(0);
  }
  async function copy(value: string) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setStatus(c("Copied. Paste it into your preferred app.", "已复制，可粘贴到社交媒体或聊天应用。"));
    } catch { setStatus(c("Select the link or text below and copy it manually.", "请选中下方链接或文案，手动复制。")); }
  }
  async function share(asImage: boolean) {
    if (!canNativeShare() || sharing || (asImage && (!ready || !canShareFile(ready.file)))) return;
    try {
      let payload: ShareData = asImage && ready
        ? { files: [ready.file], title: content.title, text: content.headline + "\n" + content.url }
        : { title: content.title, text: content.headline, url: content.url };
      if (asImage && ready && !navigator.canShare?.(payload)) payload = { files: [ready.file] };
      // Call immediately inside the click; PNGs are already prepared.
      const result = navigator.share(payload);
      setSharing(true); setStatus("");
      await result;
      setStatus(c("Opened the system share menu.", "已打开系统分享菜单。"));
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) {
        setStatus(c("Use Copy link, Copy text or Save image to share in another app.", "可使用复制链接、复制文案或保存图片，在其他应用中分享。"));
      }
    } finally { setSharing(false); }
  }

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button variant="outline" size="sm" className="shrink-0 gap-1.5"><Share2 className="h-4 w-4" aria-hidden="true" />{c("Share", "分享")}</Button></DialogTrigger>
    <DialogContent className="max-w-xl pb-5 pt-8">
      <DialogHeader><DialogTitle>{c("Share creator opinions", "分享博主观点")}</DialogTitle><DialogDescription>{c("Share a public link, prepare a social post, or save images of the latest imported opinions.", "通过公开链接、社交媒体或图片，分享最新一期已收录观点。")}</DialogDescription></DialogHeader>
      <div ref={appearanceRef} className="mt-3 space-y-3 rounded-xl font-sans">
        <Tabs value={mode} onValueChange={(value) => { if (!sharing) { setMode(value === "image" ? "image" : "link"); setStatus(""); } }}>
          <TabsList><TabsTrigger value="link" disabled={sharing}>{c("Link & social", "链接与社交")}</TabsTrigger><TabsTrigger value="image" disabled={sharing}>{c("Image", "图片")}</TabsTrigger></TabsList>
          <TabsContent value="link" className="mt-5 space-y-5">{mode === "link" && <>
            <div className="space-y-2"><label htmlFor={linkId} className="text-sm font-medium">{c("Public share link", "公开分享链接")}</label><Input id={linkId} readOnly value={content.url} onFocus={(event) => event.currentTarget.select()} /><p className="text-xs text-muted-foreground">{c("Recipients can read these opinions without signing in.", "接收者无需登录即可查看观点。")}</p></div>
            <div className="flex flex-wrap gap-2"><Button onClick={() => void copy(content.url)} className="gap-2"><Link2 className="h-4 w-4" aria-hidden="true" />{c("Copy link", "复制链接")}</Button>{canNativeShare() && <Button variant="outline" disabled={sharing} onClick={() => void share(false)} className="gap-2"><Share2 className="h-4 w-4" aria-hidden="true" />{c("More apps", "更多应用")}</Button>}</div>
            <div className="space-y-3"><p className="text-sm font-medium">{c("Share to", "分享到")}</p><div className="flex flex-wrap gap-2">{creatorSocialLinks(content).map((platform) => <Button key={platform.name} variant="outline" asChild><a href={platform.href} target="_blank" rel="noopener noreferrer">{platform.name}</a></Button>)}<Button variant="outline" asChild><a href={creatorEmailLink(content)} className="gap-2"><Mail className="h-4 w-4" aria-hidden="true" />{c("Email", "邮件")}</a></Button></div></div>
            <div className="space-y-2"><label htmlFor={textId} className="text-sm font-medium">{c("Share text", "分享文案")}</label><Textarea id={textId} readOnly value={content.text} rows={5} onFocus={(event) => event.currentTarget.select()} /><Button variant="outline" disabled={loading} onClick={() => void copy(content.text)} className="gap-2"><Copy className="h-4 w-4" aria-hidden="true" />{c("Copy text", "复制文案")}</Button></div>
            <p className="text-xs leading-relaxed text-muted-foreground">{c("For WeChat, Xiaohongshu and other apps, paste the link or text, or switch to Image and save a share card.", "微信、小红书等应用可粘贴链接或文案，也可切换到「图片」保存分享卡片。")}</p>
            {loading && <p role="status" className="text-xs text-muted-foreground">{c("Loading the latest opinions…", "正在加载最新观点…")}</p>}
          </>}</TabsContent>
          <TabsContent value="image" className="mt-3 space-y-3">{mode === "image" && <>
            {(loading || (doc && !visible && !error)) && <div role="status" className="mx-auto flex h-[min(45dvh,440px)] w-full items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{c("Generating the image…", "正在生成图片…")}</div>}
            {empty && <p className="py-12 text-center text-sm text-muted-foreground">{c("This creator has no imported opinions yet.", "这位博主暂无已收录观点。")}</p>}
            {visible && doc && <><figure aria-busy={!ready && !error} className="relative mx-auto flex h-[min(45dvh,440px)] w-full items-center justify-center">
              {!ready && !error && <span role="status" className="absolute right-2 top-2 rounded-full bg-background p-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /><span className="sr-only">{c("Generating the image…", "正在生成图片…")}</span></span>}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={visible.url} width={1080} height={visible.height} alt={c(`${doc.creator}, opinions, image ${visible.page + 1} of ${doc.pages.length}`, `${doc.creator}观点，第 ${visible.page + 1} / ${doc.pages.length} 张`)} aria-describedby={transcriptId} className="block max-h-full max-w-full h-auto w-auto rounded-xl border border-border bg-background" />
            </figure><div id={transcriptId} className="sr-only">{doc.pages[visible.page].map((fragment, index) => <p key={index}>{fragment.ticker} · {fragment.strength.label} · {fragment.lines.join("")}</p>)}</div></>}
            {doc && doc.pages.length > 1 && <div className="flex items-center justify-center gap-4"><Button variant="ghost" size="icon" aria-label={c("Previous image", "上一张图片")} disabled={page === 0 || sharing} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="h-4 w-4" /></Button><span role="status" className="text-sm tabular-nums">{page + 1} / {doc.pages.length}</span><Button variant="ghost" size="icon" aria-label={c("Next image", "下一张图片")} disabled={page === doc.pages.length - 1 || sharing} onClick={() => setPage((value) => value + 1)}><ChevronRight className="h-4 w-4" /></Button></div>}
            {visible && <div className="flex flex-wrap justify-center gap-2"><Button asChild disabled={!ready} className="gap-2"><a href={ready?.url} download={ready?.file.name} aria-disabled={!ready} onClick={(event) => { if (!ready) { event.preventDefault(); return; } setStatus(c("Image download started.", "已开始下载图片。")); }}><Download className="h-4 w-4" aria-hidden="true" />{c("Save image", "保存图片")}</a></Button>{canShareFile(visible.file) && <Button variant="outline" disabled={sharing || !ready} onClick={() => void share(true)} className="gap-2"><Share2 className="h-4 w-4" aria-hidden="true" />{c("Share image", "分享图片")}</Button>}</div>}
            {visible && <p className="text-center text-xs text-muted-foreground">{c("Save each image or press and hold it, then attach it to your social post.", "可逐张保存或长按图片，添加到社交媒体帖子。")}</p>}
            {sourceVideoUrl(data?.video) && <p className="text-center text-xs"><a href={sourceVideoUrl(data?.video)} target="_blank" rel="noopener noreferrer" className="text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{c("View source video", "查看原视频")}</a></p>}
          </>}</TabsContent>
        </Tabs>
        {error && <div role="alert" className="space-y-3"><p className="text-sm text-muted-foreground">{error}</p><Button variant="outline" onClick={() => setRevision((value) => value + 1)}>{c("Retry", "重试")}</Button></div>}
        <p role="status" aria-live="polite" className={status ? "text-center text-xs text-muted-foreground" : "sr-only"}>{status}</p>
      </div>
    </DialogContent>
  </Dialog>;
}
