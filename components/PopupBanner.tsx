"use client";

import { useEffect, useState } from "react";
import { getSectionAdConfig, type PopupBanner } from "@/lib/sectionAdConfig";

export default function PopupBannerRenderer() {
  const [popups, setPopups] = useState<PopupBanner[]>([]);
  const [closedPopups, setClosedPopups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const loadConfig = () => {
      try {
        const config = getSectionAdConfig();
        setPopups((config.popups || []).filter((p) => p.enabled));
      } catch (error) {
        console.error("Failed to load popup config:", error);
        setPopups([]);
      }
    };

    loadConfig();

    const handleStorageChange = () => {
      loadConfig();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("sectionAdConfigUpdated", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("sectionAdConfigUpdated", handleStorageChange);
    };
  }, []);

  return (
    <>
      {popups.map((popup) => (
        <PopupComponent
          key={popup.id}
          popup={popup}
          isClosed={closedPopups.has(popup.id)}
          onClose={() => setClosedPopups((prev) => new Set(prev).add(popup.id))}
        />
      ))}
    </>
  );
}

function PopupComponent({
  popup,
  isClosed,
  onClose,
}: {
  popup: PopupBanner;
  isClosed: boolean;
  onClose: () => void;
}) {
  const [show, setShow] = useState(!isClosed);

  useEffect(() => {
    if (popup.autoClose && popup.autoClose > 0 && show) {
      const timer = setTimeout(() => {
        onClose();
        setShow(false);
      }, popup.autoClose);
      return () => clearTimeout(timer);
    }
  }, [popup.autoClose, onClose, show]);

  if (!show || isClosed) return null;

  const positionClasses: Record<string, string> = {
    top: "top-4 left-1/2 -translate-x-1/2",
    bottom: "bottom-4 left-1/2 -translate-x-1/2",
    center: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
    left: "left-4 top-1/2 -translate-y-1/2",
    right: "right-4 top-1/2 -translate-y-1/2",
  };

  const position = popup.position || "center";

  const content = (() => {
    if (popup.content.type === "image" && popup.content.mediaUrl) {
      return (
        <img
          src={popup.content.mediaUrl}
          alt={popup.content.alt || "Popup"}
          className="w-full h-full object-cover"
        />
      );
    }
    if (popup.content.type === "video" && popup.content.mediaUrl) {
      return (
        <video
          src={popup.content.mediaUrl}
          className="w-full h-full object-cover"
          autoPlay
          loop
          muted
          playsInline
        />
      );
    }
    return (
      <div className="p-4 text-white">{popup.content.text || popup.content.alt || "Popup"}</div>
    );
  })();

  return (
    <div
      className={`fixed z-50 ${positionClasses[position] || positionClasses.center}`}
      style={{
        width: popup.style?.width || "400px",
        maxWidth: "90vw",
        height: popup.style?.height || "300px",
        maxHeight: "90vh",
        backgroundColor: popup.style?.backgroundColor,
      }}
    >
      <div className="relative w-full h-full bg-gray-900 rounded-lg shadow-2xl overflow-hidden">
        {(popup.closeButton ?? true) && (
          <button
            onClick={() => {
              onClose();
              setShow(false);
            }}
            className="absolute top-2 right-2 z-10 w-8 h-8 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 flex items-center justify-center transition-all"
            aria-label="닫기"
          >
            ×
          </button>
        )}
        {popup.content.link ? (
          <a
            href={popup.content.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full h-full"
          >
            {content}
          </a>
        ) : (
          content
        )}
      </div>
      {popup.type === "popup" && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => {
            onClose();
            setShow(false);
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

