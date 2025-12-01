"use client";

import Header from "./Header";
import type { SectionAdConfig, SectionId, AdBlockType, PopupBanner, Inquiry } from "@/lib/sectionAdConfig";
import BlockPropertiesEditor from "./BlockPropertiesEditor";
import PopupEditor from "./PopupEditor";
import InquiryManager from "./InquiryManager";

interface AdminMainPageProps {
  config: SectionAdConfig;
  activeSection: SectionId;
  selectedBlockId: string | null;
  activeTab: "sections" | "popups" | "inquiries";
  inquiries: Inquiry[];
  error: string;
  success: string;
  currentSection: any;
  onSectionChange: (sectionId: SectionId) => void;
  onBlockSelect: (blockId: string | null) => void;
  onTabChange: (tab: "sections" | "popups" | "inquiries") => void;
  onAddBlock: (type: AdBlockType) => void;
  onDeleteBlock: (blockId: string) => void;
  onUpdateBlock: (blockId: string, updates: Partial<any>) => void;
  onUpdateSection: (updates: Partial<any>) => void;
  onHandleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, blockId: string) => void;
  onAddPopup: () => void;
  onUpdatePopup: (popupId: string, updates: Partial<PopupBanner>) => void;
  onDeletePopup: (popupId: string) => void;
  onSave: () => void;
  onShowPreview: () => void;
  onRefreshInquiries: () => void;
  router: any;
}

