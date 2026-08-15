import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    order: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    product: { findMany: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/growth/persistence", () => ({
  recordTrustedOrderCompleted: vi.fn(),
}));

import {
  placeOrderAction,
  setOrderStatusAction,
  removeOrderAction,
} from "@/lib/orders/actions";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { recordTrustedOrderCompleted } from "@/lib/growth/persistence";

const mockAuth = vi.mocked(auth);
const mockTransaction = vi.mocked(prisma.$transaction);
const recordTrustedOrderCompletedMock = vi.mocked(recordTrustedOrderCompleted);

const customer = {
  name: "Ada Lovelace",
  phone: "01712345678",
  email: "ada@example.com",
  address: "1 Analytical Way",
  zone: "Dhanmondi" as const,
  paymentMethod: "cod" as const,
};

// Simulate the interactive transaction: run the callback against a tx stub
// backed by the given product rows.
function stubTransaction(rows: { id: string; name: string; price: number }[]) {
  const tx = {
    product: {
      findMany: vi.fn().mockResolvedValue(rows),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    order: {
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve(data)),
    },
  };
  mockTransaction.mockImplementation(
    async (fn: unknown) => (fn as (t: typeof tx) => Promise<unknown>)(tx)
  );
  return tx;
}

beforeEach(() => {
  vi.clearAllMocks();
  recordTrustedOrderCompletedMock.mockResolvedValue({ accepted: true, duplicate: false });
});

