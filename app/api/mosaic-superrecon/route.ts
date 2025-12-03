import { NextRequest, NextResponse } from "next/server";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { spawnPython312, checkPython312 } from "@/lib/pythonExecutor";

/**
 * POST /api/mosaic-superrecon
 * 모자이크 보정 및 초해상도 복원 API
 * - 모자이크 블록 패턴 감소
 * - 엣지/윤곽선 보강
 * - 노이즈 제거
 * - 디테일 재구성
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get("image") as File;
    const scaleStr = formData.get("scale") as string | null;
    const mosaicStrengthStr = formData.get("mosaicStrength") as string | null;
    const enhanceEdgesStr = formData.get("enhanceEdges") as string | null;
    const denoiseStr = formData.get("denoise") as string | null;

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

    const mosaicStrength = mosaicStrengthStr ? parseFloat(mosaicStrengthStr) : 0.3;
    const enhanceEdges = enhanceEdgesStr === "true";
    const denoise = denoiseStr === "true";

    // 임시 파일 경로 생성 (보안: 경로 traversal 방지)
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substr(2, 9);
    const inputPath = path.join(tempDir, `mosaic_input_${timestamp}_${randomStr}.png`);
    const outputPath = path.join(tempDir, `mosaic_output_${timestamp}_${randomStr}.png`);
    
    // 경로 검증 (보안)
    if (!inputPath.startsWith(tempDir) || !outputPath.startsWith(tempDir)) {
      return NextResponse.json(
        { error: "Invalid file path detected" },
        { status: 400 }
      );
    }

    try {
      // 업로드된 이미지를 임시 파일로 저장
      const arrayBuffer = await imageFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(inputPath, buffer);

      // Python 스크립트 실행
      const pythonScriptPath = path.join(process.cwd(), "scripts", "mosaic_superrecon.py");
      
      // 스크립트 파일 존재 확인
      if (!fs.existsSync(pythonScriptPath)) {
        return NextResponse.json(
          { 
            error: "모자이크 보정 스크립트를 찾을 수 없습니다.",
            note: "scripts/mosaic_superrecon.py 파일이 필요합니다."
          },
          { status: 500 }
        );
      }

      return new Promise<NextResponse>(async (resolve, reject) => {
        // Python 3.12 설치 확인
        const pythonCheck = await checkPython312();
        if (!pythonCheck.available) {
          resolve(
            NextResponse.json(
              {
                error: "Python 3.12가 설치되어 있지 않습니다.",
                note: "Python 3.12를 설치하거나 PATH에 등록해주세요.",
                details: pythonCheck.error,
              },
              { status: 500 }
            )
          );
          return;
        }

        // 스크립트 인자 구성
        const scriptArgs = [
          "--input",
          inputPath,
          "--output",
          outputPath,
          "--scale",
          scale.toString(),
          "--mosaic-strength",
          mosaicStrength.toString(),
        ];

        if (enhanceEdges) {
          scriptArgs.push("--enhance-edges");
        }

        if (denoise) {
          scriptArgs.push("--denoise");
        }

        scriptArgs.push("--device", "auto");

        // Python 3.12 실행 (전용)
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
        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];
        let timeoutId: NodeJS.Timeout | null = null;

        // Timeout 설정 (5분)
        const TIMEOUT_MS = 5 * 60 * 1000;
        timeoutId = setTimeout(() => {
          py.kill("SIGTERM");
          resolve(
            NextResponse.json(
              {
                error: "처리 시간이 초과되었습니다.",
                note: "이미지가 너무 크거나 처리 중 문제가 발생했습니다.",
                errorCode: "TIMEOUT",
              },
              { status: 500 }
            )
          );
        }, TIMEOUT_MS);

        py.stdout?.on("data", (data: Buffer) => {
          stdoutChunks.push(data);
          try {
            const decoded = data.toString("utf8");
            stdout += decoded;
            console.log("Python stdout:", decoded);
          } catch (e) {
            const safeDecoded = data.toString("utf8").replace(/\uFFFD/g, "?");
            stdout += safeDecoded;
          }
        });

        py.stderr?.on("data", (data: Buffer) => {
          stderrChunks.push(data);
          try {
            const decoded = data.toString("utf8");
            stderr += decoded;
            console.error("Python stderr:", decoded);
          } catch (e) {
            const safeDecoded = data.toString("utf8").replace(/\uFFFD/g, "?");
            stderr += safeDecoded;
            console.error("Python stderr (raw):", safeDecoded);
          }
        });

        py.on("error", (err: Error) => {
          console.error("Python spawn error:", err);
          // 임시 파일 정리
          try {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
          } catch (e) {
            console.error("Failed to cleanup temp files:", e);
          }
          reject(
            NextResponse.json(
              {
                error: "Python 실행에 실패했습니다.",
                note: "Python이 설치되어 있고 PATH에 등록되어 있는지 확인하세요.",
                details: err.message,
              },
              { status: 500 }
            )
          );
        });

        py.on("close", (code: number | null) => {
          // Timeout 정리
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }

          // 입력 파일 정리
          try {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
          } catch (e) {
            console.error("Failed to cleanup input file:", e);
          }

          if (code !== 0) {
            // 출력 파일 정리
            try {
              if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            } catch (e) {
              console.error("Failed to cleanup output file:", e);
            }

            console.error("Python exited with code:", code);
            console.error("Python stderr:", stderr);
            
            // 에러 메시지 정리
            let cleanStderr = "";
            if (stderr) {
              try {
                const buffer = Buffer.from(stderr, "utf8");
                cleanStderr = buffer.toString("utf8").replace(/\uFFFD/g, "?");
                if (cleanStderr.length > 200) {
                  cleanStderr = cleanStderr.substring(0, 200) + "...";
                }
              } catch (e) {
                cleanStderr = "Error details unavailable";
              }
            }
            
            // stdout + stderr 통합 (전체 오류 정보)
            const fullError = (stdout + "\n" + stderr).trim();
            
            // 사용자 친화적인 에러 메시지
            let userMessage = "모자이크 보정에 실패했습니다.";
            let errorCode = "UNKNOWN_ERROR";
            
            if (fullError.includes("Model file not found") || fullError.includes("모델 파일") || fullError.includes("FileNotFoundError")) {
              userMessage = "모델 파일을 찾을 수 없습니다.";
              errorCode = "MODEL_NOT_FOUND";
            } else if (fullError.includes("Required library not installed") || fullError.includes("ImportError") || fullError.includes("ModuleNotFoundError")) {
              userMessage = "필수 Python 라이브러리가 설치되지 않았습니다.";
              errorCode = "LIBRARY_MISSING";
            } else if (fullError.includes("Python 3.12") || fullError.includes("python3.12")) {
              userMessage = "Python 3.12 실행에 실패했습니다.";
              errorCode = "PYTHON312_NOT_FOUND";
            } else if (code === 1) {
              userMessage = "Python 스크립트 실행 중 오류가 발생했습니다.";
              errorCode = "SCRIPT_ERROR";
            }
            
            resolve(
              NextResponse.json(
                {
                  error: userMessage,
                  errorCode: errorCode,
                  note: "자세한 내용은 서버 로그를 확인하세요.",
                  details: cleanStderr || fullError || `Exit code: ${code}`,
                },
                { status: 500 }
              )
            );
            return;
          }

          // 출력 파일 읽기
          try {
            if (!fs.existsSync(outputPath)) {
              resolve(
                NextResponse.json(
                  {
                    error: "출력 파일을 찾을 수 없습니다.",
                    note: "Python 스크립트가 출력 파일을 생성하지 못했습니다.",
                  },
                  { status: 500 }
                )
              );
              return;
            }

            const buf = fs.readFileSync(outputPath);
            const base64 = buf.toString("base64");
            const dataUrl = `data:image/png;base64,${base64}`;

            // 출력 파일 정리
            try {
              fs.unlinkSync(outputPath);
            } catch (e) {
              console.error("Failed to cleanup output file:", e);
            }

            resolve(
              NextResponse.json({
                enhanced: dataUrl,
                scale: scale,
                mosaicStrength: mosaicStrength,
                enhanceEdges: enhanceEdges,
                denoise: denoise,
              })
            );
          } catch (e) {
            console.error("Failed to read output file:", e);
            // 출력 파일 정리
            try {
              if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            } catch (cleanupError) {
              console.error("Failed to cleanup output file:", cleanupError);
            }

            resolve(
              NextResponse.json(
                {
                  error: "출력 파일 읽기에 실패했습니다.",
                  note: "파일 시스템 오류가 발생했습니다.",
                  details: e instanceof Error ? e.message : String(e),
                },
                { status: 500 }
              )
            );
          }
        });
      });
    } catch (error) {
      // 임시 파일 정리
      try {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      } catch (e) {
        console.error("Failed to cleanup temp files:", e);
      }

      console.error("Mosaic superrecon error:", error);
      return NextResponse.json(
        {
          error: "모자이크 보정 처리 중 오류가 발생했습니다.",
          details: error instanceof Error ? error.message : String(error),
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

