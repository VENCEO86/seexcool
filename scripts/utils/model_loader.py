#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
모델 로더 유틸리티
다양한 AI 모델을 로드하고 관리하는 공통 유틸리티
"""

import os
import sys
from pathlib import Path

# UTF-8 인코딩 강제 설정
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

try:
    import torch
    from realesrgan import RealESRGAN
except ImportError as e:
    print(f"ERROR: Required library not installed: {e}", file=sys.stderr)
    sys.exit(1)


def get_weights_dir():
    """weights 디렉토리 경로 반환"""
    return Path(__file__).parent.parent.parent / "weights"


def get_model_path(model_name: str, weights_dir: Path = None):
    """모델 파일 경로 반환"""
    if weights_dir is None:
        weights_dir = get_weights_dir()
    
    model_path = weights_dir / f"{model_name}.pth"
    return model_path


def check_model_exists(model_name: str, weights_dir: Path = None):
    """모델 파일 존재 여부 확인"""
    model_path = get_model_path(model_name, weights_dir)
    return model_path.exists(), model_path


def load_esrgan_model(device: str = "auto", scale: int = 4, model_name: str = "RealESRGAN_x4plus"):
    """Real-ESRGAN 모델 로드"""
    # Device 자동 선택
    if device == "auto":
        device = "cuda" if torch.cuda.is_available() else "cpu"
    
    # 모델 파일 경로 확인
    model_path = get_model_path(model_name)
    
    if not model_path.exists():
        raise FileNotFoundError(
            f"Model file not found: {model_path}\n"
            f"Please download: python scripts/download_models.py"
        )
    
    # 모델 로드
    model = RealESRGAN(device, scale=scale)
    model.load_weights(str(model_path))
    
    return model, device


def get_device_info():
    """디바이스 정보 반환"""
    try:
        if torch.cuda.is_available():
            return {
                "device": "cuda",
                "available": True,
                "device_name": torch.cuda.get_device_name(0),
                "device_count": torch.cuda.device_count(),
            }
        else:
            return {
                "device": "cpu",
                "available": False,
                "device_name": None,
                "device_count": 0,
            }
    except Exception as e:
        return {
            "device": "cpu",
            "available": False,
            "error": str(e),
        }


if __name__ == "__main__":
    # 테스트
    print("Model Loader Utility Test")
    print("=" * 40)
    
    weights_dir = get_weights_dir()
    print(f"Weights directory: {weights_dir}")
    
    model_name = "RealESRGAN_x4plus"
    exists, path = check_model_exists(model_name)
    print(f"Model {model_name}: {'Found' if exists else 'Not Found'}")
    if exists:
        print(f"  Path: {path}")
    
    device_info = get_device_info()
    print(f"\nDevice Info:")
    print(f"  Device: {device_info['device']}")
    if device_info.get("device_name"):
        print(f"  Name: {device_info['device_name']}")


