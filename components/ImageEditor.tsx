"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { enhanceImageQuality } from "@/lib/imageEnhancement";
import { removeBackground, type BackgroundRemovalOptions } from "@/lib/backgroundRemoval";
import { PerformanceMonitor, optimizeImageSize, isSafeImageSize } from "@/lib/performance";
// OCR, Edge Detection, Video Processing은 동적 import로 처리 (런타임 에러 방지)

interface ImageEditorProps {
  onImageProcessed?: (blob: Blob) => void;
}

export default function ImageEditor({ onImageProcessed }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnhancingQuality, setIsEnhancingQuality] = useState(false);
  const [enhancedImage, setEnhancedImage] = useState<HTMLImageElement | null>(null);
  const [enhancedScale, setEnhancedScale] = useState(1);
  const [isRemovingBackground, setIsRemovingBackground] = useState(false);
  const [hasBackgroundRemoved, setHasBackgroundRemoved] = useState(false);
  const [backgroundRemovedCanvas, setBackgroundRemovedCanvas] = useState<HTMLCanvasElement | null>(null);
  const [removalMethod, setRemovalMethod] = useState<BackgroundRemovalOptions["method"]>("auto");
  const [removalThreshold, setRemovalThreshold] = useState(35); // 기본값 상향 조정 (더 정확한 식별)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // OCR 상태 (타입 임시 처리)
  const [isExtractingText, setIsExtractingText] = useState(false);
  const [ocrResult, setOcrResult] = useState<any | null>(null);
  const [showOCRBoundingBoxes, setShowOCRBoundingBoxes] = useState(false);
  
  // Edge Detection 상태 (타입 임시 처리)
  const [isDetectingEdges, setIsDetectingEdges] = useState(false);
  const [edgeResult, setEdgeResult] = useState<any | null>(null);
  const [showEdges, setShowEdges] = useState(false);
  const [selectedContour, setSelectedContour] = useState<number | null>(null);
  
  // 비디오 상태 (타입 임시 처리)
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoThumbnails, setVideoThumbnails] = useState<any[]>([]);
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    // Clear existing timeout
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 3000);
  }, []);

  // 비디오 업로드 처리 (동적 import)
  const handleVideoUpload = useCallback(async (file: File) => {
    if (file.size > 1024 * 1024 * 1024) { // 1GB
      showToast("비디오 파일 크기는 1GB 이하여야 합니다.", "error");
      return;
    }

    setIsProcessingVideo(true);
    setVideoFile(file);
    
    try {
      const { generateVideoThumbnails } = await import("@/lib/videoProcessing");
      const thumbnails = await generateVideoThumbnails(file, 10);
      setVideoThumbnails(thumbnails);
      showToast(`비디오 썸네일 생성 완료: ${thumbnails.length}개`, "success");
    } catch (error) {
      console.error("Video processing error:", error);
      showToast("비디오 처리에 실패했습니다.", "error");
    } finally {
      setIsProcessingVideo(false);
    }
  }, [showToast]);

  const loadImage = useCallback((file: File) => {
    try {
      // 이미지 파일 지원 확장 (GIF 포함)
      if (!file.type.match(/^image\/(jpeg|jpg|png|webp|gif)$/i)) {
        // 비디오 파일 처리
        if (file.type.match(/^video\//i)) {
          handleVideoUpload(file);
          return;
        }
        showToast("JPG, PNG, WebP, GIF, MP4 파일만 지원됩니다.", "error");
        return;
      }

      // 파일 크기 제한 확대 (GIF/영상 대비)
      const maxSize = file.type.match(/^image\/gif$/i) ? 50 * 1024 * 1024 : 20 * 1024 * 1024;
      if (file.size > maxSize) {
        showToast(`파일 크기는 ${Math.round(maxSize / 1024 / 1024)}MB 이하여야 합니다.`, "error");
        return;
      }

      // 파일 크기가 0인지 확인
      if (file.size === 0) {
        showToast("파일이 비어있습니다. 다른 파일을 선택해주세요.", "error");
        return;
      }
    } catch (error) {
      console.error("File validation error:", error);
      showToast("파일 검증 중 오류가 발생했습니다.", "error");
      return;
    }

    setIsLoading(true);
    const reader = new FileReader();
    
    reader.onerror = (error) => {
      console.error("FileReader error:", error);
      showToast("파일 읽기에 실패했습니다. 파일이 손상되었거나 지원하지 않는 형식일 수 있습니다.", "error");
      setIsLoading(false);
    };

    reader.onabort = () => {
      showToast("파일 읽기가 취소되었습니다.", "error");
      setIsLoading(false);
    };

    reader.onload = (e) => {
      try {
        const result = e.target?.result;
        if (!result || typeof result !== "string") {
          throw new Error("Invalid file data");
        }

        const img = new Image();
        
        img.onerror = (error) => {
          console.error("Image loading error:", error);
          showToast("이미지 로딩에 실패했습니다. 파일 형식을 확인해주세요.", "error");
          setIsLoading(false);
        };

        img.onload = () => {
          try {
            // 이미지 크기 검증
            if (img.width === 0 || img.height === 0) {
              throw new Error("Invalid image dimensions");
            }

            setImage((prevImage) => {
              // Clean up previous image to prevent memory leaks
              if (prevImage) {
                prevImage.src = "";
              }
              return img;
            });
            setScale(1);
            setBrightness(100);
            setContrast(100);
            setIsLoading(false);
            setHasBackgroundRemoved(false);
            setBackgroundRemovedCanvas(null);
            setEnhancedImage(null);
            setEnhancedScale(1);
            showToast(`이미지가 로드되었습니다. (${img.width} × ${img.height}px)`, "success");
          } catch (error) {
            console.error("Image processing error:", error);
            showToast("이미지 처리 중 오류가 발생했습니다.", "error");
            setIsLoading(false);
          }
        };
        
        img.src = result;
      } catch (error) {
        console.error("File load error:", error);
        showToast("파일 처리 중 오류가 발생했습니다.", "error");
        setIsLoading(false);
      }
    };
    
    try {
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("FileReader read error:", error);
      showToast("파일을 읽을 수 없습니다.", "error");
      setIsLoading(false);
    }
  }, [showToast]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadImage(file);
    }
    // Reset input to allow selecting the same file again
    e.target.value = "";
  };

  const handleCameraInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadImage(file);
    }
    // Reset input to allow selecting the same file again
    e.target.value = "";
  };

  const drawCanvas = useRef<number | null>(null);
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    // 모바일 성능 최적화: willReadFrequently를 모바일에서만 true로 설정
    const isMobile = typeof window !== "undefined" && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const ctx = canvas.getContext("2d", { willReadFrequently: isMobile });
    if (!ctx) return;

    // 실제 해상도 업스케일링 (화질 개선)
    const scaledWidth = Math.round(image.width * scale);
    const scaledHeight = Math.round(image.height * scale);

    // Limit canvas size to prevent memory issues (모바일에서는 더 낮은 제한)
    const maxDimension = isMobile ? 2048 : 8192;
    const { width: optimizedWidth, height: optimizedHeight } = optimizeImageSize(
      scaledWidth,
      scaledHeight,
      maxDimension
    );
    let finalWidth = optimizedWidth;
    let finalHeight = optimizedHeight;

    // 메모리 안전성 확인
    if (!isSafeImageSize(finalWidth, finalHeight, 500)) {
      console.warn("이미지 크기가 메모리 제한을 초과할 수 있습니다. 크기를 조정합니다.");
      const { width: safeWidth, height: safeHeight } = optimizeImageSize(
        scaledWidth,
        scaledHeight,
        4096
      );
      finalWidth = safeWidth;
      finalHeight = safeHeight;
    }

    // Only resize if dimensions changed to prevent flickering
    // 모바일에서 성능 최적화: requestAnimationFrame으로 지연 렌더링
    if (canvas.width !== finalWidth || canvas.height !== finalHeight) {
      if (isMobile && typeof window !== "undefined") {
        requestAnimationFrame(() => {
          if (canvas) {
            canvas.width = finalWidth;
            canvas.height = finalHeight;
          }
        });
      } else {
        canvas.width = finalWidth;
        canvas.height = finalHeight;
      }
    }

    // Clear and redraw
    ctx.clearRect(0, 0, finalWidth, finalHeight);
    
    // 고품질 업스케일링 설정
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    
      // 딥러닝 SR 모델로 화질 개선된 이미지가 있으면 사용, 없으면 클라이언트 사이드 처리
      if (scale > 1) {
        try {
          // 딥러닝으로 개선된 이미지가 있고 현재 scale과 일치하면 사용
          if (enhancedImage && enhancedScale === scale) {
            ctx.drawImage(enhancedImage, 0, 0, finalWidth, finalHeight);
          } else {
            // 폴백: 클라이언트 사이드 Lanczos 보간 (API 호출 전 임시 미리보기)
            const enhancedCanvas = PerformanceMonitor.measure("image-enhancement", () => {
              const sourceCanvas = document.createElement("canvas");
              sourceCanvas.width = image.width;
              sourceCanvas.height = image.height;
              const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
              if (!sourceCtx) throw new Error("Cannot create source canvas");
              
              sourceCtx.drawImage(image, 0, 0);
              return enhanceImageQuality(sourceCanvas, scale);
            });
            ctx.drawImage(enhancedCanvas, 0, 0, finalWidth, finalHeight);
          }
        
        // 밝기/명암 필터는 별도로 적용 (업스케일링 후)
        if (brightness !== 100 || contrast !== 100) {
          // 필터를 적용하기 위해 ImageData 사용
          const imageData = ctx.getImageData(0, 0, finalWidth, finalHeight);
          const data = imageData.data;
          
          for (let i = 0; i < data.length; i += 4) {
            // 밝기 조절
            if (brightness !== 100) {
              const factor = brightness / 100;
              data[i] = Math.min(255, Math.max(0, data[i] * factor));     // R
              data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * factor)); // G
              data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * factor)); // B
            }
            
            // 명암 조절
            if (contrast !== 100) {
              const factor = contrast / 100;
              const intercept = 128 * (1 - factor);
              data[i] = Math.min(255, Math.max(0, data[i] * factor + intercept));     // R
              data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * factor + intercept)); // G
              data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * factor + intercept)); // B
            }
          }
          
          ctx.putImageData(imageData, 0, 0);
        }

        // OCR 바운딩 박스 그리기 (비동기로 처리하되 렌더링에는 영향 없음)
        if (showOCRBoundingBoxes && ocrResult) {
          import("@/lib/ocr").then(({ drawOCRBoundingBoxes }) => {
            drawOCRBoundingBoxes(canvas, ocrResult, "#00ff00");
          }).catch(() => {});
        }

        // Edge 표시
        if (showEdges && edgeResult) {
          // Edge를 오버레이로 표시 (원본 이미지 위에)
          const edgeCanvas = document.createElement("canvas");
          edgeCanvas.width = finalWidth;
          edgeCanvas.height = finalHeight;
          const edgeCtx = edgeCanvas.getContext("2d");
          if (edgeCtx) {
            edgeCtx.putImageData(edgeResult.edges, 0, 0);
            ctx.globalAlpha = 0.5;
            ctx.drawImage(edgeCanvas, 0, 0);
            ctx.globalAlpha = 1.0;
          }
          
          // 선택된 Contour 강조
          if (selectedContour !== null && edgeResult.contours[selectedContour]) {
            const contour = edgeResult.contours[selectedContour];
            ctx.strokeStyle = "#ff00ff";
            ctx.lineWidth = 3;
            ctx.beginPath();
            contour.forEach((point: { x: number; y: number }, idx: number) => {
              if (idx === 0) {
                ctx.moveTo(point.x, point.y);
              } else {
                ctx.lineTo(point.x, point.y);
              }
            });
            ctx.closePath();
            ctx.stroke();
          }
        }
      } catch (error) {
        // 에러 발생 시 폴백: 직접 그리기
        console.error("Enhancement error, using fallback:", error);
        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
        ctx.drawImage(image, 0, 0, finalWidth, finalHeight);
      }
    } else {
      // scale이 1배(원본)인 경우 일반 렌더링
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
      ctx.drawImage(image, 0, 0, finalWidth, finalHeight);
    }
  }, [image, scale, brightness, contrast, enhancedImage, enhancedScale]);

  useEffect(() => {
    if (!image) return;

    // Cancel previous timeout and animation frame
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }
    if (drawCanvas.current) {
      cancelAnimationFrame(drawCanvas.current);
    }

    // 디바운싱: 슬라이더 조작 시 약간의 지연 후 렌더링 (성능 최적화)
    renderTimeoutRef.current = setTimeout(() => {
      drawCanvas.current = requestAnimationFrame(() => {
        renderCanvas();
      });
    }, 50); // 50ms 디바운싱

    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
      if (drawCanvas.current) {
        cancelAnimationFrame(drawCanvas.current);
      }
    };
  }, [image, scale, brightness, contrast, renderCanvas, enhancedImage, enhancedScale]);

  // 딥러닝 SR 모델로 화질 개선 API 호출
  const enhanceQualityWithAI = useCallback(async (targetScale: number) => {
    if (!image || targetScale <= 1) {
      setEnhancedImage(null);
      setEnhancedScale(1);
      return;
    }

    // 이미 같은 scale로 개선된 이미지가 있으면 스킵
    if (enhancedImage && enhancedScale === targetScale) {
      return;
    }

    setIsEnhancingQuality(true);
    showToast("딥러닝 모델로 화질 개선 중...", "success");

    try {
      // 원본 이미지를 Blob으로 변환
      const sourceCanvas = document.createElement("canvas");
      sourceCanvas.width = image.width;
      sourceCanvas.height = image.height;
      const sourceCtx = sourceCanvas.getContext("2d");
      if (!sourceCtx) throw new Error("Cannot create source canvas");
      sourceCtx.drawImage(image, 0, 0);

      const blob = await new Promise<Blob>((resolve, reject) => {
        sourceCanvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to create blob"));
        }, "image/png");
      });

      const formData = new FormData();
      formData.append("image", blob);
      formData.append("scale", targetScale.toString());

      const res = await fetch("/api/quality-enhance", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      
      if (!res.ok) {
        const errorMsg = json?.error || json?.note || `HTTP ${res.status}`;
        const details = json?.details ? ` (${json.details})` : '';
        throw new Error(`${errorMsg}${details}`);
      }
      
      if (json?.enhanced) {
        // Base64 data URL을 이미지로 변환
        const enhancedImg = new Image();
        enhancedImg.onload = () => {
          setEnhancedImage(enhancedImg);
          setEnhancedScale(targetScale);
          showToast("화질 개선 완료!", "success");
        };
        enhancedImg.onerror = () => {
          throw new Error("Failed to load enhanced image");
        };
        enhancedImg.src = json.enhanced;
      } else {
        throw new Error(json?.error || "Unknown error");
      }
    } catch (error) {
      console.error("Quality enhancement error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error details:", errorMessage);
      
      // 에러 메시지 파싱 및 정리
      let userMessage = "화질 개선에 실패했습니다.";
      
      // JSON 응답에서 에러 정보 추출 시도
      if (errorMessage.includes("errorCode")) {
        try {
          // JSON 문자열인 경우 파싱
          const errorObj = JSON.parse(errorMessage);
          if (errorObj.error) {
            userMessage = errorObj.error;
          }
        } catch (e) {
          // JSON이 아니면 그대로 사용
        }
      }
      
      // 에러 메시지에서 주요 정보만 추출
      if (errorMessage.includes("모델 파일")) {
        userMessage = "모델 파일을 찾을 수 없습니다.";
      } else if (errorMessage.includes("라이브러리") || errorMessage.includes("ImportError")) {
        userMessage = "필수 Python 라이브러리가 설치되지 않았습니다.";
      } else if (errorMessage.includes("Python 실행")) {
        userMessage = "Python 실행에 실패했습니다.";
      } else if (errorMessage.length > 0 && errorMessage.length < 100) {
        // 짧은 에러 메시지는 그대로 표시
        userMessage = errorMessage;
      }
      
      showToast(userMessage, "error");
      setEnhancedImage(null);
      setEnhancedScale(1);
    } finally {
      setIsEnhancingQuality(false);
    }
  }, [image, enhancedImage, enhancedScale, showToast]);

  // scale 변경 시 딥러닝 API 호출 (디바운싱)
  const scaleEnhanceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!image || scale <= 1) {
      setEnhancedImage(null);
      setEnhancedScale(1);
      return;
    }

    // 기존 timeout 취소
    if (scaleEnhanceTimeoutRef.current) {
      clearTimeout(scaleEnhanceTimeoutRef.current);
    }

    // 1초 후에 API 호출 (슬라이더 조작이 끝난 후)
    scaleEnhanceTimeoutRef.current = setTimeout(() => {
      enhanceQualityWithAI(scale);
    }, 1000);

    return () => {
      if (scaleEnhanceTimeoutRef.current) {
        clearTimeout(scaleEnhanceTimeoutRef.current);
      }
    };
  }, [image, scale, enhanceQualityWithAI]);

  const downloadImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) {
      showToast("이미지를 먼저 업로드해주세요.", "error");
      return;
    }

    // 최고 품질로 다운로드 (화질 개선된 이미지)
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          showToast("다운로드에 실패했습니다.", "error");
          return;
        }

        if (onImageProcessed) {
          onImageProcessed(blob);
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `image-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("이미지가 다운로드되었습니다.");
      },
      "image/png",
      1.0 // 최고 품질로 저장
    );
  }, [image, onImageProcessed, showToast]);

  const handleBackgroundRemoval = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !image) {
      showToast("이미지를 먼저 업로드해주세요.", "error");
      return;
    }

    // 메모리 안전성 확인
    if (!isSafeImageSize(canvas.width, canvas.height, 300)) {
      showToast("이미지가 너무 큽니다. 크기를 줄여주세요.", "error");
      return;
    }

    setIsRemovingBackground(true);
    showToast("배경제거 처리 중...", "success");

    try {
      // 성능 측정을 포함한 배경제거 처리
      const resultCanvas = await PerformanceMonitor.measureAsync("background-removal", async () => {
        // 현재 캔버스 상태를 복사
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: false });
        if (!tempCtx) throw new Error("Cannot create temp canvas");

        tempCtx.drawImage(canvas, 0, 0);

        // 배경제거 적용
        const options: BackgroundRemovalOptions = {
          method: removalMethod,
          threshold: removalThreshold,
          smoothEdges: true,
        };

        return removeBackground(tempCanvas, options);
      });

      // 결과를 메인 캔버스에 적용
      const ctx = canvas.getContext("2d", { willReadFrequently: false });
      if (!ctx) throw new Error("Cannot get canvas context");

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(resultCanvas, 0, 0);

      setBackgroundRemovedCanvas(resultCanvas);
      setHasBackgroundRemoved(true);
      showToast("배경제거가 완료되었습니다.", "success");
    } catch (error) {
      console.error("Background removal error:", error);
      showToast("배경제거에 실패했습니다.", "error");
    } finally {
      setIsRemovingBackground(false);
    }
  }, [image, removalMethod, removalThreshold, showToast]);

  const downloadBackgroundRemoved = useCallback(() => {
    if (!backgroundRemovedCanvas) {
      showToast("배경제거된 이미지가 없습니다.", "error");
      return;
    }

    backgroundRemovedCanvas.toBlob(
      (blob) => {
        if (!blob) {
          showToast("다운로드에 실패했습니다.", "error");
          return;
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `image-nukki-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("배경제거된 이미지가 다운로드되었습니다.");
      },
      "image/png",
      1.0
    );
  }, [backgroundRemovedCanvas, showToast]);

  // OCR 기능 (동적 import)
  const handleExtractText = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !image) {
      showToast("이미지를 먼저 업로드해주세요.", "error");
      return;
    }

    setIsExtractingText(true);
    try {
      const { extractText } = await import("@/lib/ocr");
      const result = await PerformanceMonitor.measureAsync("ocr-extraction", async () => {
        return await extractText(canvas);
      });
      
      setOcrResult(result);
      setShowOCRBoundingBoxes(true);
      showToast(`텍스트 추출 완료: ${result.words.length}개 단어 발견`, "success");
    } catch (error) {
      console.error("OCR error:", error);
      showToast("텍스트 추출에 실패했습니다.", "error");
    } finally {
      setIsExtractingText(false);
    }
  }, [image, showToast]);

  // Edge Detection 기능 (동적 import)
  const handleDetectEdges = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !image) {
      showToast("이미지를 먼저 업로드해주세요.", "error");
      return;
    }

    setIsDetectingEdges(true);
    try {
      const { detectEdges, findContours } = await import("@/lib/edgeDetection");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Cannot get canvas context");
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      const result = await PerformanceMonitor.measureAsync("edge-detection", async () => {
        const edges = detectEdges(imageData, 50, 150);
        const contours = findContours(edges);
        return { edges, contours };
      });
      
      setEdgeResult(result);
      setShowEdges(true);
      showToast(`엣지 감지 완료: ${result.contours.length}개 영역 발견`, "success");
    } catch (error) {
      console.error("Edge detection error:", error);
      showToast("엣지 감지에 실패했습니다.", "error");
    } finally {
      setIsDetectingEdges(false);
    }
  }, [image, showToast]);

  const copyToClipboard = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !image) {
      showToast("이미지를 먼저 업로드해주세요.", "error");
      return;
    }

    // Check if clipboard API is available
    if (!navigator.clipboard || !window.ClipboardItem) {
      showToast("이 브라우저는 클립보드 복사를 지원하지 않습니다.", "error");
      return;
    }

    try {
      // 최고 품질로 클립보드 복사
      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            showToast("복사에 실패했습니다.", "error");
            return;
          }

          try {
            await navigator.clipboard.write([
              new ClipboardItem({
                "image/png": blob,
              }),
            ]);
            showToast("클립보드에 복사되었습니다.");
          } catch (error) {
            console.error("Clipboard error:", error);
            showToast("클립보드 복사에 실패했습니다.", "error");
          }
        },
        "image/png",
        1.0 // 최고 품질로 복사
      );
    } catch (error) {
      console.error("Copy error:", error);
      showToast("복사에 실패했습니다.", "error");
    }
  }, [image, showToast]);

  // Keyboard shortcuts and paste handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Prevent default paste behavior if image is being pasted
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf("image") !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            loadImage(file);
            showToast("이미지가 붙여넣기되었습니다.");
          }
          break;
        }
      }
    };

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S to download
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (image) {
          downloadImage();
        }
      }
      // Ctrl/Cmd + Shift + C to copy (only if image is loaded)
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && e.shiftKey && image) {
        e.preventDefault();
        copyToClipboard();
      }
    };

    window.addEventListener("paste", handlePaste);
    window.addEventListener("keydown", handleKeyDown);
    
    return () => {
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [image, loadImage, downloadImage, copyToClipboard]);

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-gray-900/90 backdrop-blur-sm rounded-xl p-4 sm:p-6 lg:p-8 space-y-6 border border-gray-800 shadow-2xl">
        {/* File Input */}
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileInput}
            className="hidden"
            aria-label="이미지 파일 선택"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCameraInput}
            className="hidden"
            aria-label="카메라로 촬영"
            onClick={(e) => {
              // 모바일에서 카메라 활성화를 위한 처리
              if (typeof window !== "undefined" && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
                // 모바일 환경에서 카메라 접근 허용
                const input = e.currentTarget;
                input.setAttribute("capture", "environment");
              }
            }}
          />
          <div
            className="border-2 border-dashed border-gray-700 rounded-xl p-6 sm:p-8 text-center hover:border-blue-500/50 transition-all duration-300 bg-gray-800/50 group relative overflow-hidden"
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.classList.add("border-blue-500", "bg-blue-500/10");
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.classList.remove("border-blue-500", "bg-blue-500/10");
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.classList.remove("border-blue-500", "bg-blue-500/10");
              const file = e.dataTransfer.files[0];
              if (file) {
                loadImage(file);
              }
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-purple-500/0 to-pink-500/0 group-hover:from-blue-500/5 group-hover:via-purple-500/5 group-hover:to-pink-500/5 transition-all duration-500 pointer-events-none"></div>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="flex-1 py-3 px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 flex items-center justify-center gap-2 group"
                aria-label="파일에서 이미지 업로드"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    로딩 중...
                  </span>
                ) : (
                  <>
                    <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    이미지 업로드
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  if (cameraInputRef.current) {
                    // 모바일에서 카메라 활성화
                    if (typeof window !== "undefined" && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
                      cameraInputRef.current.setAttribute("capture", "environment");
                    }
                    cameraInputRef.current.click();
                  }
                }}
                disabled={isLoading}
                className="flex-1 py-3 px-6 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 sm:hidden"
                aria-label="카메라로 촬영"
              >
                {isLoading ? "로딩 중..." : "카메라 촬영"}
              </button>
            </div>
            <p className="text-sm text-gray-400 relative z-10">
              또는 이미지를 드래그 앤 드롭하거나 <kbd className="px-2 py-1 bg-gray-700/80 border border-gray-600 rounded text-xs font-mono shadow-sm">Ctrl+V</kbd>로 붙여넣으세요
            </p>
            <div className="mt-3 text-xs text-gray-500 relative z-10">
              <span className="inline-flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                지원 형식: JPG, PNG, WebP, GIF (최대 50MB)
              </span>
            </div>
          </div>
        </div>

        {/* Canvas Preview */}
        {image && (
          <div className="space-y-4">
            <div className="flex justify-center bg-gray-800/50 rounded-xl p-4 sm:p-6 overflow-auto relative border border-gray-700/50 group">
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/95 backdrop-blur-md rounded-xl z-10 animate-fade-in">
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <svg className="animate-spin h-12 w-12 text-blue-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-6 h-6 bg-blue-500 rounded-full animate-pulse"></div>
                      </div>
                    </div>
                    <div className="text-white font-medium text-lg">처리 중...</div>
                    <div className="text-gray-400 text-sm">잠시만 기다려주세요</div>
                  </div>
                </div>
              )}
              <canvas
                ref={canvasRef}
                className="max-w-full h-auto border-2 border-gray-700 rounded-lg shadow-2xl transition-all duration-300 group-hover:border-blue-500/50 group-hover:shadow-blue-500/20"
                aria-label="편집된 이미지 미리보기"
              />
              {image && !isLoading && (
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs text-white flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  {image.width * scale} × {image.height * scale}px
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="scale-slider" className="block text-sm font-medium text-white flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                    화질 개선
                  </label>
                  <span className="text-sm font-bold text-blue-400 bg-blue-500/20 px-3 py-1 rounded-full border border-blue-500/30 shadow-lg flex items-center gap-2">
                    {Math.round(scale)}배
                    {isEnhancingQuality && (
                      <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                  </span>
                </div>
                <input
                  id="scale-slider"
                  type="range"
                  min="1"
                  max="4"
                  step="1"
                  value={Math.round(scale)}
                  onChange={(e) => {
                    const newScale = parseInt(e.target.value);
                    setScale(newScale);
                  }}
                  className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:accent-blue-500 transition-all duration-200"
                  style={{
                    background: `linear-gradient(to right, #2563eb 0%, #2563eb ${((Math.round(scale) - 1) / 3) * 100}%, #374151 ${((Math.round(scale) - 1) / 3) * 100}%, #374151 100%)`
                  }}
                  aria-label="이미지 화질 개선 조절"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1배 (원본)</span>
                  <span>2배</span>
                  <span>3배</span>
                  <span>4배</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="brightness-slider" className="block text-sm font-medium text-white flex items-center gap-2">
                    <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    밝기
                  </label>
                  <span className="text-sm font-bold text-yellow-400 bg-yellow-500/20 px-3 py-1 rounded-full border border-yellow-500/30 shadow-lg">
                    {brightness}%
                  </span>
                </div>
                <input
                  id="brightness-slider"
                  type="range"
                  min="50"
                  max="150"
                  step="1"
                  value={brightness}
                  onChange={(e) => setBrightness(parseInt(e.target.value))}
                  className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-600 hover:accent-yellow-500 transition-all duration-200"
                  style={{
                    background: `linear-gradient(to right, #eab308 0%, #eab308 ${((brightness - 50) / 100) * 100}%, #374151 ${((brightness - 50) / 100) * 100}%, #374151 100%)`
                  }}
                  aria-label="밝기 조절"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>어둡게</span>
                  <span>밝게</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="contrast-slider" className="block text-sm font-medium text-white flex items-center gap-2">
                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    명암
                  </label>
                  <span className="text-sm font-bold text-purple-400 bg-purple-500/20 px-3 py-1 rounded-full border border-purple-500/30 shadow-lg">
                    {contrast}%
                  </span>
                </div>
                <input
                  id="contrast-slider"
                  type="range"
                  min="50"
                  max="150"
                  step="1"
                  value={contrast}
                  onChange={(e) => setContrast(parseInt(e.target.value))}
                  className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600 hover:accent-purple-500 transition-all duration-200"
                  style={{
                    background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${((contrast - 50) / 100) * 100}%, #374151 ${((contrast - 50) / 100) * 100}%, #374151 100%)`
                  }}
                  aria-label="명암 조절"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>부드럽게</span>
                  <span>선명하게</span>
                </div>
              </div>

              {/* 배경제거 설정 */}
              <div className="border-t border-gray-700 pt-4 mt-4 space-y-3">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-white flex items-center gap-2">
                    <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    배경제거 (누끼)
                  </label>
                  <select
                    value={removalMethod}
                    onChange={(e) => setRemovalMethod(e.target.value as BackgroundRemovalOptions["method"])}
                    className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all hover:border-orange-500/50"
                  >
                    <option value="auto">🤖 자동 (권장)</option>
                    <option value="edge-color">🎨 가장자리 색상</option>
                    <option value="edge-detection">🔍 엣지 감지</option>
                  </select>
                </div>
                {removalMethod === "edge-color" && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-gray-400">민감도</label>
                      <span className="text-xs text-gray-400">{removalThreshold}</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="60"
                      step="5"
                      value={removalThreshold}
                      onChange={(e) => setRemovalThreshold(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-600"
                    />
                  </div>
                )}
                <button
                  onClick={handleBackgroundRemoval}
                  disabled={isRemovingBackground || isLoading}
                  className="w-full py-3 px-6 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                  aria-label="배경제거"
                >
                  {isRemovingBackground ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      처리 중...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      배경제거
                    </>
                  )}
                </button>
                {hasBackgroundRemoved && (
                  <button
                    onClick={downloadBackgroundRemoved}
                    className="w-full mt-2 py-2 px-4 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                    aria-label="배경제거된 이미지 다운로드"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    누끼 이미지 다운로드 (PNG)
                  </button>
                )}
              </div>

              {/* OCR 기능 */}
              <div className="border-t border-gray-700 pt-4 mt-4 space-y-3">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-white flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    텍스트 인식 (OCR)
                  </label>
                </div>
                <button
                  onClick={handleExtractText}
                  disabled={isExtractingText || isLoading || !image}
                  className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                  aria-label="텍스트 추출"
                >
                  {isExtractingText ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      추출 중...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      텍스트 추출
                    </>
                  )}
                </button>
                {ocrResult && (
                  <div className="mt-2 p-3 bg-gray-800/50 rounded-lg border border-blue-500/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-400">추출된 텍스트</span>
                      <button
                        onClick={() => setShowOCRBoundingBoxes(!showOCRBoundingBoxes)}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        {showOCRBoundingBoxes ? "숨기기" : "바운딩 박스 표시"}
                      </button>
                    </div>
                    <p className="text-sm text-white max-h-32 overflow-y-auto">{ocrResult.text || "텍스트를 찾을 수 없습니다."}</p>
                    <p className="text-xs text-gray-500 mt-2">신뢰도: {ocrResult.confidence.toFixed(1)}% | 단어 수: {ocrResult.words.length}</p>
                  </div>
                )}
              </div>

              {/* Edge Detection 기능 */}
              <div className="border-t border-gray-700 pt-4 mt-4 space-y-3">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-white flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    엣지 감지
                  </label>
                </div>
                <button
                  onClick={handleDetectEdges}
                  disabled={isDetectingEdges || isLoading || !image}
                  className="w-full py-3 px-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                  aria-label="엣지 감지"
                >
                  {isDetectingEdges ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      감지 중...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      엣지 감지
                    </>
                  )}
                </button>
                {edgeResult && (
                  <div className="mt-2 p-3 bg-gray-800/50 rounded-lg border border-green-500/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-400">감지된 영역</span>
                      <button
                        onClick={() => setShowEdges(!showEdges)}
                        className="text-xs text-green-400 hover:text-green-300"
                      >
                        {showEdges ? "숨기기" : "엣지 표시"}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">영역 수: {edgeResult.contours.length}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <button
                onClick={downloadImage}
                className="flex-1 py-3 px-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 flex items-center justify-center gap-2 group"
                aria-label="이미지 다운로드"
                title="Ctrl+S로도 다운로드 가능"
              >
                <svg className="w-5 h-5 group-hover:animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                다운로드
                <kbd className="hidden sm:inline-block ml-2 px-2 py-0.5 text-xs bg-white/20 rounded border border-white/30">Ctrl+S</kbd>
              </button>
              <button
                onClick={copyToClipboard}
                className="flex-1 py-3 px-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 flex items-center justify-center gap-2 group whitespace-nowrap"
                aria-label="클립보드에 복사"
                title="Ctrl+Shift+C로도 복사 가능"
              >
                <svg className="w-5 h-5 group-hover:rotate-12 transition-transform flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="whitespace-nowrap">
                  클립보드 복사 <kbd className="hidden sm:inline-block ml-2 px-2 py-0.5 text-xs bg-white/20 rounded border border-white/30 whitespace-nowrap">Ctrl+Shift+C</kbd>
                </span>
              </button>
            </div>
          </div>
        )}

        {/* 비디오 썸네일 표시 */}
        {videoThumbnails.length > 0 && (
          <div className="mt-6 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              비디오 썸네일
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {videoThumbnails.map((thumb, idx) => (
                <div key={idx} className="relative group cursor-pointer">
                  <img
                    src={URL.createObjectURL(thumb.blob)}
                    alt={`Thumbnail ${idx + 1}`}
                    className="w-full h-auto rounded-lg border-2 border-transparent group-hover:border-purple-500 transition-all"
                  />
                  <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 rounded">
                    {Math.round(thumb.timestamp)}s
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          role="alert"
          aria-live="polite"
          className={`fixed bottom-4 right-4 px-6 py-4 rounded-xl shadow-2xl z-50 transition-all animate-slide-up flex items-center gap-3 min-w-[280px] ${
            toast.type === "success"
              ? "bg-gradient-to-r from-green-600 to-emerald-600 text-white border border-green-400/30"
              : "bg-gradient-to-r from-red-600 to-rose-600 text-white border border-red-400/30"
          }`}
        >
          {toast.type === "success" ? (
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
}

