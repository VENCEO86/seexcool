// 🔥 mosaic-superrecon API 완성본 (빌드 오류 100% 해결 버전)

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { spawnPython312, checkPython312 } from "@/lib/pythonExecutor";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get("image") as File;
    const scaleStr = formData.get("scale") as string | null;
    const mosaicStrengthStr = formData.get("mosaicStrength") as string | null;
    const enhanceEdgesStr = formData.get("enhanceEdges") as string | null;

    // 🔥 완전 수정본 — denoiseStr 버그 해결
    const denoiseStr = formData.get("denoise") as string | null;
    const denoise = denoiseStr === "true";

    if (!imageFile) {
      return NextResponse.json({ error: "이미지 파일이 필요합니다." }, { status: 400 });
    }

    const scale = scaleStr ? parseFloat(scaleStr) : 2.0;
    if (isNaN(scale) || scale <= 1.0 || scale > 4.0) {
      return NextResponse.json(
        { error: "scale은 1.0보다 크고 4.0 이하여야 합니다." },
        { status: 400 }
      );
    }

    const mosaicStrength = mosaicStrengthStr ? parseFloat(mosaicStrengthStr) : 0.3;
    const enhanceEdges = enhanceEdgesStr === "true";

    const tempDir = os.tmpdir();
    const ts = Date.now();
    const rnd = Math.random().toString(36).substr(2, 9);

    const inputPath = path.join(tempDir, `mosaic_input_${ts}_${rnd}.png`);
    const outputPath = path.join(tempDir, `mosaic_output_${ts}_${rnd}.png`);

    if (!inputPath.startsWith(tempDir) || !outputPath.startsWith(tempDir)) {
      return NextResponse.json({ error: "Invalid file path detected" }, { status: 400 });
    }

    try {
      const arrayBuffer = await imageFile.arrayBuffer();
      fs.writeFileSync(inputPath, Buffer.from(arrayBuffer));

      const scriptPath = path.join(process.cwd(), "scripts", "mosaic_superrecon.py");

      if (!fs.existsSync(scriptPath)) {
        return NextResponse.json(
          {
            error: "모자이크 보정 스크립트를 찾을 수 없습니다.",
            note: "scripts/mosaic_superrecon.py 파일이 필요합니다.",
          },
          { status: 500 }
        );
      }

      return new Promise<NextResponse>(async (resolve) => {
        const pythonCheck = await checkPython312();
        if (!pythonCheck.available) {
          resolve(
            NextResponse.json(
              {
                error: "Python 3.12가 설치되어 있지 않습니다.",
                note: "Python 3.12 설치 필요",
                details: pythonCheck.error,
              },
              { status: 500 }
            )
          );
          return;
        }

        const args = [
          "--input",
          inputPath,
          "--output",
          outputPath,
          "--scale",
          scale.toString(),
          "--mosaic-strength",
          mosaicStrength.toString(),
        ];

        if (enhanceEdges) args.push("--enhance-edges");
        if (denoise) args.push("--denoise");

        args.push("--device", "auto");

        // 🔥 env 병합 — 빌드 오류(Required NODE_ENV missing) 완전 해결
        const py = spawnPython312(scriptPath, args, {
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

        let timeoutId: NodeJS.Timeout | null = setTimeout(() => {
          py.kill("SIGTERM");
          resolve(
            NextResponse.json(
              { error: "처리 시간 초과", errorCode: "TIMEOUT" },
              { status: 500 }
            )
          );
        }, 5 * 60 * 1000);

        py.stdout?.on("data", (d) => {
          stdout += d.toString("utf8");
        });

        py.stderr?.on("data", (d) => {
          stderr += d.toString("utf8");
        });

        py.on("close", (code) => {
          if (timeoutId) clearTimeout(timeoutId);

          try {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
          } catch {}

          if (code !== 0) {
            try {
              if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            } catch {}

            resolve(
              NextResponse.json(
                {
                  error: "모자이크 보정 오류 발생",
                  details: stderr || stdout,
                },
                { status: 500 }
              )
            );
            return;
          }

          if (!fs.existsSync(outputPath)) {
            resolve(
              NextResponse.json(
                { error: "출력 파일 없음 — 처리 실패" },
                { status: 500 }
              )
            );
            return;
          }

          try {
            const buf = fs.readFileSync(outputPath);
            const base64 = buf.toString("base64");

            try {
              fs.unlinkSync(outputPath);
            } catch {}

            resolve(
              NextResponse.json({
                enhanced: `data:image/png;base64,${base64}`,
                scale,
                mosaicStrength,
                enhanceEdges,
                denoise,
              })
            );
          } catch (e) {
            resolve(
              NextResponse.json(
                { error: "출력 파일 읽기 실패", details: String(e) },
                { status: 500 }
              )
            );
          }
        });
      });
    } catch (error) {
      try {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      } catch {}

      return NextResponse.json(
        {
          error: "처리 중 오류 발생",
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: "요청 처리 중 오류 발생",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
