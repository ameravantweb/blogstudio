import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SEO + AEO Blog Studio",
  description: "A private client workspace to brief, draft, and refine useful blog articles for search and answer engines.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
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
