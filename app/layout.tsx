import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "rehm",
  description: "a longitudinal dream study",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
