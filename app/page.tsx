import { Suspense, lazy } from "react";
import SectionAdRenderer from "@/components/SectionAdRenderer";
import PopupBannerRenderer from "@/components/PopupBanner";
import InquiryModal from "@/components/InquiryModal";
import Header from "@/components/Header";

// 성능 최적화: ImageEditor를 동적 import로 지연 로딩
const ImageEditor = lazy(() => import("@/components/ImageEditor"));

// 로딩 컴포넌트
const ImageEditorLoading = () => (
  <div className="w-full h-96 flex items-center justify-center bg-gray-900 rounded-lg">
    <div className="text-center">
      <svg className="animate-spin h-12 w-12 text-purple-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p className="text-gray-400 text-sm">이미지 편집기 로딩 중...</p>
    </div>
  </div>
);

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950">
      <Header />
      <PopupBannerRenderer />
      <div className="flex flex-col min-h-screen pt-16">
        {/* Section 1: Top */}
        <div className="w-full flex-shrink-0">
          <SectionAdRenderer sectionId="1" />
        </div>

        {/* Main Content Area with Sidebars */}
        <div className="flex flex-1 min-h-0 w-full">
          {/* Section 2: Left Sidebar */}
          <aside className="hidden lg:block w-48 xl:w-64 flex-shrink-0">
            <div className="h-full sticky top-16">
              <SectionAdRenderer sectionId="2" />
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto w-full">
              <div className="text-center mb-8 animate-fade-in">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-white bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                  이미지 화질 개선 & 명암 조절 도구
                </h1>
                <p className="text-gray-400 text-sm sm:text-base px-4">
                  간단하게 이미지를 업로드하고 화질 개선, 밝기/명암 조절, 배경제거를 할 수 있습니다
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs text-gray-500">
                  <span className="px-3 py-1 bg-gray-800/50 rounded-full border border-gray-700">
                    🚀 빠른 처리
                  </span>
                  <span className="px-3 py-1 bg-gray-800/50 rounded-full border border-gray-700">
                    🎨 고품질 결과
                  </span>
                  <span className="px-3 py-1 bg-gray-800/50 rounded-full border border-gray-700">
                    ✂️ 배경제거
                  </span>
                </div>
              </div>

              <Suspense fallback={<ImageEditorLoading />}>
                <ImageEditor />
              </Suspense>

              {/* Inquiry Buttons */}
              <div className="mt-8 flex gap-4 justify-center flex-wrap">
                <InquiryModal type="advertisement" />
                <InquiryModal type="collaboration" />
              </div>
            </div>
          </main>

          {/* Section 3: Right Sidebar */}
          <aside className="hidden lg:block w-48 xl:w-64 flex-shrink-0">
            <div className="h-full sticky top-16">
              <SectionAdRenderer sectionId="3" />
            </div>
          </aside>
        </div>

        {/* Section 4: Bottom */}
        <div className="w-full flex-shrink-0 mt-auto">
          <SectionAdRenderer sectionId="4" />
        </div>
      </div>
    </div>
  );
}
