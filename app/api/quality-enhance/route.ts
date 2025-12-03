import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/quality-enhance
 * 딥러닝 초해상도(SR) 모델을 사용한 화질 개선
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get("image") as File;
    const scaleStr = formData.get("scale") as string | null;

    if (!imageFile) {
      return NextResponse.json(
        { error: "이미지 파일이 필요합니다." },
        { status: 400 }
      );
    }

    const scale = scaleStr ? parseFloat(scaleStr) : 2.0;
    if (isNaN(scale) || scale <= 1.0 || scale > 4.0) {
      return NextResponse.json(
        { error: "scale은 1.0보다 크고 4.0 이하여야 합니다." },
        { status: 400 }
      );
    }

    // Python 서버로 HTTP 요청
    const pythonServerUrl = "https://python-ai-server-ezax.onrender.com/enhance";
    
    const requestFormData = new FormData();
    requestFormData.append("file", imageFile);
    requestFormData.append("scale", scale.toString());

    try {
      const response = await fetch(pythonServerUrl, {
        method: "POST",
        body: requestFormData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Python 서버 응답 오류:", response.status, errorText);
        return NextResponse.json(
          {
            error: "화질 개선 처리에 실패했습니다.",
            note: "Python 서버 요청이 실패했습니다.",
            details: errorText || `HTTP ${response.status}`,
          },
          { status: response.status || 500 }
        );
      }

      const result = await response.json();
      
      // Python 서버 응답 형식에 맞게 변환
      if (result.enhanced || result.data) {
        return NextResponse.json({
          enhanced: result.enhanced || result.data,
          scale: scale,
        });
      } else {
        return NextResponse.json(
          {
            error: "Python 서버 응답 형식 오류",
            details: "응답에 이미지 데이터가 없습니다.",
          },
          { status: 500 }
        );
      }
    } catch (fetchError) {
      console.error("Python 서버 요청 실패:", fetchError);
      return NextResponse.json(
        {
          error: "Python 서버 요청에 실패했습니다.",
          note: "서버 연결을 확인해주세요.",
          details: fetchError instanceof Error ? fetchError.message : String(fetchError),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      {
        error: "요청 처리 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
