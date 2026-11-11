import type { Metadata } from "next";
import { themeScript } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Study Tool", template: "%s · Study Tool" },
  description: "Import Markdown notes, organize study topics, and track progress through approved assessments.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head>
    <script dangerouslySetInnerHTML={{ __html: themeScript }} />
  </head><body>{children}</body></html>;
}
