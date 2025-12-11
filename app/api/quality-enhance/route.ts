import { NextRequest, NextResponse } from "next/server";
import { detectPythonEnvironment, getPythonScriptPath } from "@/lib/pythonEnvironment";
import { spawnPython312 } from "@/lib/pythonExecutor";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

/**
 * 화질 개선된 이미지 검증
 * 원본 이미지와 비교하여 실제로 업스케일되었는지 확인
 */
async function validateEnhancedImage(
  originalFile: File,
  enhancedDataUrl: string,
  expectedScale: number
): Promise<{
  isValid: boolean;
  reason?: string;
  originalSize: { width: number; height: number };
  enhancedSize: { width: number; height: number };
  actualScale: number;
  isSameSize: boolean;
}> {
  try {
    // 원본 이미지 크기 읽기
    const originalArrayBuffer = await originalFile.arrayBuffer();
    const originalBuffer = Buffer.from(originalArrayBuffer);
    const originalSize = await getImageDimensions(originalBuffer);
    
    // 개선된 이미지 크기 읽기
    const enhancedBuffer = Buffer.from(
      enhancedDataUrl.replace(/^data:image\/[a-z]+;base64,/, ""),
      "base64"
    );
    const enhancedSize = await getImageDimensions(enhancedBuffer);
    
    // 실제 스케일 계산
    const widthScale = enhancedSize.width / originalSize.width;
    const heightScale = enhancedSize.height / originalSize.height;
    const actualScale = Math.min(widthScale, heightScale); // 더 작은 값 사용 (비율 유지)
    
    // 크기 비교
    const isSameSize = 
      originalSize.width === enhancedSize.width && 
      originalSize.height === enhancedSize.height;
    
    // 검증 기준:
    // 1. 크기가 동일하면 실패
    // 2. 실제 스케일이 예상 스케일의 80% 미만이면 실패
    // 3. 실제 스케일이 1.1 미만이면 실패 (거의 변화 없음)
    if (isSameSize) {
      return {
        isValid: false,
        reason: "원본 이미지와 크기가 동일함",
        originalSize,
        enhancedSize,
        actualScale,
        isSameSize: true,
      };
    }
    
    if (actualScale < 1.1) {
      return {
        isValid: false,
        reason: `실제 스케일이 너무 작음 (${actualScale.toFixed(2)}배)`,
        originalSize,
        enhancedSize,
        actualScale,
        isSameSize: false,
      };
    }
    
    if (actualScale < expectedScale * 0.8) {
      return {
        isValid: false,
        reason: `실제 스케일이 예상보다 작음 (예상: ${expectedScale}배, 실제: ${actualScale.toFixed(2)}배)`,
        originalSize,
        enhancedSize,
        actualScale,
        isSameSize: false,
      };
    }
    
    return {
      isValid: true,
      originalSize,
      enhancedSize,
      actualScale,
      isSameSize: false,
    };
  } catch (error) {
    return {
      isValid: false,
      reason: `검증 중 오류: ${error instanceof Error ? error.message : String(error)}`,
      originalSize: { width: 0, height: 0 },
      enhancedSize: { width: 0, height: 0 },
      actualScale: 0,
      isSameSize: false,
    };
  }
}

/**
 * 이미지 버퍼에서 크기 추출 (PNG/JPEG 지원)
 */
async function getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number }> {
  // PNG 시그니처 확인
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    // PNG: IHDR 청크에서 크기 읽기
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }
  
  // JPEG 시그니처 확인
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
    let offset = 2;
    while (offset < buffer.length) {
      // JPEG 마커 찾기
      if (buffer[offset] === 0xFF && buffer[offset + 1] === 0xC0) {
        // SOF0 (Start of Frame) 마커
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }
      // 다음 마커로 이동
      const segmentLength = buffer.readUInt16BE(offset + 2);
      offset += 2 + segmentLength;
      if (offset >= buffer.length) break;
    }
  }
  
  // 파싱 실패 시 에러
  throw new Error("이미지 형식을 인식할 수 없습니다 (PNG/JPEG만 지원)");
}

