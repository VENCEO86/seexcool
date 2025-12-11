# ============================================
# 자동 배포 스크립트: GitHub + Render
# ============================================
# 이 스크립트는 다음을 수행합니다:
# 1. 변경사항 커밋
# 2. GitHub에 푸시
# 3. Render 자동 배포 확인
# ============================================

$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "자동 배포 시작: GitHub + Render" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 1. Git 상태 확인
Write-Host "[1/5] Git 상태 확인 중..." -ForegroundColor Yellow
$status = git status --short
if (-not $status) {
    Write-Host "변경사항이 없습니다. 배포를 건너뜁니다." -ForegroundColor Yellow
    exit 0
}

Write-Host "변경된 파일:" -ForegroundColor Green
git status --short | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }

# 2. .cursor 디렉토리 제외 확인
Write-Host ""
Write-Host "[2/5] .gitignore 확인 중..." -ForegroundColor Yellow
if (-not (Test-Path ".gitignore")) {
    Write-Host ".gitignore 파일이 없습니다. 생성합니다..." -ForegroundColor Yellow
    Add-Content -Path ".gitignore" -Value ".cursor`nnode_modules`n.env.local`n.next`n"
}

# .cursor가 .gitignore에 있는지 확인
$gitignoreContent = Get-Content ".gitignore" -ErrorAction SilentlyContinue
if ($gitignoreContent -notcontains ".cursor") {
    Write-Host ".cursor를 .gitignore에 추가합니다..." -ForegroundColor Yellow
    Add-Content -Path ".gitignore" -Value ".cursor`n"
}

# 3. 변경사항 스테이징
Write-Host ""
Write-Host "[3/5] 변경사항 스테이징 중..." -ForegroundColor Yellow
git add -A

# 커밋 메시지 생성
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$commitMessage = "Deploy: Auto deployment at $timestamp"

Write-Host "커밋 메시지: $commitMessage" -ForegroundColor Gray

# 4. 커밋
Write-Host ""
Write-Host "[4/5] 커밋 중..." -ForegroundColor Yellow
try {
    git commit -m $commitMessage
    Write-Host "커밋 완료!" -ForegroundColor Green
} catch {
    Write-Host "커밋 실패 또는 변경사항 없음: $_" -ForegroundColor Yellow
}

# 5. GitHub 푸시
Write-Host ""
Write-Host "[5/5] GitHub에 푸시 중..." -ForegroundColor Yellow
try {
    $branch = git branch --show-current
    Write-Host "브랜치: $branch" -ForegroundColor Gray
    
    git push origin $branch
    Write-Host "푸시 완료!" -ForegroundColor Green
} catch {
    Write-Host "푸시 실패: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "배포 완료!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "다음 단계:" -ForegroundColor Yellow
Write-Host "1. Render 대시보드에서 자동 배포 상태 확인" -ForegroundColor Gray
Write-Host "2. https://dashboard.render.com 접속" -ForegroundColor Gray
Write-Host "3. seexcool-web 서비스의 배포 로그 확인" -ForegroundColor Gray
Write-Host ""
Write-Host "참고: Render는 GitHub 푸시 시 자동으로 배포됩니다." -ForegroundColor Cyan
Write-Host ""

