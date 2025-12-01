export type AdBlockType = "image" | "video" | "link";

export interface AdBlock {
  id: string;
  type: AdBlockType;
  // 공통 속성
  link?: string;
  alt?: string;
  // 이미지/영상 속성
  mediaUrl?: string; // 이미지 URL 또는 영상 URL
  // 레이아웃 속성
  position: {
    x: number; // 그리드 컬럼 시작 (1-12)
    y: number; // 그리드 행
    width: number; // 그리드 컬럼 수 (1-12)
    height: number; // 그리드 행 수
  };
  // 스타일 속성
  style?: {
    width?: string; // px, %, auto
    height?: string; // px, %, auto
    maxWidth?: string;
    maxHeight?: string;
    objectFit?: "contain" | "cover" | "fill" | "none" | "scale-down";
  };
}

export interface AdBlockLayout {
  blocks: AdBlock[];
  containerWidth?: string; // 전체 컨테이너 너비
  gridColumns?: number; // 그리드 컬럼 수 (기본 12)
}

export interface AdConfigV2 {
  top?: AdBlockLayout;
  bottom?: AdBlockLayout;
}

export const DEFAULT_AD_BLOCK_LAYOUT: AdBlockLayout = {
  blocks: [
    {
      id: "block-1",
      type: "image",
      mediaUrl: "https://via.placeholder.com/728x90/2563eb/ffffff?text=Top+Banner+Ad",
      link: "https://example.com",
      alt: "Top Banner Advertisement",
      position: {
        x: 1,
        y: 1,
        width: 12,
        height: 1,
      },
      style: {
        width: "100%",
        height: "auto",
        objectFit: "cover",
      },
    },
  ],
  containerWidth: "100%",
  gridColumns: 12,
};

export const AD_BLOCK_CONFIG_KEY = "adBlockConfig";

export function getAdBlockConfig(): AdConfigV2 {
  if (typeof window === "undefined") {
    return {
      top: DEFAULT_AD_BLOCK_LAYOUT,
      bottom: {
        blocks: [
          {
            id: "block-2",
            type: "image",
            mediaUrl: "https://via.placeholder.com/728x90/1d4ed8/ffffff?text=Bottom+Banner+Ad",
            link: "https://example.com",
            alt: "Bottom Banner Advertisement",
            position: {
              x: 1,
              y: 1,
              width: 12,
              height: 1,
            },
            style: {
              width: "100%",
              height: "auto",
              objectFit: "cover",
            },
          },
        ],
        containerWidth: "100%",
        gridColumns: 12,
      },
    };
  }

  try {
    const stored = localStorage.getItem(AD_BLOCK_CONFIG_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to parse ad block config from localStorage:", error);
  }

  return {
    top: DEFAULT_AD_BLOCK_LAYOUT,
    bottom: {
      blocks: [
        {
          id: "block-2",
          type: "image",
          mediaUrl: "https://via.placeholder.com/728x90/1d4ed8/ffffff?text=Bottom+Banner+Ad",
          link: "https://example.com",
          alt: "Bottom Banner Advertisement",
          position: {
            x: 1,
            y: 1,
            width: 12,
            height: 1,
          },
          style: {
            width: "100%",
            height: "auto",
            objectFit: "cover",
          },
        },
      ],
      containerWidth: "100%",
      gridColumns: 12,
    },
  };
}

export function saveAdBlockConfig(config: AdConfigV2): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(AD_BLOCK_CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.error("Failed to save ad block config to localStorage:", error);
  }
}

// 유틸리티 함수
export function generateBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function validateAdBlock(block: AdBlock): { valid: boolean; error?: string } {
  if (!block.id || !block.type) {
    return { valid: false, error: "블록 ID와 타입은 필수입니다." };
  }

  if (block.type === "image" || block.type === "video") {
    if (!block.mediaUrl) {
      return { valid: false, error: `${block.type === "image" ? "이미지" : "영상"} URL이 필요합니다.` };
    }
  }

  if (block.position.x < 1 || block.position.x > 12) {
    return { valid: false, error: "X 위치는 1-12 사이여야 합니다." };
  }

  if (block.position.width < 1 || block.position.width > 12) {
    return { valid: false, error: "너비는 1-12 사이여야 합니다." };
  }

  if (block.position.x + block.position.width - 1 > 12) {
    return { valid: false, error: "블록이 그리드 범위를 벗어났습니다." };
  }

  return { valid: true };
}



