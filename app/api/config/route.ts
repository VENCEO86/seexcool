import { NextRequest, NextResponse } from "next/server";
import type { SectionAdConfig } from "@/lib/sectionAdConfig";
import { DEFAULT_SECTION_CONFIG } from "@/lib/sectionAdConfig";
import { configStore as store } from "./store";
import { logger } from "@/lib/logger";

/**
 * GET /api/config
 * 설정 조회
 */
export async function GET(request: NextRequest) {
  try {
    // 실제로는 데이터베이스에서 조회
    const storedConfig = store.get();
    if (!storedConfig) {
      // 기본 설정 반환
      return NextResponse.json({
        success: true,
        data: DEFAULT_SECTION_CONFIG,
      });
    }

    return NextResponse.json({
      success: true,
      data: storedConfig,
    });
  } catch (error) {
    logger.error("Failed to get config", error instanceof Error ? error : new Error(String(error)), {
      endpoint: "/api/config",
      method: "GET",
    });
    return NextResponse.json(
      {
        success: false,
        error: "설정을 불러오는데 실패했습니다.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/config
 * 설정 저장
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { config } = body;

    if (!config) {
      return NextResponse.json(
        {
          success: false,
          error: "설정 데이터가 필요합니다.",
        },
        { status: 400 }
      );
    }

    // 유효성 검사
    if (!config.sections || typeof config.sections !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: "올바른 설정 형식이 아닙니다.",
        },
        { status: 400 }
      );
    }

    // 실제로는 데이터베이스에 저장
    store.set(config);

    logger.info("Config saved successfully", {
      endpoint: "/api/config",
      sectionsCount: Object.keys(config.sections).length,
      popupsCount: config.popups.length,
    });

    return NextResponse.json({
      success: true,
      data: config,
      message: "설정이 저장되었습니다.",
    });
  } catch (error) {
    logger.error("Failed to save config", error instanceof Error ? error : new Error(String(error)), {
      endpoint: "/api/config",
      method: "POST",
    });
    return NextResponse.json(
      {
        success: false,
        error: "설정 저장에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}

