import { ImageResponse } from "next/og";

// Default social-share card applied to every route (product pages override the
// image with their own photo). Without this, shared Meher links render blank.
export const alt = "Meher — Pakistani Women's Wear";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f6efe3",
          color: "#1c1b2a",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ fontSize: 150, fontWeight: 700, color: "#b14a33" }}>
          Meher
        </div>
        <div
          style={{
            width: 120,
            height: 3,
            background: "#c18f3c",
            margin: "28px 0",
          }}
        />
        <div
          style={{
            fontSize: 40,
            letterSpacing: 2,
            color: "#4a4860",
            display: "flex",
          }}
        >
          Pakistani Women&apos;s Wear · Cash on Delivery
        </div>
      </div>
    ),
    { ...size },
  );
}
