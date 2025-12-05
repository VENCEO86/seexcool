#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
모델 파일 자동 다운로드 스크립트
필요한 모델 파일을 자동으로 다운로드하고 검증
"""

import sys
import os
import urllib.request
import urllib.error
from pathlib import Path
import hashlib

# UTF-8 인코딩 강제 설정
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# 모델 정보 (이름, URL, 파일 크기)
MODELS = {
    "RealESRGAN_x4plus": {
        "url": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth",
        "size_mb": 67,
        "description": "Real-ESRGAN x4plus model for general image super-resolution"
    }
}

def download_file(url: str, dest_path: Path, description: str = ""):
    """파일 다운로드 (진행률 표시)"""
    try:
        print(f"Downloading {description or dest_path.name}...")
        print(f"URL: {url}")
        print(f"Destination: {dest_path}")
        
        def progress_hook(count, block_size, total_size):
            if total_size > 0:
                percent = min(100, int(count * block_size * 100 / total_size))
                size_mb = total_size / (1024 * 1024)
                downloaded_mb = count * block_size / (1024 * 1024)
                print(f"\rProgress: {percent}% ({downloaded_mb:.1f}/{size_mb:.1f} MB)", end="", flush=True)
        
        # 디렉토리 생성
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 다운로드
        urllib.request.urlretrieve(url, dest_path, reporthook=progress_hook)
        print("\n✓ Download complete!")
        return True
    except urllib.error.URLError as e:
        print(f"\n✗ Download failed: {e}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"\n✗ Error: {e}", file=sys.stderr)
        return False

def verify_file(file_path: Path, expected_size_mb: int = None):
    """파일 검증 (크기 확인)"""
    if not file_path.exists():
        return False, "File does not exist"
    
    actual_size_mb = file_path.stat().st_size / (1024 * 1024)
    
    if expected_size_mb:
        # 10% 오차 허용
        if abs(actual_size_mb - expected_size_mb) > expected_size_mb * 0.1:
            return False, f"File size mismatch: {actual_size_mb:.1f} MB (expected ~{expected_size_mb} MB)"
    
    return True, f"File verified: {actual_size_mb:.1f} MB"

def download_model(model_name: str, weights_dir: str = "weights", force: bool = False):
    """모델 다운로드"""
    if model_name not in MODELS:
        print(f"ERROR: Unknown model: {model_name}", file=sys.stderr)
        return False
    
    model_info = MODELS[model_name]
    model_path = Path(weights_dir) / f"{model_name}.pth"
    
    # 이미 존재하는 경우
    if model_path.exists() and not force:
        is_valid, message = verify_file(model_path, model_info.get("size_mb"))
        if is_valid:
            print(f"✓ Model {model_name} already exists: {model_path}")
            print(f"  {message}")
            return True
        else:
            print(f"⚠ Existing file is invalid: {message}")
            print("  Re-downloading...")
    
    # 다운로드
    success = download_file(
        model_info["url"],
        model_path,
        f"{model_name} ({model_info['description']})"
    )
    
    if success:
        # 검증
        is_valid, message = verify_file(model_path, model_info.get("size_mb"))
        if is_valid:
            print(f"✓ {message}")
            return True
        else:
            print(f"⚠ Warning: {message}", file=sys.stderr)
            return True  # 다운로드는 성공했으므로 True 반환
    
    return False

def download_all_models(weights_dir: str = "weights", force: bool = False):
    """모든 모델 다운로드"""
    print("=" * 60)
    print("MODEL DOWNLOADER")
    print("=" * 60)
    
    weights_path = Path(weights_dir)
    weights_path.mkdir(parents=True, exist_ok=True)
    
    results = {}
    for model_name in MODELS.keys():
        print(f"\n[{model_name}]")
        results[model_name] = download_model(model_name, weights_dir, force)
    
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    all_success = True
    for model_name, success in results.items():
        status = "✓" if success else "✗"
        print(f"{status} {model_name}: {'OK' if success else 'FAILED'}")
        if not success:
            all_success = False
    
    return all_success

def main():
    """메인 함수"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Download AI model files")
    parser.add_argument("--model", help="Specific model to download (default: all)")
    parser.add_argument("--weights-dir", default="weights", help="Weights directory (default: weights)")
    parser.add_argument("--force", action="store_true", help="Force re-download even if file exists")
    
    args = parser.parse_args()
    
    try:
        if args.model:
            success = download_model(args.model, args.weights_dir, args.force)
            sys.exit(0 if success else 1)
        else:
            success = download_all_models(args.weights_dir, args.force)
            sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nDownload cancelled by user", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()






