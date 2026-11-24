# SITE HUB

여러 사이트를 카드로 모아 보여주고, 카드를 누르면 해당 사이트로 이동하는 **정적 사이트**입니다.
빌드나 서버가 필요 없고, `index.html`을 열거나 정적 호스팅에 올리면 바로 동작합니다.

## 구조

```
index.html          허브 페이지
style.css           스타일
app.js              카드 렌더링 · 검색 · 카테고리 필터
sites.js            ★ 사이트 목록 (여기만 수정하면 됨)
thumbs/             카드 썸네일 (1280 WebP + 640 사본)
scripts/            썸네일 캐프처 · 링크 점검 스크립트
health.json         링크 점검 결과 (CI 가 갱신 · 카드 상태 점에 사용)
sw.js               오프라인 셀 서비스 워커
manifest.webmanifest 홈화면 추가(PWA)
icons/, og.png      홈화면 아이콘 · 공유 미리보기 같은 이미지
```

## 사이트 추가

`sites.js`의 `sites` 배열에 항목을 추가합니다.

```js
{
  name: "사이트 이름",
  desc: "한 줄 설명",
  url: "https://example.com",
  icon: "🌐",
  image: "thumbs/example.png", // 없으면 강조색 + 아이콘으로 표시
  group: "기타",
  tags: ["키워드"],
  accent: "#5fd1ff",
  pin: true, // 선택 — 넣으면 해당 탭에서 항상 맨 위(북마크보다 위)
}
```

카테고리 필터와 검색은 `group` / `tags` 값에서 자동으로 생성됩니다.
`pin: true` 인 카드는 북마크로 고정한 카드보다도 위에 표시됩니다.

## 검색 · 정렬 규칙

- 이름 · 설명 · 태그 · 주소를 대상으로 전체 탭에서 찾습니다.
- 공백은 무시합니다. (`끝말 잇기` → 끝말잇기)
- 초성 검색을 지원합니다. (`ㅊㅁ` → 침묵의 숲)
- 카드 순서: `pin` → 북마크 → 자주·최근 연 카드 → 나머지(등록 순).
- 방문 기록은 `localStorage`(`sitehub.visits.v1`)에만 저장됩니다.

## 로컬에서 보기

```bash
python3 -m http.server 4173
# 또는
npm start
```

→ http://localhost:4173

## 썸네일 다시 캡처

사이트 화면이 바뀌었을 때만 필요합니다. `sites.js`에서 `image`가 지정된 사이트를 브라우저로 열어
1280×720 **WebP + 640px 사본(`-640.webp`)** 을 저장하며, **첫 방문 안내 모달(튜토리얼 등)은 자동으로 닫고** 캡처합니다.
사본 두 개는 카드에서 `srcset` 으로 쓰입니다.

### 1. 준비 (한 번만)

```bash
npm install                        # puppeteer (devDependency)
npx puppeteer browsers install chrome
```

Linux에서 Chrome이 뜨지 않으면 아래 패키지가 필요합니다. (Ubuntu 24.04 기준)

```bash
sudo apt-get install -y \
  libnspr4 libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libatspi2.0-0t64 \
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libxkbcommon0 libasound2t64 \
  libxrender1 libxi6 libxext6 libcups2t64 libcairo2 libpango-1.0-0 \
  libpangocairo-1.0-0 libpangoft2-1.0-0 libavahi-common3 libavahi-client3 \
  libharfbuzz0b libfribidi0 libthai0 libdatrie1 libgraphite2-3 libpixman-1-0 \
  libxcb-render0 libxcb-shm0 libpng16-16t64 libfreetype6 liblzo2-2 libxcb1 \
  libdbus-1-3 libglib2.0-0t64
```

폰트도 필요합니다. 폰트가 없으면 한글은 □, 이모지는 빈 사각형으로 찍히고,
폰트 설정 자체가 없으면 Chrome이 `SkFontMgr_FontConfigInterface ... Not implemented` 로 즉시 종료됩니다.

