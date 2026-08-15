import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    product: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  updateProductAction,
  resetProductAction,
  resetAllProductsAction,
} from "@/lib/products/actions";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { PRODUCTS } from "@/data/products";

const mockAuth = vi.mocked(auth);
const mockUpdate = vi.mocked(prisma.product.update);

const asAdmin = () => mockAuth.mockResolvedValue({ user: { role: "admin" } } as never);
const asStaff = () => mockAuth.mockResolvedValue({ user: { role: "staff" } } as never);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateProductAction", () => {
  it("rejects staff before touching the DB", async () => {
    asStaff();
    const res = await updateProductAction({ id: "p01", patch: { stock: 5 } });
    expect(res).toEqual({ ok: false, error: "Admin only" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated caller", async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await updateProductAction({ id: "p01", patch: { stock: 5 } });
    expect(res).toEqual({ ok: false, error: "Admin only" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects an empty patch", async () => {
    asAdmin();
    const res = await updateProductAction({ id: "p01", patch: {} });
    expect(res).toEqual({ ok: false, error: "Invalid patch" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects negative stock and price", async () => {
    asAdmin();
    expect(
      (await updateProductAction({ id: "p01", patch: { stock: -1 } })).ok
    ).toBe(false);
    expect(
      (await updateProductAction({ id: "p01", patch: { price: -100 } })).ok
    ).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("passes a valid patch through for admin", async () => {
    asAdmin();
    mockUpdate.mockResolvedValue({} as never);
    const res = await updateProductAction({
      id: "p01",
      patch: { stock: 12, featured: true },
    });
    expect(res).toEqual({ ok: true });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "p01" },
      data: { stock: 12, featured: true },
    });
  });
});

describe("resetProductAction", () => {
  it("is admin-gated", async () => {
    asStaff();
    const res = await resetProductAction("p01");
    expect(res).toEqual({ ok: false, error: "Admin only" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects ids not present in the seed", async () => {
    asAdmin();
    const res = await resetProductAction("nope");
    expect(res).toEqual({ ok: false, error: "Unknown product" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("resets a known product to its seed values", async () => {
    asAdmin();
    mockUpdate.mockResolvedValue({} as never);
    const seed = PRODUCTS.find((p) => p.id === "p01")!;
    const res = await resetProductAction("p01");
    expect(res).toEqual({ ok: true });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "p01" },
      data: {
        stock: seed.stock,
        price: seed.price,
        organic: seed.organic,
        featured: seed.featured ?? false,
        inSeason: seed.inSeason,
      },
    });
  });
});

describe("resetAllProductsAction", () => {
  it("is admin-gated", async () => {
    asStaff();
    const res = await resetAllProductsAction();
    expect(res).toEqual({ ok: false, error: "Admin only" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("resets the whole seed in one transaction and reports the count", async () => {
    asAdmin();
    vi.mocked(prisma.$transaction).mockResolvedValue([] as never);
    const res = await resetAllProductsAction();
    expect(res).toEqual({ ok: true, count: PRODUCTS.length });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(PRODUCTS.length);
  });
});
