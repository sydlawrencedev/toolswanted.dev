/**
 * GitHub OAuth for builders. Hand rolled on purpose: no Passport, no
 * database of sessions, just a signed cookie.
 */

import type { Env } from "./types";

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return new Uint8Array(sig);
}

export interface Session {
  login: string;
  id: number;
  exp: number;
  admin?: boolean;
  /** For OAuth state tokens: where to send the user after login. */
  next?: string;
}

export async function signSession(session: Session, secret: string): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify(session)));
  const sig = b64url(await hmac(secret, payload));
  return `${payload}.${sig}`;
}

export async function verifySession(token: string | undefined, secret: string): Promise<Session | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = b64url(await hmac(secret, payload!));
  if (sig !== expected) return null;
  try {
    const session = JSON.parse(new TextDecoder().decode(b64urlDecode(payload!))) as Session;
    if (!session.exp || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function sessionSecret(env: Env): string {
  return env.SESSION_SECRET ?? env.GITHUB_CLIENT_SECRET ?? env.ADMIN_TOKEN ?? "toolswanted-dev";
}

export function sessionCookie(token: string, maxAge = 60 * 60 * 24 * 30): string {
  return `tw_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearCookie(): string {
  return "tw_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

/**
 * Read the session cookie from a request.
 *
 * A session with no login is not a session.
 *
 * The pending-claim cookie the server hands to every anonymous visitor
 * who starts a claim is signed in exactly this format, with exactly this
 * secret, and carries `login: ""` because there is no builder yet. It is
 * a different cookie name, so it is not read here — but a token is a
 * token, and if a caller can put one in `tw_session` it must not become
 * a signed-in builder. The routes that trust the login (claim, ship)
 * would otherwise accept it.
 *
 * The admin session carries `login: "admin"`, so it still passes.
 */
export async function readSession(env: Env, request: Request): Promise<Session | null> {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)tw_session=([^;]+)/);
  const session = await verifySession(match?.[1], sessionSecret(env));
  if (!session) return null;
  if (!session.login) return null;
  return session;
}

export async function getSessionCookieValue(request: Request): Promise<string | undefined> {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.match(/(?:^|;\s*)tw_session=([^;]+)/)?.[1];
}

export interface GitHubUser {
  id: number;
  login: string;
  avatar_url?: string;
}

/** Exchange an OAuth code for a token and fetch the user. */
export async function completeGitHubLogin(
  env: Env,
  code: string,
  redirectUri: string
): Promise<GitHubUser | null> {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) return null;

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenJson.access_token) return null;

  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      authorization: `Bearer ${tokenJson.access_token}`,
      accept: "application/vnd.github+json",
      "user-agent": "toolswanted",
    },
  });
  if (!userRes.ok) return null;
  return (await userRes.json()) as GitHubUser;
}

/** Build the GitHub authorize URL. */
export function githubAuthorizeUrl(
  env: Env,
  state: string,
  redirectUri: string
): string {
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    scope: "read:user",
    state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/** Create a signed OAuth state token that also carries the return path. */
export async function makeState(next: string, secret: string): Promise<string> {
  return signSession(
    { login: "", id: 0, exp: Date.now() + 10 * 60 * 1000, next },
    secret
  );
}

export async function readState(state: string | null, secret: string): Promise<string | null> {
  if (!state) return null;
  const session = await verifySession(state, secret);
  if (!session) return null;
  return session.next || "/";
}
