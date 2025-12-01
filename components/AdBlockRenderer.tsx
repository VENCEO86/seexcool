"use client";

import { useEffect, useState } from "react";
import { getAdBlockConfig, type AdBlockLayout, type AdBlock } from "@/lib/adBlockConfig";

interface AdBlockRendererProps {
  position: "top" | "bottom";
}

export default function AdBlockRenderer({ position }: AdBlockRendererProps) {
  const [layout, setLayout] = useState<AdBlockLayout | null>(null);

  useEffect(() => {
    const loadConfig = () => {
      const adConfig = getAdBlockConfig();
      const blockLayout = position === "top" ? adConfig.top : adConfig.bottom;
      setLayout(blockLayout || null);
    };

    loadConfig();

    const handleStorageChange = () => {
      loadConfig();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("adBlockConfigUpdated", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("adBlockConfigUpdated", handleStorageChange);
    };
  }, [position]);

  if (!layout || !layout.blocks || layout.blocks.length === 0) {
    return null;
  }

  const gridColumns = layout.gridColumns || 12;

  return (
    <div
      className={`w-full flex justify-center ${position === "top" ? "mb-8" : "mt-8"}`}
      style={{ width: layout.containerWidth || "100%" }}
    >
      <div
        className="grid gap-4 w-full"
        style={{
          gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
        }}
      >
        {layout.blocks.map((block) => (
          <AdBlockComponent key={block.id} block={block} gridColumns={gridColumns} />
        ))}
      </div>
    </div>
  );
}

function AdBlockComponent({ block, gridColumns }: { block: AdBlock; gridColumns: number }) {
  const [mediaError, setMediaError] = useState(false);

  const gridColumnStart = block.position.x;
  const gridColumnEnd = block.position.x + block.position.width;
  const gridRowStart = block.position.y;
  const gridRowEnd = block.position.y + block.position.height;

  const style: React.CSSProperties = {
    gridColumn: `${gridColumnStart} / ${gridColumnEnd}`,
    gridRow: `${gridRowStart} / ${gridRowEnd}`,
    ...block.style,
  };

  const content = (() => {
    if (block.type === "image") {
      if (mediaError || !block.mediaUrl) {
        return (
          <div className="bg-gray-800 text-gray-400 p-4 rounded text-center text-sm">
            이미지를 불러올 수 없습니다
          </div>
        );
      }
      return (
        <img
          src={block.mediaUrl}
          alt={block.alt || "Advertisement"}
          className="w-full h-full object-cover rounded"
          onError={() => setMediaError(true)}
          loading="lazy"
          style={{
            objectFit: block.style?.objectFit || "cover",
          }}
        />
      );
    }

    if (block.type === "video") {
      if (!block.mediaUrl) {
        return (
          <div className="bg-gray-800 text-gray-400 p-4 rounded text-center text-sm">
            영상 URL이 없습니다
          </div>
        );
      }
      return (
        <video
          src={block.mediaUrl}
          className="w-full h-full object-cover rounded"
          controls={false}
          autoPlay
          loop
          muted
          playsInline
          style={{
            objectFit: block.style?.objectFit || "cover",
          }}
        />
      );
    }

    if (block.type === "link") {
      return (
        <div className="bg-gray-800 p-4 rounded text-center">
          <a
            href={block.link || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline"
          >
            {block.alt || block.link || "링크"}
          </a>
        </div>
      );
    }

    return null;
  })();

  if (block.link && block.type !== "link") {
    return (
      <a
        href={block.link}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
        style={style}
        aria-label={block.alt || "Advertisement"}
      >
        {content}
      </a>
    );
  }

  return <div style={style}>{content}</div>;
}



