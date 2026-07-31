import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "rehm",
  description: "rehm — a longitudinal dream study",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
