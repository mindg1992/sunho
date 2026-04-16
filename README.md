# 선호피엔에스 설비보전일지

Next.js 14 + Supabase로 구축한 사내 설비보전일지 웹앱.

## 기능
- 홈: "선호피엔에스" 타이틀 + `1공장` / `2공장` / `날씨입력` 버튼
- 1공장/2공장: 좌우 스크롤 입력 표 (날짜 컬럼 좌측 고정, 헤더 상단 고정, 날씨 컬럼 맨 우측)
- 날짜 셀 클릭 시 날짜 선택 (관리자만 변경 가능)
- 셀 포커스 벗어나면 자동 저장
- 엑셀 다운로드: 사진과 동일한 양식 + 날씨 컬럼 추가
- 날씨입력: 날짜별 텍스트 저장, 최근 30일 리스트
- 공용 PIN(4자리) 로그인, 이름은 드롭다운 선택
- **수정 권한**: 입력자는 빈 칸만 입력 가능, 이미 입력된 값의 수정 및 날짜 변경은 관리자만
- 관리자 페이지(/admin): 계정 생성, PIN 변경, 삭제

## 설치 및 실행

### 1. Supabase 프로젝트 생성
1. https://supabase.com 가입 (무료)
2. New Project 생성 (리전: Northeast Asia - Seoul 권장)
3. Settings → API 에서 다음 값을 복사:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (secret! 노출 금지)
4. SQL Editor 에서 `supabase/schema.sql` 내용 전체 붙여넣고 실행

### 2. 환경변수
```
cp .env.local.example .env.local
```
`.env.local` 편집해서 실제 값 입력. `SESSION_SECRET`은 아무 긴 랜덤 문자열.

### 3. 의존성 설치 및 실행
```
npm install
npm run dev
```
브라우저에서 http://localhost:3000 접속.

### 4. 최초 관리자 시드
- 사용자가 없으면 로그인 화면에 "관리자 시드 생성" 버튼 표시됨
- 클릭하면 **박유신 / PIN 1234** 계정 생성
- 로그인 후 `/admin` 에서 PIN을 다른 값으로 변경하세요

### 5. 배포 (Vercel 추천, 무료)
1. GitHub에 이 코드를 push
2. https://vercel.com 에서 Import Project → 환경변수 3개 입력 → Deploy
3. 사내 누구나 URL로 접속 가능

## 권한 정리
| 동작 | 입력자 | 관리자 |
|---|---|---|
| 로그인 | O | O |
| 신규 날짜(행) 추가 | O | O |
| 빈 칸에 값 입력 | O | O |
| 이미 입력된 값 수정 | X | O |
| 날짜 변경 | X | O |
| 날씨 입력(신규) | O | O |
| 날씨 수정 | X | O |
| 엑셀 다운로드 | O | O |
| 계정 관리 | X | O |

## 파일 구조
```
app/
  page.tsx                  홈 (3버튼)
  login/                    PIN 로그인
  factory/[id]/             1공장/2공장 그리드
  weather/                  날씨 입력
  admin/                    계정 관리
  api/
    login, logout, seed
    factory/[id]/upsert     셀 저장
    factory/[id]/change-date 날짜 변경 (관리자)
    factory/[id]/excel      엑셀 생성
    weather                 날씨 저장
    admin/users             사용자 CRUD
lib/
  supabase.ts               Supabase 클라이언트
  auth.ts                   PIN 해시, 세션 토큰
  columns.ts                공장별 컬럼 정의
supabase/
  schema.sql                DB 스키마
```

## 아키텍처 메모
- Supabase Auth 대신 **자체 PIN 인증**: 공용 PIN 방식에 Supabase Auth를 맞추는 것보다 Service Role Key + 서명된 쿠키가 훨씬 깔끔
- 모든 쓰기는 **Next.js API 라우트 경유** → 서버에서 권한 검증 후 Supabase에 반영
- 클라이언트는 `NEXT_PUBLIC_SUPABASE_URL`만 보이고, 실제 DB 접근은 서버에서만 (Service Role Key는 서버 전용)
- 엑셀은 `exceljs`로 서버에서 생성 → 사진 양식(색상·테두리·틀고정) 그대로 재현, 맨 우측에 날씨 컬럼 추가
