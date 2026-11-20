import { ImageResponse } from "next/og";
import { SHARE_KIND_LABELS, markdownToText, shareBody, shareHeadline } from "@/lib/contentShare";
import { getPublicShare } from "./data";

export const alt = "Kolvex share";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 600;

const clip = (text: string, limit: number) => {
  const chars = Array.from(text.replace(/\s+/g, " ").trim());
  return chars.length <= limit ? chars.join("") : chars.slice(0, limit - 1).join("") + "…";
};

/** Only the glyphs on the card, so Chinese renders without shipping a full CJK font. */
async function cjkFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@500&text=${encodeURIComponent(text)}`,
      { next: { revalidate: 86400 } },
    ).then((response) => response.text());
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype|woff2?)'\)/)?.[1];
    return url ? await fetch(url).then((response) => response.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

// Brand art (like app/opengraph-image.tsx): fixed colours are allowed in OG images.
export default async function ShareImage({ params }: { params: { id: string } }) {
  const share = await getPublicShare(params.id);
  const zh = share?.locale !== "en";
  const kind = share
    ? zh
      ? SHARE_KIND_LABELS[share.kind][1]
      : SHARE_KIND_LABELS[share.kind][0]
    : "Kolvex";
  const headline = share ? clip(shareHeadline(share, zh), 44) : "Kolvex";
  const body = share
    ? share.locked
      ? zh
        ? "登录 Kolvex 查看详情"
        : "Sign in to Kolvex to read the details"
      : clip(
          share.kind === "chat"
            ? markdownToText(String(share.card.data.answer || "")).replace(/^\s*[-*+]\s+/gm, "")
            : shareBody(share, zh),
          150,
        )
    : "";
  const tickers = (share?.card.tickers || []).slice(0, 4).join("  ");
  const footer = zh
    ? "kolvex.app · 观点可追溯到原始来源"
    : "kolvex.app · every opinion links to its source";
  const font = await cjkFont(kind + headline + body + tickers + footer);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "60px 72px",
        background: "#0b1110",
        color: "#f2f5f3",
        fontFamily: font ? "Noto Sans SC" : "sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", fontSize: 32, fontWeight: 700, color: "#58d89b" }}>
          Kolvex
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#bdc8c1" }}>{kind}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 50, fontWeight: 500, lineHeight: 1.25 }}>
          {headline}
        </div>
        {body && (
          <div
            style={{
              display: "flex",
              fontSize: 28,
              marginTop: 28,
              lineHeight: 1.55,
              color: "#d5ddd8",
            }}
          >
            {body}
          </div>
        )}
      </div>
      <div
        style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: "#bdc8c1" }}
      >
        <div style={{ display: "flex" }}>{footer}</div>
        <div style={{ display: "flex", color: "#58d89b" }}>{tickers}</div>
      </div>
    </div>,
    {
      ...size,
      fonts: font ? [{ name: "Noto Sans SC", data: font, weight: 500, style: "normal" }] : [],
    },
  );
}
