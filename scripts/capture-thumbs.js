"use strict";

/* =========================================================
   scripts/capture-thumbs.js — 허브 카드 썸네일 자동 캡처
   ---------------------------------------------------------
   sites.js 에서 image 가 지정된 사이트를 브라우저로 열어
   1280x720 PNG 로 저장합니다.
   화면을 덮는 첫 방문 안내 모달(튜토리얼 등)은 닫은 뒤 캡처합니다.

   실행:
     npm install                      # puppeteer 포함 devDependency
     npx puppeteer browsers install chrome
     python3 -m http.server 4173      # 정적 서버를 켜둔 상태에서
     npm run thumbs                   # 이 스크립트
========================================================= */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const puppeteer = require("puppeteer");

const ROOT = path.join(__dirname, "..");
const CLIENT_DIR = ROOT;
const BASE_URL = process.env.THUMB_BASE_URL || "http://127.0.0.1:4173";
const VIEWPORT = { width: 1280, height: 720, deviceScaleFactor: 1 };
const SETTLE_MS = 1200;

function loadSites() {
  const file = path.join(CLIENT_DIR, "sites.js");
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  return (sandbox.window.HUB && sandbox.window.HUB.sites) || [];
}

/* ---------- 오버레이(첫 방문 모달) 닫기 ---------- */
/* 화면을 덮는 고정 레이어에서 닫기/건너뛰기 버튼만 눌러 썸네일이 모달로 가려지지 않게 한다. */
const DISMISS_TEXT = /^(✕|×|x|닫기|건너뛰기|skip|close|got\s*it|확인|시작하기)$/i;
const OVERLAY_SELECTOR =
  'dialog,[role="dialog"],[aria-modal="true"],[class*="modal" i],[class*="overlay" i],[class*="popup" i]';

async function dismissOverlays(page) {
  for (let round = 0; round < 3; round += 1) {
    const found = await page.evaluate(
      ({ selector, pattern }) => {
        const re = new RegExp(pattern, "i");
        const visible = (el) => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return (
            r.width > 60 &&
            r.height > 40 &&
            s.display !== "none" &&
            s.visibility !== "hidden" &&
            Number(s.opacity) > 0.05
          );
        };
        const overlays = [...document.querySelectorAll(selector)].filter((el) => {
          const s = getComputedStyle(el);
          return (
            visible(el) &&
            (s.position === "fixed" || s.position === "absolute") &&
            Number(s.zIndex) >= 100
          );
        });
        if (!overlays.length) return { overlays: 0, acted: false };

        for (const root of overlays) {
          const controls = [...root.querySelectorAll('button,[role="button"],a')].filter(visible);
          const pick =
            controls.find((el) => /close/i.test(String(el.className))) ||
            controls.find((el) => /닫기|close/i.test(el.getAttribute("aria-label") || "")) ||
            controls.find((el) => re.test((el.innerText || el.textContent || "").trim()));
          if (!pick) continue;

          const label = (pick.innerText || pick.textContent || "").trim();
          const target = root.id ? `#${root.id}` : `.${String(root.className).split(" ")[0]}`;
          pick.click();
          return { overlays: overlays.length, acted: true, target, label };
        }
        return { overlays: overlays.length, acted: false };
      },
      { selector: OVERLAY_SELECTOR, pattern: DISMISS_TEXT.source }
    );

    if (found.overlays === 0) return;
    if (found.acted) {
      console.log(`[THUMB]   모달 닫기: ${found.target} ← "${found.label}"`);
      await new Promise((r) => setTimeout(r, 700));
      continue;
    }

    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 500));
  }

  const left = await page.evaluate((selector) => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return (
        r.width > 60 &&
        r.height > 40 &&
        s.display !== "none" &&
        s.visibility !== "hidden" &&
        (s.position === "fixed" || s.position === "absolute") &&
        Number(s.zIndex) >= 100
      );
    };
    return [...document.querySelectorAll(selector)].filter(visible).length;
  }, OVERLAY_SELECTOR);

  if (left > 0) console.log(`[THUMB]   경고: 닫지 못한 오버레이 ${left}개 (그대로 캡처)`);
}

async function main() {
  const targets = loadSites().filter((s) => s && s.url && s.image);
  if (!targets.length) {
    console.log("[THUMB] image 가 지정된 사이트가 없습니다. sites.js 를 확인하세요.");
    return;
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars"],
  });

  try {
    for (const site of targets) {
      const outPath = path.join(CLIENT_DIR, site.image);
      const url = new URL(site.url, BASE_URL).href;
      const page = await browser.newPage();

      try {
        await page.setViewport(VIEWPORT);
        await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
        await new Promise((r) => setTimeout(r, SETTLE_MS));

        await dismissOverlays(page);
        await new Promise((r) => setTimeout(r, 400));

        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        await page.screenshot({ path: outPath, type: "png" });

        const size = Math.round(fs.statSync(outPath).size / 1024);
        console.log(`[THUMB] ${site.name} → ${path.relative(ROOT, outPath)} (${size}KB) ${url}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("[THUMB] 실패:", err.message);
  process.exit(1);
});
