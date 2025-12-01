export interface AdBannerConfig {
  image: string;
  link: string;
  alt: string;
}

export interface AdConfig {
  top?: AdBannerConfig;
  bottom?: AdBannerConfig;
}

export const DEFAULT_AD_CONFIG: AdConfig = {
  top: {
    image: "https://via.placeholder.com/728x90/2563eb/ffffff?text=Top+Banner+Ad",
    link: "https://example.com",
    alt: "Top Banner Advertisement",
  },
  bottom: {
    image: "https://via.placeholder.com/728x90/1d4ed8/ffffff?text=Bottom+Banner+Ad",
    link: "https://example.com",
    alt: "Bottom Banner Advertisement",
  },
};

export const AD_CONFIG_KEY = "adConfig";

export function getAdConfig(): AdConfig {
  if (typeof window === "undefined") {
    return DEFAULT_AD_CONFIG;
  }

  try {
    const stored = localStorage.getItem(AD_CONFIG_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to parse ad config from localStorage:", error);
  }

  return DEFAULT_AD_CONFIG;
}

export function saveAdConfig(config: AdConfig): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(AD_CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.error("Failed to save ad config to localStorage:", error);
  }
}



