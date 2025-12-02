"use client";

import { useRef } from "react";
import type { AdBlock } from "@/lib/sectionAdConfig";

interface BlockPropertiesEditorProps {
  block: AdBlock;
  onUpdate: (updates: Partial<AdBlock>) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function BlockPropertiesEditor({
  block,
  onUpdate,
  onFileUpload,
}: BlockPropertiesEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">타입</label>
        <div className="text-gray-300">{block.type}</div>
      </div>

      {(block.type === "image" || block.type === "video") && (
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">
            {block.type === "image" ? "이미지" : "영상"} 업로드
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept={block.type === "image" ? "image/*" : "video/*"}
            onChange={onFileUpload}
            className="hidden"
          />
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              파일 선택
            </button>
            {block.mediaUrl && (
              <button
                onClick={() => {
                  if (confirm("파일을 삭제하시겠습니까?")) {
                    onUpdate({ mediaUrl: "" });
                  }
                }}
                className="px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                aria-label="파일 삭제"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                삭제
              </button>
            )}
          </div>
          {block.mediaUrl && (
            <div className="mb-2 p-2 bg-gray-800 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">미리보기</span>
                <a
                  href={block.mediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  새 창에서 보기
                </a>
              </div>
              {block.type === "image" ? (
                <img
                  src={block.mediaUrl}
                  alt={block.alt || "Preview"}
                  className="w-full h-auto max-h-32 object-contain rounded border border-gray-700"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <video
                  src={block.mediaUrl}
                  className="w-full h-auto max-h-32 object-contain rounded border border-gray-700"
                  controls
                  muted
                />
              )}
            </div>
          )}
          <input
            type="text"
            value={block.mediaUrl || ""}
            onChange={(e) => onUpdate({ mediaUrl: e.target.value })}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            placeholder="URL 또는 파일 업로드"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-2 text-gray-300">링크 URL</label>
        <input
          type="url"
          value={block.link || ""}
          onChange={(e) => onUpdate({ link: e.target.value })}
          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          placeholder="https://example.com"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2 text-gray-300">Alt 텍스트</label>
        <input
          type="text"
          value={block.alt || ""}
          onChange={(e) => onUpdate({ alt: e.target.value })}
          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          placeholder="설명"
        />
      </div>

      {block.type !== "link" && (
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">Object Fit</label>
          <select
            value={block.style?.objectFit || "cover"}
            onChange={(e) =>
              onUpdate({
                style: { ...block.style, objectFit: e.target.value as any },
              })
            }
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          >
            <option value="contain">Contain</option>
            <option value="cover">Cover</option>
            <option value="fill">Fill</option>
            <option value="none">None</option>
            <option value="scale-down">Scale Down</option>
          </select>
        </div>
      )}
    </div>
  );
}


