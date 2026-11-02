/**
 * Daily budget for Workers AI.
 *
 * The free tier gives 10,000 neurons per day. The product (filing and
 * sanitising wishes) always gets priority; the background registry index
 * spends whatever is left. When the day runs out, both degrade gracefully
 * instead of erroring.
 */

import type { Env } from "./types";

const DAILY_LIMIT = 10_000;
const RESERVE_FOR_PRODUCT = 8_500;

export async function spendNeurons(env: Env, estimate: number): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const key = `neurons:${today}`;
  const current = Number((await env.KV.get(key)) ?? "0");
  if (current + estimate > DAILY_LIMIT) return false;
  await env.KV.put(key, String(current + estimate));
  return true;
}

export async function neuronsUsed(env: Env): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  return Number((await env.KV.get(`neurons:${today}`)) ?? "0");
}

/**
 * Budget available to background work (the registry index). Keeps a reserve
 * for the product so a crawl can never starve a wish.
 */
export async function backgroundBudget(env: Env, estimate: number): Promise<boolean> {
  const used = await neuronsUsed(env);
  if (used + estimate > RESERVE_FOR_PRODUCT) return false;
  return spendNeurons(env, estimate);
}