```bash
sudo apt-get install -y fontconfig fonts-nanum fonts-noto-color-emoji fonts-dejavu-core
```

### 2. 캡처

```bash
npm run thumbs
THUMB_ONLY=silence npm run thumbs   # 이름·파일명에 silence 가 들어간 카드만 다시 캡처
```

- 결과는 `sites.js`의 `image` 경로에 그대로 덮어씁니다. (예: `thumbs/shooter.webp` + `thumbs/shooter-640.webp`)
- 화면을 덮는 고정 레이어(`z-index ≥ 100`)에서 닫기/건너뛰기 버튼만 눌러 모달을 닫습니다.
  어떤 모달을 닫았는지는 `[THUMB]   모달 닫기: #tutorialModal ← "건너뛰기"` 처럼 로그로 나옵니다.
- `python3 -m http.server` 같은 정적 서버는 필요 없습니다. `sites.js`의 URL이 모두 절대 주소라
  `THUMB_BASE_URL`(기본값 `http://127.0.0.1:4173`)은 상대 경로를 쓸 때만 사용됩니다.

### 3. 반영

```bash
git diff --stat thumbs/
git add thumbs
git commit -m "chore: 썸네일 갱신"
git push
```

GitHub Pages는 썸네일을 `cache-control: max-age=600`으로 캐시합니다.
배포 직후 예전 이미지가 보이면 10분 뒤에, 또는 `?v=2` 쿼리를 붙여 확인하세요.

### 문제 해결

| 증상 | 원인 / 해결 |
|---|---|
| `Code: 127 ... error while loading shared libraries: libXXX.so` | 위 시스템 라이브러리 누락 → 해당 패키지 설치 |
| `SkFontMgr_FontConfigInterface.cpp ... Not implemented` | 폰트 설정 없음 → `fontconfig` + 폰트 설치 |
| 한글이 □, 이모지가 빈 사각형 | `fonts-nanum`, `fonts-noto-color-emoji` 설치 |
| `[THUMB] 경고: 닫지 못한 오버레이 N개` | 자동으로 닫지 못한 모달 → 해당 사이트 닫기 버튼을 스크립트 규칙에 추가 |
| 첫 실행이 느림 | Render 무료 플랜 콜드 스타트(20초 안팎). 스크립트 타임아웃은 45초 |

## Google 로그인 · 북마크 동기화 (선택)

`auth.js`의 `CLIENT_ID`를 채우면 헤더에 로그인 버튼이 생기고, 북마크가 Google Drive의
**앱 데이터 폴더**(`sitehub-bookmarks.json`)에 저장되어 기기 간에 동기화됩니다.
비워두면 버튼이 나타나지 않고 북마크는 브라우저 localStorage에만 저장됩니다.

1. Google Cloud Console → **API 및 서비스 → OAuth 동의 화면** 구성 (외부)
2. **사용자 인증 정보 → OAuth 클라이언트 ID → 웹 애플리케이션**
3. **승인된 JavaScript 원본**에 배포 주소의 원본을 추가 (경로 제외)
   - `https://psb0118.github.io`
   - 로컬 테스트용 `http://localhost:4173`
4. 발급된 클라이언트 ID를 `auth.js`의 `CLIENT_ID`에 붙여넣기 (시크릿은 필요 없음)

사용 범위는 `openid email profile https://www.googleapis.com/auth/drive.appdata` 입니다.
앱 데이터 폴더는 사용자 Drive에 보이지 않는 숨김 영역이고 이 앱만 읽고 씁니다.
액세스 토큰은 메모리에만 보관하며 서버로 보내지 않습니다.

> 학교 Workspace 계정은 관리자 정책에 따라 외부 앱 OAuth가 차단될 수 있습니다.
> `drive.appdata`는 민감 범위라 외부 사용자에게 공개할 때 Google 검증이 필요할 수 있습니다.

## 배포

정적 호스팅이면 어디든 됩니다. 빌드 명령은 비워두고 루트(`/`)를 배포하면 됩니다.

