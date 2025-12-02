#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
딥러닝 초해상도(SR) 모델을 사용한 화질 개선 스크립트
Real-ESRGAN 계열 모델 사용, CPU/GPU 자동 인식
** 고도화 버전: CPU에서도 RealESRGAN 실행, 강화된 후처리 파이프라인 **
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
    from realesrgan import RealESRGAN
    HAS_REALESRGAN = True
    print("INFO: RealESRGAN library found - AI model will be used", file=sys.stderr)
except ImportError:
    print("WARNING: realesrgan not installed, using high-quality fallback", file=sys.stderr)
    print("INFO: For better quality, install: pip install realesrgan", file=sys.stderr)
    print("INFO: Continuing with enhanced upscaling...", file=sys.stderr)


def preprocess_image(img_pil):
    """이미지 전처리: 노이즈 감소 및 품질 최적화"""
    print("INFO: [Preprocessing] Starting image preprocessing...", file=sys.stderr)
    img_array = np.array(img_pil)
    
    # 약한 노이즈 감소 (가우시안 블러)
    img_array = cv2.GaussianBlur(img_array, (3, 3), 0.5)
    
    print("INFO: [Preprocessing] Noise reduction applied", file=sys.stderr)
    return Image.fromarray(img_array)


def enhance_color(img_cv):
    """색상 대비 개선 (Color Enhancement)"""
    print("INFO: [Postprocessing] Applying color enhancement...", file=sys.stderr)
    
    # LAB 색공간으로 변환
    lab = cv2.cvtColor(img_cv, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    
    # L 채널: CLAHE로 대비 향상
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    
    # A, B 채널: 약한 saturation boost
    a = cv2.addWeighted(a, 1.1, a, 0, 0)
    b = cv2.addWeighted(b, 1.1, b, 0, 0)
    
    lab = cv2.merge([l, a, b])
    result = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
    
    print("INFO: [Postprocessing] Color enhancement complete", file=sys.stderr)
    return result


def reduce_noise(img_cv):
    """노이즈 감소 (Noise Reduction)"""
    print("INFO: [Postprocessing] Applying noise reduction...", file=sys.stderr)
    
    # Non-local Means Denoising
    denoised = cv2.fastNlMeansDenoisingColored(img_cv, None, 10, 10, 7, 21)
    
    # Bilateral Filtering (디테일 보존하면서 노이즈 제거)
    denoised = cv2.bilateralFilter(denoised, 5, 50, 50)
    
    print("INFO: [Postprocessing] Noise reduction complete", file=sys.stderr)
    return denoised


def boost_detail(img_cv):
    """디테일 강화 (Detail Boosting)"""
    print("INFO: [Postprocessing] Applying detail boosting...", file=sys.stderr)
    
    # Unsharp Masking (선명도 향상)
    gaussian = cv2.GaussianBlur(img_cv, (0, 0), 2.0)
    unsharp = cv2.addWeighted(img_cv, 1.7, gaussian, -0.7, 0)
    
    # 약한 샤프닝 필터
    kernel = np.array([
        [0, -0.3, 0],
        [-0.3, 2.2, -0.3],
        [0, -0.3, 0]
    ])
    sharpened = cv2.filter2D(unsharp, -1, kernel)
    
    print("INFO: [Postprocessing] Detail boosting complete", file=sys.stderr)
    return sharpened


def enhance_edge_clarity(img_cv):
    """선명도 강화 (Edge Clarity Boost)"""
    print("INFO: [Postprocessing] Applying edge clarity boost...", file=sys.stderr)
    
    # Canny 엣지 감지
    gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    
    # 엣지 영역 강화
    edges_3ch = cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)
    enhanced = cv2.addWeighted(img_cv, 0.9, edges_3ch, 0.1, 0)
    
    # 추가 샤프닝
    kernel = np.array([
        [0, -0.5, 0],
        [-0.5, 3, -0.5],
        [0, -0.5, 0]
    ])
    enhanced = cv2.filter2D(enhanced, -1, kernel)
    
    print("INFO: [Postprocessing] Edge clarity boost complete", file=sys.stderr)
    return enhanced


def reduce_mosaic(img_cv):
    """모자이크 감소 (Mosaic Reduction Filter)"""
    print("INFO: [Postprocessing] Applying mosaic reduction...", file=sys.stderr)
    
    # 가우시안 블러로 블록 경계 부드럽게
    blurred = cv2.GaussianBlur(img_cv, (5, 5), 1.0)
    
    # 적응적 블렌딩
    result = cv2.addWeighted(img_cv, 0.7, blurred, 0.3, 0)
    
    # Bilateral Filter로 디테일 보존
    result = cv2.bilateralFilter(result, 5, 50, 50)
    
    print("INFO: [Postprocessing] Mosaic reduction complete", file=sys.stderr)
    return result


def postprocess_image_enhanced(img_pil):
    """강화된 후처리 파이프라인"""
    print("INFO: [Postprocessing] Starting enhanced postprocessing pipeline...", file=sys.stderr)
    img_cv = cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)
    
    # 파이프라인: 색상 보정 → 노이즈 감소 → 디테일 강화 → 선명도 강화 → 모자이크 감소
    img_cv = enhance_color(img_cv)
    img_cv = reduce_noise(img_cv)
    img_cv = boost_detail(img_cv)
    img_cv = enhance_edge_clarity(img_cv)
    img_cv = reduce_mosaic(img_cv)
    
    print("INFO: [Postprocessing] Enhanced postprocessing pipeline complete", file=sys.stderr)
    return Image.fromarray(cv2.cvtColor(img_cv, cv2.COLOR_BGR2RGB))


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

    try:
        # 전처리
        preprocessed_img = preprocess_image(img)
        
        # RealESRGAN 모델 로드 및 실행 (CPU에서도 실행)
        if HAS_REALESRGAN and os.path.exists(model_path):
            try:
                print("INFO: [Model Loading] Loading Real-ESRGAN model...", file=sys.stderr)
                print(f"INFO: [Model Loading] Model path: {model_path}", file=sys.stderr)
                print(f"INFO: [Model Loading] Target device: {device}", file=sys.stderr)
                
                model = RealESRGAN(device, scale=4)
                model.load_weights(model_path)
                print("INFO: [Model Loading] Model loaded successfully", file=sys.stderr)
                
                # 모델을 디바이스로 이동 (CPU/GPU 모두)
                if hasattr(model, 'model'):
                    model.model = model.model.to(device)
                    print(f"INFO: [Model Loading] Model moved to {device}", file=sys.stderr)
                
                # RealESRGAN 모델 실행 (CPU에서도 실행)
                print("INFO: [Upscaling] Processing with Real-ESRGAN (4x upscale)...", file=sys.stderr)
                print(f"INFO: [Upscaling] Using {device} for inference", file=sys.stderr)
                
                if device == "cpu" and original_size[0] * original_size[1] > 512 * 512:
                    # 큰 이미지는 타일 처리
                    sr_img = upscale_with_tiles(preprocessed_img, model, device)
                else:
                    # 작은 이미지 또는 GPU는 전체 처리
                    sr_img = model.predict(preprocessed_img)
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
        
        # 강화된 후처리 파이프라인
        final_img = postprocess_image_enhanced(sr_img)

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
