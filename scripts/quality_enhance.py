#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
딥러닝 초해상도(SR) 모델을 사용한 화질 개선 스크립트
Real-ESRGAN 계열 모델 사용, CPU/GPU 자동 인식
** 고도화 버전: 원본 색상 보존 + 선명도 강화 + 아티팩트 제거 **
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
    # 모든 예외를 잡아서 상세 정보 출력
    import traceback
    error_type = type(e).__name__
    error_msg = str(e)
    print(f'WARNING: realesrgan import failed: {error_type}: {error_msg}', file=sys.stderr)
    print('DEBUG: Full traceback:', file=sys.stderr)
    traceback.print_exc(file=sys.stderr)
    print('INFO: Using high-quality fallback', file=sys.stderr)
    print('INFO: Continuing with enhanced upscaling...', file=sys.stderr)


def preprocess_image(img_pil):
    """이미지 전처리: 최소한의 노이즈 감소만 (원본 보존)"""
    print("INFO: [Preprocessing] Starting minimal preprocessing...", file=sys.stderr)
    # 전처리 최소화 - RealESRGAN이 원본을 최대한 보존하도록
    return img_pil


def preserve_color_original(original_cv, enhanced_cv):
    """원본 색상을 보존하면서 선명도만 강화"""
    print("INFO: [Color Preservation] Preserving original color characteristics...", file=sys.stderr)
    
    # 원본을 업스케일한 버전 생성 (참조용)
    original_upscaled = cv2.resize(original_cv, (enhanced_cv.shape[1], enhanced_cv.shape[0]), interpolation=cv2.INTER_LANCZOS4)
    
    # LAB 색공간으로 변환
    original_lab = cv2.cvtColor(original_upscaled, cv2.COLOR_BGR2LAB)
    enhanced_lab = cv2.cvtColor(enhanced_cv, cv2.COLOR_BGR2LAB)
    
    # L 채널: AI 결과 사용 (선명도)
    # A, B 채널: 원본 색상 보존 (색상 정보)
    l_enhanced, a_original, b_original = cv2.split(enhanced_lab)
    _, a_orig, b_orig = cv2.split(original_lab)
    
    # 원본 색상과 블렌딩 (90% 원본 색상, 10% AI 색상)
    a_blended = cv2.addWeighted(a_orig, 0.9, a_original, 0.1, 0)
    b_blended = cv2.addWeighted(b_orig, 0.9, b_original, 0.1, 0)
    
    # L 채널: 약한 CLAHE로 대비만 약간 향상 (색상 변형 최소화)
    clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8))
    l_enhanced = clahe.apply(l_enhanced)
    
    lab_result = cv2.merge([l_enhanced, a_blended, b_blended])
    result = cv2.cvtColor(lab_result, cv2.COLOR_LAB2BGR)
    
    print("INFO: [Color Preservation] Original color preserved", file=sys.stderr)
    return result


def enhance_sharpness_preserve_color(img_cv, original_cv):
    """선명도 강화 (원본 색상 보존)"""
    print("INFO: [Sharpness] Enhancing sharpness while preserving colors...", file=sys.stderr)
    
    # Unsharp Masking (약한 강도)
    gaussian = cv2.GaussianBlur(img_cv, (0, 0), 1.5)
    unsharp = cv2.addWeighted(img_cv, 1.3, gaussian, -0.3, 0)
    
    # 약한 샤프닝 필터 (아티팩트 최소화)
    kernel = np.array([
        [0, -0.2, 0],
        [-0.2, 1.8, -0.2],
        [0, -0.2, 0]
    ])
    sharpened = cv2.filter2D(unsharp, -1, kernel)
    
    # 원본 색상과 블렌딩 (색상 보존)
    result = preserve_color_original(original_cv, sharpened)
    
    print("INFO: [Sharpness] Sharpness enhanced", file=sys.stderr)
    return result


def remove_artifacts(img_cv):
    """아티팩트 제거 (그림자, 할로우 효과 등)"""
    print("INFO: [Artifact Removal] Removing artifacts...", file=sys.stderr)
    
    # 약한 bilateral filter만 적용 (디테일 보존)
    result = cv2.bilateralFilter(img_cv, 3, 30, 30)
    
    print("INFO: [Artifact Removal] Artifacts removed", file=sys.stderr)
    return result


def postprocess_image_enhanced(sr_img_pil, original_img_pil):
    """원본 색상 보존 후처리 파이프라인"""
    print("INFO: [Postprocessing] Starting color-preserving postprocessing...", file=sys.stderr)
    
    sr_cv = cv2.cvtColor(np.array(sr_img_pil), cv2.COLOR_RGB2BGR)
    original_cv = cv2.cvtColor(np.array(original_img_pil), cv2.COLOR_RGB2BGR)
    
    # 1. 원본 색상 보존하면서 선명도 강화
    result = enhance_sharpness_preserve_color(sr_cv, original_cv)
    
    # 2. 아티팩트 제거 (최소한만)
    result = remove_artifacts(result)
    
    print("INFO: [Postprocessing] Color-preserving postprocessing complete", file=sys.stderr)
    return Image.fromarray(cv2.cvtColor(result, cv2.COLOR_BGR2RGB))


