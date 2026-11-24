/* =========================================================
   app.js — sites.js 목록을 카드로 렌더링 + 검색/카테고리 필터
========================================================= */

(function () {
  "use strict";

  const cfg = window.HUB || {};
  const sites = (Array.isArray(cfg.sites) ? cfg.sites : []).filter(
    (s) => s && s.name && s.url
  );

  const titleEl = document.getElementById("hub-title");
  const subEl = document.getElementById("hub-subtitle");
  const gridEl = document.getElementById("site-grid");
  const groupsEl = document.getElementById("groups");
  const emptyEl = document.getElementById("empty");
  const countEl = document.getElementById("site-count");
  const searchEl = document.getElementById("search");

  if (cfg.title) titleEl.textContent = cfg.title;
  if (cfg.subtitle) subEl.textContent = cfg.subtitle;
  document.title = cfg.title ? `${cfg.title} — 사이트 모음` : "사이트 허브";

  /* 기본 활성 탭 = sites.js 에 처음 등장하는 그룹 */
  const BOOKMARK_GROUP = "__bookmarks__";
  const DEFAULT_GROUP = sites.length ? sites[0].group || "기타" : "";
  let activeGroup = DEFAULT_GROUP;
  let query = "";

  /* ---------- 북마크 (개인 설정 · localStorage) ---------- */

  /* 브라우저에만 저장됩니다. 서버·계정과 무관하게 이 기기에서만 유지됩니다. */
  const BOOKMARK_KEY = "sitehub.bookmarks.v1";

  function loadBookmarks() {
    try {
      const raw = localStorage.getItem(BOOKMARK_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.filter((u) => typeof u === "string") : [];
    } catch {
      return [];
    }
  }

  let bookmarks = loadBookmarks();

  function isBookmarked(url) {
    return bookmarks.includes(url);
  }

  function saveBookmarks() {
    try {
      localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks));
    } catch {
      /* 저장 불가(시크릿 모드 등) — 이번 세션에서만 유지 */
    }
  }

  function toggleBookmark(url) {
    bookmarks = isBookmarked(url)
      ? bookmarks.filter((u) => u !== url)
      : [url, ...bookmarks];
    saveBookmarks();
    if (auth && auth.isSignedIn()) auth.push(bookmarks);
    buildGroups();
    render();

    const btn = [...gridEl.querySelectorAll(".card-star")].find((b) => b.dataset.url === url);
    if (btn) btn.focus();
  }

  /* ---------- 방문 기록 (자주 · 최근 연 카드 우선) ---------- */

  const VISIT_KEY = "sitehub.visits.v1";

  function loadVisits() {
    try {
      const raw = localStorage.getItem(VISIT_KEY);
      const data = raw ? JSON.parse(raw) : {};
      return data && typeof data === "object" ? data : {};
    } catch {
      return {};
    }
  }

  let visits = loadVisits();

  function recordVisit(url) {
    const prev = visits[url] || { n: 0, t: 0 };
    visits[url] = { n: prev.n + 1, t: Date.now() };
    try {
      localStorage.setItem(VISIT_KEY, JSON.stringify(visits));
    } catch {
      /* 저장 불가(시크릿 모드 등) — 이번 세션에서만 유지 */
    }
  }

  /* ---------- 계정 (선택 · auth.js) ---------- */

  const auth = window.HUB_AUTH || null;
  const accountEl = document.getElementById("account");

  /* 로그인 직후: Drive 와 로컬 북마크를 합집합으로 병합하고 다시 올린다 */
  async function syncOnSignIn() {
    if (!auth) return;
    try {
      const remote = await auth.pull();
      if (Array.isArray(remote)) {
        const merged = bookmarks.slice();
        for (const url of remote) {
          if (typeof url === "string" && !merged.includes(url)) merged.push(url);
        }
        bookmarks = merged;
        saveBookmarks();
        render();
      }
      auth.push(bookmarks);
    } catch (err) {
      console.warn("[HUB] 북마크 동기화 실패:", err.message);
    }
  }

  function renderAccount() {
    if (!auth || !accountEl) return;

    auth.onStatus((st) => {
      accountEl.replaceChildren();
      accountEl.hidden = !st.configured;
      if (!st.configured) return;

      if (!st.signedIn) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "account-btn";
        btn.textContent = st.busy ? "로그인 중…" : "Google 로그인";
        btn.disabled = st.busy;
        btn.addEventListener("click", async () => {
          const ok = await auth.signIn();
          if (ok) await syncOnSignIn();
        });
        accountEl.append(btn);

        if (st.error) {
          const err = document.createElement("span");
          err.className = "account-err";
          err.textContent = st.error;
          accountEl.append(err);
        }
        return;
      }

      const chip = document.createElement("div");
      chip.className = "account-chip";

      const name = document.createElement("span");
      name.className = "account-name";
      name.textContent = (st.user && st.user.name) || "로그인됨";

      const out = document.createElement("button");
      out.type = "button";
      out.className = "account-out";
      out.textContent = "로그아웃";
      out.addEventListener("click", () => auth.signOut());

      chip.append(name, out);
      accountEl.append(chip);
    });
  }

  /* ---------- 유틸 ---------- */

  function isExternal(url) {
    try {
      return new URL(url, window.location.href).origin !== window.location.origin;
    } catch {
      return false;
    }
  }

  function hostOf(url) {
    try {
      const u = new URL(url, window.location.href);
      return u.host || url;
    } catch {
      return url;
    }
  }

  /* 검색용 정규화: 공백 제거 + 소문자 ("끝말 잇기" → "끝말잇기") */
  function normalize(text) {
    return String(text || "").toLowerCase().replace(/\s+/g, "");
  }

  /* 한글 초성 추출: "침묵의 숲" → "ㅊㅁㅇㅅ" */
  const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";

  function choseong(text) {
    let out = "";
    for (const ch of String(text || "")) {
      const code = ch.charCodeAt(0);
      out +=
        code >= 0xac00 && code <= 0xd7a3
          ? CHO[Math.floor((code - 0xac00) / 588)]
          : ch;
    }
    return out;
  }

  /* hex 색상 → 투명도 포함 색상 (강조색 배경/테두리용) */
  function withAlpha(hex, alpha) {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || ""));
    if (!m) return `rgba(74, 124, 255, ${alpha})`;
    let h = m[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /* ---------- 카드 ---------- */

  /* 썸네일 — image 가 있으면 실제 미리보기, 없으면 강조색 배경 + 아이콘 */
  function buildThumb(site) {
    const thumb = document.createElement("div");
    thumb.className = "card-thumb";

    const fallback = document.createElement("div");
    fallback.className = "thumb-fallback";
    fallback.setAttribute("aria-hidden", "true");

    const fbIcon = document.createElement("span");
    fbIcon.className = "thumb-fallback-icon";
    fbIcon.textContent = site.icon || "🌐";
    fallback.append(fbIcon);
    thumb.append(fallback);

    if (site.image) {
      const img = document.createElement("img");
      img.className = "thumb-img";
      img.src = site.image;
      /* 카드 제목이 이미 사이트를 설명하므로 썸네일은 장식으로 둔다 */
      img.alt = "";
      img.setAttribute("aria-hidden", "true");
      img.loading = "lazy";
      img.decoding = "async";
      img.width = 1280;
      img.height = 720;

      /* WebP 는 640px 사본을 함께 두고 화면 폭에 따라 골라 받는다 */
      const small = site.image.replace(/\.webp$/i, "-640.webp");
      if (small !== site.image) {
        img.srcset = `${small} 640w, ${site.image} 1280w`;
        img.sizes = "(max-width: 720px) 92vw, 360px";
      }

      const show = () => thumb.classList.add("has-image");
      const hide = () => {
        thumb.classList.remove("has-image");
        img.remove();
        console.warn(`[HUB] 썸네일을 불러오지 못했습니다: ${site.image}`);
      };
      img.addEventListener("load", show);
      img.addEventListener("error", hide);
      if (img.complete && img.naturalWidth > 0) show();

      thumb.append(img);
    }

    return thumb;
  }

  function buildCard(site) {
    const accent = site.accent || "#4a7cff";
    const external = isExternal(site.url);

    const card = document.createElement("a");
    card.className = "site-card";
    card.href = site.url;
    card.dataset.url = site.url;
    card.addEventListener("click", () => recordVisit(site.url));
    card.style.setProperty("--accent", accent);
    card.style.setProperty("--accent-soft", withAlpha(accent, 0.22));
    card.style.setProperty("--accent-faint", withAlpha(accent, 0.1));
    /* 접근 이름은 aria-label 로 덮지 않는다 — 화면에 보이는 텍스트(제목·설명·태그)와
       어긋나면 WCAG 2.5.3(Label in Name) 위반이 된다. */
    if (external) {
      card.target = "_blank";
      card.rel = "noopener noreferrer";
    }

    /* 본문: 아이콘 + 이름/주소 */
    const body = document.createElement("div");
    body.className = "card-body";

    const top = document.createElement("div");
    top.className = "card-top";

    const icon = document.createElement("div");
    icon.className = "card-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = site.icon || "🌐";

    const title = document.createElement("div");
    title.className = "card-title";

    const name = document.createElement("div");
    name.className = "card-name";
    name.textContent = site.name;

    const host = document.createElement("div");
    host.className = "card-host";
    host.textContent = hostOf(site.url);

    title.append(name, host);

    /* 링크 점검 상태 점 — health.json 을 받아오면 표시된다 */
    const healthDot = document.createElement("span");
    healthDot.className = "card-health";
    healthDot.dataset.state = "unknown";
    healthDot.hidden = true;
    /* 점은 시각 표시용 — 응답 없음은 카드 본문 안내 문구로 전달된다 */
    healthDot.setAttribute("aria-hidden", "true");

    top.append(icon, title, healthDot);

    /* 설명 */
    const desc = document.createElement("p");
    desc.className = "card-desc";
    desc.textContent = site.desc || "";

    /* 응답이 없을 때만 보이는 안내 (Render 무료 플랜 콜드 스타트) */
    const note = document.createElement("p");
    note.className = "card-note";
    note.hidden = true;

    /* 하단: 태그 + 이동 표시 */
    const foot = document.createElement("div");
    foot.className = "card-foot";

    const tags = document.createElement("div");
    tags.className = "card-tags";
    for (const tag of (site.tags || []).slice(0, 3)) {
      const t = document.createElement("span");
      t.className = "card-tag";
      t.textContent = tag;
      tags.append(t);
    }

    const go = document.createElement("span");
    go.className = "card-go";
    go.setAttribute("aria-hidden", "true");
    go.innerHTML = external
      ? '새 탭 <span class="card-ext">외부</span> ↗'
      : "이동 →";

    foot.append(tags, go);

    body.append(top, desc, note, foot);

    /* 새 탭 안내도 본문 텍스트로 넣어 접근 이름에 포함시킨다 */
    if (external) {
      const hint = document.createElement("span");
      hint.className = "visually-hidden";
      hint.textContent = " (새 탭에서 열림)";
      body.append(hint);
    }
    card.append(buildThumb(site), body);

    /* 북마크 별 — 카드(<a>) 안에 버튼을 중첩할 수 없어 형제로 둔다 */
    const wrap = document.createElement("div");
    wrap.className = "card-wrap" + (isBookmarked(site.url) ? " is-pinned" : "");

    const star = document.createElement("button");
    star.type = "button";
    star.className = "card-star" + (isBookmarked(site.url) ? " active" : "");
    star.dataset.url = site.url;
    star.textContent = isBookmarked(site.url) ? "★" : "☆";
    star.setAttribute("aria-pressed", String(isBookmarked(site.url)));
    star.setAttribute(
      "aria-label",
      `${site.name} 북마크 ${isBookmarked(site.url) ? "해제" : "추가"}`
    );
    star.title = isBookmarked(site.url) ? "북마크 해제" : "북마크 (맨 위에 고정)";
    star.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleBookmark(site.url);
    });

    wrap.append(card, star);
    return wrap;
  }

  /* ---------- 카테고리 칩 ---------- */

  function groupNames() {
    const names = [];
    for (const s of sites) {
      const g = s.group || "기타";
      if (!names.includes(g)) names.push(g);
    }
    return names;
  }

  function makeChip(value, label, count) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.dataset.group = value;
    btn.textContent = label;

    const num = document.createElement("span");
    num.className = "chip-num";
    num.textContent = String(count);
    btn.append(num);

    btn.addEventListener("click", () => {
      activeGroup = value;
      /* 검색 중에 탭을 누르면 검색어를 지우고 해당 탭 전체를 보여준다 */
      if (query) {
        query = "";
        searchEl.value = "";
      }
      render();
      writeUrlState(true);
    });

    return btn;
  }

  function markActiveChips() {
    for (const chip of groupsEl.querySelectorAll(".chip")) {
      const on = chip.dataset.group === activeGroup;
      chip.classList.toggle("active", on);
      chip.setAttribute("aria-pressed", String(on));
    }
  }

  function buildGroups() {
    groupsEl.replaceChildren();

    /* 북마크한 사이트가 있을 때만 '북마크' 탭을 맨 앞에 노출 */
    if (bookmarks.length) {
      groupsEl.append(makeChip(BOOKMARK_GROUP, "북마크", bookmarks.length));
    }
    for (const name of groupNames()) {
      const count = sites.filter((s) => (s.group || "기타") === name).length;
      groupsEl.append(makeChip(name, name, count));
    }
    markActiveChips();
  }

  /* ---------- 렌더 ---------- */

  /* ---------- URL 상태 (?g=그룹&q=검색어) ---------- */

  function readUrlState() {
    const params = new URLSearchParams(location.search);
    const g = params.get("g");
    query = params.get("q") || "";
    if (g && (g === BOOKMARK_GROUP || groupNames().includes(g))) activeGroup = g;
    if (searchEl) searchEl.value = query;
  }

  function writeUrlState(push) {
    const params = new URLSearchParams();
    if (activeGroup && activeGroup !== DEFAULT_GROUP) params.set("g", activeGroup);
    if (query.trim()) params.set("q", query.trim());

    const qs = params.toString();
    const url = location.pathname + (qs ? `?${qs}` : "") + location.hash;
    const state = { g: activeGroup, q: query };

    if (push) history.pushState(state, "", url);
    else history.replaceState(state, "", url);
  }

  function render() {
    const q = normalize(query);

    /* 북마크 탭에 있는데 북마크가 모두 사라졌으면 기본 탭으로 복귀 */
    if (activeGroup === BOOKMARK_GROUP && !bookmarks.length) {
      activeGroup = DEFAULT_GROUP;
      writeUrlState(false);
    }

    const visible = sites.filter((s) => {
      /* 검색어가 있으면 탭과 무관하게 전체 사이트에서 찾는다 */
      if (q) {
        const hay = normalize([s.name, s.desc, (s.tags || []).join(" "), s.url].join(" "));
        if (hay.includes(q)) return true;
        /* 초성 검색: "ㅊㅁ" → 침묵의 숲 */
        return (
          /^[ㄱ-ㅎ]+$/.test(q) &&
          normalize(choseong([s.name, (s.tags || []).join(" ")].join(" "))).includes(q)
        );
      }
      if (activeGroup === BOOKMARK_GROUP) return isBookmarked(s.url);
      return (s.group || "기타") === activeGroup;
    });

    /* 상단 고정(pin) → 북마크 → 자주·최근 연 순 (같은 순위는 기존 순서 유지) */
    const ordered = visible.slice().sort((a, b) => {
      const pin = Number(!a.pin) - Number(!b.pin);
      if (pin) return pin;

      const book = Number(isBookmarked(b.url)) - Number(isBookmarked(a.url));
      if (book) return book;

      const va = visits[a.url] || { n: 0, t: 0 };
      const vb = visits[b.url] || { n: 0, t: 0 };
      if (va.n !== vb.n) return vb.n - va.n;
      return vb.t - va.t;
    });

    gridEl.replaceChildren();
    for (const site of ordered) gridEl.append(buildCard(site));

    if (sites.length === 0) {
      emptyEl.textContent = "아직 등록된 사이트가 없습니다. sites.js 에 사이트를 추가하세요.";
      emptyEl.classList.remove("hidden");
    } else {
      emptyEl.textContent = q
        ? `“${query.trim()}”에 맞는 사이트가 없습니다.`
        : activeGroup === BOOKMARK_GROUP
          ? "북마크한 사이트가 없습니다."
          : "조건에 맞는 사이트가 없습니다.";
      emptyEl.classList.toggle("hidden", visible.length > 0);
    }

    countEl.textContent = q
      ? `${visible.length}개 표시 / 전체 ${sites.length}개 (전체 검색)`
      : `${visible.length}개 표시 / 전체 ${sites.length}개`;

    markActiveChips();
    applyHealth();
  }

  /* ---------- 점검 상태 (health.json · CI 가 주기적으로 갱신) ---------- */

  let health = {};
  let healthAt = "";

  function healthText(st) {
    if (!st) return "점검 정보 없음";
    const state = st.state === "ok" ? "정상" : st.state === "warn" ? "주의" : "응답 없음";
    const when = healthAt ? ` · ${healthAt.slice(0, 16).replace("T", " ")} UTC 점검` : "";
    return `${state} (${st.label || st.state})${when}`;
  }

  function applyHealth() {
    for (const card of gridEl.querySelectorAll(".site-card")) {
      const st = health[card.dataset.url];
      const dot = card.querySelector(".card-health");
      const note = card.querySelector(".card-note");
      if (!st || !dot) continue;

      dot.hidden = false;
      dot.dataset.state = st.state;
      dot.title = healthText(st);

      /* 5xx · 연결 실패 → 슬립 가능성 안내 */
      const sleeping = st.state === "bad" || /^5\d\d/.test(String(st.status || ""));
      if (note) {
        note.hidden = !sleeping;
        note.textContent = sleeping
          ? "지금 응답이 없어요 · 첫 접속에 30초쯤 걸릴 수 있습니다"
          : "";
      }
    }
  }

  async function loadHealth() {
    try {
      const res = await fetch(`health.json?v=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (!data || typeof data !== "object" || !data.sites) return;
      health = data.sites;
      healthAt = data.checkedAt || "";
      applyHealth();
    } catch {
      /* file:// · 오프라인 — 상태 표시 없이 그대로 동작 */
    }
  }

  /* ---------- 이벤트 ---------- */

  searchEl.addEventListener("input", () => {
    query = searchEl.value;
    render();
    writeUrlState(false);
  });

  window.addEventListener("popstate", () => {
    const params = new URLSearchParams(location.search);
    const g = params.get("g");
    query = params.get("q") || "";
    activeGroup = g && (g === BOOKMARK_GROUP || groupNames().includes(g)) ? g : DEFAULT_GROUP;
    searchEl.value = query;
    render();
  });

  searchEl.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      searchEl.value = "";
      query = "";
      render();
      writeUrlState(false);
      searchEl.blur();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== searchEl) {
      e.preventDefault();
      searchEl.focus();
    }
  });

  /* 카드 사이 키보드 이동 (← → ↑ ↓ · Home · End) */
  gridEl.addEventListener("keydown", (e) => {
    const moves = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"];
    if (!moves.includes(e.key)) return;

    const cards = [...gridEl.querySelectorAll(".site-card")];
    const current = cards.indexOf(document.activeElement);
    if (current < 0) return;

    const columns = Math.max(
      1,
      getComputedStyle(gridEl).gridTemplateColumns.split(" ").filter(Boolean).length
    );

    let next = current;
    if (e.key === "ArrowRight") next = Math.min(cards.length - 1, current + 1);
    else if (e.key === "ArrowLeft") next = Math.max(0, current - 1);
    else if (e.key === "ArrowDown") next = Math.min(cards.length - 1, current + columns);
    else if (e.key === "ArrowUp") next = Math.max(0, current - columns);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = cards.length - 1;

    if (next !== current && cards[next]) {
      e.preventDefault();
      cards[next].focus();
    }
  });

  readUrlState();
  renderAccount();
  buildGroups();
  render();
  loadHealth();
})();
