"use client";

import dynamic from "next/dynamic";
import type { SectionAdConfig } from "@/lib/sectionAdConfig";

const SectionPreview = dynamic(() => import("@/components/SectionPreview"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-white">미리보기 로딩 중...</div>
    </div>
  ),
});

interface AdminPreviewPageProps {
  config: SectionAdConfig;
  onClose: () => void;
}

export default function AdminPreviewPage({ config, onClose }: AdminPreviewPageProps) {
  return (
    <div className="fixed inset-0 z-50 bg-gray-950 overflow-auto">
      <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-700 p-4 flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">미리보기 모드</h2>
        <button
          onClick={() => {
            onClose();
            if (typeof window !== "undefined") {
              localStorage.removeItem("sectionAdConfig_preview");
            }
          }}
          className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          편집으로 돌아가기
        </button>
      </div>
      <SectionPreview previewConfig={config} />
    </div>
  );
}


