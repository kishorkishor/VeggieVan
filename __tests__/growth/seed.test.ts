import { describe, expect, it, vi } from "vitest";

import { EXPERIMENTS, assignVariant, type ExperimentKey } from "@/lib/growth/experiments";
import { buildGrowthDemoRows, replaceGrowthDemoRows } from "@/prisma/seed";

const ANCHOR = new Date("2026-07-19T00:00:00.000Z");
const FORBIDDEN_CUSTOMER_FIELDS = /customer|email|address|phone|userAgent|ipAddress/i;

function exposureSummary(rows: ReturnType<typeof buildGrowthDemoRows>) {
  return Object.fromEntries(
    Object.keys(EXPERIMENTS).map((experiment) => {
      const exposures = rows.exposures.filter((row) => row.experiment === experiment);
      return [experiment, {
        count: exposures.length,
        variants: {
          control: exposures.filter((row) => row.variant === "control").length,
          treatment: exposures.filter((row) => row.variant === "treatment").length,
        },
      }];
    }),
  );
}

describe("buildGrowthDemoRows", () => {
  it("builds identical anonymous rows, IDs, event counts, and variant distributions", () => {
    const first = buildGrowthDemoRows(ANCHOR);
    const second = buildGrowthDemoRows(ANCHOR);

    expect(second).toEqual(first);
    expect(second.sessions.map(({ id }) => id)).toEqual(first.sessions.map(({ id }) => id));
    expect(second.events.map(({ id }) => id)).toEqual(first.events.map(({ id }) => id));
    expect(second.exposures.map(({ id }) => id)).toEqual(first.exposures.map(({ id }) => id));
    expect(second.events.length).toBe(first.events.length);
    expect(exposureSummary(second)).toEqual(exposureSummary(first));
  });

  it("creates at least 240 deterministically assigned exposures per experiment", () => {
    const rows = buildGrowthDemoRows(ANCHOR);
    const summary = exposureSummary(rows);

    for (const experiment of Object.keys(EXPERIMENTS) as ExperimentKey[]) {
      expect(summary[experiment].count).toBeGreaterThanOrEqual(240);
      expect(summary[experiment].variants.control).toBeGreaterThanOrEqual(100);
      expect(summary[experiment].variants.treatment).toBeGreaterThanOrEqual(100);

      for (const exposure of rows.exposures.filter((row) => row.experiment === experiment)) {
        expect(exposure.version).toBe(EXPERIMENTS[experiment].version);
        expect(exposure.variant).toBe(assignVariant(exposure.sessionId, experiment));
      }
    }
  });

  it("marks every persisted row as demo data and contains no customer fields", () => {
    const rows = buildGrowthDemoRows(ANCHOR);
    const persistedRows = [...rows.sessions, ...rows.events, ...rows.exposures];

    expect(persistedRows.length).toBeGreaterThan(0);
    expect(persistedRows.every((row) => row.demo === true)).toBe(true);

    for (const row of persistedRows) {
      expect(Object.keys(row).some((key) => FORBIDDEN_CUSTOMER_FIELDS.test(key))).toBe(false);
    }
  });

  it("gives every event and exposure deterministic server-received chronology", () => {
    const rows = buildGrowthDemoRows(ANCHOR);

    expect(rows.events.every((row) => row.receivedAt instanceof Date)).toBe(true);
    expect(rows.exposures.every((row) => row.receivedAt instanceof Date)).toBe(true);
    expect(rows.events.every((row) =>
      new Date(row.receivedAt!).getTime() === new Date(row.occurredAt).getTime())).toBe(true);
    expect(rows.exposures.every((row) =>
      new Date(row.receivedAt!).getTime() === new Date(row.exposedAt).getTime())).toBe(true);
  });
});

describe("replaceGrowthDemoRows", () => {
  function databaseWithTransaction(mixedSession: { id: string } | null = null) {
    const tx = {
      growthEvent: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      experimentExposure: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      growthSession: {
        findFirst: vi.fn().mockResolvedValue(mixedSession),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const database = {
      $transaction: vi.fn(async (operation: (transaction: typeof tx) => Promise<void>) => {
        await operation(tx);
      }),
    };
    return { database, tx };
  }

  it("replaces only demo-labeled analytics inside one transaction", async () => {
    const rows = buildGrowthDemoRows(ANCHOR);
    const { database, tx } = databaseWithTransaction();

    await replaceGrowthDemoRows(database, rows);

    expect(database.$transaction).toHaveBeenCalledOnce();
    expect(tx.growthEvent.deleteMany).toHaveBeenCalledWith({ where: { demo: true } });
    expect(tx.experimentExposure.deleteMany).toHaveBeenCalledWith({ where: { demo: true } });
    expect(tx.growthSession.deleteMany).toHaveBeenCalledWith({ where: { demo: true } });
    expect(tx.growthSession.createMany).toHaveBeenCalledWith({ data: rows.sessions });
    expect(tx.experimentExposure.createMany).toHaveBeenCalledWith({ data: rows.exposures });
    expect(tx.growthEvent.createMany).toHaveBeenCalledWith({ data: rows.events });
  });

  it("refuses cleanup when a demo session owns non-demo analytics", async () => {
    const rows = buildGrowthDemoRows(ANCHOR);
    const { database, tx } = databaseWithTransaction({ id: "mixed_session" });

    await expect(replaceGrowthDemoRows(database, rows)).rejects.toThrow(
      "Refusing to replace demo growth data",
    );
    expect(tx.growthEvent.deleteMany).not.toHaveBeenCalled();
    expect(tx.experimentExposure.deleteMany).not.toHaveBeenCalled();
    expect(tx.growthSession.deleteMany).not.toHaveBeenCalled();
  });
});
