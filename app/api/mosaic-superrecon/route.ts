import { NextRequest, NextResponse } from "next/server";
import { detectPythonEnvironment, getPythonScriptPath } from "@/lib/pythonEnvironment";
import { spawnPython312 } from "@/lib/pythonExecutor";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

/**
 * POST /api/mosaic-superrecon
 * 모자이크 보정 및 초해상도 복원
 * 
 * 하이브리드 모드:
 * - 로컬 환경: child_process로 Python 스크립트 직접 실행
 * - Render 서버: HTTP 요청으로 Python 서버 호출
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get("image") as File;
    const scaleStr = formData.get("scale") as string | null;
    const mosaicStrengthStr = formData.get("mosaic-strength") as string | null;
    const enhanceEdges = formData.get("enhance-edges") === "true";
    const denoise = formData.get("denoise") === "true";

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

    // 환경 감지
    const env = detectPythonEnvironment();
    console.log("[Mosaic Superrecon] Python environment:", env.mode, env.useLocalPython ? "local" : "remote");

    // 로컬 환경: Python 스크립트 직접 실행
    if (env.useLocalPython) {
      return await executeLocalPython(imageFile, scale, mosaicStrengthStr, enhanceEdges, denoise);
    }

    // Render 서버 환경: HTTP 요청
    const pythonServerUrl = env.pythonServerUrl || "https://python-ai-server-ezax.onrender.com/enhance";
    
    const requestFormData = new FormData();
    requestFormData.append("file", imageFile);
    requestFormData.append("scale", scale.toString());
    if (mosaicStrengthStr) {
      requestFormData.append("mosaic-strength", mosaicStrengthStr);
    }
    if (enhanceEdges) {
      requestFormData.append("enhance-edges", "true");
    }
    if (denoise) {
      requestFormData.append("denoise", "true");
    }

    try {
      // Render 서버 최적화: 타임아웃 설정
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25초 타임아웃
      
      const response = await fetch(pythonServerUrl, {
        method: "POST",
        body: requestFormData,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorText = "";
        try {
          errorText = await response.text();
        } catch (e) {
          errorText = `HTTP ${response.status}`;
        }
        
        console.error("Python 서버 응답 오류:", response.status, errorText);
        
        if (response.status === 422) {
          return NextResponse.json(
            {
              error: "모자이크 보정 처리에 실패했습니다.",
              note: "Python 서버가 요청 형식을 인식하지 못했습니다.",
              details: errorText || "Unprocessable Entity",
              errorCode: "INVALID_REQUEST_FORMAT",
            },
            { status: 500 }
          );
        }
        
        return NextResponse.json(
          {
            error: "모자이크 보정 처리에 실패했습니다.",
            note: "Python 서버 요청이 실패했습니다.",
            details: errorText || `HTTP ${response.status}`,
            errorCode: "PYTHON_SERVER_ERROR",
          },
          { status: response.status || 500 }
        );
      }

      // 응답을 한 번만 읽기
      const contentType = response.headers.get("content-type") || "";
      const responseBuffer = await response.arrayBuffer();
      const responseSize = responseBuffer.byteLength;
      
      let result: any = null;
      let enhancedData: string | null = null;
      
      try {
        if (contentType.includes("application/json")) {
          const text = new TextDecoder().decode(responseBuffer);
          result = JSON.parse(text);
        } else if (contentType.includes("image/")) {
          const base64 = Buffer.from(responseBuffer).toString("base64");
          const mimeType = contentType.split(";")[0];
          enhancedData = `data:${mimeType};base64,${base64}`;
        } else {
          const text = new TextDecoder().decode(responseBuffer);
          if (text.trim().startsWith("data:image/")) {
            enhancedData = text.trim();
          } else if (text.trim().startsWith("{")) {
            result = JSON.parse(text);
          } else {
            const cleanText = text.trim().replace(/\s/g, "");
            if (cleanText.length > 100 && /^[A-Za-z0-9+/=]+$/.test(cleanText)) {
              enhancedData = `data:image/png;base64,${cleanText}`;
            } else {
              result = JSON.parse(text);
            }
          }
        }
        
        // 다양한 필드명에서 이미지 데이터 추출
        if (!enhancedData && result) {
          enhancedData = result?.enhanced || 
                        result?.data || 
                        result?.image || 
                        result?.result || 
                        result?.output ||
                        result?.processed_image ||
                        result?.enhanced_image ||
                        result?.image_data ||
                        result?.image_base64 ||
                        result?.encoded_image ||
                        null;
          
          // 확인 메시지만 있는 경우
          if (!enhancedData && result?.message) {
            throw new Error("RENDER_SERVER_PROCESSING_INCOMPLETE");
          }
        }
        
        // Base64 데이터 URL 형식 정규화
        if (enhancedData) {
          if (typeof enhancedData !== "string") {
            enhancedData = String(enhancedData);
          }
          if (!enhancedData.startsWith("data:image/")) {
            if (!enhancedData.startsWith("data:")) {
              enhancedData = `data:image/png;base64,${enhancedData}`;
            }
          }
          
          return NextResponse.json({
            enhanced: enhancedData,
            scale: scale,
          });
        } else {
          // 마지막 시도: 전체 응답을 Base64로 변환
          if (responseSize > 1000 && !contentType.includes("application/json")) {
            const base64 = Buffer.from(responseBuffer).toString("base64");
            return NextResponse.json({
              enhanced: `data:image/png;base64,${base64}`,
              scale: scale,
            });
          }
          
          return NextResponse.json(
            {
              error: "Python 서버 응답 형식 오류",
              details: "응답에 이미지 데이터를 찾을 수 없습니다.",
              debug: {
                contentType: contentType,
                responseSize: responseSize,
                resultKeys: result ? Object.keys(result) : [],
              },
            },
            { status: 500 }
          );
        }
      } catch (parseError) {
        console.error("응답 파싱 오류:", parseError);
        
        // 마지막 시도: 전체 응답을 Base64로 변환
        if (responseSize > 100) {
          try {
            const base64 = Buffer.from(responseBuffer).toString("base64");
            return NextResponse.json({
              enhanced: `data:image/png;base64,${base64}`,
              scale: scale,
            });
          } catch (e) {
            console.error("Base64 변환 실패:", e);
          }
        }
        
        return NextResponse.json(
          {
            error: "응답 파싱에 실패했습니다.",
            details: parseError instanceof Error ? parseError.message : String(parseError),
          },
          { status: 500 }
        );
      }
    } catch (fetchError) {
      console.error("Python 서버 요청 실패:", fetchError);
      
      // Render 서버 타임아웃 감지
      const isTimeout = fetchError instanceof Error && 
                       (fetchError.name === "AbortError" || 
                        fetchError.message.includes("timeout") ||
                        fetchError.message.includes("aborted"));
      
      if (isTimeout) {
        return NextResponse.json(
          {
            error: "모자이크 보정 처리 시간이 초과되었습니다.",
            note: "Render 서버가 처리 중이거나 타임아웃이 발생했습니다.",
            details: fetchError instanceof Error ? fetchError.message : String(fetchError),
            errorCode: "RENDER_SERVER_TIMEOUT",
            fallback: true,
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        {
          error: "Python 서버 요청에 실패했습니다.",
          note: "서버 연결을 확인해주세요.",
          details: fetchError instanceof Error ? fetchError.message : String(fetchError),
          errorCode: "NETWORK_ERROR",
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

/**
 * 로컬 환경: Python 스크립트 직접 실행
 */
