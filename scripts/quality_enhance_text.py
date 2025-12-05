#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
로고/텍스트 특화 초해상도(SR) 모델을 사용한 화질 개선 스크립트
Real-ESRGAN 기반 + 텍스트/로고 최적화 후처리
** 텍스트 선명도 강화 + 로고 보존 + 아티팩트 최소화 **
"""

import argparse
import os
import sys
import io

# UTF-8 인코딩 강제 설정 (Windows 환경 대응)
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

try:
    import cv2
    import numpy as np
    from PIL import Image
    import torch
    import torch.nn.functional as F
except ImportError as e:
    error_msg = f"Required library not installed: {e}"
    install_msg = "Please install: pip install -r requirements.txt"
    print(f"ERROR: {error_msg}", file=sys.stderr)
    print(f"INFO: {install_msg}", file=sys.stderr)
    sys.exit(1)

# RealESRGAN은 선택적 (없으면 고품질 폴백 사용)
HAS_REALESRGAN = False
try:
    from realesrgan import RealESRGANer
    HAS_REALESRGAN = True
    print("INFO: RealESRGAN library found - AI model will be used", file=sys.stderr)
except Exception as e:
    import traceback
    error_type = type(e).__name__
    error_msg = str(e)
    print(f'WARNING: realesrgan import failed: {error_type}: {error_msg}', file=sys.stderr)
    print('INFO: Using high-quality fallback', file=sys.stderr)


def enhance_text_sharpness(img_cv):
    """텍스트 선명도 강화 (Unsharp Masking + Edge Enhancement)"""
    print("INFO: [Text Enhancement] Enhancing text sharpness...", file=sys.stderr)
    
    # 1. 강한 Unsharp Masking (텍스트 선명도 향상)
    gaussian = cv2.GaussianBlur(img_cv, (0, 0), 1.0)
    unsharp = cv2.addWeighted(img_cv, 1.8, gaussian, -0.8, 0)
    
    # 2. Edge Enhancement (텍스트 경계 강화)
    kernel_edge = np.array([
        [-1, -1, -1],
        [-1,  9, -1],
        [-1, -1, -1]
    ])
    edge_enhanced = cv2.filter2D(unsharp, -1, kernel_edge)
    
    # 3. 원본과 블렌딩 (과도한 아티팩트 방지)
    result = cv2.addWeighted(img_cv, 0.3, edge_enhanced, 0.7, 0)
    
    # 4. 대비 강화 (텍스트 가독성 향상)
    lab = cv2.cvtColor(result, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    l = clahe.apply(l)
    result = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)
    
    print("INFO: [Text Enhancement] Text sharpness enhanced", file=sys.stderr)
    return result


def preserve_logo_edges(img_cv, original_cv):
    """로고 경계 보존 (선명한 경계 유지)"""
    print("INFO: [Logo Preservation] Preserving logo edges...", file=sys.stderr)
    
    # Canny Edge Detection으로 경계 추출
    gray_original = cv2.cvtColor(original_cv, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray_original, 50, 150)
    
    # 경계 영역만 선명도 강화
    edges_dilated = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)
    edges_mask = edges_dilated.astype(np.float32) / 255.0
    
    # 경계 영역은 강한 샤프닝, 나머지는 약한 샤프닝
    kernel_sharp = np.array([
        [0, -0.5, 0],
        [-0.5, 3, -0.5],
        [0, -0.5, 0]
    ])
    sharpened = cv2.filter2D(img_cv, -1, kernel_sharp)
    
    # 마스크 기반 블렌딩
    result = np.zeros_like(img_cv, dtype=np.float32)
    for c in range(3):
        result[:, :, c] = (
            img_cv[:, :, c].astype(np.float32) * (1 - edges_mask) +
            sharpened[:, :, c].astype(np.float32) * edges_mask
        )
    
    result = np.clip(result, 0, 255).astype(np.uint8)
    
    print("INFO: [Logo Preservation] Logo edges preserved", file=sys.stderr)
    return result


def remove_text_artifacts(img_cv):
    """텍스트 아티팩트 제거 (할로우 효과, 그림자 등)"""
    print("INFO: [Artifact Removal] Removing text artifacts...", file=sys.stderr)
    
    # 약한 bilateral filter (디테일 보존하면서 노이즈 제거)
    result = cv2.bilateralFilter(img_cv, 5, 50, 50)
    
    print("INFO: [Artifact Removal] Text artifacts removed", file=sys.stderr)
    return result


def postprocess_text_logo(sr_img_pil, original_img_pil):
    """로고/텍스트 특화 후처리 파이프라인"""
    print("INFO: [Postprocessing] Starting text/logo-specific postprocessing...", file=sys.stderr)
    
    sr_cv = cv2.cvtColor(np.array(sr_img_pil), cv2.COLOR_RGB2BGR)
    original_cv = cv2.cvtColor(np.array(original_img_pil), cv2.COLOR_RGB2BGR)
    
    # 원본을 업스케일한 버전 생성 (참조용)
    original_upscaled = cv2.resize(
        original_cv, 
        (sr_cv.shape[1], sr_cv.shape[0]), 
        interpolation=cv2.INTER_LANCZOS4
    )
    
    # 1. 텍스트 선명도 강화
    result = enhance_text_sharpness(sr_cv)
    
    # 2. 로고 경계 보존
    result = preserve_logo_edges(result, original_upscaled)
    
    # 3. 아티팩트 제거
    result = remove_text_artifacts(result)
    
    print("INFO: [Postprocessing] Text/logo-specific postprocessing complete", file=sys.stderr)
    return Image.fromarray(cv2.cvtColor(result, cv2.COLOR_BGR2RGB))




def main():
    parser = argparse.ArgumentParser(description="로고/텍스트 특화 딥러닝 초해상도 화질 개선")
    parser.add_argument("--input", required=True, help="입력 이미지 경로")
    parser.add_argument("--output", required=True, help="출력 이미지 경로")
    parser.add_argument("--scale", default="2.0", help="스케일 배율 (1.0 ~ 4.0)")
    parser.add_argument("--model", default="RealESRGAN_x4plus", help="모델 이름 (기본: RealESRGAN_x4plus)")
    args = parser.parse_args()

    scale = float(args.scale)
    if scale <= 1.0 or scale > 4.0:
        print(f"ERROR: scale must be between 1.0 and 4.0 (current: {scale})", file=sys.stderr)
        sys.exit(1)

    # GPU/CPU 자동 인식
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"INFO: [Device Detection] Device: {device}", file=sys.stderr)
    
    if device == "cuda":
        print(f"INFO: [Device Detection] GPU: {torch.cuda.get_device_name(0)}", file=sys.stderr)
    else:
        torch.set_num_threads(min(4, os.cpu_count() or 4))
        print(f"INFO: [Device Detection] CPU threads: {torch.get_num_threads()}", file=sys.stderr)

    # 모델 weights 경로
    weights_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "weights")
    model_path = os.path.join(weights_dir, f"{args.model}.pth")

    # 이미지 로드
    print(f"INFO: [Image Loading] Loading image: {args.input}", file=sys.stderr)
    img = Image.open(args.input).convert("RGB")
    original_size = img.size
    print(f"INFO: [Image Loading] Original size: {original_size[0]} x {original_size[1]}", file=sys.stderr)
    
    # 원본 이미지 백업 (후처리용)
    original_img_backup = img.copy()

    try:
        # RealESRGAN 모델 로드 및 실행
        if HAS_REALESRGAN and os.path.exists(model_path):
            try:
                print("INFO: [Model Loading] Loading Real-ESRGAN model for text/logo enhancement...", file=sys.stderr)
                print(f"INFO: [Model Loading] Model path: {model_path}", file=sys.stderr)
                
                # RealESRGANer 사용 (일반 스크립트와 동일한 방식)
                from realesrgan import RealESRGANer
                model = RealESRGANer(
                    scale=4,
                    model_path=model_path,
                    model=None,
                    tile=512,
                    tile_pad=10,
                    pre_pad=0,
                    half=False if device == "cpu" else True,
                    gpu_id=0 if device == "cuda" else None
                )
                print("INFO: [Model Loading] Model loaded successfully", file=sys.stderr)
                
                # RealESRGAN 모델 실행
                print("INFO: [Upscaling] Processing with Real-ESRGAN (4x upscale for text/logo)...", file=sys.stderr)
                
                img_array = np.array(img)
                output, _ = model.enhance(img_array, outscale=4)
                sr_img = Image.fromarray(output)
                print("INFO: [Upscaling] RealESRGAN inference complete", file=sys.stderr)
                
                sr_size = sr_img.size
                print(f"INFO: [Upscaling] After 4x upscale (AI): {sr_size[0]} x {sr_size[1]}", file=sys.stderr)
                    
            except Exception as e:
                print(f"ERROR: [Model Loading] RealESRGAN processing failed: {e}", file=sys.stderr)
                import traceback
                traceback.print_exc(file=sys.stderr)
                print("INFO: [Fallback] Using high-quality Lanczos upscaling", file=sys.stderr)
                target_w = int(original_size[0] * 4)
                target_h = int(original_size[1] * 4)
                sr_img = img.resize((target_w, target_h), Image.LANCZOS)
        else:
            # 고품질 폴백 업스케일링
            if not os.path.exists(model_path):
                print(f"WARNING: [Model Loading] Model file not found: {model_path}", file=sys.stderr)
            if not HAS_REALESRGAN:
                print("WARNING: [Model Loading] RealESRGAN library not available", file=sys.stderr)
            print("INFO: [Fallback] Using high-quality Lanczos upscaling (4x)...", file=sys.stderr)
            target_w = int(original_size[0] * 4)
            target_h = int(original_size[1] * 4)
            sr_img = img.resize((target_w, target_h), Image.LANCZOS)
        
        # 원하는 배율로 리사이즈 (4배가 아닌 경우)
        if scale != 4.0:
            target_w = int(original_size[0] * scale)
            target_h = int(original_size[1] * scale)
            print(f"INFO: [Resizing] Resizing to final size: {target_w} x {target_h}", file=sys.stderr)
            sr_img = sr_img.resize((target_w, target_h), Image.LANCZOS)
            original_img_backup = original_img_backup.resize((target_w, target_h), Image.LANCZOS)
        
        # 로고/텍스트 특화 후처리 파이프라인
        final_img = postprocess_text_logo(sr_img, original_img_backup)

        # 출력 디렉토리 생성
        output_dir = os.path.dirname(args.output)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)

        # 이미지 저장 (고품질 PNG)
        print(f"INFO: [Saving] Saving image: {args.output}", file=sys.stderr)
        final_cv = cv2.cvtColor(np.array(final_img), cv2.COLOR_RGB2BGR)
        cv2.imwrite(args.output, final_cv, [cv2.IMWRITE_PNG_COMPRESSION, 0])
        
        final_size = final_cv.shape[:2][::-1]
        print(f"INFO: [Complete] Processing complete: {final_size[0]} x {final_size[1]}", file=sys.stderr)
        print(f"INFO: [Complete] Text/logo enhancement applied successfully", file=sys.stderr)
        
    except Exception as e:
        error_type = type(e).__name__
        error_msg = str(e)
        print(f"ERROR: {error_type}: {error_msg}", file=sys.stderr)
        import traceback
        print("TRACEBACK:", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

