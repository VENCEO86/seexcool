import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/admin/auth
 * 관리자 비밀번호 인증 API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        {
          success: false,
          error: "비밀번호가 필요합니다.",
        },
        { status: 400 }
      );
    }

    // 서버 사이드에서만 환경변수 접근
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    
    if (password === adminPassword) {
      return NextResponse.json({
        success: true,
        authenticated: true,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "비밀번호가 올바르지 않습니다.",
        },
        { status: 401 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "인증 처리 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
