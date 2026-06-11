import { ImageResponse } from "next/og";

// Apple touch icon — a simple branded monogram so the home-screen shortcut
// reads as "Meher" rather than a default screenshot.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#b14a33",
          color: "#fbf7ef",
          fontSize: 120,
          fontWeight: 700,
          fontFamily: "Georgia, serif",
          position: "relative",
        }}
      >
        M
        <div
          style={{
            position: "absolute",
            bottom: 40,
            width: 44,
            height: 4,
            background: "#d8b878",
            borderRadius: 2,
          }}
        />
      </div>
    ),
    { ...size },
  );
}
