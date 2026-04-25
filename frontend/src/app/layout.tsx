import "./globals.css";

import type { Metadata } from "next";

import { AuthProvider } from "@/components/auth-provider";

export const metadata: Metadata = {
  title: "F1 AI Analytics & Strategy Platform",
  description: "Telemetry dashboards, race strategy, reports, prediction, and F1 chat.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
