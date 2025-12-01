"use client";

import { useEffect, useState } from "react";
import { getAdConfig, type AdBannerConfig } from "@/lib/adConfig";

interface AdBannerProps {
  position: "top" | "bottom";
}

export default function AdBanner({ position }: AdBannerProps) {
  const [config, setConfig] = useState<AdBannerConfig | null>(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const loadConfig = () => {
      const adConfig = getAdConfig();
      const bannerConfig = position === "top" ? adConfig.top : adConfig.bottom;
      setConfig(bannerConfig || null);
      setImageError(false);
    };

    loadConfig();

    // Listen for storage changes (when admin updates config)
    const handleStorageChange = () => {
      loadConfig();
    };

    window.addEventListener("storage", handleStorageChange);
    // Also listen for custom event for same-window updates
    window.addEventListener("adConfigUpdated", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("adConfigUpdated", handleStorageChange);
    };
  }, [position]);

  if (!config) {
    return null;
  }

  return (
    <div className={`w-full flex justify-center ${position === "top" ? "mb-8" : "mt-8"}`}>
      <a
        href={config.link}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
        aria-label={config.alt}
      >
        {!imageError ? (
          <img
            src={config.image}
            alt={config.alt}
            className="max-w-full h-auto"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <div className="bg-gray-800 text-gray-400 p-4 rounded text-center text-sm">
            광고 이미지를 불러올 수 없습니다
          </div>
        )}
      </a>
    </div>
  );
}

