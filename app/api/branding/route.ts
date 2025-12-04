import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const BRANDING_DIR = path.join(process.cwd(), "public", "branding");
const FAVICON_PATH = path.join(BRANDING_DIR, "favicon.ico");
const OG_IMAGE_PATH = path.join(BRANDING_DIR, "og-image.png");

// 브랜딩 디렉토리 생성 (없으면)
function ensureBrandingDir() {
  if (!fs.existsSync(BRANDING_DIR)) {
    fs.mkdirSync(BRANDING_DIR, { recursive: true });
  }
}

/**
 * GET /api/branding
 * 브랜딩 설정 조회 (파일 존재 여부 확인)
 */
export async function GET() {
  try {
    ensureBrandingDir();

    const faviconExists = fs.existsSync(FAVICON_PATH);
    const ogImageExists = fs.existsSync(OG_IMAGE_PATH);

    return NextResponse.json({
      success: true,
      data: {
        favicon: faviconExists ? "/branding/favicon.ico" : null,
        ogImage: ogImageExists ? "/branding/og-image.png" : null,
      },
    });
  } catch (error) {
    console.error("Failed to get branding config:", error);
    return NextResponse.json(
      {
        success: false,
        error: "브랜딩 설정을 불러오는데 실패했습니다.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/branding
 * 브랜딩 파일 업로드 (favicon 또는 og-image)
 */
export async function POST(request: NextRequest) {
  try {
    ensureBrandingDir();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string | null; // "favicon" or "og-image"

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: "파일이 필요합니다.",
        },
        { status: 400 }
      );
    }

    if (!type || (type !== "favicon" && type !== "og-image")) {
      return NextResponse.json(
        {
          success: false,
          error: "type은 'favicon' 또는 'og-image'여야 합니다.",
        },
        { status: 400 }
      );
    }

    // 파일 크기 검증 (10MB 제한)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          success: false,
          error: "파일 크기는 10MB 이하여야 합니다.",
        },
        { status: 400 }
      );
    }

    // 파일 형식 검증
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/x-icon", "image/vnd.microsoft.icon", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "지원하지 않는 파일 형식입니다. (PNG, JPEG, ICO, WebP만 지원)",
        },
        { status: 400 }
      );
    }

    // 파일 저장 경로 결정
    const savePath = type === "favicon" ? FAVICON_PATH : OG_IMAGE_PATH;

    // 파일 저장
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // 기존 파일이 있으면 삭제 (덮어쓰기)
    if (fs.existsSync(savePath)) {
      fs.unlinkSync(savePath);
    }
    
    fs.writeFileSync(savePath, buffer);

    // 파일 저장 성공 확인
    if (!fs.existsSync(savePath)) {
      return NextResponse.json(
        {
          success: false,
          error: "파일 저장에 실패했습니다.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${type === "favicon" ? "파비콘" : "OG 이미지"}이 업로드되었습니다.`,
      data: {
        type,
        path: type === "favicon" ? "/branding/favicon.ico" : "/branding/og-image.png",
        timestamp: Date.now(), // 캐시 버스팅용
      },
    });
  } catch (error) {
    console.error("Failed to upload branding file:", error);
    return NextResponse.json(
      {
        success: false,
        error: "파일 업로드에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/branding
 * 브랜딩 파일 삭제
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // "favicon" or "og-image"

    if (!type || (type !== "favicon" && type !== "og-image")) {
      return NextResponse.json(
        {
          success: false,
          error: "type은 'favicon' 또는 'og-image'여야 합니다.",
        },
        { status: 400 }
      );
    }

    const deletePath = type === "favicon" ? FAVICON_PATH : OG_IMAGE_PATH;

    if (fs.existsSync(deletePath)) {
      fs.unlinkSync(deletePath);
    }

    return NextResponse.json({
      success: true,
      message: `${type === "favicon" ? "파비콘" : "OG 이미지"}이 삭제되었습니다.`,
    });
  } catch (error) {
    console.error("Failed to delete branding file:", error);
    return NextResponse.json(
      {
        success: false,
        error: "파일 삭제에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}


