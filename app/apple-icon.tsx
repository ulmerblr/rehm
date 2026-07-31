import { ImageResponse } from "next/og";

// apple-touch-icon: the "r" crop at 180×180.
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
          background: "#10131C",
          color: "#F4F4F5",
          fontSize: 128,
          fontWeight: 700,
        }}
      >
        r
      </div>
    ),
    { ...size }
  );
}
