import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Suofei lobby instead of a blank client-only loading screen", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>索菲 · 在线读心牌局<\/title>/);
  assert.match(html, /无需登录 · 和 NPC 索菲练一局/);
  assert.match(html, /邮箱登录 \/ 注册/);
  assert.doesNotMatch(html, /正在回到牌桌/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships guest NPC play plus email/password accounts for online rooms", async () => {
  const [page, styles, gameLogic, apiRoute, authRoute, authLogic, hosting, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../lib/game.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/game/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /创建在线房间/);
  assert.match(page, /和 NPC 索菲练一局/);
  assert.match(page, /不需要 ChatGPT 账号/);
  assert.match(page, /className="game-table"/);
  assert.doesNotMatch(page, /className="table"/);
  assert.match(styles, /\.game-table\s*\{[\s\S]*?display:\s*block;[\s\S]*?width:\s*100%;/);
  assert.match(page, /跟注/);
  assert.match(page, /加注/);
  assert.match(gameLogic, /a\.rank === 2 && b\.rank === 14/);
  assert.match(gameLogic, /replenishHands\(game\)/);
  assert.match(apiRoute, /CREATE TABLE IF NOT EXISTS game_rooms/);
  assert.match(apiRoute, /在线对战需要先用邮箱登录/);
  assert.match(authRoute, /registerAccount/);
  assert.match(authLogic, /PBKDF2/);
  assert.match(authLogic, /HttpOnly; SameSite=Lax/);
  assert.match(hosting, /"d1": "DB"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("keeps the selected opponent band secret and ships table ambience", async () => {
  const [page, styles, gameLogic, jazz, lofi, electronicJazz] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../lib/game.ts", import.meta.url), "utf8"),
    stat(new URL("../public/audio/jazz-table.ogg", import.meta.url)),
    stat(new URL("../public/audio/lofi-table.ogg", import.meta.url)),
    stat(new URL("../public/audio/electronic-jazz.mp3", import.meta.url)),
  ]);

  assert.match(gameLogic, /startingBands: opponentStartingBands/);
  assert.match(gameLogic, /hasPlayed: Boolean\(opponent\.played\)/);
  assert.doesNotMatch(gameLogic, /playedBand:/);
  assert.doesNotMatch(gameLogic, /handBands:/);
  assert.match(page, /仅显示本局起手数量/);
  assert.match(page, /对手暗牌/);
  assert.doesNotMatch(page, /opponent\?\.playedBand/);
  assert.match(page, /ChipStack/);
  assert.match(page, /牌桌动态 · LIVE/);
  assert.match(page, /MUSIC_TRACKS/);
  assert.match(page, /AudioContext/);
  assert.match(styles, /\.wager-spot/);
  assert.match(styles, /\.turn-badge/);
  assert.ok(jazz.size > 1_000_000);
  assert.ok(lofi.size > 1_000_000);
  assert.ok(electronicJazz.size > 1_000_000);
});
