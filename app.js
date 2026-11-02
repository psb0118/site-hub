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

  const ALL = "전체";
  let activeGroup = ALL;
  let query = "";

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
      img.alt = `${site.name} 미리보기`;
      img.loading = "lazy";
      img.decoding = "async";

      const show = () => thumb.classList.add("has-image");
      const hide = () => { thumb.classList.remove("has-image"); img.remove(); };
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
    card.style.setProperty("--accent", accent);
    card.style.setProperty("--accent-soft", withAlpha(accent, 0.22));
    card.style.setProperty("--accent-faint", withAlpha(accent, 0.1));
    card.setAttribute(
      "aria-label",
      `${site.name}${site.desc ? " — " + site.desc : ""}${external ? " (새 탭에서 열림)" : ""}`
    );

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
    top.append(icon, title);

    /* 설명 */
    const desc = document.createElement("p");
    desc.className = "card-desc";
    desc.textContent = site.desc || "";

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
    go.innerHTML = external
      ? '새 탭 <span class="card-ext">외부</span> ↗'
      : "이동 →";

    foot.append(tags, go);

    body.append(top, desc, foot);
    card.append(buildThumb(site), body);
    return card;
  }

  /* ---------- 카테고리 칩 ---------- */

  function groupNames() {
    const names = [];
    for (const s of sites) {
      const g = s.group || "기타";
      if (!names.includes(g)) names.push(g);
    }
    return [ALL, ...names];
  }

  function buildGroups() {
    groupsEl.replaceChildren();
    for (const name of groupNames()) {
      const count = name === ALL ? sites.length : sites.filter((s) => (s.group || "기타") === name).length;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip" + (name === activeGroup ? " active" : "");
      btn.setAttribute("aria-pressed", String(name === activeGroup));
      btn.dataset.group = name;
      btn.textContent = name;

      const num = document.createElement("span");
      num.className = "chip-num";
      num.textContent = String(count);
      btn.append(num);

      btn.addEventListener("click", () => {
        activeGroup = name;
        for (const chip of groupsEl.querySelectorAll(".chip")) {
          const on = chip === btn;
          chip.classList.toggle("active", on);
          chip.setAttribute("aria-pressed", String(on));
        }
        render();
      });

      groupsEl.append(btn);
    }
  }

  /* ---------- 렌더 ---------- */

  function render() {
    const q = query.trim().toLowerCase();

    const visible = sites.filter((s) => {
      const groupOk = activeGroup === ALL || (s.group || "기타") === activeGroup;
      if (!groupOk) return false;
      if (!q) return true;
      const hay = [s.name, s.desc, (s.tags || []).join(" "), s.url].join(" ").toLowerCase();
      return hay.includes(q);
    });

    gridEl.replaceChildren();
    for (const site of visible) gridEl.append(buildCard(site));

    if (sites.length === 0) {
      emptyEl.textContent = "아직 등록된 사이트가 없습니다. client/sites.js 에 사이트를 추가하세요.";
      emptyEl.classList.remove("hidden");
    } else {
      emptyEl.textContent = "조건에 맞는 사이트가 없습니다.";
      emptyEl.classList.toggle("hidden", visible.length > 0);
    }

    countEl.textContent = q || activeGroup !== ALL
      ? `${visible.length}개 표시 / 전체 ${sites.length}개`
      : `사이트 ${sites.length}개`;
  }

  /* ---------- 이벤트 ---------- */

  searchEl.addEventListener("input", () => {
    query = searchEl.value;
    render();
  });

  searchEl.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      searchEl.value = "";
      query = "";
      render();
      searchEl.blur();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== searchEl) {
      e.preventDefault();
      searchEl.focus();
    }
  });

  buildGroups();
  render();
})();
