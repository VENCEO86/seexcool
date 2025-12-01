"use client";

import { useState, useEffect } from "react";
import { updateInquiryStatus, getInquiries, type Inquiry } from "@/lib/sectionAdConfig";
import { inquiryApi } from "@/lib/api";

interface InquiryManagerProps {
  inquiries: Inquiry[];
  onRefresh: () => void;
}

export default function InquiryManager({ inquiries, onRefresh }: InquiryManagerProps) {
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);

  const handleStatusChange = async (id: string, status: Inquiry["status"]) => {
    try {
      // 백엔드 API로 업데이트 시도
      const updated = await inquiryApi.updateStatus(id, status);
      if (selectedInquiry?.id === id) {
        setSelectedInquiry(updated);
      }
    } catch (apiError) {
      // API 실패 시 localStorage에 저장 (폴백)
      console.warn("API 업데이트 실패, localStorage에 저장:", apiError);
      updateInquiryStatus(id, status);
      if (selectedInquiry?.id === id) {
        setSelectedInquiry({ ...selectedInquiry, status });
      }
    }
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center pb-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          문의/협업 관리
        </h3>
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          새로고침
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Inquiries List */}
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {inquiries.length === 0 ? (
            <div className="text-gray-400 text-center py-8 bg-gray-800/50 rounded-lg">
              <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              문의가 없습니다.
            </div>
          ) : (
            inquiries
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((inquiry) => (
                <div
                  key={inquiry.id}
                  className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ${
                    selectedInquiry?.id === inquiry.id
                      ? "bg-gradient-to-r from-blue-600/30 to-purple-600/30 border-2 border-blue-500 shadow-lg scale-105"
                      : inquiry.status === "pending"
                      ? "bg-yellow-600/20 border-2 border-yellow-500 hover:bg-yellow-600/30 hover:scale-102"
                      : "bg-gray-800 border-2 border-transparent hover:bg-gray-700 hover:scale-102"
                  }`}
                  onClick={() => setSelectedInquiry(inquiry)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">
                        {inquiry.name} ({inquiry.type === "advertisement" ? "광고" : "협업"})
                      </div>
                      <div className="text-sm text-gray-400">{inquiry.email}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(inquiry.createdAt).toLocaleString("ko-KR")}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        inquiry.status === "pending"
                          ? "bg-yellow-600"
                          : inquiry.status === "read"
                          ? "bg-blue-600"
                          : "bg-green-600"
                      }`}
                    >
                      {inquiry.status === "pending"
                        ? "대기"
                        : inquiry.status === "read"
                        ? "읽음"
                        : "답변완료"}
                    </span>
                  </div>
                </div>
              ))
          )}
        </div>

        {/* Inquiry Detail */}
        {selectedInquiry && (
          <div className="bg-gray-800 rounded-lg p-6 space-y-4 border border-gray-700 shadow-lg animate-fade-in">
            <div className="flex justify-between items-center pb-3 border-b border-gray-700">
              <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                문의 상세
              </h4>
              <div className="flex gap-2">
                <button
                  onClick={() => handleStatusChange(selectedInquiry.id, "read")}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  읽음
                </button>
                <button
                  onClick={() => handleStatusChange(selectedInquiry.id, "replied")}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  답변완료
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-sm font-medium text-gray-400">타입</label>
                <div className="text-white">
                  {selectedInquiry.type === "advertisement" ? "광고문의" : "협업"}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-400">이름</label>
                <div className="text-white">{selectedInquiry.name}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-400">이메일</label>
                <div className="text-white">{selectedInquiry.email}</div>
              </div>
              {selectedInquiry.phone && (
                <div>
                  <label className="text-sm font-medium text-gray-400">전화번호</label>
                  <div className="text-white">{selectedInquiry.phone}</div>
                </div>
              )}
              {selectedInquiry.company && (
                <div>
                  <label className="text-sm font-medium text-gray-400">회사/기관</label>
                  <div className="text-white">{selectedInquiry.company}</div>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-400">문의 내용</label>
                <div className="text-white bg-gray-900 p-3 rounded mt-1 whitespace-pre-wrap">
                  {selectedInquiry.message}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-400">등록일</label>
                <div className="text-white text-sm">
                  {new Date(selectedInquiry.createdAt).toLocaleString("ko-KR")}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


