import { NextRequest, NextResponse } from "next/server";
import type { Inquiry } from "@/lib/sectionAdConfig";
import { inquiriesStore } from "./store";
import { sanitizeInput, isValidEmail, validateLength, checkRateLimit } from "@/lib/security";
import { logger } from "@/lib/logger";

/**
 * GET /api/inquiries
 * 문의 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    // 실제로는 데이터베이스에서 조회
    // 현재는 메모리 저장소 사용
    const sortedInquiries = inquiriesStore.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({
      success: true,
      data: sortedInquiries,
      count: sortedInquiries.length,
    });
  } catch (error) {
    logger.error("Failed to get inquiries", error instanceof Error ? error : new Error(String(error)), {
      endpoint: "/api/inquiries",
      method: "GET",
    });
    return NextResponse.json(
      {
        success: false,
        error: "문의 목록을 불러오는데 실패했습니다.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inquiries
 * 새 문의 생성
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting 체크
    const clientIp = request.headers.get("x-forwarded-for") || 
                     request.headers.get("x-real-ip") || 
                     "unknown";
    if (!checkRateLimit(clientIp, 10, 60000)) {
      logger.warn("Rate limit exceeded", { clientIp, endpoint: "/api/inquiries" });
      return NextResponse.json(
        {
          success: false,
          error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { type, name, email, phone, company, message } = body;

    // 유효성 검사
    if (!type || !name || !email || !message) {
      return NextResponse.json(
        {
          success: false,
          error: "필수 필드가 누락되었습니다.",
        },
        { status: 400 }
      );
    }

    // 이메일 형식 검증
    if (!isValidEmail(email)) {
      return NextResponse.json(
        {
          success: false,
          error: "올바른 이메일 형식이 아닙니다.",
        },
        { status: 400 }
      );
    }

    // 입력값 길이 제한 (보안)
    if (
      !validateLength(name, 1, 100) ||
      !validateLength(email, 1, 255) ||
      !validateLength(message, 1, 5000)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "입력값 길이가 올바르지 않습니다.",
        },
        { status: 400 }
      );
    }

    // XSS 방지를 위한 sanitization
    const inquiry: Inquiry = {
      id: `inquiry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      name: sanitizeInput(name),
      email: sanitizeInput(email),
      phone: phone ? sanitizeInput(phone) : undefined,
      company: company ? sanitizeInput(company) : undefined,
      message: sanitizeInput(message),
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 실제로는 데이터베이스에 저장
    inquiriesStore.push(inquiry);

    logger.info("Inquiry created successfully", {
      inquiryId: inquiry.id,
      type: inquiry.type,
      email: inquiry.email,
    });

    return NextResponse.json({
      success: true,
      data: inquiry,
      message: "문의가 성공적으로 전송되었습니다.",
    });
  } catch (error) {
    logger.error("Failed to create inquiry", error instanceof Error ? error : new Error(String(error)), {
      endpoint: "/api/inquiries",
      method: "POST",
    });
    return NextResponse.json(
      {
        success: false,
        error: "문의 전송에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}
