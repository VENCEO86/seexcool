"use client";

import { useEffect, useMemo } from "react";
import SectionAdRenderer from "./SectionAdRenderer";
import ImageEditor from "./ImageEditor";
import type { SectionAdConfig } from "@/lib/sectionAdConfig";

interface SectionPreviewProps {
  previewConfig: SectionAdConfig;
}

export default function SectionPreview({ previewConfig }: SectionPreviewProps) {
  // 설정 유효성 검사 및 즉시 localStorage에 저장
  const validatedConfig = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        sections: {
          "1": { id: "1" as const, blocks: [], splitCount: 1, backgroundColor: "#1a1a1a" },
          "2": { id: "2" as const, blocks: [], splitCount: 1, backgroundColor: "#1a1a1a" },
          "3": { id: "3" as const, blocks: [], splitCount: 1, backgroundColor: "#1a1a1a" },
          "4": { id: "4" as const, blocks: [], splitCount: 1, backgroundColor: "#1a1a1a" },
        },
        popups: [],
      };
    }

    const config = {
      sections: {
        "1": previewConfig.sections?.["1"] || { id: "1" as const, blocks: [], splitCount: 1, backgroundColor: "#1a1a1a" },
        "2": previewConfig.sections?.["2"] || { id: "2" as const, blocks: [], splitCount: 1, backgroundColor: "#1a1a1a" },
        "3": previewConfig.sections?.["3"] || { id: "3" as const, blocks: [], splitCount: 1, backgroundColor: "#1a1a1a" },
        "4": previewConfig.sections?.["4"] || { id: "4" as const, blocks: [], splitCount: 1, backgroundColor: "#1a1a1a" },
      },
      popups: previewConfig.popups || [],
    };

    // 즉시 localStorage에 저장 (동기적으로)
    try {
      const tempKey = "sectionAdConfig_preview";
      localStorage.setItem(tempKey, JSON.stringify(config));
    } catch (error) {
      console.error("Failed to save preview config:", error);
    }

    return config;
  }, [previewConfig]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem("sectionAdConfig_preview");
        } catch (error) {
          // 무시
        }
      }
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      {/* Section 1: Top */}
      <SectionAdRenderer sectionId="1" previewMode={true} />

      <div className="flex flex-1 min-h-0">
        {/* Section 2: Left */}
        <aside className="w-48 flex-shrink-0 hidden md:block">
          <SectionAdRenderer sectionId="2" previewMode={true} />
        </aside>

        {/* Main Content */}
        <main className="flex-1 py-8 px-4 min-w-0">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-white">
                이미지 화질 개선 & 명암 조절 도구
              </h1>
              <p className="text-gray-400 text-sm sm:text-base px-4">
                간단하게 이미지를 업로드하고 화질 개선 및 밝기/명암을 조절하세요
              </p>
            </div>

            <ImageEditor />
          </div>
        </main>

        {/* Section 3: Right */}
        <aside className="w-48 flex-shrink-0 hidden md:block">
          <SectionAdRenderer sectionId="3" previewMode={true} />
        </aside>
      </div>

      {/* Section 4: Bottom */}
      <SectionAdRenderer sectionId="4" previewMode={true} />
    </div>
  );
}
