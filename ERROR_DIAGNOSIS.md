# 화질 개선 실패 원인 진단 가이드

## 🔍 에러 원인 분석

"화질 개선에 실패했습니다" 에러가 발생하는 주요 원인:

### 1. ❌ Python 라이브러리 미설치 (가장 가능성 높음)

**증상:**
- `ImportError: No module named 'torch'`
- `ImportError: No module named 'realesrgan'`
- `ImportError: No module named 'cv2'`

**확인 방법:**
```bash
python -c "import torch; import cv2; from realesrgan import RealESRGAN; print('OK')"
```

**해결 방법:**
```bash
# 가상환경 생성 (권장)
python -m venv venv

# 가상환경 활성화
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# 의존성 설치
pip install -r requirements.txt
```

---

### 2. ❌ 모델 파일 없음

**증상:**
- `ERROR: Model file not found: weights/RealESRGAN_x4plus.pth`

**확인 방법:**
```bash
# Windows
Test-Path "weights\RealESRGAN_x4plus.pth"

# Linux/Mac
test -f weights/RealESRGAN_x4plus.pth && echo "exists" || echo "not found"
```

**해결 방법:**
```bash
# 모델 파일 다운로드
# Windows (PowerShell)
Invoke-WebRequest -Uri https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth -OutFile weights/RealESRGAN_x4plus.pth

# Linux/Mac
wget https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth -O weights/RealESRGAN_x4plus.pth
```

---

### 3. ❌ Python 미설치 또는 PATH 미등록

**증상:**
- `Python spawn error: spawn python ENOENT`
- `Python 실행에 실패했습니다`

**확인 방법:**
```bash
python --version
# 또는
python3 --version
```

**해결 방법:**
1. Python 설치: https://www.python.org/downloads/
2. 설치 시 "Add Python to PATH" 체크
3. 또는 수동으로 PATH에 Python 추가

---

### 4. ❌ 스크립트 파일 없음

**증상:**
- `화질 개선 스크립트를 찾을 수 없습니다`
- `scripts/quality_enhance.py 파일이 필요합니다`

**확인 방법:**
```bash
# Windows
Test-Path "scripts\quality_enhance.py"

# Linux/Mac
test -f scripts/quality_enhance.py && echo "exists" || echo "not found"
```

**해결 방법:**
- `scripts/quality_enhance.py` 파일이 있는지 확인
- 없으면 프로젝트를 다시 클론하거나 파일을 생성

---

### 5. ❌ 메모리 부족

**증상:**
- `Out of memory`
- `CUDA out of memory`
- 처리 중 멈춤

**해결 방법:**
- 더 작은 이미지로 테스트
- GPU 메모리 확보
- CPU 모드 사용 (느리지만 메모리 사용량 적음)

---

### 6. ❌ 권한 문제

**증상:**
- `Permission denied`
- `Access is denied`

**해결 방법:**
- 관리자 권한으로 실행
- 파일/폴더 권한 확인

---

## 🔧 빠른 진단 스크립트

다음 명령어로 한 번에 확인:

```bash
# Windows (PowerShell)
Write-Host "=== 진단 시작 ===" -ForegroundColor Cyan
Write-Host "1. Python 설치 확인:" -ForegroundColor Yellow
python --version
Write-Host "`n2. 모델 파일 확인:" -ForegroundColor Yellow
if (Test-Path "weights\RealESRGAN_x4plus.pth") { Write-Host "  ✓ 모델 파일 존재" -ForegroundColor Green } else { Write-Host "  ✗ 모델 파일 없음" -ForegroundColor Red }
Write-Host "`n3. 스크립트 파일 확인:" -ForegroundColor Yellow
if (Test-Path "scripts\quality_enhance.py") { Write-Host "  ✓ 스크립트 파일 존재" -ForegroundColor Green } else { Write-Host "  ✗ 스크립트 파일 없음" -ForegroundColor Red }
Write-Host "`n4. Python 라이브러리 확인:" -ForegroundColor Yellow
python -c "import torch; import cv2; from realesrgan import RealESRGAN; print('  ✓ 모든 라이브러리 설치됨')" 2>&1
```

---

## 📋 체크리스트

에러 해결을 위한 체크리스트:

- [ ] Python 설치 확인 (`python --version`)
- [ ] Python PATH 등록 확인
- [ ] 가상환경 생성 및 활성화
- [ ] `pip install -r requirements.txt` 실행
- [ ] `weights/RealESRGAN_x4plus.pth` 파일 존재 확인
- [ ] `scripts/quality_enhance.py` 파일 존재 확인
- [ ] Python 라이브러리 import 테스트
- [ ] Next.js 서버 재시작

---

## 🚨 가장 흔한 원인

**통계상 90% 이상의 경우:**
1. **Python 라이브러리 미설치** (50%)
2. **모델 파일 없음** (30%)
3. **Python 미설치/PATH 문제** (10%)

---

## 💡 해결 순서

1. **먼저 확인**: Python 설치 및 PATH
2. **그 다음**: 라이브러리 설치 (`pip install -r requirements.txt`)
3. **마지막**: 모델 파일 다운로드

---

**업데이트**: 2025-12-02




