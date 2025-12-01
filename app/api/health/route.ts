import { NextResponse } from "next/server";

/**
 * GET /api/health
 * 서버 상태 확인 엔드포인트
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "See X Cool Image Editor",
    version: "1.0.0",
  });
}

