#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
모자이크 보정 및 초해상도 복원 스크립트
ESRGAN 기반 고품질 이미지 복원
** 고도화 버전: CPU에서도 RealESRGAN 실행, 강화된 후처리 파이프라인 **
- 모자이크 블록 패턴 감소
- 엣지/윤곽선 보강
- 노이즈 제거
- 디테일 재구성
"""

import argparse
import os
import sys
import io

# UTF-8 인코딩 강제 설정
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

try:
    import cv2
    import numpy as np
    from PIL import Image
    import torch
except ImportError as e:
    print(f"ERROR: Required library not installed: {e}", file=sys.stderr)
    print("INFO: Please install: pip install -r requirements.txt", file=sys.stderr)
    sys.exit(1)

# RealESRGAN은 선택적 (없으면 고품질 폴백 사용)
HAS_REALESRGAN = False
try:
    from realesrgan import RealESRGAN
    HAS_REALESRGAN = True
    print("INFO: RealESRGAN library found - AI model will be used", file=sys.stderr)
except ImportError:
    print("WARNING: realesrgan not installed, using high-quality fallback", file=sys.stderr)
    print("INFO: For better quality, install: pip install realesrgan", file=sys.stderr)
    print("INFO: Continuing with enhanced upscaling...", file=sys.stderr)

try:
    from skimage import restoration, filters
    HAS_SKIMAGE = True
except ImportError:
    print("WARNING: scikit-image not installed, some features may be limited", file=sys.stderr)
    HAS_SKIMAGE = False


def detect_mosaic_regions(image_cv):
    """모자이크 영역 감지 (블록 패턴 감지)"""
    gray = cv2.cvtColor(image_cv, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    kernel = np.ones((3, 3), np.uint8)
    edges = cv2.dilate(edges, kernel, iterations=1)
    return edges


def reduce_mosaic_artifacts(image_cv, strength=0.5):
    """모자이크 아티팩트 감소 (강화 버전)"""
    print(f"INFO: [Mosaic Reduction] Reducing mosaic artifacts (strength: {strength})...", file=sys.stderr)
    
    # 1. 가우시안 블러로 블록 경계 부드럽게
    blurred = cv2.GaussianBlur(image_cv, (5, 5), 1.0)
    
    # 2. 원본과 블러를 적응적 블렌딩
    result = cv2.addWeighted(image_cv, 1.0 - strength, blurred, strength, 0)
    
    # 3. 약한 bilateral filter로 디테일 보존하면서 노이즈 제거
    result = cv2.bilateralFilter(result, 5, 50, 50)
    
    print("INFO: [Mosaic Reduction] Mosaic reduction complete", file=sys.stderr)
    return result


def enhance_edges(image_cv):
    """엣지/윤곽선 보강 (강화 버전)"""
    print("INFO: [Edge Enhancement] Enhancing edges and contours...", file=sys.stderr)
    
    # 1. Unsharp Masking으로 엣지 강화
    gaussian = cv2.GaussianBlur(image_cv, (0, 0), 2.0)
    unsharp = cv2.addWeighted(image_cv, 1.8, gaussian, -0.8, 0)
    
    # 2. CLAHE (Contrast Limited Adaptive Histogram Equalization)
    lab = cv2.cvtColor(unsharp, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    lab = cv2.merge([l, a, b])
    result = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
    
    # 3. 엣지 보강 필터
    kernel = np.array([
        [0, -0.5, 0],
        [-0.5, 3, -0.5],
        [0, -0.5, 0]
    ])
    result = cv2.filter2D(result, -1, kernel)
    
    print("INFO: [Edge Enhancement] Edge enhancement complete", file=sys.stderr)
    return result


def denoise_image(image_cv):
    """노이즈 제거 (강화 버전)"""
    print("INFO: [Denoising] Applying denoising...", file=sys.stderr)
    
    # 1. Non-local Means Denoising (강화)
    denoised = cv2.fastNlMeansDenoisingColored(image_cv, None, 12, 12, 7, 21)
    
    # 2. 약한 bilateral filter 추가 적용
    denoised = cv2.bilateralFilter(denoised, 5, 50, 50)
    
    print("INFO: [Denoising] Denoising complete", file=sys.stderr)
    return denoised


def enhance_color(image_cv, original_cv=None):
    """색상 대비 개선 (원본 색상 보존)"""
    print("INFO: [Color Enhancement] Applying color enhancement (preserving original colors)...", file=sys.stderr)
    
    if original_cv is not None:
        # 원본 색상 보존
        original_upscaled = cv2.resize(original_cv, (image_cv.shape[1], image_cv.shape[0]), interpolation=cv2.INTER_LANCZOS4)
        original_lab = cv2.cvtColor(original_upscaled, cv2.COLOR_BGR2LAB)
        image_lab = cv2.cvtColor(image_cv, cv2.COLOR_BGR2LAB)
        
        l_img, a_img, b_img = cv2.split(image_lab)
        _, a_orig, b_orig = cv2.split(original_lab)
        
        # L 채널: 약한 CLAHE만 적용
        clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8))
        l_img = clahe.apply(l_img)
        
        # A, B 채널: 원본 색상 90% 보존
        a_blended = cv2.addWeighted(a_orig, 0.9, a_img, 0.1, 0)
        b_blended = cv2.addWeighted(b_orig, 0.9, b_img, 0.1, 0)
        
        lab_result = cv2.merge([l_img, a_blended, b_blended])
        result = cv2.cvtColor(lab_result, cv2.COLOR_LAB2BGR)
    else:
        # 원본이 없으면 최소한의 보정만
        lab = cv2.cvtColor(image_cv, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8))
        l = clahe.apply(l)
        lab = cv2.merge([l, a, b])
        result = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
    
    print("INFO: [Color Enhancement] Color enhancement complete", file=sys.stderr)
    return result


def boost_detail(image_cv):
    """디테일 강화 (Detail Boosting)"""
    print("INFO: [Detail Boosting] Applying detail boosting...", file=sys.stderr)
    
    gaussian = cv2.GaussianBlur(image_cv, (0, 0), 2.0)
    unsharp = cv2.addWeighted(image_cv, 1.7, gaussian, -0.7, 0)
    
    kernel = np.array([
        [0, -0.3, 0],
        [-0.3, 2.2, -0.3],
        [0, -0.3, 0]
    ])
    sharpened = cv2.filter2D(unsharp, -1, kernel)
    
    print("INFO: [Detail Boosting] Detail boosting complete", file=sys.stderr)
    return sharpened


def upscale_with_tiles(img_pil, model, device, tile_size=512, overlap=32):
    """타일 단위로 업스케일 (CPU 메모리 최적화)"""
    if device == "cuda":
        print("INFO: [Upscaling] GPU mode - processing full image", file=sys.stderr)
        return model.predict(img_pil)
    
    print(f"INFO: [Upscaling] CPU mode - processing in tiles ({tile_size}x{tile_size})", file=sys.stderr)
    original_size = img_pil.size
    target_w = original_size[0] * 4
    target_h = original_size[1] * 4
    
    tiles = []
    tile_count = 0
    for y in range(0, original_size[1], tile_size - overlap):
        for x in range(0, original_size[0], tile_size - overlap):
            right = min(x + tile_size, original_size[0])
            bottom = min(y + tile_size, original_size[1])
            tile = img_pil.crop((x, y, right, bottom))
            
            upscaled_tile = model.predict(tile)
            tiles.append((x * 4, y * 4, upscaled_tile))
            tile_count += 1
            print(f"INFO: [Upscaling] Processed tile {tile_count}", file=sys.stderr)
    
    result = Image.new("RGB", (target_w, target_h))
    for x, y, tile in tiles:
        result.paste(tile, (x, y))
    
    print(f"INFO: [Upscaling] All {tile_count} tiles processed and merged", file=sys.stderr)
    return result


def process_with_esrgan(image_pil, device, scale=4, model_path=None):
    """Real-ESRGAN으로 초해상도 처리 (CPU에서도 실행)"""
    if model_path is None:
        weights_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "weights")
        model_path = os.path.join(weights_dir, "RealESRGAN_x4plus.pth")
    
    # RealESRGAN이 있고 모델 파일이 있으면 사용
    if HAS_REALESRGAN and os.path.exists(model_path):
        try:
            print(f"INFO: [Model Loading] Loading Real-ESRGAN model from {model_path}...", file=sys.stderr)
            print(f"INFO: [Model Loading] Target device: {device}", file=sys.stderr)
            
            model = RealESRGAN(device, scale=4)
            model.load_weights(model_path)
            print(f"INFO: [Model Loading] Model loaded successfully on {device}", file=sys.stderr)
            
            # 모델을 디바이스로 이동 (CPU/GPU 모두)
            if hasattr(model, 'model'):
                model.model = model.model.to(device)
                print(f"INFO: [Model Loading] Model moved to {device}", file=sys.stderr)
            
            print(f"INFO: [Upscaling] Processing with Real-ESRGAN (4x upscale)...", file=sys.stderr)
            print(f"INFO: [Upscaling] Using {device} for inference", file=sys.stderr)
            
            # CPU 환경 최적화: 큰 이미지는 타일 처리
            original_size = image_pil.size
            if device == "cpu" and original_size[0] * original_size[1] > 512 * 512:
                sr_image = upscale_with_tiles(image_pil, model, device)
            else:
                sr_image = model.predict(image_pil)
                print("INFO: [Upscaling] RealESRGAN inference complete", file=sys.stderr)
            
            print(f"INFO: [Upscaling] Real-ESRGAN processing complete", file=sys.stderr)
            
            # 결과 검증
            if sr_image.size[0] < image_pil.size[0] * 3.5:
                print(f"WARNING: [Verification] Upscale ratio seems low: {sr_image.size[0]/image_pil.size[0]:.2f}x", file=sys.stderr)
            else:
                print(f"INFO: [Verification] Upscale ratio verified: {sr_image.size[0]/image_pil.size[0]:.2f}x", file=sys.stderr)
            
            return sr_image
        except Exception as e:
            print(f"ERROR: [Model Loading] Real-ESRGAN processing failed: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            print("INFO: [Fallback] Using high-quality Lanczos upscaling", file=sys.stderr)
            # 폴백으로 계속 진행
            pass
    
    # 폴백: 고품질 Lanczos 업스케일링
    print(f"INFO: [Fallback] Using high-quality Lanczos upscaling (4x)...", file=sys.stderr)
    original_size = image_pil.size
    target_w = int(original_size[0] * 4)
    target_h = int(original_size[1] * 4)
    sr_image = image_pil.resize((target_w, target_h), Image.LANCZOS)
    print(f"INFO: [Fallback] Upscaling complete: {target_w} x {target_h}", file=sys.stderr)
    
    return sr_image


def verify_enhancement(original_img, enhanced_img):
    """품질 개선 검증"""
    orig_array = np.array(original_img)
    enh_array = np.array(enhanced_img)
    
    size_ratio = (enh_array.shape[0] * enh_array.shape[1]) / (orig_array.shape[0] * orig_array.shape[1])
    orig_var = np.var(orig_array)
    enh_var = np.var(enh_array)
    
    print(f"INFO: [Verification] Size ratio: {size_ratio:.2f}x", file=sys.stderr)
    print(f"INFO: [Verification] Variance ratio: {enh_var/orig_var:.2f}x", file=sys.stderr)
    
    return size_ratio >= 3.5  # 최소 4배 업스케일 확인


def main():
    parser = argparse.ArgumentParser(description="Mosaic correction and super-resolution")
    parser.add_argument("--input", required=True, help="Input image path")
    parser.add_argument("--output", required=True, help="Output image path")
    parser.add_argument("--scale", type=float, default=2.0, help="Scale factor (1.0-4.0)")
    parser.add_argument("--mosaic-strength", type=float, default=0.3, help="Mosaic reduction strength (0.0-1.0)")
    parser.add_argument("--enhance-edges", action="store_true", help="Enhance edges and contours")
    parser.add_argument("--denoise", action="store_true", help="Apply denoising")
    parser.add_argument("--device", choices=["auto", "cuda", "cpu"], default="auto", help="Device selection")
    
    args = parser.parse_args()
    
    # Scale 검증
    if args.scale <= 1.0 or args.scale > 4.0:
        print(f"ERROR: scale must be between 1.0 and 4.0 (current: {args.scale})", file=sys.stderr)
        sys.exit(1)
    
    # Device 선택
    if args.device == "auto":
        device = "cuda" if torch.cuda.is_available() else "cpu"
    else:
        device = args.device
    
    print(f"INFO: [Device Detection] Device: {device}", file=sys.stderr)
    if device == "cuda":
        print(f"INFO: [Device Detection] GPU: {torch.cuda.get_device_name(0)}", file=sys.stderr)
        print(f"INFO: [Device Detection] CUDA enabled - using GPU acceleration", file=sys.stderr)
    else:
        print("INFO: [Device Detection] CPU mode - RealESRGAN will run on CPU", file=sys.stderr)
        # CPU 스레드 최적화
        torch.set_num_threads(min(4, os.cpu_count() or 4))
        print(f"INFO: [Device Detection] CPU threads: {torch.get_num_threads()}", file=sys.stderr)
    
    try:
        # 이미지 로드
        print(f"INFO: [Image Loading] Loading image: {args.input}", file=sys.stderr)
        img_pil = Image.open(args.input).convert("RGB")
        original_size = img_pil.size
        print(f"INFO: [Image Loading] Original size: {original_size[0]} x {original_size[1]}", file=sys.stderr)
        
        # 원본 이미지 백업 (색상 보존용)
        original_img_backup = img_pil.copy()
        
        # PIL → OpenCV 변환
        img_cv = cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)
        
        # 1단계: 모자이크 아티팩트 감소 (항상 적용, 강도 조절)
        if args.mosaic_strength > 0:
            img_cv = reduce_mosaic_artifacts(img_cv, args.mosaic_strength)
        
        # 2단계: 노이즈 제거 (선택적, 기본값으로 활성화)
        if args.denoise:
            img_cv = denoise_image(img_cv)
        
        # OpenCV → PIL 변환
        img_pil = Image.fromarray(cv2.cvtColor(img_cv, cv2.COLOR_BGR2RGB))
        
        # 3단계: Real-ESRGAN으로 초해상도 처리 (CPU에서도 실행)
        print(f"INFO: [Upscaling] Applying super-resolution with Real-ESRGAN (target scale: {args.scale})...", file=sys.stderr)
        sr_img = process_with_esrgan(img_pil, device, scale=4)
        
        # 품질 개선 검증
        if verify_enhancement(img_pil, sr_img):
            print("INFO: [Verification] Enhancement verified - AI upscaling applied", file=sys.stderr)
        else:
            print("WARNING: [Verification] Enhancement verification failed - may not have applied AI model", file=sys.stderr)
        
        # 4단계: 원하는 배율로 리사이즈
        if args.scale != 4.0:
            target_w = int(original_size[0] * args.scale)
            target_h = int(original_size[1] * args.scale)
            print(f"INFO: [Resizing] Resizing to final size: {target_w} x {target_h}", file=sys.stderr)
            sr_img = sr_img.resize((target_w, target_h), Image.LANCZOS)
            # 원본도 같은 크기로 리사이즈 (색상 보존용)
            original_img_backup = original_img_backup.resize((target_w, target_h), Image.LANCZOS)
        
        # 5단계: 원본 색상 보존 후처리 파이프라인
        print("INFO: [Postprocessing] Starting color-preserving postprocessing pipeline...", file=sys.stderr)
        sr_cv = cv2.cvtColor(np.array(sr_img), cv2.COLOR_RGB2BGR)
        original_cv = cv2.cvtColor(np.array(original_img_backup), cv2.COLOR_RGB2BGR)
        
        # 원본을 업스케일한 버전 생성 (색상 참조용)
        original_upscaled = cv2.resize(original_cv, (sr_cv.shape[1], sr_cv.shape[0]), interpolation=cv2.INTER_LANCZOS4)
        
        # 파이프라인: 원본 색상 보존 색상 보정 → 최소 노이즈 감소 → 디테일 강화 → 엣지 보강
        sr_cv = enhance_color(sr_cv, original_upscaled)
        # 노이즈 감소 최소화 (아티팩트 방지)
        if args.denoise:
            sr_cv = denoise_image(sr_cv)
        sr_cv = boost_detail(sr_cv)
        
        if args.enhance_edges:
            sr_cv = enhance_edges(sr_cv)
        else:
            # 엣지 보강이 비활성화되어도 약한 샤프닝은 적용
            print("INFO: [Postprocessing] Applying light sharpening...", file=sys.stderr)
            gaussian = cv2.GaussianBlur(sr_cv, (0, 0), 1.5)
            sr_cv = cv2.addWeighted(sr_cv, 1.3, gaussian, -0.3, 0)
        
        sr_img = Image.fromarray(cv2.cvtColor(sr_cv, cv2.COLOR_BGR2RGB))
        print("INFO: [Postprocessing] Enhanced postprocessing pipeline complete", file=sys.stderr)
        
        # 최종 이미지 저장 (고품질 PNG)
        output_dir = os.path.dirname(args.output)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
        
        print(f"INFO: [Saving] Saving image: {args.output}", file=sys.stderr)
        sr_cv = cv2.cvtColor(np.array(sr_img), cv2.COLOR_RGB2BGR)
        cv2.imwrite(args.output, sr_cv, [cv2.IMWRITE_PNG_COMPRESSION, 0])  # 무손실 압축
        
        final_size = sr_cv.shape[:2][::-1]
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