export default function AdminMainPage({
  config,
  activeSection,
  selectedBlockId,
  activeTab,
  inquiries,
  error,
  success,
  currentSection,
  onSectionChange,
  onBlockSelect,
  onTabChange,
  onAddBlock,
  onDeleteBlock,
  onUpdateBlock,
  onUpdateSection,
  onHandleFileUpload,
  onAddPopup,
  onUpdatePopup,
  onDeletePopup,
  onSave,
  onShowPreview,
  onRefreshInquiries,
  router,
}: AdminMainPageProps) {
  return (
    <>
      <Header />
      <main className="min-h-screen py-8 px-4 bg-gray-950 pt-24">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gray-900 rounded-lg p-6 space-y-6 shadow-xl border border-gray-800">
            <div className="flex justify-between items-center pb-4 border-b border-gray-800">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                  광고 섹션 관리
                </h1>
                <p className="text-gray-400 text-sm mt-1">섹션별 광고 블록, 팝업, 문의를 관리하세요</p>
              </div>
              <button
                onClick={() => router.push("/")}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
              >
                홈으로
              </button>
            </div>

            {success && (
              <div className="bg-green-600/90 text-white px-4 py-3 rounded-lg flex items-center gap-2 shadow-lg animate-slide-up">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {success}
              </div>
            )}
            {error && (
              <div className="bg-red-600/90 text-white px-4 py-3 rounded-lg flex items-center gap-2 shadow-lg animate-slide-up">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {error}
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-700">
              <button
                onClick={() => onTabChange("sections")}
                className={`px-4 py-3 font-medium transition-all duration-200 relative ${
                  activeTab === "sections"
                    ? "text-blue-400"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                섹션 관리
                {activeTab === "sections" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-400 to-purple-500"></span>
                )}
              </button>
              <button
                onClick={() => onTabChange("popups")}
                className={`px-4 py-3 font-medium transition-all duration-200 relative ${
                  activeTab === "popups"
                    ? "text-blue-400"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                팝업/배너
                {activeTab === "popups" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-400 to-purple-500"></span>
                )}
              </button>
              <button
                onClick={() => {
                  onTabChange("inquiries");
                  onRefreshInquiries();
                }}
                className={`px-4 py-3 font-medium transition-all duration-200 relative ${
                  activeTab === "inquiries"
                    ? "text-blue-400"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                문의/협업
                {inquiries.filter((i) => i.status === "pending").length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
                    {inquiries.filter((i) => i.status === "pending").length}
                  </span>
                )}
                {activeTab === "inquiries" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-400 to-purple-500"></span>
                )}
              </button>
            </div>

            {/* Sections Tab */}
            {activeTab === "sections" && (
              <div className="space-y-6">
                {/* Section Selector */}
                <div className="flex gap-2 flex-wrap">
                  {(["1", "2", "3", "4"] as SectionId[]).map((sectionId) => (
                    <button
                      key={sectionId}
                      onClick={() => {
                        onSectionChange(sectionId);
                        onBlockSelect(null);
                      }}
                      className={`px-4 py-2 rounded-lg transition-all duration-200 font-medium ${
                        activeSection === sectionId
                          ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105"
                          : "bg-gray-800 text-gray-300 hover:bg-gray-700 hover:scale-102"
                      }`}
                    >
                      {sectionId}번 섹션
                    </button>
                  ))}
                </div>

                {/* Section Settings */}
                <div className="bg-gray-800 rounded-lg p-6 space-y-4 border border-gray-700 shadow-lg">
                  <div className="flex items-center gap-2 pb-3 border-b border-gray-700">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-white">
                      {activeSection}번 섹션 설정
                      <span className="text-sm text-gray-400 ml-2">
                        {activeSection === "1" || activeSection === "4"
                          ? "(가로/세로 분할 가능)"
                          : "(가로 분할만 가능)"}
                      </span>
                    </h3>
                  </div>

                  {/* Split Settings */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-300">분할 개수</label>
                      <input
                        type="number"
                        min="1"
                        max="4"
                        value={currentSection.splitCount || 1}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 1;
                          const clampedValue = Math.min(4, Math.max(1, value));
                          onUpdateSection({ splitCount: clampedValue });
                        }}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                    {(activeSection === "1" || activeSection === "4") && (
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-300">분할 방향</label>
                        <select
                          value={currentSection.splitDirection || "horizontal"}
                          onChange={(e) =>
                            onUpdateSection({ splitDirection: e.target.value as any })
                          }
                          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        >
                          <option value="horizontal">가로</option>
                          <option value="vertical">세로</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Background */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-300">배경색</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={currentSection.backgroundColor || "#1a1a1a"}
                          onChange={(e) => onUpdateSection({ backgroundColor: e.target.value })}
                          className="w-16 h-10 bg-gray-700 border border-gray-600 rounded-lg cursor-pointer"
                        />
                        <input
                          type="text"
                          value={currentSection.backgroundColor || "#1a1a1a"}
                          onChange={(e) => onUpdateSection({ backgroundColor: e.target.value })}
                          className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="#1a1a1a"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-300">배경 이미지 URL</label>
                      <input
                        type="text"
                        value={currentSection.backgroundImage || ""}
                        onChange={(e) => onUpdateSection({ backgroundImage: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        placeholder="https://example.com/bg.jpg"
                      />
                    </div>
                  </div>

                  {/* Add Block Buttons */}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => onAddBlock("image")}
                      className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 active:scale-95 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      이미지
                    </button>
                    <button
                      onClick={() => onAddBlock("video")}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 active:scale-95 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      영상
                    </button>
                    <button
                      onClick={() => onAddBlock("link")}
                      className="px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 active:scale-95 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      링크
                    </button>
                  </div>

                  {/* Blocks List */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-white">블록 목록</h4>
                    {Array.isArray(currentSection.blocks) && currentSection.blocks.length > 0 ? (
                      currentSection.blocks.map((block: any, idx: number) => (
                        <div
                          key={block.id}
                          className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                            selectedBlockId === block.id
                              ? "bg-gradient-to-r from-blue-600/30 to-purple-600/30 border-2 border-blue-500 shadow-lg scale-105"
                              : "bg-gray-700 hover:bg-gray-600 border-2 border-transparent hover:border-gray-600 hover:scale-102"
                          }`}
                          onClick={() => onBlockSelect(block.id)}
                        >
                          <div className="flex justify-between items-center">
                            <span className="flex items-center gap-2">
                              <span className="font-medium text-white">{idx + 1}. {block.type}</span>
                              {block.mediaUrl && (
                                <span className="text-green-400">
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                </span>
                              )}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteBlock(block.id);
                              }}
                              className="text-red-400 hover:text-red-300 transition-colors p-1 rounded hover:bg-red-500/20"
                              aria-label="블록 삭제"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-400 text-sm py-4 text-center bg-gray-800/50 rounded-lg">
                        블록이 없습니다. 위의 버튼을 눌러 추가하세요.
                      </div>
                    )}
                  </div>
                </div>

                {/* Block Properties Editor */}
                {(() => {
                  const block = selectedBlockId ? (currentSection.blocks || []).find((b: any) => b.id === selectedBlockId) : null;
                  return block ? (
                    <div className="bg-gray-800 rounded-lg p-6 space-y-4 border border-gray-700 shadow-lg animate-fade-in">
                      <div className="flex items-center gap-2 pb-3 border-b border-gray-700">
                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <h3 className="text-lg font-semibold text-white">블록 속성 편집</h3>
                      </div>
                      <BlockPropertiesEditor
                        block={block}
                        onUpdate={(updates) => onUpdateBlock(selectedBlockId!, updates)}
                        onFileUpload={(e) => onHandleFileUpload(e, selectedBlockId!)}
                      />
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            {/* Popups Tab */}
            {activeTab === "popups" && (
              <div className="space-y-4">
                <button
                  onClick={onAddPopup}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 active:scale-95 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  팝업/배너 추가
                </button>

                <div className="space-y-4">
                  {(config.popups || []).map((popup) => (
                    <PopupEditor
                      key={popup.id}
                      popup={popup}
                      onUpdate={(updates) => onUpdatePopup(popup.id, updates)}
                      onDelete={() => onDeletePopup(popup.id)}
                      onFileUpload={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const dataUrl = event.target?.result as string;
                          onUpdatePopup(popup.id, {
                            content: { ...popup.content, mediaUrl: dataUrl },
                          });
                        };
                        reader.readAsDataURL(file);
                        e.target.value = "";
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Inquiries Tab */}
            {activeTab === "inquiries" && (
              <InquiryManager inquiries={inquiries} onRefresh={onRefreshInquiries} />
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4 border-t border-gray-800">
              <button
                onClick={onShowPreview}
                className="flex-1 py-3 px-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                미리보기
              </button>
              <button
                onClick={onSave}
                className="flex-1 py-3 px-6 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                저장
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}


