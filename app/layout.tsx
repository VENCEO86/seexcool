import type { Metadata, Viewport } from "next";
import "./globals.css";
import ErrorBoundary from "@/components/ErrorBoundary";

export const metadata: Metadata = {
  title: "이미지 화질 개선 & 배경제거 도구 | See X Cool",
  description: "고품질 이미지 화질 개선, 밝기/명암 조절, 배경제거(누끼) 기능을 제공하는 무료 이미지 편집 도구. 빠르고 간편하게 이미지를 처리하세요.",
  keywords: [
    "이미지 편집",
    "화질 개선",
    "스케일업",
    "명암 조절",
    "밝기 조절",
    "배경제거",
    "누끼",
    "이미지 보정",
    "image editor",
    "background removal",
    "image enhancement",
  ],
  authors: [{ name: "See X Cool" }],
  openGraph: {
    title: "이미지 화질 개선 & 배경제거 도구 | See X Cool",
    description: "고품질 이미지 화질 개선, 밝기/명암 조절, 배경제거 기능을 제공하는 무료 이미지 편집 도구",
    type: "website",
    siteName: "See X Cool",
  },
  twitter: {
    card: "summary_large_image",
    title: "이미지 화질 개선 & 배경제거 도구",
    description: "고품질 이미지 화질 개선, 밝기/명암 조절, 배경제거 기능",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}

