import { env } from "cloudflare:workers";

export type Account = {
  id: string;
  email: string;
  displayName: string;
};

type AccountRow = {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  password_salt: string;
};

const COOKIE_NAME = "suofei_session";
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 120_000;

export async function ensureAuthSchema() {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at)"),
  ]);
}

function normalizeEmail(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("请输入有效的邮箱地址");
  }
  return email;
}

function normalizeDisplayName(value: unknown, email: string) {
  const fallback = email.split("@")[0];
  return (String(value ?? "").trim() || fallback).replace(/[<>]/g, "").slice(0, 12) || "玩家";
}

function validatePassword(value: unknown) {
  const password = String(value ?? "");
  if (password.length < 8) throw new Error("密码至少需要 8 个字符");
  if (password.length > 72) throw new Error("密码不能超过 72 个字符");
  return password;
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomToken() {
  return bytesToBase64(randomBytes(32)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function derivePassword(password: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS },
    material,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return mismatch === 0;
}

function cookieValue(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE_NAME) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function sessionCookie(token: string, request: Request, maxAge: number) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

async function createSession(userId: string, request: Request) {
  const token = randomToken();
  const tokenHash = await sha256(token);
  const now = Date.now();
  const expiresAt = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await env.DB.prepare(
    "INSERT INTO auth_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
  ).bind(tokenHash, userId, expiresAt, now).run();
  return sessionCookie(token, request, SESSION_DAYS * 24 * 60 * 60);
}

function publicAccount(row: Pick<AccountRow, "id" | "email" | "display_name">): Account {
  return { id: row.id, email: row.email, displayName: row.display_name };
}

export async function registerAccount(request: Request, input: Record<string, unknown>) {
  await ensureAuthSchema();
  const email = normalizeEmail(input.email);
  const password = validatePassword(input.password);
  const displayName = normalizeDisplayName(input.displayName, email);
  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: string }>();
  if (existing) throw new Error("这个邮箱已经注册，请直接登录");

  const salt = randomBytes(16);
  const passwordHash = await derivePassword(password, salt);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO users (id, email, display_name, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).bind(id, email, displayName, passwordHash, bytesToBase64(salt), Date.now()).run();
  const account = { id, email, displayName };
  return { account, cookie: await createSession(id, request) };
}

export async function loginAccount(request: Request, input: Record<string, unknown>) {
  await ensureAuthSchema();
  const email = normalizeEmail(input.email);
  const password = validatePassword(input.password);
  const row = await env.DB.prepare(
    "SELECT id, email, display_name, password_hash, password_salt FROM users WHERE email = ?",
  ).bind(email).first<AccountRow>();
  if (!row) throw new Error("邮箱或密码不正确");
  const actualHash = await derivePassword(password, base64ToBytes(row.password_salt));
  if (!constantTimeEqual(actualHash, row.password_hash)) throw new Error("邮箱或密码不正确");
  return { account: publicAccount(row), cookie: await createSession(row.id, request) };
}

export async function currentAccount(request: Request): Promise<Account | null> {
  await ensureAuthSchema();
  const token = cookieValue(request);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(
    `SELECT users.id, users.email, users.display_name
     FROM auth_sessions
     INNER JOIN users ON users.id = auth_sessions.user_id
     WHERE auth_sessions.token_hash = ? AND auth_sessions.expires_at > ?`,
  ).bind(tokenHash, Date.now()).first<Pick<AccountRow, "id" | "email" | "display_name">>();
  return row ? publicAccount(row) : null;
}

export async function logoutAccount(request: Request) {
  await ensureAuthSchema();
  const token = cookieValue(request);
  if (token) {
    await env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  }
  return sessionCookie("", request, 0);
}