- **GitHub Pages**: Settings → Pages → Source: Deploy from a branch → `main` / `(root)`
- **Render**: New → Static Site (build command 없음, publish directory `.`)
- **Vercel / Cloudflare Pages**: 프레임워크 없이 정적 배포

배포 후 `sites.js`의 링크는 절대 주소이므로 그대로 동작합니다.

## 자동 점검 · 운영

`.github/workflows/` 에 두 개의 워크플로가 있습니다.

| 워크플로 | 언제 | 하는 일 |
|---|---|---|
| 링크·썸네일 점검 (`health-check.yml`) | `sites.js`/`thumbs/` 변경, main 푸시, 매일 06:00 KST, 수동 | 13개 링크 상태 확인 → `health.json` 커밋, 요약 리포트·아티팩트, **실패하면 `site-health` 라벨 이슈 자동 생성**, 복구되면 자동 종료 |
| 썸네일 자동 갱신 (`thumbs-refresh.yml`) | 매주 화 03:00 KST, 수동 | Chrome 으로 전체 썸네일 재캡처 후 변경이 있으면 커밋·푸시 |

- 링크 장애(5xx·타임아웃)는 경고로만 기록해 초록불을 유지하고, **썸네일 누락·손상 때만** 실패합니다.
- 카드 우측 상단의 점은 `health.json` 을 읽어 표시합니다: 초록(정상) · 노랑(주의) · 빨강(응답 없음 + "30초쯤 걸릴 수 있습니다" 안내).
- 점검 결과는 최대 하루 전일 수 있습니다(스케줄 주기).

## 키보드 · 접근성

- 첫 `Tab` 은 "사이트 목록으로 건너뛰기" 링크로 이동합니다.
- 카드 사이는 `←` `→` `↑` `↓` · `Home` · `End` 로 이동하고 `Enter` 로 엽니다.
- `/` 로 검색창 포커스, `Esc` 로 검색어 삭제.
- 결과 개수는 `role="status"` 로 스크린 리더에 알려줍니다.

## 공유 미리보기 · 홈화면 추가

- `og.png`(1200×630) 로 링크 공유 시 미리보기가 뜨는 카드가 표시됩니다.
- `manifest.webmanifest` + `sw.js` 로 홈화면에 추가할 수 있고, 오프라인에서도 마지막으로 받은 화면을 보여줍니다(네트워크 우선).
- `sw.js` 의 `SHELL` 이나 `CACHE` 내용을 바꿨다면 `CACHE` 버전(`site-hub-v1`)을 올려 주세요.

## 현재 등록된 사이트

| 이름 | 주소 | 상단 고정 |
|---|---|---|
| Shooter — 5v5 전술 슈터 | https://shooter-mfal.onrender.com/ | ★ |
| Wordgame — 끝말잇기 | https://wordgame-kol6.onrender.com/ | ★ |
| SILENCE — 침묵의 숲 | https://silence-g1fe.onrender.com/ | ★ |
| 머니 플레이그라운드 | https://psb0118.github.io/stock-market/ | ★ |
| Mushroom | https://sites.google.com/changshin.ms.kr/mushroom | |
| 1v1 Cyber Duel | https://sites.google.com/changshin.ms.kr/1v1cyberduel-firebaseedition | |
| 113 | https://sites.google.com/changshin.ms.kr/113 | |
| 네온 에임 트레이너 | https://sites.google.com/changshin.ms.kr/yoo | |
| Pigeon Timing Flight Game | https://sites.google.com/changshin.ms.kr/pigeon-timing-flight-game | |
| 3D Crystal Quest | https://sites.google.com/changshin.ms.kr/changshin-is-goat | |
| Neon Space Shooter | https://sites.google.com/changshin.ms.kr/neon-space-shooter | |
| 팔레오 클래시 — 고생물 배틀 도감 | https://26024-cmyk.github.io/-/ | |
| GitHub — shooter | https://github.com/psb0118/shooter | |

> Wordgame·Shooter·SILENCE 는 Render 무료 플랜이라 첫 접속 시 콜드 스타트로 시간이 걸릴 수 있습니다.
