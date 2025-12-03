import type { Metadata, Viewport } from "next";
import "./globals.css";
import ErrorBoundary from "@/components/ErrorBoundary";
import fs from "fs";
import path from "path";

// 브랜딩 파일 경로 확인 (안전한 체크 - 서버 사이드에서만 실행)
function checkBrandingFiles() {
  let faviconExists = false;
  let ogImageExists = false;

  try {
    const BRANDING_DIR = path.join(process.cwd(), "public", "branding");
    const FAVICON_PATH = path.join(BRANDING_DIR, "favicon.ico");
    const OG_IMAGE_PATH = path.join(BRANDING_DIR, "og-image.png");
    
    // 디렉토리가 없으면 생성
    if (!fs.existsSync(BRANDING_DIR)) {
      fs.mkdirSync(BRANDING_DIR, { recursive: true });
    }
    
    faviconExists = fs.existsSync(FAVICON_PATH);
    ogImageExists = fs.existsSync(OG_IMAGE_PATH);
  } catch (error) {
    // 파일 시스템 접근 실패 시 기본값 사용
    console.warn("Failed to check branding files:", error);
  }
  
  return { faviconExists, ogImageExists };
}

const { faviconExists, ogImageExists } = checkBrandingFiles();

// 기본 사이트 URL (환경변수 또는 기본값)
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.seexcool.com";

// 동적 메타데이터 생성
export async function generateMetadata(): Promise<Metadata> {
  const ogImageUrl = ogImageExists 
    ? `${siteUrl}/branding/og-image.png`
    : undefined;

  return {
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
      url: siteUrl,
      ...(ogImageUrl && { images: [{ url: ogImageUrl, width: 1200, height: 630 }] }),
    },
    twitter: {
      card: "summary_large_image",
      title: "이미지 화질 개선 & 배경제거 도구",
      description: "고품질 이미지 화질 개선, 밝기/명암 조절, 배경제거 기능",
      ...(ogImageUrl && { images: [ogImageUrl] }),
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
    ...(faviconExists && {
      icons: {
        icon: "/branding/favicon.ico",
      },
    }),
  };
}

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
        {faviconExists ? (
          <link rel="icon" href="/branding/favicon.ico" />
        ) : (
          <link rel="icon" href="/favicon.ico" />
        )}
      </head>
      <body>
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}

