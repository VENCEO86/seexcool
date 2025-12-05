import SectionAdRenderer from "@/components/SectionAdRenderer";
import PopupBannerRenderer from "@/components/PopupBanner";
import InquiryModal from "@/components/InquiryModal";
import Header from "@/components/Header";
import ImageEditor from "@/components/ImageEditor";

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

              <ImageEditor />

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