async function executeLocalPython(
  imageFile: File,
  scale: number,
  mosaicStrengthStr: string | null,
  enhanceEdges: boolean,
  denoise: boolean
): Promise<NextResponse> {
  const tempDir = path.join(process.cwd(), "temp");
  const inputPath = path.join(tempDir, `input_${Date.now()}.png`);
  const outputPath = path.join(tempDir, `output_${Date.now()}.png`);

  try {
    // temp 디렉토리 생성
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // 이미지 파일 저장
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(inputPath, buffer);

    // Python 스크립트 실행
    const scriptPath = getPythonScriptPath("mosaic_superrecon.py");
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json(
        { error: "Python 스크립트를 찾을 수 없습니다.", details: scriptPath },
        { status: 500 }
      );
    }

    const args = [inputPath, outputPath, scale.toString()];
    if (mosaicStrengthStr) {
      args.push("--mosaic-strength", mosaicStrengthStr);
    }
    if (enhanceEdges) {
      args.push("--enhance-edges");
    }
    if (denoise) {
      args.push("--denoise");
    }

    const pythonProcess = spawnPython312(scriptPath, args, {
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
      },
      timeout: 300000, // 5분 타임아웃
    });

    let stdout = "";
    let stderr = "";

    pythonProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    await new Promise<void>((resolve, reject) => {
      pythonProcess.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Python script exited with code ${code}. stderr: ${stderr}`));
        }
      });

      pythonProcess.on("error", (error) => {
        reject(error);
      });
    });

    // 출력 파일 확인
    if (!fs.existsSync(outputPath)) {
      return NextResponse.json(
        { error: "Python 스크립트가 출력 파일을 생성하지 않았습니다.", details: stderr },
        { status: 500 }
      );
    }

    // 출력 이미지 읽기
    const outputBuffer = fs.readFileSync(outputPath);
    const base64 = outputBuffer.toString("base64");
    const enhancedData = `data:image/png;base64,${base64}`;

    // 임시 파일 삭제
    try {
      await unlink(inputPath);
      await unlink(outputPath);
    } catch (e) {
      console.warn("Failed to delete temp files:", e);
    }

    return NextResponse.json({
      enhanced: enhancedData,
      scale: scale,
    });
  } catch (error) {
    // 임시 파일 정리
    try {
      if (fs.existsSync(inputPath)) await unlink(inputPath);
      if (fs.existsSync(outputPath)) await unlink(outputPath);
    } catch (e) {
      console.warn("Failed to cleanup temp files:", e);
    }

    console.error("Local Python execution error:", error);
    return NextResponse.json(
      {
        error: "로컬 Python 실행에 실패했습니다.",
        details: error instanceof Error ? error.message : String(error),
        errorCode: "LOCAL_PYTHON_ERROR",
      },
      { status: 500 }
    );
  }
}
