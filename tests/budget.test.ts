import { describe, it, expect } from "vitest";
import { spendNeurons, neuronsUsed, backgroundBudget } from "../src/budget";
import type { Env } from "../src/types";

/**
 * The daily Workers AI neuron budget.
 *
 * The counter was not moving. The charge statement inserted zero and
 * updated by zero, so the board spent real neurons against a limit it was
 * not measuring, and the daily figure stayed at whatever the first day
 * happened to leave. That is the defect these tests exist to catch.
 *
 * A stub D1 is enough: the budget only ever runs one statement and reads
 * one number back.
 */

interface Row {
  day: string;
  used: number;
}

function stubDb(initial: Row | null) {
  const state = { row: initial, statements: [] as string[] };
  const db = {
    prepare(sql: string) {
      state.statements.push(sql);
      const isInsert = /INSERT INTO neuron_budget/.test(sql);
      const isSelect = /SELECT used/.test(sql);
      const isUpdate = /UPDATE neuron_budget SET used = used -/.test(sql);
      return {
        bind(...args: unknown[]) {
          return {
            async first() {
              if (isSelect) return state.row;
              if (!isInsert) return null;
              // Read the value the statement actually inserts, rather than
              // assuming it is the estimate. That is the whole point: the
              // bug was the statement inserting zero, so a stub that adds
              // the estimate itself would hide it.
              const inserted = /VALUES \(\?, 0\)/.test(sql) ? 0 : Number(args[1]);
              const day = String(args[0]);
              state.row = state.row
                ? { day, used: state.row.used + inserted }
                : { day, used: inserted };
              return { used: state.row.used };
            },
            async run() {
              if (isUpdate) {
                const estimate = Number(args[0]);
                if (state.row) state.row.used -= estimate;
              }
              return { success: true };
            },
          };
        },
      };
    },
  };
  return { db: db as never, state };
}

const env = { DB: null } as unknown as Env;

describe("the daily neuron budget", () => {
  it("counts what it spends", async () => {
    const { db, state } = stubDb(null);
    const allowed = await spendNeurons({ ...env, DB: db } as Env, 1000);
    expect(allowed).toBe(true);
    expect(state.row?.used).toBe(1000);
  });

  it("counts what it spends against an existing day", async () => {
    const { db, state } = stubDb({ day: "2026-11-03", used: 4227 });
    await spendNeurons({ ...env, DB: db } as Env, 1300);
    expect(state.row?.used).toBe(5527);
  });

  it("reports what it has spent", async () => {
    const { db } = stubDb({ day: "2026-11-03", used: 4227 });
    const used = await neuronsUsed({ ...env, DB: db } as Env);
    expect(used).toBe(4227);
  });

  it("refuses once the limit is passed", async () => {
    // 10,000 is the daily limit.
    const { db, state } = stubDb({ day: "2026-11-03", used: 9900 });
    const allowed = await spendNeurons({ ...env, DB: db } as Env, 200);
    expect(allowed).toBe(false);
  });

  it("gives the reservation back when it refuses", async () => {
    const { db, state } = stubDb({ day: "2026-11-03", used: 9900 });
    await spendNeurons({ ...env, DB: db } as Env, 200);
    // The counter reflects what was actually spent, not what was reserved.
    expect(state.row?.used).toBe(9900);
  });

  it("counts the background work against the reserve too", async () => {
    const { db, state } = stubDb({ day: "2026-11-03", used: 4000 });
    const allowed = await backgroundBudget({ ...env, DB: db } as Env, 300);
    expect(allowed).toBe(true);
    expect(state.row?.used).toBe(4300);
  });

  it("stops the background work at the reserve", async () => {
    // 8,500 is the reserve held for the product.
    const { db } = stubDb({ day: "2026-11-03", used: 8400 });
    const allowed = await backgroundBudget({ ...env, DB: db } as Env, 300);
    expect(allowed).toBe(false);
  });

  it("inserts the estimate rather than zero", async () => {
    // The regression itself: the statement inserted zero, so the counter
    // never moved however much was spent.
    const { db, state } = stubDb(null);
    await spendNeurons({ ...env, DB: db } as Env, 777);
    expect(state.row?.used).toBe(777);
    expect(state.row?.used).not.toBe(0);
  });
});
