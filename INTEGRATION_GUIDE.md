# 🔗 기능 통합 가이드

## 개요

이 프로젝트에는 두 가지 화질 개선 API가 있습니다:

1. **`/api/quality-enhance`** - 기본 화질 개선 (기존)
2. **`/api/mosaic-superrecon`** - 모자이크 보정 및 고급 화질 개선 (신규)

---

## API 비교

### `/api/quality-enhance`

**용도:** 일반적인 이미지 화질 개선

**특징:**
- Real-ESRGAN 기반 초해상도
- 단순하고 빠름
- 기본적인 업스케일링

**사용 시나리오:**
- 일반 사진 화질 개선
- 간단한 업스케일링
- 빠른 처리 필요

### `/api/mosaic-superrecon`

**용도:** 모자이크 보정 및 고급 화질 개선

**특징:**
- 모자이크 블록 패턴 감소
- 엣지/윤곽선 보강
- 노이즈 제거
- 디테일 재구성
- 더 정교한 처리

**사용 시나리오:**
- 모자이크 처리된 이미지 복원
- 고품질 복원 필요
- 엣지 보강 필요
- 노이즈 제거 필요

---

## 프론트엔드 통합 예시

### 기본 화질 개선 사용

```typescript
const enhanceQuality = async (imageFile: File, scale: number) => {
  const formData = new FormData();
  formData.append("image", imageFile);
  formData.append("scale", scale.toString());

  const res = await fetch("/api/quality-enhance", {
    method: "POST",
    body: formData,
  });

  const result = await res.json();
  return result.enhanced; // base64 data URL
};
```

### 모자이크 보정 사용

```typescript
const enhanceMosaic = async (
  imageFile: File,
  options: {
    scale?: number;
    mosaicStrength?: number;
    enhanceEdges?: boolean;
    denoise?: boolean;
  }
) => {
  const formData = new FormData();
  formData.append("image", imageFile);
  formData.append("scale", (options.scale || 2.0).toString());
  formData.append("mosaicStrength", (options.mosaicStrength || 0.3).toString());
  formData.append("enhanceEdges", String(options.enhanceEdges || false));
  formData.append("denoise", String(options.denoise || false));

  const res = await fetch("/api/mosaic-superrecon", {
    method: "POST",
    body: formData,
  });

  const result = await res.json();
  return result.enhanced; // base64 data URL
};
```

---

## 선택 가이드

### 언제 `/api/quality-enhance`를 사용할까?

- ✅ 일반 사진 화질 개선
- ✅ 빠른 처리 필요
- ✅ 단순 업스케일링
- ✅ 리소스 절약

### 언제 `/api/mosaic-superrecon`을 사용할까?

- ✅ 모자이크 처리된 이미지
- ✅ 고품질 복원 필요
- ✅ 엣지 보강 필요
- ✅ 노이즈 제거 필요
- ✅ 더 정교한 처리 필요

---

## 성능 비교

| 항목 | quality-enhance | mosaic-superrecon |
|------|----------------|-------------------|
| 처리 시간 (GPU) | 빠름 (2-3초) | 보통 (3-5초) |
| 처리 시간 (CPU) | 보통 (30-60초) | 느림 (60-120초) |
| 메모리 사용 | 낮음 | 중간 |
| 품질 | 좋음 | 매우 좋음 |
| 모자이크 보정 | ❌ | ✅ |
| 엣지 보강 | ❌ | ✅ |
| 노이즈 제거 | ❌ | ✅ |

---

## 에러 처리

두 API 모두 동일한 에러 처리 방식을 사용합니다:

```typescript
try {
  const result = await fetch("/api/quality-enhance", { ... });
  const json = await result.json();
  
  if (!result.ok) {
    // 에러 처리
    console.error(json.error);
    console.error(json.errorCode);
    console.error(json.details);
    return null;
  }
  
  return json.enhanced;
} catch (error) {
  console.error("API call failed:", error);
  return null;
}
```

---

## 자동 폴백

프론트엔드에서 자동 폴백 구현 예시:

```typescript
const enhanceImage = async (imageFile: File, scale: number, useAdvanced: boolean = false) => {
  const api = useAdvanced ? "/api/mosaic-superrecon" : "/api/quality-enhance";
  
  try {
    // 고급 API 시도
    if (useAdvanced) {
      return await enhanceMosaic(imageFile, { scale });
    } else {
      return await enhanceQuality(imageFile, scale);
    }
  } catch (error) {
    // 실패 시 기본 API로 폴백
    if (useAdvanced) {
      console.warn("Advanced API failed, falling back to basic API");
      return await enhanceQuality(imageFile, scale);
    }
    throw error;
  }
};
```

---

## 환경 변수

두 API 모두 동일한 환경 설정을 사용합니다:

- `PYTHONIOENCODING=utf-8`
- `PYTHONUTF8=1`
- `LANG=en_US.UTF-8`
- `LC_ALL=en_US.UTF-8`

---

## 모니터링

서버 로그에서 다음을 확인할 수 있습니다:

```
Python stderr: INFO: Device: cuda
Python stderr: INFO: Loading Real-ESRGAN model...
Python stderr: INFO: Processing with Real-ESRGAN...
Python stderr: INFO: Processing complete: 1600 x 1200
```

---

**참고:** UI/UX는 변경하지 않았습니다. 백엔드 기능만 추가되었습니다.

