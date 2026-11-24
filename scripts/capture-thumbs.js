"use strict";

/* =========================================================
   scripts/capture-thumbs.js — 허브 카드 썸네일 자동 캡처
   ---------------------------------------------------------
   sites.js 에서 image 가 지정된 사이트를 브라우저로 열어
   1280×720 WebP 와 640px 사본(-640.webp)을 저장합니다.
   화면을 덮는 첫 방문 안내 모달(튜토리얼 등)은 닫은 뒤 캡처합니다.

   실행:
     npm install                      # puppeteer 포함 devDependency
     npx puppeteer browsers install chrome
     python3 -m http.server 4173      # 정적 서버를 켜둔 상태에서
     npm run thumbs                   # 이 스크립트
     THUMB_ONLY=silence npm run thumbs   # 이름·파일명에 silence 가 들어간 카드만
========================================================= */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const puppeteer = require("puppeteer");

const ROOT = path.join(__dirname, "..");
const CLIENT_DIR = ROOT;
const BASE_URL = process.env.THUMB_BASE_URL || "http://127.0.0.1:4173";
const VIEWPORT = { width: 1280, height: 720, deviceScaleFactor: 1 };
/* THUMB_ONLY=값 → 이름 또는 image 경로에 값이 들어간 사이트만 캡처 (대소문자 무시) */
const ONLY = (process.env.THUMB_ONLY || "").trim().toLowerCase();
const SETTLE_MS = 1200;

function loadSites() {
  const file = path.join(CLIENT_DIR, "sites.js");
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  return (sandbox.window.HUB && sandbox.window.HUB.sites) || [];
}

/* PNG 버퍼 → WebP (width 미지정 시 원본 크기) */
async function toWebp(browser, png, width) {
  const page = await browser.newPage();
  try {
    const data = await page.evaluate(
      async ({ b64, width }) => {
        const img = new Image();
        img.src = "data:image/png;base64," + b64;
        await img.decode();
        const w = width || img.naturalWidth;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = Math.round((img.naturalHeight / img.naturalWidth) * w);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/webp", 0.86).split(",")[1];
      },
      { b64: Buffer.from(png).toString("base64"), width }
    );
    return Buffer.from(data, "base64");
  } finally {
    await page.close();
  }
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
  const all = loadSites().filter((s) => s && s.url && s.image);
  const targets = ONLY
    ? all.filter((s) => `${s.name} ${s.image}`.toLowerCase().includes(ONLY))
    : all;
  if (!targets.length) {
    const why = ONLY
      ? `THUMB_ONLY="${process.env.THUMB_ONLY}" 와 일치하는 사이트가 없습니다.`
      : "image 가 지정된 사이트가 없습니다. sites.js 를 확인하세요.";
    console.log(
      `[THUMB] ${why}` + (ONLY ? `\n[THUMB] 캡처 가능: ${all.map((s) => s.image).join(", ")}` : "")
    );
    return;
  }
  console.log(`[THUMB] 대상 ${targets.length}개${ONLY ? ` (THUMB_ONLY=${process.env.THUMB_ONLY})` : ""}`);

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
        try {
          await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
        } catch (err) {
          /* 폴링·소켓 등으로 네트워크가 멈추지 않는 사이트 — 화면은 이미 떠 있으므로 그대로 캡처 */
          if (!/timeout/i.test(err.message)) throw err;
          console.log("[THUMB]   네트워크 유휴 대기 초과 — 현재 화면으로 캡처");
        }
        await new Promise((r) => setTimeout(r, SETTLE_MS));

        await dismissOverlays(page);
        await new Promise((r) => setTimeout(r, 400));

        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        const png = await page.screenshot({ type: "png" });

        const big = await toWebp(browser, png, null);
        fs.writeFileSync(outPath, big);
        const size = Math.round(big.length / 1024);

        let extra = "";
        if (/\.webp$/i.test(outPath)) {
          const compactPath = outPath.replace(/\.webp$/i, "-640.webp");
          const compact = await toWebp(browser, png, 640);
          fs.writeFileSync(compactPath, compact);
          extra = ` + ${path.relative(ROOT, compactPath)} (${Math.round(compact.length / 1024)}KB)`;
        } else {
          extra = " (image 경로가 .webp 가 아니어서 640 사본을 만들지 않았습니다)";
        }

        console.log(
          `[THUMB] ${site.name} → ${path.relative(ROOT, outPath)} (${size}KB)${extra} ${url}`
        );
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
