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
      name: "Neon Tetris",
      desc: "Firebase로 만든 네온 스타일 테트리스. Google Sites에서 바로 플레이합니다.",
      url: "https://sites.google.com/changshin.ms.kr/neon-tetris-with-firebase",
      icon: "🟪",
      image: "thumbs/neon-tetris.png",
      group: "게임",
      tags: ["테트리스", "Tetris", "Firebase", "퍼즐"],
      accent: "#a855f7",
    },
    {
      name: "Mushroom",
      desc: "창신중학교 Google Sites에 올라온 버섯 테마 게임입니다.",
      url: "https://sites.google.com/changshin.ms.kr/mushroom",
      icon: "🍄",
      image: "thumbs/mushroom.png",
      group: "게임",
      tags: ["버섯", "Mushroom", "미니게임"],
      accent: "#ef6b6b",
    },
    {
      name: "1v1 Cyber Duel",
      desc: "Firebase 에디션 1대1 사이버 대결 게임입니다.",
      url: "https://sites.google.com/changshin.ms.kr/1v1cyberduel-firebaseedition",
      icon: "⚔️",
      image: "thumbs/1v1-cyber-duel.png",
      group: "게임",
      tags: ["1v1", "대결", "Cyber Duel", "Firebase"],
      accent: "#4ad9d9",
    },
    {
      name: "113",
      desc: "창신중학교 Google Sites 페이지입니다.",
      url: "https://sites.google.com/changshin.ms.kr/113",
      icon: "🌐",
      image: "thumbs/113.png",
      group: "게임",
      tags: ["113", "창신", "Google Sites"],
      accent: "#7c9cff",
    },
    {
      name: "네온 에임 트레이너",
      desc: "제한 시간 안에 나타나는 표적을 클릭해 점수를 올리는 2분 집중 에임 게임입니다.",
      url: "https://sites.google.com/changshin.ms.kr/yoo",
      icon: "🎯",
      image: "thumbs/yoo.png",
      group: "게임",
      tags: ["에임", "Aim Trainer", "표적", "미니게임"],
      accent: "#22d3ee",
    },
    {
      name: "Pigeon Timing Flight Game",
      desc: "스페이스바나 화면을 클릭해 날개를 쳐서 타이밍에 맞춰 부스터를 발동하는 비행 게임입니다.",
      url: "https://sites.google.com/changshin.ms.kr/pigeon-timing-flight-game",
      icon: "🕊️",
      image: "thumbs/pigeon-timing-flight-game.png",
      group: "게임",
      tags: ["비둘기", "타이밍", "비행", "Pigeon"],
      accent: "#f59e0b",
    },
    {
      name: "3D Crystal Quest",
      desc: "공중에 떠 있는 크리스탈을 모으고 워프 포털로 다음 스테이지로 이동하는 3D 탐험 게임입니다.",
      url: "https://sites.google.com/changshin.ms.kr/changshin-is-goat",
      icon: "💎",
      image: "thumbs/changshin-is-goat.png",
      group: "게임",
      tags: ["3D", "크리스탈", "탐험", "Crystal Quest"],
      accent: "#34d399",
    },
    {
      name: "Neon Space Shooter",
      desc: "네온 스타일 우주 슈팅 게임입니다. Google 로그인 후 점수를 저장할 수 있습니다.",
      url: "https://sites.google.com/changshin.ms.kr/neon-space-shooter",
      icon: "🚀",
      image: "thumbs/neon-space-shooter.png",
      group: "게임",
      tags: ["네온", "우주", "슈터", "Neon Shooter"],
      accent: "#7dd3fc",
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
