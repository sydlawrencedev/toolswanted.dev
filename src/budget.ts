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
    // Read and compare in ONE statement, so the check and the charge cannot
    // disagree.
    //
    // It used to increment the counter and then compare the result, which
    // meant a REFUSED call was still charged. Once the budget was spent the
    // counter kept climbing, so `neuronsUsed` reported a number that had
    // drifted above what had actually been spent.
    //
    // The value inserted is the estimate. It was zero, which meant the
    // counter never moved at all: the board spent Workers AI neurons
    // against a limit it was not measuring, and the daily figure stayed
    // at whatever the first day happened to leave.
    const row = await env.DB.prepare(
      `INSERT INTO neuron_budget (day, used) VALUES (?, ?)
       ON CONFLICT(day) DO UPDATE SET used = used + excluded.used
       RETURNING used`
    )
      .bind(today, estimate)
      .first<{ used: number }>();
    const used = row?.used ?? estimate;
    if (used > DAILY_LIMIT) {
      // Refused. Give the reservation back, so the counter reflects what
      // was actually spent.
      await env.DB.prepare(
        `UPDATE neuron_budget SET used = used - ? WHERE day = ? AND used > ?`
      )
        .bind(estimate, today, DAILY_LIMIT)
        .run();
      return false;
    }
    return true;
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
 *
 * The check and the charge are one statement. It used to read the counter,
 * compare it, and then charge it in a second call, which left a window
 * where two crawls could both pass the check and both spend — and where
 * background work could spend the reserve it was supposed to protect.
 */
export async function backgroundBudget(env: Env, estimate: number): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    // The estimate is the value inserted, for the same reason it is in
    // `spendNeurons`: a zero meant the background work was never counted
    // against the reserve it was supposed to be kept to.
    const row = await env.DB.prepare(
      `INSERT INTO neuron_budget (day, used) VALUES (?, ?)
       ON CONFLICT(day) DO UPDATE SET used = used + excluded.used
       RETURNING used`
    )
      .bind(today, estimate)
      .first<{ used: number }>();
    const used = row?.used ?? estimate;
    if (used > RESERVE_FOR_PRODUCT) {
      await env.DB.prepare(
        `UPDATE neuron_budget SET used = used - ? WHERE day = ? AND used > ?`
      )
        .bind(estimate, today, RESERVE_FOR_PRODUCT)
        .run();
      return false;
    }
    return true;
  } catch {
    return true;
  }
}