/**
 * POST /api/quality-enhance
 * 딥러닝 초해상도(SR) 모델을 사용한 화질 개선
 * 
 * 하이브리드 모드:
 * - 로컬 환경: child_process로 Python 스크립트 직접 실행
 * - Render 서버: HTTP 요청으로 Python 서버 호출
 */
export async function POST(request: NextRequest) {
  const logPath = path.join(process.cwd(), ".cursor", "debug.log");
  const logEntry = (location: string, message: string, data: any) => {
    const entry = JSON.stringify({
      location,
      message,
      data,
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "API"
    }) + "\n";
    try {
      // 디렉토리가 없으면 생성
      const logDir = path.dirname(logPath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      fs.appendFileSync(logPath, entry, "utf8");
    } catch (e) {
      // 로깅 실패는 무시 (서버 동작에 영향 없음)
    }
  };
  
  try {
    logEntry("route.ts:150", "API POST request received", {});
    const formData = await request.formData();
    const imageFile = formData.get("image") as File;
    const scaleStr = formData.get("scale") as string | null;
    const modelType = (formData.get("modelType") as string | null) || "general"; // "general" | "text_logo"

    logEntry("route.ts:157", "FormData parsed", {
      hasImageFile: !!imageFile,
      imageFileName: imageFile?.name || "none",
      imageFileSize: imageFile?.size || 0,
      scaleStr,
      modelType
    });

    if (!imageFile) {
      logEntry("route.ts:160", "Error: no image file", {});
      return NextResponse.json(
        { error: "이미지 파일이 필요합니다." },
        { status: 400 }
      );
    }

    const scale = scaleStr ? parseFloat(scaleStr) : 2.0;
    logEntry("route.ts:165", "Scale parsed", { scaleStr, scale, isNaN: isNaN(scale) });
    if (isNaN(scale) || scale <= 1.0 || scale > 4.0) {
      logEntry("route.ts:167", "Error: invalid scale", { scale, isNaN: isNaN(scale) });
      return NextResponse.json(
        { error: "scale은 1.0보다 크고 4.0 이하여야 합니다." },
        { status: 400 }
      );
    }

    // 환경 감지
    const env = detectPythonEnvironment();
    logEntry("route.ts:173", "Python environment detected", {
      mode: env.mode,
      useLocalPython: env.useLocalPython,
      pythonServerUrl: env.pythonServerUrl || "not set",
      nodeEnv: process.env.NODE_ENV || "not set",
      pythonExecutionMode: process.env.PYTHON_EXECUTION_MODE || "not set",
    });
    console.log("[Quality Enhance] Python environment:", {
      mode: env.mode,
      useLocalPython: env.useLocalPython,
      pythonServerUrl: env.pythonServerUrl || "not set",
      nodeEnv: process.env.NODE_ENV || "not set",
      pythonExecutionMode: process.env.PYTHON_EXECUTION_MODE || "not set",
    });

    // 로컬 환경: Python 스크립트 직접 실행
    if (env.useLocalPython) {
      logEntry("route.ts:183", "Using local Python execution", { scale, modelType });
      console.log("[Quality Enhance] Using local Python execution");
      const result = await executeLocalPython(imageFile, scale, modelType);
      logEntry("route.ts:186", "Local Python execution completed", { 
        status: result.status,
        hasBody: !!result.body 
      });
      return result;
    }

    // Render 서버 환경: HTTP 요청으로 Python 서버 호출
    // 원격 Python 서버가 설정되어 있으면 호출 시도, 실패 시 클라이언트 사이드 폴백
    const pythonServerUrl = env.pythonServerUrl || "https://python-ai-server-ezax.onrender.com/enhance";
    console.log("[Quality Enhance] Using remote Python server:", pythonServerUrl);
    
    // 재시도 로직: Render 무료 인스턴스 콜드 스타트 대응
    const maxRetries = 2; // 최대 2번 시도 (첫 시도 + 1회 재시도)
    let lastError: any = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[Quality Enhance] 원격 서버 호출 시도 ${attempt}/${maxRetries}`);
      
      const requestFormData = new FormData();
      // Python 서버가 기대하는 필드명 확인 필요 - 여러 형식 시도
      requestFormData.append("file", imageFile);
      requestFormData.append("image", imageFile); // 대체 필드명
      requestFormData.append("scale", scale.toString());
      requestFormData.append("factor", scale.toString()); // 대체 필드명
      requestFormData.append("modelType", modelType);

      try {
      // Render 무료 인스턴스 콜드 스타트 대응: 첫 요청 시 최대 60초 대기
      // 무료 인스턴스는 비활성 시 50초 이상 지연될 수 있음
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60초 타임아웃
      
      console.log("[Quality Enhance] 원격 Python 서버 호출 시작:", {
        url: pythonServerUrl,
        scale,
        modelType,
        timeout: "60초",
      });
      
      const response = await fetch(pythonServerUrl, {
        method: "POST",
        body: requestFormData,
        signal: controller.signal,
        headers: {
          // Content-Type은 FormData 사용 시 자동 설정되므로 명시하지 않음
        },
      });
      
      clearTimeout(timeoutId);
      
      console.log("[Quality Enhance] 원격 Python 서버 응답 수신:", {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get("content-type"),
        attempt,
      });

      if (!response.ok) {
        // 5xx 에러는 서버 문제이므로 재시도 가능
        // 4xx 에러는 클라이언트 문제이므로 재시도 불필요
        if (response.status >= 500 && attempt < maxRetries) {
          console.warn(`⚠️ 서버 오류 (${response.status}), ${attempt + 1}번째 시도 대기 중...`);
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기 후 재시도
          continue;
        }
        let errorText = "";
        try {
          errorText = await response.text();
        } catch (e) {
          errorText = `HTTP ${response.status}`;
        }
        
        console.error("❌ Python 서버 응답 오류:", {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText.substring(0, 500),
          url: pythonServerUrl,
          scale,
          modelType,
        });

        // Remote 실패 시 로컬 Python 실행 시도 (Render 서버에서도 가능하면)
        console.warn("⚠️ 원격 Python 서버 실패, 로컬 Python 실행 시도");
        try {
          const localResult = await executeLocalPython(imageFile, scale, modelType);
          // 로컬 실행이 성공하면 반환
          if (localResult.status === 200) {
            const localJson = await localResult.json();
            if (localJson.enhanced && !localJson.fallback) {
              console.log("✅ 로컬 Python 실행 성공");
              return localResult;
            }
          }
        } catch (localError) {
          console.error("❌ 로컬 Python 실행도 실패:", localError);
        }
        
        // 로컬도 실패하면 클라이언트 사이드 폴백 사용 안내
        console.warn("⚠️ 원격 및 로컬 Python 모두 실패, 클라이언트 사이드 폴백 사용");
        return NextResponse.json(
          {
            fallback: true,
            error: "원격 서버 처리 실패",
            message: "클라이언트 사이드 처리로 자동 전환됩니다.",
            details: `HTTP ${response.status}: ${errorText.substring(0, 200)}`,
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
      
      // 응답이 비어있거나 너무 작으면 로컬 Python 실행 시도
      if (responseSize === 0 || responseSize < 100) {
        console.warn("⚠️ Python 서버 응답이 비어있거나 너무 작음 (크기:", responseSize, "bytes), 로컬 Python 실행 시도");
        try {
          const localResult = await executeLocalPython(imageFile, scale, modelType);
          // 로컬 실행이 성공하면 반환
          if (localResult.status === 200) {
            const localJson = await localResult.json();
            if (localJson.enhanced && !localJson.fallback) {
              console.log("✅ 로컬 Python 실행 성공");
              return localResult;
            }
          }
        } catch (localError) {
          console.error("❌ 로컬 Python 실행도 실패:", localError);
        }
        
        // 로컬도 실패하면 클라이언트 사이드 폴백 사용
        console.warn("⚠️ 원격 응답 비어있음 및 로컬 Python 모두 실패, 클라이언트 사이드 폴백 사용");
        return NextResponse.json(
          {
            fallback: true,
            error: "원격 서버 응답이 비어있습니다",
            message: "클라이언트 사이드 처리로 자동 전환됩니다.",
            details: `응답 크기: ${responseSize} bytes`,
          },
          { status: 200 }
        );
      }
      
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
          
          // 🔍 화질 개선 검증: 반환된 이미지가 실제로 업스케일되었는지 확인
          try {
            const validationResult = await validateEnhancedImage(
              imageFile,
              enhancedData,
              scale
            );
            
            if (!validationResult.isValid) {
              console.error("❌ 화질 개선 검증 실패:", validationResult.reason);
              console.error("검증 상세:", {
                originalSize: validationResult.originalSize,
                enhancedSize: validationResult.enhancedSize,
                expectedScale: scale,
                actualScale: validationResult.actualScale,
                isSameSize: validationResult.isSameSize,
              });
              
              // 원본 이미지와 동일하거나 크기가 증가하지 않은 경우 → 로컬 Python 실행 시도
              if (validationResult.isSameSize || validationResult.actualScale < 1.1) {
                console.warn("⚠️ 원격 서버가 원본 이미지를 반환함, 로컬 Python 실행 시도");
                return await executeLocalPython(imageFile, scale, modelType);
              }
              
              // 크기는 증가했지만 예상보다 작은 경우 → 경고 후 사용
              if (validationResult.actualScale < scale * 0.8) {
                console.warn("⚠️ 화질 개선이 예상보다 낮음, 로컬 Python 실행 시도");
                return await executeLocalPython(imageFile, scale, modelType);
              }
            } else {
              console.log("✅ 화질 개선 검증 성공:", {
                originalSize: validationResult.originalSize,
                enhancedSize: validationResult.enhancedSize,
                actualScale: validationResult.actualScale,
              });
            }
          } catch (validationError) {
            console.error("화질 개선 검증 중 오류:", validationError);
            // 검증 실패해도 이미지 데이터는 있으므로 사용 (하지만 경고)
            console.warn("⚠️ 검증 실패했지만 이미지 데이터는 있음, 사용하되 로컬 Python 실행 시도");
            // 안전을 위해 로컬 Python 실행 시도
            return await executeLocalPython(imageFile, scale, modelType);
          }
          
          // 성공: 루프 빠져나가기
          return NextResponse.json({
            enhanced: enhancedData,
            scale: scale,
          });
        } else {
          // 이미지 데이터를 찾을 수 없으면 로컬 Python 실행 시도
          console.warn("⚠️ 원격 응답에서 이미지 데이터를 찾을 수 없음, 로컬 Python 실행 시도");
          try {
            const localResult = await executeLocalPython(imageFile, scale, modelType);
            // 로컬 실행이 성공하면 반환
            if (localResult.status === 200) {
              const localJson = await localResult.json();
              if (localJson.enhanced && !localJson.fallback) {
                console.log("✅ 로컬 Python 실행 성공");
                return localResult;
              }
            }
          } catch (localError) {
            console.error("❌ 로컬 Python 실행도 실패:", localError);
          }
          
          // 로컬도 실패하면 클라이언트 사이드 폴백 사용
          console.warn("⚠️ 원격 응답 형식 오류 및 로컬 Python 모두 실패, 클라이언트 사이드 폴백 사용");
          return NextResponse.json(
            {
              error: "원격 서버 응답 형식 오류",
              fallback: true,
              message: "클라이언트 사이드 처리로 자동 전환됩니다.",
              details: "응답에서 이미지 데이터를 찾을 수 없습니다.",
            },
            { status: 200 }
          );
        }
      } catch (parseError) {
        console.error("❌ 응답 파싱 오류:", {
          error: parseError instanceof Error ? parseError.message : String(parseError),
          stack: parseError instanceof Error ? parseError.stack : undefined,
          responseSize,
          contentType,
          url: pythonServerUrl,
          attempt,
        });

        // 파싱 실패는 재시도 불가 (이미 응답을 받았으므로)
        // 로컬 Python 실행 시도
        console.warn("⚠️ 원격 응답 파싱 실패, 로컬 Python 실행 시도");
        try {
          const localResult = await executeLocalPython(imageFile, scale, modelType);
          // 로컬 실행이 성공하면 반환
          if (localResult.status === 200) {
            const localJson = await localResult.json();
            if (localJson.enhanced && !localJson.fallback) {
              console.log("✅ 로컬 Python 실행 성공");
              return localResult;
            }
          }
        } catch (localError) {
          console.error("❌ 로컬 Python 실행도 실패:", localError);
        }

        // 로컬도 실패하면 클라이언트 사이드 폴백 사용
        console.warn("⚠️ 원격 파싱 및 로컬 Python 모두 실패, 클라이언트 사이드 폴백 사용");
        return NextResponse.json(
          {
            error: "원격 서버 응답 파싱 실패",
            fallback: true,
            message: "클라이언트 사이드 처리로 자동 전환됩니다.",
            details: parseError instanceof Error ? parseError.message : String(parseError),
          },
          { status: 200 }
        );
      }
      
      // 성공적으로 처리되었으면 루프 종료 (위의 return 문에서 이미 종료됨)
      break;
      
      } catch (fetchError) {
        // 네트워크 오류는 재시도 가능
        if (attempt < maxRetries) {
          const isTimeout = fetchError instanceof Error && 
            (fetchError.name === 'AbortError' || fetchError.message.includes('timeout'));
          
          if (isTimeout) {
            console.warn(`⚠️ 타임아웃 발생, ${attempt + 1}번째 시도 대기 중... (콜드 스타트 가능성)`);
            await new Promise(resolve => setTimeout(resolve, 3000)); // 3초 대기 후 재시도
            lastError = fetchError;
            continue;
          }
          
          // 기타 네트워크 오류도 재시도
          console.warn(`⚠️ 네트워크 오류, ${attempt + 1}번째 시도 대기 중...`);
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기 후 재시도
          lastError = fetchError;
          continue;
        }
        
        // 모든 재시도 실패
        lastError = fetchError;
        break; // 재시도 루프 종료
      }
    }
    
    // 모든 재시도 실패 시 처리
    if (lastError) {
      console.error("❌ Python 서버 요청 실패 (모든 재시도 실패):", {
        error: lastError instanceof Error ? lastError.message : String(lastError),
        stack: lastError instanceof Error ? lastError.stack : undefined,
        url: pythonServerUrl,
        scale,
        modelType,
        attempts: maxRetries,
      });
      
      // 네트워크 오류 시 로컬 Python 실행 시도 (Render 서버에서는 불가능할 수 있음)
      console.warn("⚠️ 원격 Python 서버 연결 실패 (모든 재시도 실패), 클라이언트 사이드 폴백 사용");
      return NextResponse.json(
        {
          error: "원격 서버 연결 실패",
          fallback: true,
          message: "클라이언트 사이드 처리로 자동 전환됩니다.",
          details: lastError instanceof Error ? lastError.message : String(lastError),
        },
        { status: 200 }
      );
    }
    
    // 이 부분은 실행되지 않아야 하지만, 타입 안전성을 위해 추가
    return NextResponse.json(
      {
        error: "예상치 못한 오류",
        fallback: true,
        message: "클라이언트 사이드 처리로 자동 전환됩니다.",
      },
      { status: 200 }
    );
  } catch (outerError) {
    // 루프 외부에서 발생한 오류 처리
    console.error("❌ 예상치 못한 오류:", outerError);
    return NextResponse.json(
      {
        error: "요청 처리 중 오류가 발생했습니다.",
        details: outerError instanceof Error ? outerError.message : String(outerError),
        fallback: true,
      },
      { status: 500 }
    );
  }
}

/**
 * 로컬 환경: Python 스크립트 직접 실행
 */
async function executeLocalPython(imageFile: File, scale: number, modelType: string = "general"): Promise<NextResponse> {
  const logPath = path.join(process.cwd(), ".cursor", "debug.log");
  const logEntry = (location: string, message: string, data: any) => {
    const entry = JSON.stringify({
      location,
      message,
      data,
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "LOCAL_PYTHON"
    }) + "\n";
    try {
      // 디렉토리가 없으면 생성
      const logDir = path.dirname(logPath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      fs.appendFileSync(logPath, entry, "utf8");
    } catch (e) {
      // 로깅 실패는 무시 (서버 동작에 영향 없음)
    }
  };
  
  const tempDir = path.join(process.cwd(), "temp");
  const timestamp = Date.now();
  const inputPath = path.join(tempDir, `input_${timestamp}.png`);
  const outputPath = path.join(tempDir, `output_${timestamp}.png`);
  
  logEntry("route.ts:643", "executeLocalPython started", { scale, modelType, inputPath, outputPath });
  
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
    
    logEntry("route.ts:667", "Script path determined", { scriptName, scriptPath, exists: fs.existsSync(scriptPath) });
    
    if (!fs.existsSync(scriptPath)) {
      console.error("[Local Python] Script not found:", scriptPath);
      logEntry("route.ts:670", "Script not found, trying fallback", { scriptPath });
      // 폴백: 일반 스크립트 사용
      const fallbackScript = getPythonScriptPath("quality_enhance.py");
      if (!fs.existsSync(fallbackScript)) {
        logEntry("route.ts:675", "Fallback script also not found", { fallbackScript });
        return NextResponse.json(
          { error: "Python 스크립트를 찾을 수 없습니다.", details: scriptPath },
          { status: 500 }
        );
      }
      console.warn("[Local Python] Using fallback script:", fallbackScript);
      logEntry("route.ts:681", "Using fallback script", { fallbackScript });
    }

    console.log("[Local Python] Executing script:", scriptPath);
    console.log("[Local Python] Model type:", modelType);
    console.log("[Local Python] Input:", inputPath);
    console.log("[Local Python] Output:", outputPath);
    console.log("[Local Python] Scale:", scale);
    
    logEntry("route.ts:688", "About to execute Python script", { scriptPath, scale, modelType, inputPath, outputPath });

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
      logEntry("route.ts:709", "Python stdout", { text: text.trim().substring(0, 200) });
    });

    pythonProcess.stderr.on("data", (data) => {
      const text = data.toString("utf-8");
      stderr += text;
      console.log("[Local Python] stderr:", text.trim());
      logEntry("route.ts:715", "Python stderr", { text: text.trim().substring(0, 200) });
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
        logEntry("route.ts:727", "Python process closed", { code, signal, stdoutLength: stdout.length, stderrLength: stderr.length });
        
        if (code === 0) {
          logEntry("route.ts:730", "Python process succeeded", {});
          resolve();
        } else {
          const errorMsg = stderr || stdout || "Unknown error";
          logEntry("route.ts:733", "Python process failed", { code, errorMsg: errorMsg.substring(0, 200) });
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
    logEntry("route.ts:782", "Output file generated successfully", { 
      outputSize: outputBuffer.length, 
      base64Length: base64.length,
      enhancedDataLength: enhancedData.length 
    });

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
