"use strict";

/* =========================================================
   scripts/capture-thumbs.js — 허브 카드 썸네일 자동 캡처
   ---------------------------------------------------------
   client/sites.js 에서 image 가 지정된 사이트를 브라우저로 열어
   1280x720 PNG 로 저장합니다.

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
const CLIENT_DIR = path.join(ROOT, "client");
const BASE_URL = process.env.THUMB_BASE_URL || "http://127.0.0.1:4173";
const VIEWPORT = { width: 1280, height: 720, deviceScaleFactor: 1 };
const SETTLE_MS = 1200;

function loadSites() {
  const file = path.join(CLIENT_DIR, "sites.js");
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  return (sandbox.window.HUB && sandbox.window.HUB.sites) || [];
}

async function main() {
  const targets = loadSites().filter((s) => s && s.url && s.image);
  if (!targets.length) {
    console.log("[THUMB] image 가 지정된 사이트가 없습니다. client/sites.js 를 확인하세요.");
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
