export type AdBlockType = "image" | "video" | "link";
export type SectionId = "1" | "2" | "3" | "4";
export type SplitDirection = "horizontal" | "vertical";

export interface AdBlock {
  id: string;
  type: AdBlockType;
  mediaUrl?: string;
  link?: string;
  alt?: string;
  style?: {
    width?: string;
    height?: string;
    objectFit?: "contain" | "cover" | "fill" | "none" | "scale-down";
    backgroundColor?: string;
    backgroundImage?: string;
  };
}

export interface Section {
  id: SectionId;
  blocks: AdBlock[];
  splitDirection?: SplitDirection; // 분할 방향
  splitCount?: number; // 분할 개수 (2, 3, 4 등)
  backgroundColor?: string; // 빈 공간 배경색
  backgroundImage?: string; // 빈 공간 배경 이미지
}

export interface PopupBanner {
  id: string;
  enabled: boolean;
  type: "popup" | "banner";
  position?: "top" | "bottom" | "center" | "left" | "right";
  content: {
    type: AdBlockType;
    mediaUrl?: string;
    link?: string;
    alt?: string;
    text?: string;
  };
  style?: {
    width?: string;
    height?: string;
    backgroundColor?: string;
  };
  closeButton?: boolean;
  autoClose?: number; // 자동 닫기 시간 (ms)
}

export interface SectionAdConfig {
  sections: {
    "1": Section; // 상단
    "2": Section; // 좌측
    "3": Section; // 우측
    "4": Section; // 하단
  };
  popups: PopupBanner[];
}

export interface Inquiry {
  id: string;
  type: "advertisement" | "collaboration";
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message: string;
  status: "pending" | "read" | "replied";
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_SECTION_CONFIG: SectionAdConfig = {
  sections: {
    "1": {
      id: "1",
      blocks: [],
      splitCount: 1,
      backgroundColor: "#1a1a1a",
    },
    "2": {
      id: "2",
      blocks: [],
      splitCount: 1,
      backgroundColor: "#1a1a1a",
    },
    "3": {
      id: "3",
      blocks: [],
      splitCount: 1,
      backgroundColor: "#1a1a1a",
    },
    "4": {
      id: "4",
      blocks: [],
      splitCount: 1,
      backgroundColor: "#1a1a1a",
    },
  },
  popups: [],
};

export const SECTION_AD_CONFIG_KEY = "sectionAdConfig";
export const INQUIRIES_KEY = "inquiries";

export function getSectionAdConfig(): SectionAdConfig {
  if (typeof window === "undefined") {
    return DEFAULT_SECTION_CONFIG;
  }

  try {
    const stored = localStorage.getItem(SECTION_AD_CONFIG_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to parse section ad config:", error);
  }

  return DEFAULT_SECTION_CONFIG;
}

export function saveSectionAdConfig(config: SectionAdConfig): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(SECTION_AD_CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.error("Failed to save section ad config:", error);
  }
}

export function getInquiries(): Inquiry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = localStorage.getItem(INQUIRIES_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to parse inquiries:", error);
  }

  return [];
}

export function saveInquiry(inquiry: Inquiry): void {
  if (typeof window === "undefined") return;

  try {
    const inquiries = getInquiries();
    inquiries.push(inquiry);
    localStorage.setItem(INQUIRIES_KEY, JSON.stringify(inquiries));
  } catch (error) {
    console.error("Failed to save inquiry:", error);
  }
}

export function updateInquiryStatus(id: string, status: Inquiry["status"]): void {
  if (typeof window === "undefined") return;

  try {
    const inquiries = getInquiries();
    const index = inquiries.findIndex((inq) => inq.id === id);
    if (index !== -1) {
      inquiries[index].status = status;
      inquiries[index].updatedAt = new Date().toISOString();
      localStorage.setItem(INQUIRIES_KEY, JSON.stringify(inquiries));
    }
  } catch (error) {
    console.error("Failed to update inquiry:", error);
  }
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}



