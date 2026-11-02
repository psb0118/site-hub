/* =========================================================
   SITE HUB 목록
   ---------------------------------------------------------
   아래 sites 배열에 항목을 추가하면 허브에 카드로 표시됩니다.
   카드를 클릭하면 url 로 이동합니다. (외부 주소는 새 탭)

   - name   : 사이트 이름
   - desc   : 한 줄 설명
   - url    : 이동할 주소
   - icon   : 카드 아이콘 (이모지)
   - image  : 카드 상단 썸네일 경로 (없으면 강조색 + 아이콘으로 표시)
   - group  : 카테고리 (같은 값끼리 필터 버튼이 자동 생성됨)
   - tags   : 검색에 걸리는 키워드 목록
   - accent : 카드 강조색 (16진수 색상)
========================================================= */

window.HUB = {
  title: "SITE HUB",
  subtitle: "여러 사이트를 한곳에 모았습니다. 카드를 누르면 해당 사이트로 이동합니다.",

  sites: [
    {
      name: "Shooter — 5v5 전술 슈터",
      desc: "브라우저에서 즐기는 3D FPS. 방을 만들고 AI 봇과 라운드 대전을 치릅니다.",
      url: "https://shooter-mfal.onrender.com/",
      icon: "🎯",
      image: "thumbs/shooter.png",
      group: "게임",
      tags: ["3D", "FPS", "멀티플레이", "슈터"],
      accent: "#4a7cff",
    },
    {
      name: "Wordgame — 끝말잇기",
      desc: "AI 대전과 온라인 2인 방, 랭킹이 있는 끝말잇기 게임입니다.",
      url: "https://wordgame-kol6.onrender.com/",
      icon: "🔤",
      image: "thumbs/wordgame.png",
      group: "게임",
      tags: ["끝말잇기", "AI", "온라인", "단어"],
      accent: "#5fd18a",
    },
    {
      name: "GitHub — shooter",
      desc: "게임과 허브의 소스 코드, 커밋 기록을 확인합니다.",
      url: "https://github.com/psb0118/shooter",
      icon: "🐙",
      image: "thumbs/github.png",
      group: "코드",
      tags: ["GitHub", "저장소", "소스"],
      accent: "#9aa6bb",
    },

    /* ↓ 새 사이트는 아래 형식을 복사해서 추가하세요.
    {
      name: "사이트 이름",
      desc: "한 줄 설명",
      url: "https://example.com",
      icon: "🌐",
      image: "thumbs/example.png", // 썸네일 (없으면 이 줄 삭제)
      group: "기타",
      tags: ["키워드"],
      accent: "#5fd1ff",
    },
    */
  ],
};
