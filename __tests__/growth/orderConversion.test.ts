import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  conversion: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    order: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    product: { findMany: vi.fn(), updateMany: vi.fn() },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/growth/persistence", () => ({
  recordTrustedOrderCompleted: mocks.conversion,
}));

import { placeOrderAction } from "@/lib/orders/actions";

const validOrder = {
  customer: {
    name: "Ada Lovelace",
    phone: "01712345678",
    email: "ada@example.com",
    address: "1 Analytical Way",
    zone: "Dhanmondi" as const,
    paymentMethod: "cod" as const,
  },
  items: [{ productId: "p01", qty: 2 }],
  growth: {
    sessionId: "sess_000000000002",
    experiments: { checkout_reassurance_v1: "treatment" as const },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (callback: unknown) => (callback as (tx: unknown) => Promise<unknown>)({
    product: {
      findMany: vi.fn().mockResolvedValue([{ id: "p01", name: "Potato (Alu)", price: 3_500 }]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    order: {
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve(data)),
    },
  }));
  mocks.conversion.mockResolvedValue({ accepted: true, duplicate: false });
});

describe("trusted order conversion boundary", () => {
  it("starts analytics only after the secure order transaction commits", async () => {
    let committed = false;
    mocks.transaction.mockImplementationOnce(async (callback: unknown) => {
      const order = await (callback as (tx: unknown) => Promise<unknown>)({
        product: {
          findMany: vi.fn().mockResolvedValue([{ id: "p01", name: "Potato (Alu)", price: 3_500 }]),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        order: {
          create: vi.fn().mockImplementation(({ data }) => Promise.resolve(data)),
        },
      });
      committed = true;
      return order;
    });
    mocks.conversion.mockImplementation(async () => {
      expect(committed).toBe(true);
      return { accepted: true, duplicate: false };
    });

    await expect(placeOrderAction(validOrder)).resolves.toEqual(
      expect.objectContaining({ ok: true, total: 11_000 }),
    );
    expect(mocks.conversion).toHaveBeenCalledTimes(1);
  });

  it("does not attempt a conversion when no growth context is supplied", async () => {
    const orderWithoutGrowth = {
      customer: validOrder.customer,
      items: validOrder.items,
    };

    await expect(placeOrderAction(orderWithoutGrowth)).resolves.toEqual(
      expect.objectContaining({ ok: true }),
    );
    expect(mocks.conversion).not.toHaveBeenCalled();
  });

  it("rejects unregistered experiment keys before creating an order", async () => {
    const result = await placeOrderAction({
      ...validOrder,
      growth: {
        ...validOrder.growth,
        experiments: { checkout_copy_test: "treatment" },
      },
    } as never);

    expect(result).toEqual({ ok: false, error: "Invalid order payload" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
