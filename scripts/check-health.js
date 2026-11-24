"use strict";

/* =========================================================
   scripts/check-health.js — 링크 상태·썸네일 자동 점검
   ---------------------------------------------------------
   sites.js 의 모든 항목에 대해
     1) url 접속 상태 (리다이렉트 추적, 타임아웃)
     2) image 썸네일 파일 존재 여부 · PNG 여부 · 해상도
   를 확인하고 Markdown 리포트를 만듭니다.

   외부 의존성 없음 (Node 18+ 내장 fetch 사용).

   실행:
     node scripts/check-health.js
   환경변수:
     HEALTH_TIMEOUT_MS  요청 타임아웃 (기본 20000)
     HEALTH_CONCURRENCY 동시 점검 수 (기본 4)
     STRICT_LINKS=1     링크 실패도 종료코드 1로 처리
   종료코드:
     0  정상 (링크 실패는 경고로만 기록)
     1  썸네일 누락/손상 등 저장소 자체 문제
========================================================= */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const TIMEOUT_MS = Number(process.env.HEALTH_TIMEOUT_MS || 20000);
const CONCURRENCY = Number(process.env.HEALTH_CONCURRENCY || 4);
const STRICT_LINKS = process.env.STRICT_LINKS === "1";
const REPORT_PATH = path.join(ROOT, "health-report.md");
const UA = "site-hub-health/1.0 (+https://github.com/psb0118/site-hub)";

