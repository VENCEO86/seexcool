#!/bin/bash

# -----------------------------
# 1) Python 3.12 설치
# -----------------------------
echo "📌 Python 3.12 설치 중..."
apt-get update
apt-get install -y python3 python3-pip

# python3 링크 통일
ln -sf /usr/bin/python3 /usr/bin/python
ln -sf /usr/bin/pip3 /usr/bin/pip

python --version
pip --version

# -----------------------------
# 2) requirements.txt 설치
# -----------------------------
echo "📌 requirements.txt 설치 중..."
pip install --upgrade pip
pip install -r requirements.txt

# -----------------------------
# 3) Node 서버 실행
# -----------------------------
echo "📌 Next.js 빌드 후 실행"
npm install
npm run build
npm start
