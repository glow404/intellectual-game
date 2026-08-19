import { env } from "cloudflare:workers";
import { applyAction, createGame, joinGame, makeRoomCode, type InternalGame, viewFor } from "@/lib/game";
import { currentAccount } from "@/lib/auth";

type RoomRow = { state_json: string; version: number };

async function ensureSchema() {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS game_rooms (
      code TEXT PRIMARY KEY NOT NULL,
      state_json TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_game_rooms_updated_at ON game_rooms(updated_at)"),
  ]);
}

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function normalizeCode(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

async function readGame(code: string) {
  const row = await env.DB.prepare("SELECT state_json, version FROM game_rooms WHERE code = ?")
    .bind(code)
    .first<RoomRow>();
  if (!row) throw new Error("找不到这个房间");
  return { game: JSON.parse(row.state_json) as InternalGame, version: row.version };
}

async function mutateGame(code: string, mutate: (game: InternalGame) => void) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { game, version } = await readGame(code);
    mutate(game);
    const now = Date.now();
    game.updatedAt = now;
    const result = await env.DB.prepare(
      "UPDATE game_rooms SET state_json = ?, version = version + 1, updated_at = ? WHERE code = ? AND version = ?",
    ).bind(JSON.stringify(game), now, code, version).run();
    if ((result.meta.changes ?? 0) === 1) return game;
  }
  throw new Error("房间刚刚发生变化，请再试一次");
}

async function createRoom(name: string, mode: "online" | "npc") {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = makeRoomCode();
    const playerId = crypto.randomUUID();
    const game = createGame(code, name, mode, playerId);
    try {
      await env.DB.prepare(
        "INSERT INTO game_rooms (code, state_json, version, created_at, updated_at) VALUES (?, ?, 1, ?, ?)",
      ).bind(code, JSON.stringify(game), Date.now(), Date.now()).run();
      return { game, playerId };
    } catch (error) {
      if (attempt === 7) throw error;
    }
  }
  throw new Error("暂时无法创建房间");
}

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const url = new URL(request.url);
    const code = normalizeCode(url.searchParams.get("code"));
    const playerId = url.searchParams.get("playerId") ?? "";
    if (!code || !playerId) return jsonError("缺少房间信息");
    const { game } = await readGame(code);
    return Response.json({ game: viewFor(game, playerId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取房间失败";
    return jsonError(message, message === "找不到这个房间" ? 404 : 400);
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "npc") {
      const { game, playerId } = await createRoom(String(body.name ?? "游客"), "npc");
      return Response.json({ playerId, game: viewFor(game, playerId) });
    }

    if (action === "create") {
      const account = await currentAccount(request);
      if (!account) return jsonError("在线对战需要先用邮箱登录", 401);
      const { game, playerId } = await createRoom(String(body.name ?? account.displayName), "online");
      return Response.json({ playerId, game: viewFor(game, playerId) });
    }

    if (action === "join") {
      const account = await currentAccount(request);
      if (!account) return jsonError("在线对战需要先用邮箱登录", 401);
      const code = normalizeCode(body.code);
      const playerId = crypto.randomUUID();
      if (code.length !== 6) return jsonError("请输入 6 位房间码");
      const game = await mutateGame(code, (current) => joinGame(current, String(body.name ?? account.displayName), playerId));
      return Response.json({ playerId, game: viewFor(game, playerId) });
    }

    const code = normalizeCode(body.code);
    const playerId = String(body.playerId ?? "");
    if (!code || !playerId) return jsonError("缺少房间信息");
    const game = await mutateGame(code, (current) => applyAction(current, playerId, action, body));
    return Response.json({ game: viewFor(game, playerId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "操作失败，请重试";
    return jsonError(message, message === "找不到这个房间" ? 404 : 400);
  }
}
