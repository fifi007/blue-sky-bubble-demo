import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blue Sky Meta Ball Demo",
  description: "Interactive glass metaball experience with a blue sky aesthetic.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
