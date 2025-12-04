"use client";

import { useState, useEffect, useRef } from "react";

interface BrandingEditorProps {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export default function BrandingEditor({ onSuccess, onError }: BrandingEditorProps) {
  const [favicon, setFavicon] = useState<string | null>(null);
  const [ogImage, setOgImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingFavicon, setIsUploadingFavicon] = useState(false);
  const [isUploadingOgImage, setIsUploadingOgImage] = useState(false);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const ogImageInputRef = useRef<HTMLInputElement>(null);

  // 브랜딩 설정 로드
  useEffect(() => {
    loadBranding();
  }, []);

  const loadBranding = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/branding");
      const data = await response.json();
      
      if (data.success) {
        setFavicon(data.data.favicon);
        setOgImage(data.data.ogImage);
      }
    } catch (error) {
      console.error("Failed to load branding:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingFavicon(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "favicon");

      const response = await fetch("/api/branding", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        // 캐시 버스팅을 위한 타임스탬프 추가
        const timestamp = `?v=${Date.now()}`;
        setFavicon(`${data.data.path}${timestamp}`);
        const message = "파비콘이 업로드되었습니다. 브라우저를 새로고침하면 반영됩니다.";
        onSuccess?.(message);
        // 프리뷰 즉시 업데이트
        loadBranding();
      } else {
        const message = data.error || "파비콘 업로드에 실패했습니다.";
        onError?.(message);
      }
    } catch (error) {
      console.error("Favicon upload error:", error);
      onError?.("파비콘 업로드 중 오류가 발생했습니다.");
    } finally {
      setIsUploadingFavicon(false);
      if (faviconInputRef.current) {
        faviconInputRef.current.value = "";
      }
    }
  };

  const handleOgImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingOgImage(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "og-image");

      const response = await fetch("/api/branding", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        // 캐시 버스팅을 위한 타임스탬프 추가
        const timestamp = `?v=${Date.now()}`;
        setOgImage(`${data.data.path}${timestamp}`);
        const message = "OG 이미지가 업로드되었습니다. 브라우저를 새로고침하면 반영됩니다.";
        onSuccess?.(message);
        // 프리뷰 즉시 업데이트
        loadBranding();
      } else {
        const message = data.error || "OG 이미지 업로드에 실패했습니다.";
        onError?.(message);
      }
    } catch (error) {
      console.error("OG image upload error:", error);
      onError?.("OG 이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setIsUploadingOgImage(false);
      if (ogImageInputRef.current) {
        ogImageInputRef.current.value = "";
      }
    }
  };

  const handleDeleteFavicon = async () => {
    if (!confirm("파비콘을 삭제하시겠습니까?")) return;

    try {
      const response = await fetch("/api/branding?type=favicon", {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        setFavicon(null);
        const message = "파비콘이 삭제되었습니다.";
        onSuccess?.(message);
      } else {
        const message = data.error || "파비콘 삭제에 실패했습니다.";
        onError?.(message);
      }
    } catch (error) {
      console.error("Favicon delete error:", error);
      onError?.("파비콘 삭제 중 오류가 발생했습니다.");
    }
  };

  const handleDeleteOgImage = async () => {
    if (!confirm("OG 이미지를 삭제하시겠습니까?")) return;

    try {
      const response = await fetch("/api/branding?type=og-image", {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        setOgImage(null);
        const message = "OG 이미지가 삭제되었습니다.";
        onSuccess?.(message);
      } else {
        const message = data.error || "OG 이미지 삭제에 실패했습니다.";
        onError?.(message);
      }
    } catch (error) {
      console.error("OG image delete error:", error);
      onError?.("OG 이미지 삭제 중 오류가 발생했습니다.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 파비콘 설정 */}
      <div className="bg-gray-800 rounded-lg p-6 space-y-4 border border-gray-700 shadow-lg">
        <div className="flex items-center gap-2 pb-3 border-b border-gray-700">
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
          <h3 className="text-lg font-semibold text-white">파비콘 설정</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              파비콘 이미지 (권장: 32x32 또는 16x16, ICO/PNG)
            </label>
            <input
              ref={faviconInputRef}
              type="file"
              accept="image/png,image/jpeg,image/x-icon,image/vnd.microsoft.icon,image/webp"
              onChange={handleFaviconUpload}
              className="hidden"
            />
            <div className="flex gap-2">
              <button
                onClick={() => faviconInputRef.current?.click()}
                disabled={isUploadingFavicon}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {isUploadingFavicon ? "업로드 중..." : "파일 선택"}
              </button>
              {favicon && (
                <>
                  <button
                    onClick={handleDeleteFavicon}
                    className="px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    삭제
                  </button>
                </>
              )}
            </div>
          </div>

          {favicon && (
            <div className="p-3 bg-gray-900 rounded-lg border border-gray-700">
              <div className="flex items-center gap-3">
                <img
                  src={favicon.split("?")[0]}
                  alt="Favicon Preview"
                  className="w-16 h-16 object-contain rounded border border-gray-700"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <div className="flex-1">
                  <p className="text-sm text-gray-300">현재 파비콘</p>
                  <a
                    href={favicon.split("?")[0]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    새 창에서 보기
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* OG 이미지 설정 */}
      <div className="bg-gray-800 rounded-lg p-6 space-y-4 border border-gray-700 shadow-lg">
        <div className="flex items-center gap-2 pb-3 border-b border-gray-700">
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="text-lg font-semibold text-white">OG 이미지 설정</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              OG 미리보기 이미지 (권장: 1200x630, PNG/JPG)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              카카오톡, 디스코드, 메신저 등에서 링크 공유 시 표시되는 이미지입니다.
            </p>
            <input
              ref={ogImageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleOgImageUpload}
              className="hidden"
            />
            <div className="flex gap-2">
              <button
                onClick={() => ogImageInputRef.current?.click()}
                disabled={isUploadingOgImage}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {isUploadingOgImage ? "업로드 중..." : "파일 선택"}
              </button>
              {ogImage && (
                <button
                  onClick={handleDeleteOgImage}
                  className="px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  삭제
                </button>
              )}
            </div>
          </div>

          {ogImage && (
            <div className="p-3 bg-gray-900 rounded-lg border border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <img
                  src={ogImage.split("?")[0]}
                  alt="OG Image Preview"
                  className="w-32 h-20 object-cover rounded border border-gray-700"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <div className="flex-1">
                  <p className="text-sm text-gray-300">현재 OG 이미지</p>
                  <a
                    href={ogImage.split("?")[0]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    새 창에서 보기
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

