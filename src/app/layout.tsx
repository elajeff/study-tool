import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Study Tool — Learn by doing", template: "%s · Study Tool" },
  description: "A calm, focused place to learn programming, practice exercises, and track real progress.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