describe("placeOrderAction", () => {
  it("rejects an empty items array without touching the DB", async () => {
    const res = await placeOrderAction({ customer, items: [] });
    expect(res).toEqual({ ok: false, error: "Invalid order payload" });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("rejects an invalid email without touching the DB", async () => {
    const res = await placeOrderAction({
      customer: { ...customer, email: "not-an-email" },
      items: [{ productId: "p01", qty: 1 }],
    });
    expect(res.ok).toBe(false);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("rejects non-positive and non-integer quantities", async () => {
    for (const qty of [0, -1, 1.5]) {
      const res = await placeOrderAction({
        customer,
        items: [{ productId: "p01", qty }],
      });
      expect(res.ok).toBe(false);
    }
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("prices the order from the database, not the client", async () => {
    const tx = stubTransaction([{ id: "p01", name: "Potato (Alu)", price: 4_500 }]);
    const res = await placeOrderAction({
      customer,
      items: [{ productId: "p01", qty: 2 }],
    });
    expect(res.ok).toBe(true);
    const created = tx.order.create.mock.calls[0][0].data;
    expect(created.subtotal).toBe(9_000); // ৳45 × 2
    expect(created.shipping).toBe(4_000); // flat ৳40 delivery, every order
    expect(created.total).toBe(13_000);
    expect(created.items.create).toEqual([
      { productId: "p01", name: "Potato (Alu)", qty: 2, price: 4_500 },
    ]);
  });

  it("merges duplicate product ids before checking stock", async () => {
    const tx = stubTransaction([{ id: "p01", name: "Potato (Alu)", price: 4_500 }]);
    const res = await placeOrderAction({
      customer,
      items: [
        { productId: "p01", qty: 1 },
        { productId: "p01", qty: 2 },
      ],
    });
    expect(res.ok).toBe(true);
    expect(tx.product.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: "p01", stock: { gte: 3 } },
      data: { stock: { decrement: 3 } },
    });
  });

  it("rejects unknown product ids", async () => {
    stubTransaction([]); // DB knows none of the requested ids
    const res = await placeOrderAction({
      customer,
      items: [{ productId: "ghost", qty: 1 }],
    });
    expect(res).toEqual({ ok: false, error: "Invalid product in cart" });
  });

  it("fails with an out-of-stock error when the guarded decrement matches nothing", async () => {
    const tx = stubTransaction([{ id: "p01", name: "Potato (Alu)", price: 4_500 }]);
    tx.product.updateMany.mockResolvedValue({ count: 0 });
    const res = await placeOrderAction({
      customer,
      items: [{ productId: "p01", qty: 5 }],
    });
    expect(res).toEqual({ ok: false, error: "One or more items are out of stock" });
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it("completes as a server-priced demo order when the DB is down", async () => {
    // The storefront already reads from the static catalog when Postgres is
    // unreachable, so checkout completes the same way rather than dead-ending.
    // Prices still come from the server, never from the client.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mockTransaction.mockRejectedValue(new Error("connect ECONNREFUSED"));

    const res = await placeOrderAction({
      customer,
      items: [{ productId: "p01", qty: 1 }],
    });

    expect(res.ok).toBe(true);
    expect(res).toMatchObject({ total: 4_500 + 4_000 }); // potato ৳45 + ৳40 delivery
    if (res.ok) expect(res.id).toMatch(/^demo_[a-f0-9]{12}$/);
    warnSpy.mockRestore();
  });

  it("still rejects unknown products when the DB is down", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mockTransaction.mockRejectedValue(new Error("connect ECONNREFUSED"));

    const res = await placeOrderAction({
      customer,
      items: [{ productId: "not-a-real-product", qty: 1 }],
    });

    expect(res).toEqual({ ok: false, error: "Invalid product in cart" });
    warnSpy.mockRestore();
  });

  it("records a trusted conversion after a successful order", async () => {
    stubTransaction([{ id: "p01", name: "Potato (Alu)", price: 4_500 }]);

    const result = await placeOrderAction({
      customer,
      items: [{ productId: "p01", qty: 2 }],
      growth: {
        sessionId: "sess_000000000002",
        experiments: { checkout_reassurance_v1: "treatment" },
      },
    });

    expect(result.ok).toBe(true);
    expect(recordTrustedOrderCompletedMock).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: "sess_000000000002",
      total: 13_000,
      itemCount: 2,
      experiments: { checkout_reassurance_v1: "treatment" },
    }));
  });

  it("does not fail checkout when analytics persistence fails", async () => {
    stubTransaction([{ id: "p01", name: "Potato (Alu)", price: 4_500 }]);
    recordTrustedOrderCompletedMock.mockRejectedValue(new Error("analytics unavailable"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(placeOrderAction({
      customer,
      items: [{ productId: "p01", qty: 2 }],
      growth: {
        sessionId: "sess_000000000002",
        experiments: { checkout_reassurance_v1: "treatment" },
      },
    })).resolves.toEqual(expect.objectContaining({ ok: true, total: 13_000 }));

    expect(errorSpy).toHaveBeenCalledWith("Order conversion analytics failed:", expect.any(Error));
    errorSpy.mockRestore();
  });

  it("rejects growth payloads containing checkout PII before opening a transaction", async () => {
    const result = await placeOrderAction({
      customer,
      items: [{ productId: "p01", qty: 1 }],
      growth: {
        sessionId: "sess_000000000002",
        experiments: { checkout_reassurance_v1: "treatment" },
        email: "ada@example.com",
      },
    } as never);

    expect(result).toEqual({ ok: false, error: "Invalid order payload" });
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(recordTrustedOrderCompletedMock).not.toHaveBeenCalled();
  });
});

describe("setOrderStatusAction", () => {
  it("rejects an unauthenticated caller before touching the DB", async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await setOrderStatusAction({ id: "ord_1", status: "shipped" });
    expect(res).toEqual({ ok: false, error: "Unauthorized" });
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it("rejects a session without a role", async () => {
    mockAuth.mockResolvedValue({ user: { email: "x@x" } } as never);
    const res = await setOrderStatusAction({ id: "ord_1", status: "shipped" });
    expect(res).toEqual({ ok: false, error: "Unauthorized" });
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it("rejects a status outside the enum even when authed", async () => {
    mockAuth.mockResolvedValue({ user: { role: "admin" } } as never);
    const res = await setOrderStatusAction({
      id: "ord_1",
      status: "refunded" as never,
    });
    expect(res).toEqual({ ok: false, error: "Invalid status" });
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it("allows staff to update statuses (staff manage orders by design)", async () => {
    mockAuth.mockResolvedValue({ user: { role: "staff" } } as never);
    vi.mocked(prisma.order.update).mockResolvedValue({} as never);
    const res = await setOrderStatusAction({ id: "ord_1", status: "shipped" });
    expect(res).toEqual({ ok: true });
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: "ord_1" },
      data: { status: "shipped" },
    });
  });
});

describe("removeOrderAction", () => {
  it("rejects staff before touching the DB", async () => {
    mockAuth.mockResolvedValue({ user: { role: "staff" } } as never);
    const res = await removeOrderAction("ord_1");
    expect(res).toEqual({ ok: false, error: "Admin only" });
    expect(prisma.order.delete).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated caller", async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await removeOrderAction("ord_1");
    expect(res).toEqual({ ok: false, error: "Admin only" });
    expect(prisma.order.delete).not.toHaveBeenCalled();
  });

  it("deletes for admin", async () => {
    mockAuth.mockResolvedValue({ user: { role: "admin" } } as never);
    vi.mocked(prisma.order.delete).mockResolvedValue({} as never);
    const res = await removeOrderAction("ord_1");
    expect(res).toEqual({ ok: true });
    expect(prisma.order.delete).toHaveBeenCalledWith({ where: { id: "ord_1" } });
  });
});
