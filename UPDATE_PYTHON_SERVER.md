# Python AI 서버 업데이트 가이드

## 문제
`python-server`가 Git 서브모듈로 등록되어 있어 직접 커밋이 어렵습니다.

## 해결 방법

### 방법 1: Render 대시보드에서 직접 수정 (권장)

1. **Render 대시보드 접속**
   - https://dashboard.render.com
   - `python-ai-server` 서비스 선택

2. **서비스 설정 → Build & Deploy**
   - "Manual Deploy" 클릭
   - 또는 GitHub 연결이 되어 있다면 자동 배포 대기

3. **또는 Render Shell에서 직접 수정**
   - Render 대시보드 → `python-ai-server` → Shell
   - 다음 명령 실행:

```bash
cd /opt/render/project/src/python-server
cat > app.py << 'EOF'
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Python AI Server for Image Enhancement
Flask 서버로 이미지 화질 개선 API 제공
** 업데이트: Real-ESRGAN 모델 지원 + 고급 화질 개선 **
"""

import os
import sys
import io
import tempfile
from flask import Flask, request, jsonify
from flask_cors import CORS
import base64

# UTF-8 인코딩 설정
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

app = Flask(__name__)
CORS(app)

# 스크립트 경로 추가
scripts_dir = os.path.join(os.path.dirname(__file__), '..', 'scripts')
sys.path.insert(0, scripts_dir)

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "ok", "service": "python-ai-server"}), 200

@app.route('/enhance', methods=['POST'])
def enhance():
    """이미지 화질 개선 API - Real-ESRGAN 모델 사용"""
    temp_input = None
    temp_output = None
    try:
        # 요청 파라미터 확인
        if 'image' not in request.files and 'file' not in request.files:
            return jsonify({"error": "이미지 파일이 필요합니다."}), 400
        
        # 파일 가져오기 (여러 필드명 지원)
        file = request.files.get('image') or request.files.get('file')
        if not file:
            return jsonify({"error": "이미지 파일이 필요합니다."}), 400
        
        # 스케일 파라미터 (여러 필드명 지원)
        scale_str = request.form.get('scale') or request.form.get('factor', '2.0')
        try:
            scale = float(scale_str)
            if scale <= 1.0 or scale > 4.0:
                return jsonify({"error": "scale은 1.0보다 크고 4.0 이하여야 합니다."}), 400
        except ValueError:
            return jsonify({"error": "scale은 숫자여야 합니다."}), 400
        
        # 모델 타입 (general 또는 text_logo)
        model_type = request.form.get('modelType', 'general')
        if model_type not in ['general', 'text_logo']:
            model_type = 'general'
        
        # 임시 파일 생성
        temp_dir = tempfile.gettempdir()
        temp_input = os.path.join(temp_dir, f"input_{os.getpid()}_{id(file)}.png")
        temp_output = os.path.join(temp_dir, f"output_{os.getpid()}_{id(file)}.png")
        
        # 업로드된 파일 저장
        file.save(temp_input)
        
        # quality_enhance.py 스크립트 실행
        # 모델 타입에 따라 스크립트 선택
        if model_type == 'text_logo':
            script_name = 'quality_enhance_text.py'
        else:
            script_name = 'quality_enhance.py'
        
        script_path = os.path.join(scripts_dir, script_name)
        
        if not os.path.exists(script_path):
            # 폴백: 일반 스크립트 사용
            script_path = os.path.join(scripts_dir, 'quality_enhance.py')
            if not os.path.exists(script_path):
                return jsonify({"error": "화질 개선 스크립트를 찾을 수 없습니다."}), 500
        
        # Python 스크립트 실행
        import subprocess
        import shutil
        
        # Python 실행 파일 찾기
        python_cmd = shutil.which('python3') or shutil.which('python')
        if not python_cmd:
            return jsonify({"error": "Python을 찾을 수 없습니다."}), 500
        
        # Windows 경로 변환 (백슬래시를 슬래시로)
        normalized_input = temp_input.replace('\\', '/')
        normalized_output = temp_output.replace('\\', '/')
        normalized_script = script_path.replace('\\', '/')
        
        # 스크립트 실행
        result = subprocess.run(
            [
                python_cmd,
                normalized_script,
                '--input', normalized_input,
                '--output', normalized_output,
                '--scale', str(scale)
            ],
            capture_output=True,
            text=True,
            timeout=300,  # 5분 타임아웃
            encoding='utf-8',
            errors='replace'
        )
        
        # 실행 결과 확인
        if result.returncode != 0:
            error_msg = result.stderr or result.stdout or "알 수 없는 오류"
            print(f"ERROR: Python script failed: {error_msg}", file=sys.stderr)
            return jsonify({
                "error": "화질 개선 처리에 실패했습니다.",
                "details": error_msg[:500]  # 처음 500자만
            }), 500
        
        # 출력 파일 확인
        if not os.path.exists(temp_output):
            return jsonify({"error": "출력 파일이 생성되지 않았습니다."}), 500
        
        # 출력 이미지 읽기 및 Base64 인코딩
        with open(temp_output, 'rb') as f:
            image_data = f.read()
        
        if len(image_data) == 0:
            return jsonify({"error": "출력 파일이 비어있습니다."}), 500
        
        img_base64 = base64.b64encode(image_data).decode('utf-8')
        
        return jsonify({
            "success": True,
            "enhanced": f"data:image/png;base64,{img_base64}",
            "scale": scale,
            "modelType": model_type
        }), 200
        
    except subprocess.TimeoutExpired:
        return jsonify({"error": "처리 시간이 초과되었습니다."}), 504
    except Exception as e:
        error_type = type(e).__name__
        error_msg = str(e)
        print(f"ERROR: {error_type}: {error_msg}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return jsonify({
            "error": "서버 오류가 발생했습니다.",
            "details": f"{error_type}: {error_msg}"
        }), 500
    finally:
        # 임시 파일 정리
        try:
            if temp_input and os.path.exists(temp_input):
                os.remove(temp_input)
            if temp_output and os.path.exists(temp_output):
                os.remove(temp_output)
        except Exception as e:
            print(f"WARNING: Failed to cleanup temp files: {e}", file=sys.stderr)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port, debug=False)
EOF
```

### 방법 2: GitHub에서 python-server 별도 저장소로 관리

1. python-server를 별도 GitHub 저장소로 생성
2. Render에서 해당 저장소 연결
3. 독립적으로 업데이트 가능

## 현재 상태

- ✅ `python-server/app.py` 업데이트 완료 (로컬)
- ✅ `python-server/requirements.txt` 업데이트 완료 (로컬)
- ⚠️ Git 서브모듈 문제로 GitHub 푸시 불가
- 🔄 Render에서 수동 업데이트 필요

## 다음 단계

1. Render 대시보드에서 `python-ai-server` 서비스 확인
2. 위의 방법 1을 사용하여 app.py 업데이트
3. 서비스 재배포
4. 테스트

