"use client";

import { useEffect, useState, memo, useMemo } from "react";
import { getSectionAdConfig, type Section, type AdBlock, type SectionId } from "@/lib/sectionAdConfig";

interface SectionAdRendererProps {
  sectionId: SectionId;
  previewMode?: boolean;
}

export default function SectionAdRenderer({ sectionId, previewMode = false }: SectionAdRendererProps) {
  const [section, setSection] = useState<Section | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const loadConfig = () => {
      if (previewMode) {
        // 미리보기 모드: 임시 저장된 설정 사용
        try {
          const tempKey = "sectionAdConfig_preview";
          const stored = localStorage.getItem(tempKey);
          if (stored) {
            const previewConfig = JSON.parse(stored);
            const section = previewConfig.sections?.[sectionId];
            if (section) {
              setSection({
                ...section,
                blocks: section.blocks || [],
              });
              return;
            }
          }
        } catch (error) {
          console.error("Failed to load preview config:", error);
        }
      }
      
      try {
        const config = getSectionAdConfig();
        const section = config.sections?.[sectionId];
        if (section) {
          setSection({
            ...section,
            blocks: section.blocks || [],
          });
        } else {
          setSection(null);
        }
      } catch (error) {
        console.error("Failed to load section config:", error);
        setSection(null);
      }
    };

    loadConfig();

    if (previewMode) {
      // 미리보기 모드: 실시간 업데이트 리스너
      const handlePreviewUpdate = () => {
        loadConfig();
      };
      
      window.addEventListener("sectionAdConfigPreviewUpdated", handlePreviewUpdate);
      
      // 주기적으로 localStorage 확인 (실시간 반영)
      const intervalId = setInterval(() => {
        try {
          const tempKey = "sectionAdConfig_preview";
          const stored = localStorage.getItem(tempKey);
          if (stored) {
            loadConfig();
          }
        } catch (error) {
          // 무시
        }
      }, 500); // 500ms마다 체크

      return () => {
        window.removeEventListener("sectionAdConfigPreviewUpdated", handlePreviewUpdate);
        clearInterval(intervalId);
      };
    }

    if (!previewMode) {
      const handleStorageChange = () => {
        loadConfig();
      };
      
      // 강제 업데이트 체크 (더 자주 체크하여 즉시 반영)
      let lastForceUpdate = "";
      const checkForceUpdate = () => {
        const forceUpdate = localStorage.getItem("sectionAdConfig_forceUpdate");
        if (forceUpdate && forceUpdate !== lastForceUpdate) {
          lastForceUpdate = forceUpdate;
          loadConfig();
        }
      };
      
      // BroadcastChannel 리스너 (개선: 더 안정적인 탭 간 통신)
      let broadcastChannel: BroadcastChannel | null = null;
      try {
        broadcastChannel = new BroadcastChannel("sectionAdConfig");
        broadcastChannel.onmessage = (event) => {
          if (event.data.type === "configUpdated") {
            loadConfig();
          }
        };
      } catch (e) {
        // BroadcastChannel 미지원 브라우저는 무시
      }

      window.addEventListener("storage", handleStorageChange);
      window.addEventListener("sectionAdConfigUpdated", handleStorageChange);
      
      // 주기적으로 강제 업데이트 체크 (즉시 반영을 위해, 성능 최적화: 100ms로 조정)
      const intervalId = setInterval(checkForceUpdate, 100);
      
      // 초기 강제 업데이트 체크
      checkForceUpdate();

      return () => {
        window.removeEventListener("storage", handleStorageChange);
        window.removeEventListener("sectionAdConfigUpdated", handleStorageChange);
        clearInterval(intervalId);
        if (broadcastChannel) {
          broadcastChannel.close();
        }
      };
    }
  }, [sectionId, previewMode]);

  if (!section) {
    // 섹션이 없을 때 빈 공간 표시 (레이아웃 유지)
    return (
      <div
        className="w-full"
        style={{
          minHeight: 
            sectionId === "1" || sectionId === "4" 
              ? "60px" 
              : sectionId === "2" || sectionId === "3" 
              ? "100%" 
              : "60px",
          backgroundColor: "#1a1a1a",
        }}
      />
    );
  }

  const splitCount = Math.max(1, Math.min(4, section.splitCount || 1));
  const splitDirection = section.splitDirection || "horizontal";
  const blocks = section.blocks || [];

  // 섹션별 기본 높이 설정
  const getSectionHeight = () => {
    if (sectionId === "1" || sectionId === "4") {
      return splitDirection === "vertical" ? "auto" : "80px";
    }
    return "100%";
  };

  return (
    <div
      className="w-full h-full"
      style={{
        backgroundColor: section.backgroundColor || "#1a1a1a",
        backgroundImage: section.backgroundImage ? `url(${section.backgroundImage})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: getSectionHeight(),
      }}
    >
      <div
        className={`flex gap-1 sm:gap-2 p-1 sm:p-2 h-full ${
          splitDirection === "horizontal" ? "flex-row" : "flex-col"
        }`}
        style={{
          minHeight: getSectionHeight(),
        }}
      >
        {Array.from({ length: splitCount }).map((_, idx) => {
          const block = blocks[idx];
          return (
            <div
              key={idx}
              className={`flex-1 ${
                splitDirection === "horizontal" ? "" : "min-h-[100px]"
              }`}
              style={{
                backgroundColor: block?.style?.backgroundColor || section.backgroundColor,
                backgroundImage: block?.style?.backgroundImage
                  ? `url(${block.style.backgroundImage})`
                  : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
                minHeight:
                  splitDirection === "vertical" && (sectionId === "1" || sectionId === "4")
                    ? "100px"
                    : undefined,
              }}
            >
              {block ? (
                <AdBlockComponent block={block} />
              ) : (
                <div 
                  className="w-full h-full flex items-center justify-center text-gray-500 text-sm opacity-30"
                  style={{
                    minHeight: sectionId === "2" || sectionId === "3" ? "200px" : undefined,
                  }}
                >
                  {/* 빈 공간 - 자연스러운 배경 */}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 성능 최적화: React.memo로 불필요한 리렌더링 방지
const AdBlockComponent = memo(function AdBlockComponent({ block }: { block: AdBlock }) {
  const [mediaError, setMediaError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  if (block.type === "image") {
    if (mediaError || !block.mediaUrl) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-400 text-sm">
          이미지를 불러올 수 없습니다
        </div>
      );
    }
    return (
      <a
        href={block.link || "#"}
        target={block.link ? "_blank" : undefined}
        rel={block.link ? "noopener noreferrer" : undefined}
        className="block w-full h-full flex items-center justify-center overflow-hidden"
        style={{
          backgroundColor: block.style?.backgroundColor || "transparent",
        }}
      >
        <img
          src={block.mediaUrl}
          alt={block.alt || "Advertisement"}
          className={`w-full h-full transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
          style={{
            objectFit: block.style?.objectFit || "contain",
            maxWidth: "100%",
            maxHeight: "100%",
            width: "auto",
            height: "auto",
          }}
          onError={() => setMediaError(true)}
          loading="lazy"
          onLoad={(e) => {
            setImageLoaded(true);
            // 이미지 자동 크기 조정 (하이브리드)
            const img = e.currentTarget;
            const container = img.parentElement;
            if (container) {
              const containerWidth = container.clientWidth;
              const containerHeight = container.clientHeight;
              const imgWidth = img.naturalWidth;
              const imgHeight = img.naturalHeight;
              
              if (imgWidth > 0 && imgHeight > 0) {
                // 컨테이너 비율 계산
                const containerRatio = containerWidth / containerHeight;
                const imgRatio = imgWidth / imgHeight;
                
                // contain 모드: 컨테이너 안에 맞춤
                if (block.style?.objectFit === "contain" || !block.style?.objectFit) {
                  if (imgRatio > containerRatio) {
                    // 이미지가 더 넓음 - 너비에 맞춤
                    img.style.width = "100%";
                    img.style.height = "auto";
                  } else {
                    // 이미지가 더 높음 - 높이에 맞춤
                    img.style.width = "auto";
                    img.style.height = "100%";
                  }
                } else if (block.style?.objectFit === "cover") {
                  // cover 모드: 컨테이너를 채우되 비율 유지
                  if (imgRatio > containerRatio) {
                    img.style.width = "auto";
                    img.style.height = "100%";
                  } else {
                    img.style.width = "100%";
                    img.style.height = "auto";
                  }
                }
              }
            }
          }}
        />
      </a>
    );
  }

  if (block.type === "video") {
    if (!block.mediaUrl) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-400 text-sm">
          영상 URL이 없습니다
        </div>
      );
    }
    return (
      <a
        href={block.link || "#"}
        target={block.link ? "_blank" : undefined}
        rel={block.link ? "noopener noreferrer" : undefined}
        className="block w-full h-full"
      >
        <video
          src={block.mediaUrl}
          className="w-full h-full object-cover"
          controls={false}
          autoPlay
          loop
          muted
          playsInline
          style={{
            objectFit: block.style?.objectFit || "cover",
          }}
        />
      </a>
    );
  }

  if (block.type === "link") {
    return (
      <a
        href={block.link || "#"}
        target={block.link ? "_blank" : undefined}
        rel={block.link ? "noopener noreferrer" : undefined}
        className="block w-full h-full flex items-center justify-center bg-gray-800 text-blue-400 hover:text-blue-300 p-4"
      >
        {block.alt || block.link || "링크"}
      </a>
    );
  }

  return null;
});

