"use client";

import { useRef } from "react";
import type { PopupBanner } from "@/lib/sectionAdConfig";

interface PopupEditorProps {
  popup: PopupBanner;
  onUpdate: (updates: Partial<PopupBanner>) => void;
  onDelete: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function PopupEditor({
  popup,
  onUpdate,
  onDelete,
  onFileUpload,
}: PopupEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-gray-800 rounded-lg p-6 space-y-4 border border-gray-700 shadow-lg">
      <div className="flex justify-between items-center pb-3 border-b border-gray-700">
        <h4 className="font-semibold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
          팝업/배너 설정
        </h4>
        <button 
          onClick={onDelete} 
          className="text-red-400 hover:text-red-300 transition-colors p-2 rounded hover:bg-red-500/20"
          aria-label="팝업 삭제"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">활성화</label>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={popup.enabled}
              onChange={(e) => onUpdate({ enabled: e.target.checked })}
              className="w-5 h-5 rounded cursor-pointer"
            />
            <span className="text-sm text-gray-400">{popup.enabled ? "활성" : "비활성"}</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">타입</label>
          <select
            value={popup.type}
            onChange={(e) => onUpdate({ type: e.target.value as "popup" | "banner" })}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          >
            <option value="popup">팝업</option>
            <option value="banner">배너</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">위치</label>
          <select
            value={popup.position ?? "center"}
            onChange={(e) => onUpdate({ position: e.target.value as any })}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          >
            <option value="top">상단</option>
            <option value="bottom">하단</option>
            <option value="center">중앙</option>
            <option value="left">좌측</option>
            <option value="right">우측</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">콘텐츠 타입</label>
          <select
            value={popup.content.type}
            onChange={(e) =>
              onUpdate({ content: { ...popup.content, type: e.target.value as any } })
            }
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          >
            <option value="image">이미지</option>
            <option value="video">영상</option>
            <option value="link">링크</option>
          </select>
        </div>
      </div>

      {(popup.content.type === "image" || popup.content.type === "video") && (
        <div>
          <label className="block text-sm font-medium mb-2">
            {popup.content.type === "image" ? "이미지" : "영상"} 업로드
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept={popup.content.type === "image" ? "image/*" : "video/*"}
            onChange={onFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg mb-2 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            파일 선택
          </button>
          <input
            type="text"
            value={popup.content.mediaUrl || ""}
            onChange={(e) =>
              onUpdate({ content: { ...popup.content, mediaUrl: e.target.value } })
            }
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            placeholder="URL 또는 파일 업로드"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-2 text-gray-300">링크 URL</label>
        <input
          type="url"
          value={popup.content.link || ""}
          onChange={(e) => onUpdate({ content: { ...popup.content, link: e.target.value } })}
          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          placeholder="https://example.com"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">닫기 버튼</label>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={popup.closeButton ?? true}
              onChange={(e) => onUpdate({ closeButton: e.target.checked })}
              className="w-5 h-5 rounded cursor-pointer"
            />
            <span className="text-sm text-gray-400">{(popup.closeButton ?? true) ? "표시" : "숨김"}</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">자동 닫기 (ms)</label>
          <input
            type="number"
            min="0"
            value={popup.autoClose ?? 0}
            onChange={(e) => {
              const value = parseInt(e.target.value) || 0;
              onUpdate({ autoClose: Math.max(0, value) });
            }}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            placeholder="0 = 자동 닫기 안함"
          />
        </div>
      </div>
    </div>
  );
}


