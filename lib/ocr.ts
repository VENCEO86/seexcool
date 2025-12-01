/**
 * OCR (Optical Character Recognition) 기능
 * Tesseract.js 기반 브라우저 OCR
 */

export interface OCRResult {
  text: string;
  words: Array<{
    text: string;
    bbox: { x: number; y: number; width: number; height: number };
    confidence: number;
  }>;
  confidence: number;
}

/**
 * 이미지에서 텍스트 추출 (OCR)
 */
export async function extractText(imageSource: ImageData | HTMLCanvasElement | HTMLImageElement): Promise<OCRResult> {
  try {
    // 동적 import로 Tesseract.js 로드 (번들 크기 최적화)
    const Tesseract = await import("tesseract.js");
    
    let source: string | HTMLCanvasElement | HTMLImageElement;
    if (imageSource instanceof HTMLCanvasElement || imageSource instanceof HTMLImageElement) {
      source = imageSource;
    } else {
      // ImageData를 Canvas로 변환
      const canvas = document.createElement("canvas");
      canvas.width = imageSource.width;
      canvas.height = imageSource.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Cannot get canvas context");
      ctx.putImageData(imageSource, 0, 0);
      source = canvas;
    }

    const result = await Tesseract.default.recognize(source, "kor+eng", {
      logger: (m) => {
        // 개발 환경에서만 로그 출력
        if (process.env.NODE_ENV === "development" && m.status === "recognizing text") {
          console.log(`OCR 진행률: ${Math.round(m.progress * 100)}%`);
        }
      },
    });

    // Tesseract.js 결과 타입 단언
    const data = result.data as any;

    // Tesseract.js API 구조에 맞게 수정
    const words: Array<{
      text: string;
      bbox: { x: number; y: number; width: number; height: number };
      confidence: number;
    }> = [];

    // data.words 또는 data.symbols 사용
    if (data.words && Array.isArray(data.words)) {
      // words가 직접 있는 경우
      words.push(...data.words.map((word: any) => ({
        text: word.text || "",
        bbox: {
          x: word.bbox?.x0 || 0,
          y: word.bbox?.y0 || 0,
          width: (word.bbox?.x1 || 0) - (word.bbox?.x0 || 0),
          height: (word.bbox?.y1 || 0) - (word.bbox?.y0 || 0),
        },
        confidence: word.confidence || 0,
      })));
    } else if (data.symbols && Array.isArray(data.symbols)) {
      // symbols를 words로 그룹화
      const wordMap = new Map<string, { symbols: any[] }>();
      data.symbols.forEach((symbol: any) => {
        const wordText = symbol.text || "";
        if (!wordMap.has(wordText)) {
          wordMap.set(wordText, { symbols: [] });
        }
        wordMap.get(wordText)!.symbols.push(symbol);
      });

      wordMap.forEach((wordData, text) => {
        const symbols = wordData.symbols;
        if (symbols.length > 0) {
          const firstSymbol = symbols[0];
          const lastSymbol = symbols[symbols.length - 1];
          words.push({
            text,
            bbox: {
              x: firstSymbol.bbox?.x0 || 0,
              y: firstSymbol.bbox?.y0 || 0,
              width: (lastSymbol.bbox?.x1 || 0) - (firstSymbol.bbox?.x0 || 0),
              height: (lastSymbol.bbox?.y1 || 0) - (firstSymbol.bbox?.y0 || 0),
            },
            confidence: symbols.reduce((sum, s) => sum + (s.confidence || 0), 0) / symbols.length,
          });
        }
      });
    }

    return {
      text: data.text || "",
      words,
      confidence: data.confidence || 0,
    };
  } catch (error) {
    throw new Error(`OCR 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Canvas에 OCR 결과 바운딩 박스 그리기
 */
export function drawOCRBoundingBoxes(
  canvas: HTMLCanvasElement,
  ocrResult: OCRResult,
  color: string = "#00ff00"
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.font = "12px Arial";
  ctx.fillStyle = color;

  ocrResult.words.forEach((word) => {
    // 바운딩 박스 그리기
    ctx.strokeRect(word.bbox.x, word.bbox.y, word.bbox.width, word.bbox.height);
    
    // 텍스트 표시 (선택적)
    if (word.confidence > 50) {
      ctx.fillText(
        word.text,
        word.bbox.x,
        word.bbox.y - 5
      );
    }
  });
}