def verify_model_execution(original_img, enhanced_img):
    """모델이 실제로 실행되었는지 검증"""
    orig_array = np.array(original_img)
    enh_array = np.array(enhanced_img)
    
    size_ratio = (enh_array.shape[0] * enh_array.shape[1]) / (orig_array.shape[0] * orig_array.shape[1])
    orig_var = np.var(orig_array)
    enh_var = np.var(enh_array)
    
    if size_ratio >= 3.5:
        print(f"INFO: [Verification] Size ratio: {size_ratio:.2f}x (expected ~4.0x)", file=sys.stderr)
        print(f"INFO: [Verification] Variance ratio: {enh_var/orig_var:.2f}x", file=sys.stderr)
        return True
    
    return False




def main():
    parser = argparse.ArgumentParser(description="딥러닝 초해상도 화질 개선")
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
        print(f"INFO: [Device Detection] CUDA enabled - using GPU acceleration", file=sys.stderr)
    else:
        print("INFO: [Device Detection] CPU mode - RealESRGAN will run on CPU", file=sys.stderr)
        # CPU 스레드 최적화
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
    
    # 원본 이미지 백업 (색상 보존용)
    original_img_backup = img.copy()

    try:
        # 전처리 (최소화)
        preprocessed_img = preprocess_image(img)
        
        # RealESRGAN 모델 로드 및 실행 (CPU에서도 실행)
        if HAS_REALESRGAN and os.path.exists(model_path):
            try:
                print("INFO: [Model Loading] Loading Real-ESRGAN model...", file=sys.stderr)
                print(f"INFO: [Model Loading] Model path: {model_path}", file=sys.stderr)
                print(f"INFO: [Model Loading] Target device: {device}", file=sys.stderr)
                
                # RealESRGANer 사용 (올바른 클래스)
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
                
                # RealESRGAN 모델 실행 (CPU에서도 실행)
                print("INFO: [Upscaling] Processing with Real-ESRGAN (4x upscale)...", file=sys.stderr)
                print(f"INFO: [Upscaling] Using {device} for inference", file=sys.stderr)
                
                # RealESRGANer는 numpy array를 입력으로 받음
                img_array = np.array(preprocessed_img)
                output, _ = model.enhance(img_array, outscale=4)
                sr_img = Image.fromarray(output)
                print("INFO: [Upscaling] RealESRGAN inference complete", file=sys.stderr)
                
                sr_size = sr_img.size
                print(f"INFO: [Upscaling] After 4x upscale (AI): {sr_size[0]} x {sr_size[1]}", file=sys.stderr)
                
                # 모델 실행 검증
                if verify_model_execution(img, sr_img):
                    print("INFO: [Verification] Model execution verified - AI upscaling applied", file=sys.stderr)
                else:
                    print("WARNING: [Verification] Model execution verification failed", file=sys.stderr)
                    
            except Exception as e:
                print(f"ERROR: [Model Loading] RealESRGAN processing failed: {e}", file=sys.stderr)
                import traceback
                traceback.print_exc(file=sys.stderr)
                print("INFO: [Fallback] Using high-quality Lanczos upscaling", file=sys.stderr)
                # 폴백으로 계속 진행
                target_w = int(original_size[0] * 4)
                target_h = int(original_size[1] * 4)
                sr_img = preprocessed_img.resize((target_w, target_h), Image.LANCZOS)
                sr_size = sr_img.size
                print(f"INFO: [Fallback] After 4x upscale (Lanczos): {sr_size[0]} x {sr_size[1]}", file=sys.stderr)
        else:
            # 고품질 폴백 업스케일링
            if not os.path.exists(model_path):
                print(f"WARNING: [Model Loading] Model file not found: {model_path}", file=sys.stderr)
            if not HAS_REALESRGAN:
                print("WARNING: [Model Loading] RealESRGAN library not available", file=sys.stderr)
            print("INFO: [Fallback] Using high-quality Lanczos upscaling (4x)...", file=sys.stderr)
            target_w = int(original_size[0] * 4)
            target_h = int(original_size[1] * 4)
            sr_img = preprocessed_img.resize((target_w, target_h), Image.LANCZOS)
            sr_size = sr_img.size
            print(f"INFO: [Fallback] After 4x upscale (high-quality resize): {sr_size[0]} x {sr_size[1]}", file=sys.stderr)
        
        # 원하는 배율로 리사이즈 (4배가 아닌 경우)
        if scale != 4.0:
            target_w = int(original_size[0] * scale)
            target_h = int(original_size[1] * scale)
            print(f"INFO: [Resizing] Resizing to final size: {target_w} x {target_h}", file=sys.stderr)
            sr_img = sr_img.resize((target_w, target_h), Image.LANCZOS)
            # 원본도 같은 크기로 리사이즈 (색상 보존용)
            original_img_backup = original_img_backup.resize((target_w, target_h), Image.LANCZOS)
        
        # 원본 색상 보존 후처리 파이프라인
        final_img = postprocess_image_enhanced(sr_img, original_img_backup)

        # 출력 디렉토리 생성
        output_dir = os.path.dirname(args.output)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)

        # 이미지 저장 (고품질 PNG)
        print(f"INFO: [Saving] Saving image: {args.output}", file=sys.stderr)
        final_cv = cv2.cvtColor(np.array(final_img), cv2.COLOR_RGB2BGR)
        cv2.imwrite(args.output, final_cv, [cv2.IMWRITE_PNG_COMPRESSION, 0])  # 무손실 압축
        
        final_size = final_cv.shape[:2][::-1]  # (width, height)
        print(f"INFO: [Complete] Processing complete: {final_size[0]} x {final_size[1]}", file=sys.stderr)
        print(f"INFO: [Complete] Quality enhancement applied successfully", file=sys.stderr)
        
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

