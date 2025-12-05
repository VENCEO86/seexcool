#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
자동 환경 설정 스크립트
진단 → 다운로드 → 검증을 자동으로 수행
"""

import sys
import os
import subprocess
from pathlib import Path

# UTF-8 인코딩 강제 설정
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

def run_diagnosis():
    """진단 스크립트 실행"""
    print("=" * 60)
    print("STEP 1: Environment Diagnosis")
    print("=" * 60)
    
    diagnose_script = Path(__file__).parent / "diagnose.py"
    if not diagnose_script.exists():
        print(f"ERROR: diagnose.py not found at {diagnose_script}", file=sys.stderr)
        return False
    
    result = subprocess.run([sys.executable, str(diagnose_script)], capture_output=False)
    return result.returncode == 0

def install_requirements():
    """requirements.txt 설치"""
    print("\n" + "=" * 60)
    print("STEP 2: Installing Requirements")
    print("=" * 60)
    
    requirements_file = Path(__file__).parent.parent / "requirements.txt"
    if not requirements_file.exists():
        print(f"ERROR: requirements.txt not found at {requirements_file}", file=sys.stderr)
        return False
    
    print(f"Installing from {requirements_file}...")
    result = subprocess.run(
        [sys.executable, "-m", "pip", "install", "-r", str(requirements_file)],
        capture_output=False
    )
    
    if result.returncode == 0:
        print("✓ Requirements installed successfully")
        return True
    else:
        print("✗ Failed to install requirements", file=sys.stderr)
        return False

def download_models():
    """모델 파일 다운로드"""
    print("\n" + "=" * 60)
    print("STEP 3: Downloading Models")
    print("=" * 60)
    
    download_script = Path(__file__).parent / "download_models.py"
    if not download_script.exists():
        print(f"ERROR: download_models.py not found at {download_script}", file=sys.stderr)
        return False
    
    result = subprocess.run([sys.executable, str(download_script)], capture_output=False)
    
    if result.returncode == 0:
        print("✓ Models downloaded successfully")
        return True
    else:
        print("✗ Failed to download models", file=sys.stderr)
        return False

def verify_setup():
    """설정 검증"""
    print("\n" + "=" * 60)
    print("STEP 4: Verifying Setup")
    print("=" * 60)
    
    diagnose_script = Path(__file__).parent / "diagnose.py"
    result = subprocess.run(
        [sys.executable, str(diagnose_script), "--json"],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        print("✓ Setup verification passed")
        return True
    else:
        print("✗ Setup verification failed", file=sys.stderr)
        print(result.stderr, file=sys.stderr)
        return False

def main():
    """메인 함수"""
    print("=" * 60)
    print("AUTO SETUP SCRIPT")
    print("=" * 60)
    print("This script will:")
    print("  1. Diagnose your environment")
    print("  2. Install required Python packages")
    print("  3. Download AI model files")
    print("  4. Verify the setup")
    print("=" * 60)
    
    input("\nPress Enter to continue or Ctrl+C to cancel...")
    
    try:
        # 1. 진단
        if not run_diagnosis():
            print("\n⚠ Diagnosis found issues, but continuing...")
        
        # 2. 라이브러리 설치
        if not install_requirements():
            print("\n✗ Failed to install requirements. Please install manually:", file=sys.stderr)
            print("  pip install -r requirements.txt", file=sys.stderr)
            sys.exit(1)
        
        # 3. 모델 다운로드
        if not download_models():
            print("\n⚠ Failed to download models. You can download manually:", file=sys.stderr)
            print("  python scripts/download_models.py", file=sys.stderr)
        
        # 4. 검증
        if verify_setup():
            print("\n" + "=" * 60)
            print("✓ SETUP COMPLETE!")
            print("=" * 60)
            print("You can now use the mosaic super-resolution feature.")
            sys.exit(0)
        else:
            print("\n" + "=" * 60)
            print("⚠ SETUP COMPLETE WITH WARNINGS")
            print("=" * 60)
            print("Some issues were found. Please check the output above.")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n\nSetup cancelled by user", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"\nERROR: Setup failed: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()






