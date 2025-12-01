// Global type definitions for better type safety

export interface ToastMessage {
  message: string;
  type: "success" | "error";
}

export interface ImageEditorState {
  image: HTMLImageElement | null;
  scale: number;
  brightness: number;
  contrast: number;
  isLoading: boolean;
}



