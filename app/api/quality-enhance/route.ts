import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/quality-enhance
 * 딥러닝 초해상도(SR) 모델을 사용한 화질 개선
 */
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
    if (isNaN(scale) || scale <= 1.0 || scale > 4.0) {
      return NextResponse.json(
        { error: "scale은 1.0보다 크고 4.0 이하여야 합니다." },
        { status: 400 }
      );
    }

    // Python 서버로 HTTP 요청
    const pythonServerUrl = "https://python-ai-server-ezax.onrender.com/enhance";
    
    const requestFormData = new FormData();
    // Python 서버가 기대하는 필드명 확인 필요 - 여러 형식 시도
    requestFormData.append("file", imageFile);
    requestFormData.append("image", imageFile); // 대체 필드명
    requestFormData.append("scale", scale.toString());
    requestFormData.append("factor", scale.toString()); // 대체 필드명

    try {
      const response = await fetch(pythonServerUrl, {
        method: "POST",
        body: requestFormData,
        headers: {
          // Content-Type은 FormData 사용 시 자동 설정되므로 명시하지 않음
        },
      });

      if (!response.ok) {
        let errorText = "";
        try {
          errorText = await response.text();
        } catch (e) {
          errorText = `HTTP ${response.status}`;
        }
        
        console.error("Python 서버 응답 오류:", response.status, errorText);
        
        // 422 오류는 요청 형식 문제이므로 더 자세한 정보 제공
        if (response.status === 422) {
          return NextResponse.json(
            {
              error: "화질 개선 처리에 실패했습니다.",
              note: "Python 서버가 요청 형식을 인식하지 못했습니다.",
              details: errorText || "Unprocessable Entity",
              errorCode: "INVALID_REQUEST_FORMAT",
            },
            { status: 500 }
          );
        }
        
        return NextResponse.json(
          {
            error: "화질 개선 처리에 실패했습니다.",
            note: "Python 서버 요청이 실패했습니다.",
            details: errorText || `HTTP ${response.status}`,
            errorCode: "PYTHON_SERVER_ERROR",
          },
          { status: response.status || 500 }
        );
      }

      // 응답을 한 번만 읽기 위해 클론 생성 (응답 스트림은 한 번만 읽을 수 있음)
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
          // 응답 구조 로깅
          console.error("=== Python 서버 응답 분석 ===");
          console.error("Content-Type:", contentType);
          console.error("응답 크기:", responseSize, "bytes");
          console.error("result 타입:", typeof result);
          console.error("result:", result ? JSON.stringify(result, null, 2).substring(0, 1000) : "null");
          console.error("result 키:", result ? Object.keys(result) : "null");
          console.error("enhancedData:", enhancedData);
          
          // 마지막 시도: 전체 응답을 이미지로 간주하고 Base64로 변환
          if (responseSize > 100) { // 최소 크기 확인
            console.warn("응답에서 이미지 데이터를 찾을 수 없음. 전체 응답을 Base64로 변환 시도");
            try {
              const base64 = Buffer.from(responseBuffer).toString("base64");
              const finalData = `data:image/png;base64,${base64}`;
              console.log("전체 응답을 Base64로 변환 완료 (길이:", finalData.length, ")");
              return NextResponse.json({
                enhanced: finalData,
                scale: scale,
              });
            } catch (e) {
              console.error("Base64 변환 실패:", e);
            }
          }
          
          // 응답의 처음 부분을 Base64로 변환하여 시도
          if (responseSize > 0) {
            const sampleBase64 = Buffer.from(responseBuffer.slice(0, Math.min(100, responseSize))).toString("base64");
            console.error("응답 샘플 (Base64):", sampleBase64);
          }
          
          return NextResponse.json(
            {
              error: "Python 서버 응답 형식 오류",
              details: "응답에 이미지 데이터를 찾을 수 없습니다.",
              note: "서버 로그를 확인하세요.",
              debug: {
                contentType: contentType,
                responseSize: responseSize,
                resultType: typeof result,
                resultKeys: result ? Object.keys(result) : [],
                resultSample: result ? JSON.stringify(result).substring(0, 500) : "null",
              },
            },
            { status: 500 }
          );
        }
      } catch (parseError) {
        console.error("응답 파싱 오류:", parseError);
        console.error("응답 크기:", responseSize);
        
        // 마지막 시도: 전체 응답을 Base64로 변환 (이미지로 간주)
        if (responseSize > 100) {
          try {
            const base64 = Buffer.from(responseBuffer).toString("base64");
            console.log("파싱 오류 발생, 전체 응답을 Base64로 변환 시도");
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
            note: "서버 로그를 확인하세요.",
            debug: {
              responseSize: responseSize,
              contentType: contentType,
            },
          },
          { status: 500 }
        );
      }
    } catch (fetchError) {
      console.error("Python 서버 요청 실패:", fetchError);
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
