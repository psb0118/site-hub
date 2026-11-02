"use strict";

/* =========================================================
   auth.js — Google 로그인 + Drive(appdata) 북마크 동기화 (선택)
   ---------------------------------------------------------
   아래 CLIENT_ID 를 채우면 헤더에 로그인 버튼이 나타나고,
   Drive 앱 데이터 폴더의 sitehub-bookmarks.json 과 북마크를 동기화합니다.
   비워두면 GIS 스크립트도 불러오지 않고 아무 동작도 하지 않습니다.
   (북마크는 브라우저 localStorage 에만 저장됩니다.)

   준비:
     1) Google Cloud Console → API 및 서비스 → OAuth 동의 화면 구성
     2) 사용자 인증 정보 → OAuth 클라이언트 ID → 웹 애플리케이션
     3) 승인된 JavaScript 원본: https://psb0118.github.io
        (로컬 테스트용 http://localhost:4173 도 추가)
     4) 발급된 클라이언트 ID 를 아래에 붙여넣기

   클라이언트 ID 는 공개 값이며 시크릿이 아닙니다.
   시크릿은 필요하지 않으며, 토큰은 메모리에만 보관합니다.
========================================================= */

(function () {
  const CLIENT_ID = ""; // ← OAuth 클라이언트 ID (예: "1234-abc.apps.googleusercontent.com")

  const SCOPES = "openid email profile https://www.googleapis.com/auth/drive.appdata";
  const FILE_NAME = "sitehub-bookmarks.json";
  const GIS_SRC = "https://accounts.google.com/gsi/client";
  const DRIVE = "https://www.googleapis.com/drive/v3";
  const UPLOAD = "https://www.googleapis.com/upload/drive/v3";

  const state = {
    configured: Boolean(CLIENT_ID),
    token: null,
    user: null,
    busy: false,
    error: "",
    lastSync: null,
  };

  const listeners = new Set();
  let tokenClient = null;
  let pendingResolve = null;
  let pushTimer = null;
  let queued = null;

  function status() {
    return {
      configured: state.configured,
      signedIn: Boolean(state.token),
      user: state.user,
      busy: state.busy,
      error: state.error,
      lastSync: state.lastSync,
    };
  }

  function emit() {
    const snap = status();
    for (const fn of listeners) {
      try {
        fn(snap);
      } catch {
        /* 리스너 오류가 UI 를 막지 않게 */
      }
    }
  }

  function onStatus(fn) {
    listeners.add(fn);
    try {
      fn(status());
    } catch {
      /* 첫 호출 오류 무시 */
    }
  }

  /* ---------- Google Identity Services ---------- */

  function loadGis() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      return Promise.resolve();
    }
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      return new Promise((resolve, reject) => {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("GIS 로드 실패")));
      });
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("로그인 스크립트를 불러오지 못했습니다"));
      document.head.append(script);
    });
  }

  async function ensureClient() {
    if (tokenClient) return tokenClient;
    await loadGis();
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (resp) => {
        const resolve = pendingResolve;
        pendingResolve = null;
        if (resolve) resolve(resp);
      },
    });
    return tokenClient;
  }

  async function fetchUser(token) {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`프로필 조회 실패 (${res.status})`);
    const data = await res.json();
    return { name: data.name || data.email || "사용자", email: data.email || "" };
  }

  async function signIn() {
    if (!state.configured || state.busy) return false;
    state.busy = true;
    state.error = "";
    emit();

    try {
      const client = await ensureClient();
      const resp = await new Promise((resolve) => {
        pendingResolve = resolve;
        client.requestAccessToken();
      });

      if (!resp || !resp.access_token) {
        throw new Error(
          resp && resp.error === "access_denied"
            ? "로그인이 취소되었습니다"
            : "로그인에 실패했습니다"
        );
      }

      state.token = resp.access_token;
      state.user = await fetchUser(resp.access_token);
      return true;
    } catch (err) {
      state.token = null;
      state.user = null;
      state.error = err.message || "로그인 실패";
      return false;
    } finally {
      state.busy = false;
      emit();
    }
  }

  function signOut() {
    const token = state.token;
    state.token = null;
    state.user = null;
    state.error = "";
    state.lastSync = null;
    emit();

    if (token && window.google && window.google.accounts && window.google.accounts.oauth2) {
      try {
        window.google.accounts.oauth2.revoke(token, () => {});
      } catch {
        /* 무시 */
      }
    }
  }

  /* ---------- Drive 앱 데이터 폴더 ---------- */

  async function findFile() {
    const q = encodeURIComponent(`name='${FILE_NAME}'`);
    const res = await fetch(
      `${DRIVE}/files?spaces=appDataFolder&fields=files(id,modifiedTime)&q=${q}`,
      { headers: { Authorization: `Bearer ${state.token}` } }
    );
    if (!res.ok) throw new Error(`Drive 목록 실패 (${res.status})`);
    const data = await res.json();
    return (data.files && data.files[0]) || null;
  }

  async function pull() {
    if (!state.token) return null;
    const file = await findFile();
    if (!file) return [];

    const res = await fetch(`${DRIVE}/files/${file.id}?alt=media`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    if (!res.ok) throw new Error(`Drive 읽기 실패 (${res.status})`);

    const data = await res.json();
    const list = Array.isArray(data) ? data : data && data.bookmarks;
    return Array.isArray(list) ? list.filter((u) => typeof u === "string") : [];
  }

  async function writeMedia(fileId, text) {
    const res = await fetch(`${UPLOAD}/files/${fileId}?uploadType=media`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${state.token}`,
        "Content-Type": "application/json",
      },
      body: text,
    });
    if (!res.ok) throw new Error(`Drive 저장 실패 (${res.status})`);
  }

  async function flush() {
    if (!state.token || !queued) return;
    const list = queued;
    queued = null;

    try {
      const text = JSON.stringify({
        version: 1,
        updatedAt: new Date().toISOString(),
        bookmarks: list,
      });

      const file = await findFile();
      if (file) {
        await writeMedia(file.id, text);
      } else {
        const res = await fetch(`${DRIVE}/files`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${state.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: FILE_NAME, parents: ["appDataFolder"] }),
        });
        if (!res.ok) throw new Error(`Drive 생성 실패 (${res.status})`);
        const created = await res.json();
        await writeMedia(created.id, text);
      }

      state.lastSync = new Date();
      state.error = "";
    } catch (err) {
      state.error = err.message || "동기화 실패";
    } finally {
      emit();
    }
  }

  function push(bookmarks) {
    if (!state.token || !Array.isArray(bookmarks)) return;
    queued = bookmarks.slice();
    clearTimeout(pushTimer);
    pushTimer = setTimeout(flush, 800);
  }

  window.HUB_AUTH = {
    onStatus,
    signIn,
    signOut,
    pull,
    push,
    isSignedIn: () => Boolean(state.token),
  };
})();
