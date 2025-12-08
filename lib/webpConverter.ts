/**
 * WebP 파일을 PNG로 변환하는 유틸리티
 * 브라우저 호환성 문제로 WebP를 로드할 수 없을 때 사용
 * 
 * ⚠️ 클라이언트 사이드에서만 사용 가능 (브라우저 API 사용)
 */

// 서버 사이드에서 실행되지 않도록 체크
if (typeof window === 'undefined') {
  throw new Error('webpConverter는 클라이언트 사이드에서만 사용할 수 있습니다.');
}

/**
 * WebP 파일을 PNG로 변환
 * @param webpFile WebP 파일
 * @returns PNG로 변환된 Blob
 */
export async function convertWebPToPNG(webpFile: File): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    try {
      // 방법 1: createImageBitmap 사용 (최신 브라우저)
      if (typeof createImageBitmap !== 'undefined') {
        try {
          const bitmap = await createImageBitmap(webpFile);
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error("Cannot get canvas context");
          
          ctx.drawImage(bitmap, 0, 0);
          bitmap.close();
          
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Canvas toBlob failed"));
            }
          }, 'image/png', 1.0);
          return;
        } catch (bitmapError) {
          console.warn("createImageBitmap 실패, 다른 방법 시도:", bitmapError);
        }
      }
      
      // 방법 2: FileReader + Blob URL 사용
      try {
        // FileReader로 먼저 읽기
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolveReader, rejectReader) => {
          reader.onload = (e) => {
            const result = e.target?.result;
            if (typeof result === 'string') {
              resolveReader(result);
            } else {
              rejectReader(new Error("FileReader result is not a string"));
            }
          };
          reader.onerror = () => rejectReader(new Error("FileReader failed"));
          reader.readAsDataURL(webpFile);
        });
        
        // Data URL로 이미지 로드
        const img = new Image();
        await new Promise<void>((resolveImg, rejectImg) => {
          const timeout = setTimeout(() => {
            rejectImg(new Error("Image load timeout"));
          }, 15000);
          
          img.onload = () => {
            clearTimeout(timeout);
            resolveImg();
          };
          
          img.onerror = () => {
            clearTimeout(timeout);
            rejectImg(new Error("Image load failed - WebP may be corrupted or unsupported"));
          };
          
          img.src = dataUrl;
        });
        
        // Canvas에 그리기
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Cannot get canvas context");
        
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Canvas toBlob failed"));
          }
        }, 'image/png', 1.0);
      } catch (blobError) {
        reject(blobError);
      }
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * WebP 파일을 PNG로 변환하여 File 객체로 반환
 */
export async function convertWebPFileToPNG(webpFile: File): Promise<File> {
  const pngBlob = await convertWebPToPNG(webpFile);
  const fileName = webpFile.name.replace(/\.webp$/i, '.png');
  return new File([pngBlob], fileName, { type: 'image/png' });
}

