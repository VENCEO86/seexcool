import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/remove-background
 * 배경제거 API (향후 AI 모델 연동용)
 * 
 * 현재는 브라우저에서 처리하지만, 향후 Python 백엔드와 연동하여
 * Rembg, U²-Net, MODNet 등의 AI 모델을 사용할 수 있도록 준비
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get("image") as File;
    const model = formData.get("model") as string || "rembg";

    if (!imageFile) {
      return NextResponse.json(
        {
          success: false,
          error: "이미지 파일이 필요합니다.",
        },
        { status: 400 }
      );
    }

    // 파일 크기 검증
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (imageFile.size > maxSize) {
      return NextResponse.json(
        {
          success: false,
          error: "파일 크기는 10MB 이하여야 합니다.",
        },
        { status: 400 }
      );
    }

    // 파일 형식 검증
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(imageFile.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "지원하지 않는 파일 형식입니다.",
        },
        { status: 400 }
      );
    }

    // TODO: 실제 AI 모델 연동
    // 현재는 브라우저에서 처리하므로, 이 API는 향후 확장을 위한 구조만 제공
    // Python 백엔드와 연동 시:
    // 1. 이미지를 Python 서버로 전송
    // 2. Rembg/U²-Net/MODNet 모델로 배경제거 처리
    // 3. 결과 이미지 반환

    return NextResponse.json(
      {
        success: false,
        error: "AI 배경제거 기능은 아직 구현되지 않았습니다. 브라우저 기반 배경제거를 사용해주세요.",
        note: "향후 Python 백엔드와 연동하여 고급 AI 모델을 사용할 예정입니다.",
      },
      { status: 501 } // Not Implemented
    );

    // 향후 구현 예시:
    /*
    const imageBuffer = await imageFile.arrayBuffer();
    
    // Python 백엔드로 전송
    const pythonResponse = await fetch("http://python-backend:8000/remove-background", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: Buffer.from(imageBuffer).toString("base64"),
        model: model,
      }),
    });

    const result = await pythonResponse.json();
    const resultImageBuffer = Buffer.from(result.image, "base64");

    return new NextResponse(resultImageBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="removed-background.png"`,
      },
    });
    */
  } catch (error) {
    console.error("Background removal API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "배경제거 처리 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