function loadSites() {
  const code = fs.readFileSync(path.join(ROOT, "sites.js"), "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: "sites.js" });
  const hub = sandbox.window.HUB;
  if (!hub || !Array.isArray(hub.sites)) {
    throw new Error("sites.js 에서 window.HUB.sites 를 찾지 못했습니다.");
  }
  return hub.sites;
}

function checkThumb(image) {
  if (!image) return { state: "none", label: "기본 아이콘" };
  const abs = path.resolve(ROOT, image);
  if (!abs.startsWith(ROOT + path.sep)) return { state: "bad", label: "경로 이탈" };
  let buf;
  try {
    buf = fs.readFileSync(abs);
  } catch {
    return { state: "bad", label: "파일 없음" };
  }
  const isPng =
    buf.length > 24 &&
    buf.readUInt32BE(0) === 0x89504e47 &&
    buf.readUInt32BE(4) === 0x0d0a1a0a &&
    buf.slice(12, 16).toString("ascii") === "IHDR";
  if (!isPng) return { state: "bad", label: `PNG 아님 (${buf.length}B)` };
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  const kb = Math.round(buf.length / 1024);
  const small = w < 640 || h < 360;
  return { state: small ? "warn" : "ok", label: `${w}×${h} · ${kb}KB` };
}

async function checkLink(url) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": UA, accept: "text/html,*/*;q=0.8" },
    });
    try {
      await res.body?.cancel();
    } catch {}
    const ms = Date.now() - started;
    const status = res.status;
    const finalUrl = res.url || url;
    let state = "ok";
    let note = "";
    if (status >= 500) state = "bad";
    else if (status === 429) state = "warn";
    else if (status === 401 || status === 403) state = "warn";
    else if (status >= 400) state = "bad";
    if (/^accounts\.google\.com$/.test(new URL(finalUrl).hostname)) {
      state = "warn";
      note = "로그인 필요";
    } else if (finalUrl.replace(/\/$/, "") !== url.replace(/\/$/, "")) {
      note = `→ ${finalUrl}`;
    }
    return { state, label: [String(status), note].filter(Boolean).join(" "), ms };
  } catch (err) {
    const ms = Date.now() - started;
    const name = (err && (err.name || err.code)) || "Error";
    return { state: "bad", label: `실패 (${name}, ${ms}ms)`, ms };
  }
}

function cell(text) {
  return String(text).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

const ICON = { ok: "✅", warn: "⚠️", bad: "❌", none: "—" };

async function main() {
  const sites = loadSites();
  const results = new Array(sites.length);
  let cursor = 0;

  async function worker() {
    while (cursor < sites.length) {
      const index = cursor++;
      const site = sites[index];
      results[index] = {
        site,
        link: await checkLink(site.url),
        thumb: checkThumb(site.image),
      };
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, sites.length) }, worker)
  );

  const linkOk = results.filter((r) => r.link.state === "ok").length;
  const linkWarn = results.filter((r) => r.link.state === "warn").length;
  const linkBad = results.filter((r) => r.link.state === "bad").length;
  const thumbOk = results.filter((r) => r.thumb.state === "ok").length;

  const now = new Date();
  const stamp = now.toISOString().replace("T", " ").slice(0, 16) + " UTC";

  const lines = [];
  lines.push("## 사이트 점검 결과");
  lines.push("");
  lines.push(`- 점검 시각: ${stamp}`);
  lines.push(
    `- 사이트: **${sites.length}개** · 링크 정상 **${linkOk}** / 주의 **${linkWarn}** / 실패 **${linkBad}**`
  );
  lines.push(`- 썸네일 정상: **${thumbOk} / ${sites.length}**`);
  lines.push("");
  lines.push("| # | 사이트 | 링크 | 응답 | 썸네일 |");
  lines.push("|---|---|---|---|---|");
  results.forEach((r, i) => {
    lines.push(
      `| ${i + 1} | ${cell(r.site.name)} | ${ICON[r.link.state]} | ${cell(
        r.link.label
      )} | ${ICON[r.thumb.state]} ${cell(r.thumb.label)} |`
    );
  });

  const problems = results.filter(
    (r) => r.link.state !== "ok" || r.thumb.state !== "ok" && r.thumb.state !== "none"
  );
  lines.push("");
  if (!problems.length) {
    lines.push("모든 사이트와 썸네일이 정상입니다.");
  } else {
    lines.push("### 확인이 필요한 항목");
    lines.push("");
    for (const r of problems) {
      const bits = [];
      if (r.link.state !== "ok") bits.push(`링크 ${ICON[r.link.state]} ${r.link.label}`);
      if (r.thumb.state === "bad" || r.thumb.state === "warn")
        bits.push(`썸네일 ${ICON[r.thumb.state]} ${r.thumb.label}`);
      lines.push(`- **${r.site.name}** (${r.site.url}) — ${bits.join(", ")}`);
    }
  }
  lines.push("");

  const report = lines.join("\n");
  fs.writeFileSync(REPORT_PATH, report, "utf8");
  process.stdout.write(report + "\n");

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + "\n");
  }

  for (const r of results) {
    if (r.link.state !== "ok") {
      const level = r.link.state === "bad" ? "warning" : "notice";
      process.stdout.write(
        `::${level} title=링크 ${r.link.state === "bad" ? "실패" : "주의"}::${r.site.name} — ${r.link.label}\n`
      );
    }
    if (r.thumb.state === "bad") {
      process.stdout.write(
        `::error title=썸네일 문제::${r.site.name} — ${r.site.image} (${r.thumb.label})\n`
      );
    }
  }

  const thumbBroken = results.some((r) => r.thumb.state === "bad");
  const linkBroken = linkBad > 0;
  if (thumbBroken || (STRICT_LINKS && linkBroken)) {
    process.exitCode = 1;
  }
  process.stdout.write(
    `\n요약: 링크 정상 ${linkOk}/${sites.length}, 썸네일 정상 ${thumbOk}/${sites.length}` +
      (thumbBroken ? " · 썸네일 문제로 실패" : "") +
      (STRICT_LINKS && linkBroken ? " · 링크 문제로 실패(STRICT_LINKS)" : "") +
      "\n"
  );
}

main().catch((err) => {
  process.stderr.write(`점검 스크립트 오류: ${err && err.stack ? err.stack : err}\n`);
  process.exit(2);
});
