#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
자동 환경 진단 스크립트
Python 환경, 라이브러리, 모델 파일, 경로 등을 자동으로 진단
"""

import sys
import os
import subprocess
import json
from pathlib import Path

# UTF-8 인코딩 강제 설정 (Windows 환경 대응)
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

def check_python_version():
    """Python 버전 확인"""
    version = sys.version_info
    return {
        "status": "ok" if version.major >= 3 and version.minor >= 8 else "error",
        "version": f"{version.major}.{version.minor}.{version.micro}",
        "message": "Python 3.8+ required" if version.major < 3 or version.minor < 8 else "OK"
    }

def check_library(lib_name, import_name=None):
    """라이브러리 설치 여부 확인"""
    if import_name is None:
        import_name = lib_name
    
    try:
        __import__(import_name)
        return {"status": "ok", "installed": True}
    except ImportError as e:
        return {
            "status": "error",
            "installed": False,
            "error": str(e),
            "install_command": f"pip install {lib_name}"
        }

def check_model_file(model_name, weights_dir="weights"):
    """모델 파일 존재 여부 확인"""
    model_path = Path(weights_dir) / f"{model_name}.pth"
    exists = model_path.exists()
    
    return {
        "status": "ok" if exists else "error",
        "exists": exists,
        "path": str(model_path),
        "download_url": f"https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/{model_name}.pth" if not exists else None
    }

def check_gpu():
    """GPU 사용 가능 여부 확인"""
    try:
        import torch
        cuda_available = torch.cuda.is_available()
        if cuda_available:
            device_name = torch.cuda.get_device_name(0)
            device_count = torch.cuda.device_count()
            return {
                "status": "ok",
                "available": True,
                "device_name": device_name,
                "device_count": device_count
            }
        else:
            return {
                "status": "ok",
                "available": False,
                "message": "CPU mode will be used"
            }
    except ImportError:
        return {
            "status": "error",
            "available": False,
            "message": "torch not installed"
        }

def check_script_files():
    """필수 스크립트 파일 존재 여부 확인"""
    scripts = {
        "mosaic_superrecon.py": "Main processing script",
        "download_models.py": "Model download script",
        "quality_enhance.py": "Quality enhancement script"
    }
    
    results = {}
    for script, description in scripts.items():
        script_path = Path("scripts") / script
        exists = script_path.exists()
        results[script] = {
            "status": "ok" if exists else "error",
            "exists": exists,
            "path": str(script_path),
            "description": description
        }
    
    return results

def check_paths():
    """필수 경로 확인"""
    paths = {
        "scripts": Path("scripts"),
        "weights": Path("weights"),
        "temp": Path(os.path.join(os.path.expanduser("~"), "AppData", "Local", "Temp")) if sys.platform == "win32" else Path("/tmp")
    }
    
    results = {}
    for name, path in paths.items():
        exists = path.exists()
        writable = os.access(path.parent if not exists else path, os.W_OK) if path.parent.exists() else False
        
        results[name] = {
            "status": "ok" if exists else "warning",
            "exists": exists,
            "path": str(path),
            "writable": writable,
            "message": "OK" if exists else f"Directory does not exist (will be created)"
        }
    
    return results

def run_diagnosis():
    """전체 진단 실행"""
    diagnosis = {
        "python": check_python_version(),
        "libraries": {},
        "models": {},
        "gpu": check_gpu(),
        "scripts": check_script_files(),
        "paths": check_paths()
    }
    
    # 필수 라이브러리 확인
    required_libs = [
        ("torch", "torch"),
        ("torchvision", "torchvision"),
        ("cv2", "cv2"),
        ("numpy", "numpy"),
        ("PIL", "PIL"),
        ("realesrgan", "realesrgan"),
    ]
    
    for lib_name, import_name in required_libs:
        diagnosis["libraries"][lib_name] = check_library(lib_name, import_name)
    
    # 필수 모델 파일 확인
    required_models = [
        "RealESRGAN_x4plus",
    ]
    
    for model_name in required_models:
        diagnosis["models"][model_name] = check_model_file(model_name)
    
    return diagnosis

def print_diagnosis(diagnosis):
    """진단 결과 출력"""
    print("=" * 60)
    print("ENVIRONMENT DIAGNOSIS REPORT")
    print("=" * 60)
    
    # Python 버전
    py_info = diagnosis["python"]
    status_icon = "✓" if py_info["status"] == "ok" else "✗"
    print(f"\n{status_icon} Python Version: {py_info['version']}")
    if py_info["status"] != "ok":
        print(f"  ⚠ {py_info['message']}")
    
    # 라이브러리
    print("\n📦 Required Libraries:")
    all_libs_ok = True
    for lib_name, lib_info in diagnosis["libraries"].items():
        status_icon = "✓" if lib_info["status"] == "ok" else "✗"
        print(f"  {status_icon} {lib_name}: ", end="")
        if lib_info["installed"]:
            print("Installed")
        else:
            print(f"NOT INSTALLED")
            print(f"    → Run: {lib_info.get('install_command', 'pip install ' + lib_name)}")
            all_libs_ok = False
    
    # 모델 파일
    print("\n🤖 Model Files:")
    all_models_ok = True
    for model_name, model_info in diagnosis["models"].items():
        status_icon = "✓" if model_info["status"] == "ok" else "✗"
        print(f"  {status_icon} {model_name}: ", end="")
        if model_info["exists"]:
            print(f"Found at {model_info['path']}")
        else:
            print(f"NOT FOUND")
            if model_info.get("download_url"):
                print(f"    → Download: {model_info['download_url']}")
            all_models_ok = False
    
    # GPU
    gpu_info = diagnosis["gpu"]
    status_icon = "✓" if gpu_info["status"] == "ok" else "✗"
    print(f"\n🎮 GPU Status: ", end="")
    if gpu_info.get("available"):
        print(f"Available ({gpu_info.get('device_name', 'Unknown')})")
    else:
        print(f"Not Available - CPU mode will be used")
    
    # 스크립트 파일
    print("\n📜 Script Files:")
    all_scripts_ok = True
    for script_name, script_info in diagnosis["scripts"].items():
        status_icon = "✓" if script_info["status"] == "ok" else "✗"
        print(f"  {status_icon} {script_name}: ", end="")
        if script_info["exists"]:
            print("Found")
        else:
            print("NOT FOUND")
            all_scripts_ok = False
    
    # 경로
    print("\n📁 Paths:")
    for path_name, path_info in diagnosis["paths"].items():
        status_icon = "✓" if path_info["status"] == "ok" else "⚠"
        print(f"  {status_icon} {path_name}: {path_info['path']}")
        if not path_info["exists"]:
            print(f"    → Will be created automatically")
    
    # 전체 상태
    print("\n" + "=" * 60)
    overall_status = "READY" if all_libs_ok and all_models_ok and all_scripts_ok else "ISSUES FOUND"
    status_color = "GREEN" if overall_status == "READY" else "YELLOW"
    print(f"Overall Status: {overall_status}")
    print("=" * 60)
    
    return overall_status == "READY"

def main():
    """메인 함수"""
    try:
        diagnosis = run_diagnosis()
        is_ready = print_diagnosis(diagnosis)
        
        # JSON 출력 (API용)
        if "--json" in sys.argv:
            print("\n" + json.dumps(diagnosis, indent=2, ensure_ascii=False))
        
        sys.exit(0 if is_ready else 1)
    except Exception as e:
        print(f"ERROR: Diagnosis failed: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()



