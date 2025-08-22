import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Providers from '@/components/Providers';
import './globals.css';

const inter = Inter({
  subsets: ["latin"],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "SaaS Opportunities Intelligence Platform",
  description: "AI-powered platform for discovering validated SaaS opportunities from real market pain points and user complaints.",
  keywords: "SaaS ideas, market research, AI analysis, business opportunities, startup validation",
  authors: [{ name: "SaaS Intelligence Platform" }],
  viewport: "width=device-width, initial-scale=1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
      </head>
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}