"use client";

import { useState } from "react";
import InquiryForm from "./InquiryForm";

interface InquiryModalProps {
  type: "advertisement" | "collaboration";
}

export default function InquiryModal({ type }: InquiryModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 ${
          type === "advertisement"
            ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
            : "bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white"
        }`}
      >
        {type === "advertisement" ? "광고문의하기" : "협업하기"}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <div className="relative bg-gray-900/95 backdrop-blur-md rounded-xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-800 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">
                {type === "advertisement" ? "광고문의하기" : "협업하기"}
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white text-2xl"
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <InquiryForm
              type={type}
              onSuccess={() => {
                setIsOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

