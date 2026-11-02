# SITE HUB

여러 사이트를 카드로 모아 보여주고, 카드를 누르면 해당 사이트로 이동하는 **정적 사이트**입니다.
빌드나 서버가 필요 없고, `index.html`을 열거나 정적 호스팅에 올리면 바로 동작합니다.

## 구조

```
index.html          허브 페이지
style.css           스타일
app.js              카드 렌더링 · 검색 · 카테고리 필터
sites.js            ★ 사이트 목록 (여기만 수정하면 됨)
thumbs/             카드 썸네일 이미지
scripts/            썸네일 자동 캡처 스크립트 (선택)
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
}
```

카테고리 필터와 검색은 `group` / `tags` 값에서 자동으로 생성됩니다.

## 로컬에서 보기

```bash
python3 -m http.server 4173
# 또는
npm start
```

→ http://localhost:4173

## 썸네일 다시 캡처

사이트 화면이 바뀌었을 때만 필요합니다.

```bash
npm install
npx puppeteer browsers install chrome
python3 -m http.server 4173    # 서버를 켜둔 상태에서
npm run thumbs
```

`image`가 지정된 사이트를 1280×720 PNG로 `thumbs/`에 저장합니다.
Linux에서는 Chrome 실행에 필요한 시스템 라이브러리와 한글 폰트가 필요합니다.

## 배포

정적 호스팅이면 어디든 됩니다. 빌드 명령은 비워두고 루트(`/`)를 배포하면 됩니다.

- **GitHub Pages**: Settings → Pages → Source: Deploy from a branch → `main` / `(root)`
- **Render**: New → Static Site (build command 없음, publish directory `.`)
- **Vercel / Cloudflare Pages**: 프레임워크 없이 정적 배포

배포 후 `sites.js`의 링크는 절대 주소이므로 그대로 동작합니다.

## 현재 등록된 사이트

| 이름 | 주소 |
|---|---|
| Shooter — 5v5 전술 슈터 | https://shooter-mfal.onrender.com/ |
| Wordgame — 끝말잇기 | https://wordgame-kol6.onrender.com/ |
| GitHub — shooter | https://github.com/psb0118/shooter |

> Wordgame은 Render 무료 플랜이라 첫 접속 시 30초 정도 걸릴 수 있습니다.
