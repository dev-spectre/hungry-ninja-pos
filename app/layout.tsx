import type { Metadata } from "next";
import "./globals.css";
import BottomNav from "@/components/layout/BottomNav";
import TopBar from "@/components/layout/TopBar";
import ThemeProvider from "@/components/layout/ThemeProvider";
import FetchInterceptor from "@/components/layout/FetchInterceptor";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "PoS",
  description: "Point of Sale system for bakery and snack shops",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#0f172a" />
      </head>
      <body className="flex flex-col h-screen overflow-hidden" style={{ background: "var(--bg-primary)" }}>
        <FetchInterceptor />
        <ThemeProvider>
          <Toaster 
            position="top-right" 
            toastOptions={{
              duration: 3000,
              style: {
                background: "var(--bg-elevated)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                borderRadius: "1rem",
                fontSize: "14px",
                fontWeight: 600,
              },
            }}
          />
          <TopBar />
          <main className="flex-1 overflow-y-auto pb-20">
            {children}
          </main>
          <BottomNav />
        </ThemeProvider>
      </body>
    </html>
  );
}
