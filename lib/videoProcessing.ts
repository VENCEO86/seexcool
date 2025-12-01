/**
 * 비디오 처리 기능
 * HTML5 Video API 기반
 */

export interface VideoThumbnail {
  blob: Blob;
  timestamp: number;
  width: number;
  height: number;
}

/**
 * 비디오 파일에서 썸네일 생성
 */
export async function generateVideoThumbnail(
  videoFile: File,
  timestamp: number = 0
): Promise<VideoThumbnail> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(videoFile);

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(timestamp, video.duration);
    };

    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        reject(new Error("Cannot get canvas context"));
        return;
      }

      ctx.drawImage(video, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Failed to create thumbnail blob"));
            return;
          }
          URL.revokeObjectURL(url);
          resolve({
            blob,
            timestamp: video.currentTime,
            width: video.videoWidth,
            height: video.videoHeight,
          });
        },
        "image/png",
        0.95
      );
    };

    video.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(new Error(`Video loading error: ${error}`));
    };

    video.src = url;
    video.load();
  });
}

/**
 * 비디오에서 여러 썸네일 생성 (타임라인용)
 */
export async function generateVideoThumbnails(
  videoFile: File,
  count: number = 10
): Promise<VideoThumbnail[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(videoFile);
    const thumbnails: VideoThumbnail[] = [];

    video.onloadedmetadata = async () => {
      const duration = video.duration;
      const interval = duration / (count + 1);

      try {
        for (let i = 1; i <= count; i++) {
          const timestamp = interval * i;
          video.currentTime = timestamp;

          await new Promise<void>((resolveSeek) => {
            video.onseeked = () => {
              const canvas = document.createElement("canvas");
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext("2d");
              
              if (!ctx) {
                resolveSeek();
                return;
              }

              ctx.drawImage(video, 0, 0);
              canvas.toBlob(
                (blob) => {
                  if (blob) {
                    thumbnails.push({
                      blob,
                      timestamp,
                      width: video.videoWidth,
                      height: video.videoHeight,
                    });
                  }
                  resolveSeek();
                },
                "image/jpeg",
                0.8
              );
            };
          });
        }

        URL.revokeObjectURL(url);
        resolve(thumbnails);
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };

    video.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(new Error(`Video loading error: ${error}`));
    };

    video.src = url;
    video.load();
  });
}

/**
 * 비디오 정보 가져오기
 */
export async function getVideoInfo(videoFile: File): Promise<{
  duration: number;
  width: number;
  height: number;
  fps: number;
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(videoFile);

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        fps: 30, // 기본값 (정확한 FPS는 추가 분석 필요)
      });
    };

    video.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(new Error(`Video loading error: ${error}`));
    };

    video.src = url;
    video.load();
  });
}

