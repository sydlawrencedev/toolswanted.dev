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
  try {
    const row = await env.DB.prepare(
      `INSERT INTO neuron_budget (day, used) VALUES (?, ?)
       ON CONFLICT(day) DO UPDATE SET used = used + excluded.used
       RETURNING used`
    )
      .bind(today, estimate)
      .first<{ used: number }>();
    const used = row?.used ?? estimate;
    return used <= DAILY_LIMIT;
  } catch {
    // If the counter is broken, let the call through: the platform enforces
    // the real limit anyway, and a broken counter should not stop the board.
    return true;
  }
}

export async function neuronsUsed(env: Env): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const row = await env.DB.prepare(`SELECT used FROM neuron_budget WHERE day = ?`)
      .bind(today)
      .first<{ used: number }>();
    return row?.used ?? 0;
  } catch {
    return 0;
  }
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
