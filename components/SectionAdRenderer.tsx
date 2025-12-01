"use client";

import { useEffect, useState } from "react";
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

    if (!previewMode) {
      const handleStorageChange = () => {
        loadConfig();
      };

      window.addEventListener("storage", handleStorageChange);
      window.addEventListener("sectionAdConfigUpdated", handleStorageChange);

      return () => {
        window.removeEventListener("storage", handleStorageChange);
        window.removeEventListener("sectionAdConfigUpdated", handleStorageChange);
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

function AdBlockComponent({ block }: { block: AdBlock }) {
  const [mediaError, setMediaError] = useState(false);

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
        className="block w-full h-full"
      >
        <img
          src={block.mediaUrl}
          alt={block.alt || "Advertisement"}
          className="w-full h-full object-cover"
          style={{
            objectFit: block.style?.objectFit || "cover",
          }}
          onError={() => setMediaError(true)}
          loading="lazy"
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
}

