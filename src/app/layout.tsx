import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThemeProvider } from "next-themes";
import { QueryProviderWrapper } from "@/lib/queryClientProvider";
import { Toaster } from "@/components/ui/sonner";
import { AuthSessionSync } from "@/components/auth/AuthSessionSync";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "democracyonline.io",
  description:
    "Step into an online political simulation where you shape the outcome and the future of our republic",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <Toaster position="top-center" richColors />
        <QueryProviderWrapper>
          <AuthSessionSync />
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <SidebarProvider suppressHydrationWarning>
              <AppSidebar />
              <SidebarInset suppressHydrationWarning>
                <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
                  <SidebarTrigger className="-ml-1" />
                </header>
                <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
              </SidebarInset>
            </SidebarProvider>
          </ThemeProvider>
        </QueryProviderWrapper>
      </body>
    </html>
  );
}
