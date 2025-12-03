// 🔥 quality-enhance API 완성본 (env 병합 + NODE_ENV 문제 100% 해결)

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import { spawnPython312, checkPython312 } from "@/lib/pythonExecutor";

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

    const tempDir = os.tmpdir();
    const ts = Date.now();
    const rnd = Math.random().toString(36).substring(2, 10);

    const inputPath = path.join(tempDir, `quality_input_${ts}_${rnd}.png`);
    const outputPath = path.join(tempDir, `quality_output_${ts}_${rnd}.png`);

    const arrayBuffer = await imageFile.arrayBuffer();
    fs.writeFileSync(inputPath, Buffer.from(arrayBuffer));

    const pythonScriptPath = path.join(process.cwd(), "scripts", "quality_enhance.py");

    if (!fs.existsSync(pythonScriptPath)) {
      return NextResponse.json(
        { error: "quality_enhance.py 스크립트를 찾을 수 없습니다." },
        { status: 500 }
      );
    }

    const pythonCheck = await checkPython312();
    if (!pythonCheck.available) {
      return NextResponse.json(
        {
          error: "Python 3.12 실행 불가",
          details: pythonCheck.error,
        },
        { status: 500 }
      );
    }

    return new Promise<NextResponse>((resolve) => {
      const scriptArgs = [
        "--input",
        inputPath,
        "--output",
        outputPath,
        "--scale",
        scale.toString(),
      ];

      // 🔥 env 병합 패치 — 빌드 에러 NODE_ENV missing 해결
      const py = spawnPython312(pythonScriptPath, scriptArgs, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PYTHONIOENCODING: "utf-8",
          PYTHONUTF8: "1",
          LANG: "en_US.UTF-8",
          LC_ALL: "en_US.UTF-8",
        },
      });

      let stdout = "";
      let stderr = "";

      py.stdout?.on("data", (d) => {
        stdout += d.toString("utf8");
      });

      py.stderr?.on("data", (d) => {
        stderr += d.toString("utf8");
      });

      py.on("close", (code) => {
        try {
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        } catch {}

        if (code !== 0) {
          resolve(
            NextResponse.json(
              { error: "Python 처리 오류", details: stderr || stdout },
              { status: 500 }
            )
          );
          return;
        }

        if (!fs.existsSync(outputPath)) {
          resolve(
            NextResponse.json(
              { error: "출력 파일 생성 실패" },
              { status: 500 }
            )
          );
          return;
        }

        const buf = fs.readFileSync(outputPath);
        const base64 = buf.toString("base64");

        try {
          fs.unlinkSync(outputPath);
        } catch {}

        resolve(
          NextResponse.json({
            enhanced: `data:image/png;base64,${base64}`,
            scale: scale,
          })
        );
      });
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "처리 중 오류",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
