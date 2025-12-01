"use client";

import { useState } from "react";
import { saveInquiry, generateId, type Inquiry } from "@/lib/sectionAdConfig";
import { inquiryApi } from "@/lib/api";

interface InquiryFormProps {
  type: "advertisement" | "collaboration";
  onSuccess?: () => void;
}

export default function InquiryForm({ type, onSuccess }: InquiryFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (typeof window === "undefined") {
      setSubmitStatus("error");
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus("idle");

    try {
      const inquiry: Inquiry = {
        id: generateId(),
        type,
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone?.trim() || undefined,
        company: formData.company?.trim() || undefined,
        message: formData.message.trim(),
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 유효성 검사
      if (!inquiry.name || !inquiry.email || !inquiry.message) {
        setSubmitStatus("error");
        setTimeout(() => setSubmitStatus("idle"), 3000);
        return;
      }

      // 백엔드 API로 전송 시도 (실패 시 localStorage 폴백)
      try {
        await inquiryApi.create({
          type: inquiry.type,
          name: inquiry.name,
          email: inquiry.email,
          phone: inquiry.phone,
          company: inquiry.company,
          message: inquiry.message,
          status: inquiry.status,
        });
      } catch (apiError) {
        // API 실패 시 localStorage에 저장 (폴백)
        console.warn("API 저장 실패, localStorage에 저장:", apiError);
        saveInquiry(inquiry);
      }

      setSubmitStatus("success");
      
      // 폼 초기화
      setFormData({
        name: "",
        email: "",
        phone: "",
        company: "",
        message: "",
      });

      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => setSubmitStatus("idle"), 3000);
    } catch (error) {
      console.error("Failed to submit inquiry:", error);
      setSubmitStatus("error");
      setTimeout(() => setSubmitStatus("idle"), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-2">
          이름 <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          placeholder="이름을 입력하세요"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-2">
          이메일 <span className="text-red-500">*</span>
        </label>
        <input
          id="email"
          type="email"
          required
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          placeholder="email@example.com"
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium mb-2">
          전화번호
        </label>
        <input
          id="phone"
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          placeholder="010-1234-5678"
        />
      </div>

      <div>
        <label htmlFor="company" className="block text-sm font-medium mb-2">
          회사/기관명
        </label>
        <input
          id="company"
          type="text"
          value={formData.company}
          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          placeholder="회사 또는 기관명"
        />
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium mb-2">
          문의 내용 <span className="text-red-500">*</span>
        </label>
        <textarea
          id="message"
          required
          rows={5}
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
          placeholder="문의하실 내용을 입력하세요"
        />
      </div>

      {submitStatus === "success" && (
        <div className="bg-green-600/90 text-white px-4 py-3 rounded-lg shadow-lg border border-green-500/50 animate-slide-down">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            문의가 성공적으로 전송되었습니다!
          </div>
        </div>
      )}

      {submitStatus === "error" && (
        <div className="bg-red-600/90 text-white px-4 py-3 rounded-lg shadow-lg border border-red-500/50 animate-slide-down">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            전송에 실패했습니다. 다시 시도해주세요.
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 disabled:hover:scale-100 flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            전송 중...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            문의하기
          </>
        )}
      </button>
    </form>
  );
}

