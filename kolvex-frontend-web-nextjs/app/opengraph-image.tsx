import { ImageResponse } from "next/og";

export const alt = "Kolvex — AI stock research and creator insights";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "space-between", padding: "64px 76px", background: "#0b1110",
          color: "#f2f5f3", fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 36, fontWeight: 700, color: "#58d89b" }}>
          Kolvex
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1 }}>
            Your stock research,
          </div>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1, color: "#58d89b" }}>
            connected.
          </div>
          <div style={{ fontSize: 28, marginTop: 30, color: "#bdc8c1" }}>
            Creator opinions · Market context · AI research
          </div>
        </div>
        <div style={{ fontSize: 24, color: "#bdc8c1" }}>kolvex.app</div>
      </div>
    ),
    size,
  );
}
