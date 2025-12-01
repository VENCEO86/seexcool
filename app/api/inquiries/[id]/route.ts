import { NextRequest, NextResponse } from "next/server";
import type { Inquiry } from "@/lib/sectionAdConfig";
import { inquiriesStore } from "../store";

/**
 * GET /api/inquiries/[id]
 * 특정 문의 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const inquiry = inquiriesStore.find((i) => i.id === id);

    if (!inquiry) {
      return NextResponse.json(
        {
          success: false,
          error: "문의를 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: inquiry,
    });
  } catch (error) {
    console.error("Failed to get inquiry:", error);
    return NextResponse.json(
      {
        success: false,
        error: "문의를 불러오는데 실패했습니다.",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/inquiries/[id]
 * 문의 상태 업데이트
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { status } = body;

    if (!status || !["pending", "read", "replied"].includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: "올바른 상태 값이 아닙니다.",
        },
        { status: 400 }
      );
    }

    const inquiryIndex = inquiriesStore.findIndex((i) => i.id === id);
    if (inquiryIndex === -1) {
      return NextResponse.json(
        {
          success: false,
          error: "문의를 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    const currentInquiries = inquiriesStore.get();
    const updatedInquiry = {
      ...currentInquiries[inquiryIndex],
      status,
      updatedAt: new Date().toISOString(),
    };
    currentInquiries[inquiryIndex] = updatedInquiry;
    inquiriesStore.set(currentInquiries);

    return NextResponse.json({
      success: true,
      data: updatedInquiry,
      message: "문의 상태가 업데이트되었습니다.",
    });
  } catch (error) {
    console.error("Failed to update inquiry:", error);
    return NextResponse.json(
      {
        success: false,
        error: "문의 상태 업데이트에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}

