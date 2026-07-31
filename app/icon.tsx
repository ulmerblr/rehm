import { ImageResponse } from "next/og";

// Favicon: the "r" crop — white on the dark rehm square. Next serves this at
// /icon and browsers scale it for 16/32/64.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 46,
          fontWeight: 700,
        }}
      >
        r
      </div>
    ),
    { ...size }
  );
}
