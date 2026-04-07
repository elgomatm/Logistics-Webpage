import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TEN Document Studio",
  description:
    "The Exotics Network — Official document management platform for partner reports, guides, and communications.",
  keywords: ["TEN", "Exotics Network", "Event Reports", "Document Studio"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="noise-overlay">
        {children}
      </body>
    </html>
  );
}
