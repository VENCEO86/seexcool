"use client";

import { useState, useEffect, useRef } from "react";
import {
  getSectionAdConfig,
  saveSectionAdConfig,
  getInquiries,
  updateInquiryStatus,
  type SectionAdConfig,
  type Section,
  type AdBlock,
  type AdBlockType,
  type SectionId,
  type SplitDirection,
  type PopupBanner,
  type Inquiry,
  generateId,
  DEFAULT_SECTION_CONFIG,
} from "@/lib/sectionAdConfig";
import { configApi, inquiryApi } from "@/lib/api";
import { useRouter } from "next/navigation";
import AdminLoginForm from "@/components/AdminLoginForm";
import AdminPreviewPage from "@/components/AdminPreviewPage";
import AdminMainPage from "@/components/AdminMainPage";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

export default function AdminPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [config, setConfig] = useState<SectionAdConfig>(DEFAULT_SECTION_CONFIG);
  const configRef = useRef<SectionAdConfig>(DEFAULT_SECTION_CONFIG);
  const [activeSection, setActiveSection] = useState<SectionId>("1");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"sections" | "popups" | "inquiries" | "branding">("sections");
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && isAuthenticated) {
      let isMounted = true;
      
      const loadData = async () => {
        try {
          // 백엔드 API에서 설정 로드 시도 (개선: 에러 핸들링 강화)
          try {
            const apiConfig = await configApi.get(true); // 캐시 사용
            if (isMounted) {
              setConfig(apiConfig);
              configRef.current = apiConfig;
            }
          } catch (apiError) {
            // API 실패 시 localStorage에서 로드 (폴백)
            if (process.env.NODE_ENV === "development") {
              console.warn("API 로드 실패, localStorage에서 로드:", apiError);
            }
            const stored = getSectionAdConfig();
            if (stored && stored.sections && isMounted) {
              const validatedConfig: SectionAdConfig = {
                sections: {
                  "1": stored.sections["1"] || DEFAULT_SECTION_CONFIG.sections["1"],
                  "2": stored.sections["2"] || DEFAULT_SECTION_CONFIG.sections["2"],
                  "3": stored.sections["3"] || DEFAULT_SECTION_CONFIG.sections["3"],
                  "4": stored.sections["4"] || DEFAULT_SECTION_CONFIG.sections["4"],
                },
                popups: stored.popups || [],
              };
              setConfig(validatedConfig);
              configRef.current = validatedConfig;
            } else if (isMounted) {
              setConfig(DEFAULT_SECTION_CONFIG);
              configRef.current = DEFAULT_SECTION_CONFIG;
            }
          }

          // 백엔드 API에서 문의 로드 시도 (개선: 에러 핸들링 강화)
          try {
            const apiInquiries = await inquiryApi.getAll(true); // 캐시 사용
            if (isMounted) {
              setInquiries(apiInquiries);
            }
          } catch (apiError) {
            // API 실패 시 localStorage에서 로드 (폴백)
            if (process.env.NODE_ENV === "development") {
              console.warn("API 문의 로드 실패, localStorage에서 로드:", apiError);
            }
            if (isMounted) {
              setInquiries(getInquiries());
            }
          }
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.error("Failed to load data:", error);
          }
          if (isMounted) {
            setConfig(DEFAULT_SECTION_CONFIG);
            setInquiries([]);
          }
        }
      };

      loadData();
      
      return () => {
        isMounted = false;
      };
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setError("");
    } else {
      setError("비밀번호가 올바르지 않습니다.");
    }
  };

  // currentSection을 안전하게 가져오기
  const currentSection: Section = (() => {
    const section = config.sections?.[activeSection];
    if (section && section.id && Array.isArray(section.blocks)) {
      return {
        ...section,
        blocks: section.blocks || [],
        splitCount: section.splitCount || 1,
        backgroundColor: section.backgroundColor || "#1a1a1a",
      };
    }
    return {
      id: activeSection,
      blocks: [],
      splitCount: 1,
      backgroundColor: "#1a1a1a",
    };
  })();

  const addBlock = (type: AdBlockType) => {
    try {
      const newBlock: AdBlock = {
        id: generateId(),
        type,
        style: {
          objectFit: "cover",
        },
      };

      const updatedSections = {
        ...(config.sections || {}),
        [activeSection]: {
          ...currentSection,
          blocks: [...(currentSection.blocks || []), newBlock],
        },
      };

      setConfig({
        ...config,
        sections: updatedSections,
      });
      setSelectedBlockId(newBlock.id);
      setError("");
    } catch (error) {
      console.error("Failed to add block:", error);
      setError("블록 추가에 실패했습니다.");
    }
  };

  const deleteBlock = (blockId: string) => {
    try {
      if (confirm("이 블록을 삭제하시겠습니까?")) {
        const updatedBlocks = (currentSection.blocks || []).filter((b) => b.id !== blockId);
        
        setConfig({
          ...config,
          sections: {
            ...(config.sections || {}),
            [activeSection]: {
              ...currentSection,
              blocks: updatedBlocks,
            },
          },
        });
        
        if (selectedBlockId === blockId) {
          setSelectedBlockId(null);
        }
        setError("");
      }
    } catch (error) {
      console.error("Failed to delete block:", error);
      setError("블록 삭제에 실패했습니다.");
    }
  };

  const updateBlock = (blockId: string, updates: Partial<AdBlock>) => {
    try {
      const updatedBlocks = (currentSection.blocks || []).map((b) => 
        b.id === blockId ? { ...b, ...updates } : b
      );
      
      setConfig({
        ...config,
        sections: {
          ...(config.sections || {}),
          [activeSection]: {
            ...currentSection,
            blocks: updatedBlocks,
          },
        },
      });
      setError("");
    } catch (error) {
      console.error("Failed to update block:", error);
      setError("블록 업데이트에 실패했습니다.");
    }
  };

  const updateSection = (updates: Partial<Section>) => {
    try {
      setConfig({
        ...config,
        sections: {
          ...(config.sections || {}),
          [activeSection]: {
            ...currentSection,
            ...updates,
          },
        },
      });
      setError("");
    } catch (error) {
      console.error("Failed to update section:", error);
      setError("섹션 업데이트에 실패했습니다.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, blockId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      updateBlock(blockId, { mediaUrl: dataUrl });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const addPopup = () => {
    try {
      const newPopup: PopupBanner = {
        id: generateId(),
        enabled: true,
        type: "popup",
        position: "center",
        content: {
          type: "image",
        },
        closeButton: true,
      };

      setConfig({
        ...config,
        popups: [...(config.popups || []), newPopup],
      });
      setError("");
    } catch (error) {
      console.error("Failed to add popup:", error);
      setError("팝업 추가에 실패했습니다.");
    }
  };

  const updatePopup = (popupId: string, updates: Partial<PopupBanner>) => {
    try {
      setConfig({
        ...config,
        popups: (config.popups || []).map((p) => (p.id === popupId ? { ...p, ...updates } : p)),
      });
      setError("");
    } catch (error) {
      console.error("Failed to update popup:", error);
      setError("팝업 업데이트에 실패했습니다.");
    }
  };

  const deletePopup = (popupId: string) => {
    try {
      if (confirm("이 팝업을 삭제하시겠습니까?")) {
        setConfig({
          ...config,
          popups: (config.popups || []).filter((p) => p.id !== popupId),
        });
        setError("");
      }
    } catch (error) {
      console.error("Failed to delete popup:", error);
      setError("팝업 삭제에 실패했습니다.");
    }
  };

  const handleSave = async () => {
    if (typeof window === "undefined") {
      setError("브라우저 환경에서만 저장할 수 있습니다.");
      return;
    }

    setError("");
    setSuccess("");

    try {
      // 설정 유효성 검사
      const validatedConfig: SectionAdConfig = {
        sections: {
          "1": config.sections?.["1"] || DEFAULT_SECTION_CONFIG.sections["1"],
          "2": config.sections?.["2"] || DEFAULT_SECTION_CONFIG.sections["2"],
          "3": config.sections?.["3"] || DEFAULT_SECTION_CONFIG.sections["3"],
          "4": config.sections?.["4"] || DEFAULT_SECTION_CONFIG.sections["4"],
        },
        popups: config.popups || [],
      };

      // 백엔드 API로 저장 시도
      try {
        await configApi.save(validatedConfig);
        setConfig(validatedConfig);
      } catch (apiError) {
        // API 실패 시 localStorage에 저장 (폴백)
        console.warn("API 저장 실패, localStorage에 저장:", apiError);
      }
      
      // API 성공 여부와 관계없이 localStorage에도 저장 (프론트엔드 즉시 반영을 위해)
      saveSectionAdConfig(validatedConfig);
      
      // 프론트엔드에 즉시 반영하기 위한 이벤트 발생
      if (typeof window !== "undefined") {
        // CustomEvent 발생
        window.dispatchEvent(new CustomEvent("sectionAdConfigUpdated"));
        
        // BroadcastChannel을 통한 탭 간 통신
        try {
          const channel = new BroadcastChannel("sectionAdConfig");
          channel.postMessage({ type: "configUpdated" });
          channel.close();
        } catch (e) {
          // BroadcastChannel 미지원 브라우저는 무시
        }
        
        // storage 이벤트도 발생시켜 다른 탭에서도 반영
        window.localStorage.setItem("sectionAdConfig_forceUpdate", Date.now().toString());
        setTimeout(() => {
          window.localStorage.removeItem("sectionAdConfig_forceUpdate");
        }, 100);
      }
      setSuccess("설정이 저장되었습니다. 프론트엔드에 즉시 반영됩니다.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error("Save error:", error);
      setError("저장에 실패했습니다: " + (error instanceof Error ? error.message : String(error)));
      setTimeout(() => setError(""), 5000);
    }
  };

  const refreshInquiries = async () => {
    try {
      // 백엔드 API에서 문의 로드 시도
      const apiInquiries = await inquiryApi.getAll();
      setInquiries(apiInquiries);
    } catch (apiError) {
      // API 실패 시 localStorage에서 로드 (폴백)
      console.warn("API 문의 로드 실패, localStorage에서 로드:", apiError);
      setInquiries(getInquiries());
    }
  };

  // 미리보기 설정 저장 (실시간 업데이트)
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const tempKey = "sectionAdConfig_preview";
        const validatedConfig: SectionAdConfig = {
          sections: {
            "1": config.sections?.["1"] || DEFAULT_SECTION_CONFIG.sections["1"],
            "2": config.sections?.["2"] || DEFAULT_SECTION_CONFIG.sections["2"],
            "3": config.sections?.["3"] || DEFAULT_SECTION_CONFIG.sections["3"],
            "4": config.sections?.["4"] || DEFAULT_SECTION_CONFIG.sections["4"],
          },
          popups: config.popups || [],
        };
        localStorage.setItem(tempKey, JSON.stringify(validatedConfig));
        
        // 미리보기 모드가 활성화되어 있으면 즉시 반영
        if (showPreview) {
          window.dispatchEvent(new CustomEvent("sectionAdConfigPreviewUpdated"));
        }
      } catch (error) {
        console.error("Failed to save preview config:", error);
      }
    }
  }, [config, showPreview]);

  if (!isAuthenticated) {
    return (
      <AdminLoginForm
        password={password}
        error={error}
        onPasswordChange={setPassword}
        onLogin={handleLogin}
      />
    );
  }

  if (showPreview) {
    return (
      <AdminPreviewPage
        config={config}
        onClose={() => setShowPreview(false)}
        onApply={async (previewConfig) => {
          // 미리보기 설정을 실제 설정으로 적용
          const validatedConfig: SectionAdConfig = {
            sections: {
              "1": previewConfig.sections?.["1"] || DEFAULT_SECTION_CONFIG.sections["1"],
              "2": previewConfig.sections?.["2"] || DEFAULT_SECTION_CONFIG.sections["2"],
              "3": previewConfig.sections?.["3"] || DEFAULT_SECTION_CONFIG.sections["3"],
              "4": previewConfig.sections?.["4"] || DEFAULT_SECTION_CONFIG.sections["4"],
            },
            popups: previewConfig.popups || [],
          };
          
          setConfig(validatedConfig);
          
          // 백엔드 API로 저장 시도
          try {
            await configApi.save(validatedConfig);
          } catch (apiError) {
            console.warn("API 저장 실패, localStorage에 저장:", apiError);
          }
          
          // localStorage에도 저장 (프론트엔드 즉시 반영)
          saveSectionAdConfig(validatedConfig);
          
          // 프론트엔드에 즉시 반영하기 위한 이벤트 발생
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("sectionAdConfigUpdated"));
            
            // BroadcastChannel을 통한 탭 간 통신
            try {
              const channel = new BroadcastChannel("sectionAdConfig");
              channel.postMessage({ type: "configUpdated" });
              channel.close();
            } catch (e) {
              // BroadcastChannel 미지원 브라우저는 무시
            }
            
            window.localStorage.setItem("sectionAdConfig_forceUpdate", Date.now().toString());
            setTimeout(() => {
              window.localStorage.removeItem("sectionAdConfig_forceUpdate");
            }, 100);
          }
          
          setSuccess("미리보기 설정이 적용되었습니다. 프론트엔드에 즉시 반영됩니다.");
          setTimeout(() => setSuccess(""), 3000);
        }}
      />
    );
  }

  return (
    <AdminMainPage
      config={config}
      activeSection={activeSection}
      selectedBlockId={selectedBlockId}
      activeTab={activeTab}
      inquiries={inquiries}
      error={error}
      success={success}
      currentSection={currentSection}
      onSectionChange={setActiveSection}
      onBlockSelect={setSelectedBlockId}
      onTabChange={setActiveTab}
      onAddBlock={addBlock}
      onDeleteBlock={deleteBlock}
      onUpdateBlock={updateBlock}
      onUpdateSection={updateSection}
      onHandleFileUpload={handleFileUpload}
      onAddPopup={addPopup}
      onUpdatePopup={updatePopup}
      onDeletePopup={deletePopup}
      onSave={handleSave}
      onShowPreview={() => setShowPreview(true)}
      onRefreshInquiries={refreshInquiries}
      router={router}
    />
  );
}
