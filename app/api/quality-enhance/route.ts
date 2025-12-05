import { NextRequest, NextResponse } from "next/server";
import { detectPythonEnvironment, getPythonScriptPath } from "@/lib/pythonEnvironment";
import { spawnPython312 } from "@/lib/pythonExecutor";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

/**
 * POST /api/quality-enhance
 * 딥러닝 초해상도(SR) 모델을 사용한 화질 개선
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
    const modelType = (formData.get("modelType") as string | null) || "general"; // "general" | "text_logo"

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
    console.log("[Quality Enhance] Python environment:", {
      mode: env.mode,
      useLocalPython: env.useLocalPython,
      pythonServerUrl: env.pythonServerUrl || "not set",
      nodeEnv: process.env.NODE_ENV || "not set",
      pythonExecutionMode: process.env.PYTHON_EXECUTION_MODE || "not set",
    });

    // 로컬 환경: Python 스크립트 직접 실행
    if (env.useLocalPython) {
      console.log("[Quality Enhance] Using local Python execution");
      return await executeLocalPython(imageFile, scale, modelType);
    }

    // Render 서버 환경: HTTP 요청
    const pythonServerUrl = env.pythonServerUrl || "https://python-ai-server-ezax.onrender.com/enhance";
    console.log("[Quality Enhance] Using remote Python server:", pythonServerUrl);
    
    const requestFormData = new FormData();
    // Python 서버가 기대하는 필드명 확인 필요 - 여러 형식 시도
    requestFormData.append("file", imageFile);
    requestFormData.append("image", imageFile); // 대체 필드명
    requestFormData.append("scale", scale.toString());
    requestFormData.append("factor", scale.toString()); // 대체 필드명
    requestFormData.append("modelType", modelType);

    try {
      // Render 서버 최적화: 타임아웃 설정 (무료 티어 30초, 유료 티어 더 길게)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25초 타임아웃 (Render 무료 티어 30초 이내)
      
      const response = await fetch(pythonServerUrl, {
        method: "POST",
        body: requestFormData,
        signal: controller.signal,
        headers: {
          // Content-Type은 FormData 사용 시 자동 설정되므로 명시하지 않음
        },
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

        // Remote 실패 시 클라이언트 사이드 폴백 사용 안내
        console.warn("Remote Python 서버 실패, 클라이언트 사이드 폴백 사용");
        return NextResponse.json(
          {
            error: "원격 서버 처리 실패",
            fallback: true,
            message: "클라이언트 사이드 처리로 자동 전환됩니다.",
          },
          { status: 200 } // 200으로 반환하여 클라이언트가 폴백 처리하도록
        );
      }

      // 응답을 한 번만 읽기
      const contentType = response.headers.get("content-type") || "";
      console.log("Python 서버 응답 Content-Type:", contentType);
      console.log("Python 서버 응답 Status:", response.status);
      
      // 응답 본문을 먼저 버퍼로 읽기 (한 번만 읽기)
      const responseBuffer = await response.arrayBuffer();
      const responseSize = responseBuffer.byteLength;
      console.log("Python 서버 응답 크기:", responseSize, "bytes");
      
      let result: any = null;
      let enhancedData: string | null = null;
      
      try {
        // Content-Type에 따라 처리
        if (contentType.includes("application/json")) {
          // JSON 응답
          const text = new TextDecoder().decode(responseBuffer);
          console.log("Python 서버 JSON 응답 (처음 500자):", text.substring(0, 500));
          
          try {
            result = JSON.parse(text);
            console.log("파싱된 JSON 키:", Object.keys(result || {}));
          } catch (e) {
            console.error("JSON 파싱 실패:", e);
            throw new Error("JSON 파싱 실패");
          }
        } else if (contentType.includes("image/")) {
          // 이미지가 직접 반환되는 경우
          const base64 = Buffer.from(responseBuffer).toString("base64");
          const mimeType = contentType.split(";")[0];
          enhancedData = `data:${mimeType};base64,${base64}`;
          console.log("Python 서버 이미지 직접 반환 완료");
        } else {
          // 텍스트 응답인 경우
          const text = new TextDecoder().decode(responseBuffer);
          console.log("Python 서버 텍스트 응답 (처음 500자):", text.substring(0, 500));
          
          // Base64 데이터 URL 형식인지 확인
          if (text.trim().startsWith("data:image/")) {
            enhancedData = text.trim();
          } else if (text.trim().startsWith("{")) {
            // JSON 형식인 경우
            try {
              result = JSON.parse(text);
            } catch (e) {
              console.error("텍스트 JSON 파싱 실패:", e);
            }
          } else {
            // 순수 Base64 문자열인지 확인
            const cleanText = text.trim().replace(/\s/g, "");
            if (cleanText.length > 100 && /^[A-Za-z0-9+/=]+$/.test(cleanText)) {
              enhancedData = `data:image/png;base64,${cleanText}`;
            } else {
              // JSON으로 다시 시도
              try {
                result = JSON.parse(text);
              } catch (e) {
                console.error("최종 파싱 실패, 원본 텍스트 사용");
                // 마지막 시도: 텍스트 전체를 Base64로 간주
                enhancedData = `data:image/png;base64,${cleanText}`;
              }
            }
          }
        }
        
        // result에서 이미지 데이터 추출 (다양한 필드명 지원)
        if (!enhancedData && result) {
          // 1순위: 이미지 데이터 필드들
          enhancedData = result?.enhanced || 
                        result?.data || 
                        result?.image || 
                        result?.result || 
                        result?.output ||
                        result?.processed_image ||
                        result?.enhanced_image ||
                        result?.url ||
                        result?.file ||
                        result?.base64 ||
                        null;
          
          // 2순위: Python 서버가 다른 형식으로 반환하는 경우 처리
          if (!enhancedData) {
            enhancedData = result?.image_data ||
                          result?.image_base64 ||
                          result?.encoded_image ||
                          result?.image_url ||
                          result?.result_image ||
                          result?.processed ||
                          null;
          }
          
          // 3순위: 응답이 확인 메시지만 있는 경우 (Render 서버 특성 고려)
          if (!enhancedData && result?.message) {
            console.warn("Python 서버가 확인 메시지만 반환:", result.message);
            console.warn("전체 응답:", JSON.stringify(result));
            
            // Render 서버에서 콜드 스타트나 타임아웃으로 인해 처리 중단된 경우 → 로컬 폴백
            console.warn("원격 처리 미완료, 로컬 폴백 실행");
            return await executeLocalPython(imageFile, scale, modelType);
          }
        }
        
        // enhancedData가 문자열이 아닌 경우 처리
        if (enhancedData && typeof enhancedData !== "string") {
          console.warn("enhancedData가 문자열이 아님, 변환 시도:", typeof enhancedData);
          enhancedData = String(enhancedData);
        }
        
        // Base64 데이터 URL 형식 정규화
        if (enhancedData) {
          // data:image/ 형식이 아니면 추가
          if (!enhancedData.startsWith("data:image/")) {
            if (enhancedData.startsWith("data:")) {
              // 이미 data:로 시작하면 그대로 사용
            } else {
              // Base64 문자열만 있는 경우
              enhancedData = `data:image/png;base64,${enhancedData}`;
            }
          }
          
          console.log("최종 enhancedData 길이:", enhancedData.length);
          console.log("최종 enhancedData 시작:", enhancedData.substring(0, 50));
          
          return NextResponse.json({
            enhanced: enhancedData,
            scale: scale,
          });
        } else {
          // 이미지 데이터를 찾을 수 없으면 클라이언트 사이드 폴백 사용
          console.warn("원격 응답에서 이미지 데이터를 찾을 수 없음, 클라이언트 사이드 폴백 사용");
          return NextResponse.json(
            {
              error: "원격 서버 응답 형식 오류",
              fallback: true,
              message: "클라이언트 사이드 처리로 자동 전환됩니다.",
            },
            { status: 200 }
          );
        }
      } catch (parseError) {
        console.error("응답 파싱 오류:", parseError);
        console.error("응답 크기:", responseSize);

        console.warn("원격 응답 파싱 실패, 클라이언트 사이드 폴백 사용");
        return NextResponse.json(
          {
            error: "원격 서버 응답 파싱 실패",
            fallback: true,
            message: "클라이언트 사이드 처리로 자동 전환됩니다.",
          },
          { status: 200 }
        );
      }
    } catch (fetchError) {
      console.error("Python 서버 요청 실패:", fetchError);
      
      console.warn("원격 Python 서버 요청 실패, 클라이언트 사이드 폴백 사용");
      return NextResponse.json(
        {
          error: "원격 서버 연결 실패",
          fallback: true,
          message: "클라이언트 사이드 처리로 자동 전환됩니다.",
        },
        { status: 200 }
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
async function executeLocalPython(imageFile: File, scale: number, modelType: string = "general"): Promise<NextResponse> {
  const tempDir = path.join(process.cwd(), "temp");
  const timestamp = Date.now();
  const inputPath = path.join(tempDir, `input_${timestamp}.png`);
  const outputPath = path.join(tempDir, `output_${timestamp}.png`);
  
  // 함수 스코프에서 선언 (catch 블록에서도 사용 가능)
  let stdout = "";
  let stderr = "";

  try {
    // temp 디렉토리 생성
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log("[Local Python] Created temp directory:", tempDir);
    }

    // 이미지 파일 저장
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(inputPath, buffer);
    console.log("[Local Python] Input file saved:", inputPath, "Size:", buffer.length, "bytes");

    // 모델 타입에 따라 스크립트 선택
    const scriptName = modelType === "text_logo" ? "quality_enhance_text.py" : "quality_enhance.py";
    const scriptPath = getPythonScriptPath(scriptName);
    
    if (!fs.existsSync(scriptPath)) {
      console.error("[Local Python] Script not found:", scriptPath);
      // 폴백: 일반 스크립트 사용
      const fallbackScript = getPythonScriptPath("quality_enhance.py");
      if (!fs.existsSync(fallbackScript)) {
        return NextResponse.json(
          { error: "Python 스크립트를 찾을 수 없습니다.", details: scriptPath },
          { status: 500 }
        );
      }
      console.warn("[Local Python] Using fallback script:", fallbackScript);
    }

    console.log("[Local Python] Executing script:", scriptPath);
    console.log("[Local Python] Model type:", modelType);
    console.log("[Local Python] Input:", inputPath);
    console.log("[Local Python] Output:", outputPath);
    console.log("[Local Python] Scale:", scale);

    // Windows 경로를 Python 스크립트가 이해할 수 있는 형식으로 변환
    const normalizedInputPath = inputPath.replace(/\\/g, "/");
    const normalizedOutputPath = outputPath.replace(/\\/g, "/");

    // Python 스크립트는 --input, --output, --scale 형식의 인자를 받음
    const pythonProcess = spawnPython312(scriptPath, [
      "--input", normalizedInputPath,
      "--output", normalizedOutputPath,
      "--scale", scale.toString()
    ], {
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
        LANG: "en_US.UTF-8",
        LC_ALL: "en_US.UTF-8",
      },
      timeout: 300000, // 5분 타임아웃
    });

    pythonProcess.stdout.on("data", (data) => {
      const text = data.toString("utf-8");
      stdout += text;
      console.log("[Local Python] stdout:", text.trim());
    });

    pythonProcess.stderr.on("data", (data) => {
      const text = data.toString("utf-8");
      stderr += text;
      console.log("[Local Python] stderr:", text.trim());
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        pythonProcess.kill("SIGTERM");
        reject(new Error("Python script execution timeout (5 minutes)"));
      }, 300000); // 5분 타임아웃

      pythonProcess.on("close", (code, signal) => {
        clearTimeout(timeout);
        console.log("[Local Python] Process exited with code:", code, "signal:", signal);
        console.log("[Local Python] Full stdout:", stdout);
        console.log("[Local Python] Full stderr:", stderr);
        
        if (code === 0) {
          resolve();
        } else {
          const errorMsg = stderr || stdout || "Unknown error";
          reject(new Error(`Python script exited with code ${code}. ${errorMsg}`));
        }
      });

      pythonProcess.on("error", (error) => {
        clearTimeout(timeout);
        console.error("[Local Python] Process spawn error:", error);
        stderr += `\nSpawn error: ${error.message}`;
        reject(error);
      });
    });

    // 출력 파일 확인 (약간의 지연 후 확인 - 파일 시스템 동기화 대기)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (!fs.existsSync(outputPath)) {
      console.error("[Local Python] Output file not found:", outputPath);
      console.error("[Local Python] Full stderr:", stderr);
      console.error("[Local Python] Full stdout:", stdout);
      return NextResponse.json(
        { 
          error: "Python 스크립트가 출력 파일을 생성하지 않았습니다.", 
          details: stderr || stdout || "No error message",
          errorCode: "NO_OUTPUT_FILE",
          fallback: true,
        },
        { status: 500 }
      );
    }

    // 출력 이미지 읽기
    const outputBuffer = fs.readFileSync(outputPath);
    if (outputBuffer.length === 0) {
      console.error("[Local Python] Output file is empty:", outputPath);
      return NextResponse.json(
        { 
          error: "출력 파일이 비어있습니다.", 
          details: stderr || stdout,
          errorCode: "EMPTY_OUTPUT_FILE",
          fallback: true,
        },
        { status: 500 }
      );
    }

    const base64 = outputBuffer.toString("base64");
    const enhancedData = `data:image/png;base64,${base64}`;

    console.log("[Local Python] Success! Output file size:", outputBuffer.length, "bytes");

    // 임시 파일 삭제
    try {
      if (fs.existsSync(inputPath)) await unlink(inputPath);
      if (fs.existsSync(outputPath)) await unlink(outputPath);
      console.log("[Local Python] Temp files cleaned up");
    } catch (e) {
      console.warn("[Local Python] Failed to delete temp files:", e);
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
      console.warn("[Local Python] Failed to cleanup temp files:", e);
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Local Python] Execution error:", errorMessage);
    console.error("[Local Python] Error details:", {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      inputPath,
      outputPath,
      scriptPath: getPythonScriptPath("quality_enhance.py"),
      stdout: stdout || "no stdout",
      stderr: stderr || "no stderr",
    });
    
    // Python 실행 실패 시 클라이언트 사이드 폴백 사용 가능하도록 안내
    return NextResponse.json(
      {
        error: "로컬 Python 실행에 실패했습니다.",
        details: errorMessage,
        errorCode: "LOCAL_PYTHON_ERROR",
        fallback: true, // 클라이언트 사이드 폴백 사용 가능
        debug: {
          scriptPath: getPythonScriptPath("quality_enhance.py"),
          inputPath,
          outputPath,
          stdout: stdout || "no stdout",
          stderr: stderr || "no stderr",
        },
      },
      { status: 500 }
    );
  }
}
