import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  createUserAction,
  setUserRoleAction,
  deleteUserAction,
} from "@/lib/users/actions";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

const mockAuth = vi.mocked(auth);
const user = vi.mocked(prisma.user);

const asAdmin = (email = "admin@veggievan.local") =>
  mockAuth.mockResolvedValue({ user: { role: "admin", email } } as never);
const asStaff = () =>
  mockAuth.mockResolvedValue({ user: { role: "staff", email: "staff@veggievan.local" } } as never);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createUserAction", () => {
  const input = {
    name: "New Person",
    email: "New.Person@VeggieVan.local",
    password: "longenough",
    role: "staff" as const,
  };

  it("is admin-gated", async () => {
    asStaff();
    const res = await createUserAction(input);
    expect(res).toEqual({ ok: false, error: "Admin only" });
    expect(user.create).not.toHaveBeenCalled();
  });

  it("rejects short passwords", async () => {
    asAdmin();
    const res = await createUserAction({ ...input, password: "short" });
    expect(res.ok).toBe(false);
    expect(user.create).not.toHaveBeenCalled();
  });

  it("normalizes the email and stores a bcrypt hash, never the password", async () => {
    asAdmin();
    user.create.mockResolvedValue({} as never);
    const res = await createUserAction(input);
    expect(res).toEqual({ ok: true });
    const data = user.create.mock.calls[0][0].data;
    expect(data.email).toBe("new.person@veggievan.local");
    expect(data.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(data.passwordHash).not.toContain("longenough");
    expect(data).not.toHaveProperty("password");
  });

  it("maps unique-email violations to a friendly error", async () => {
    asAdmin();
    user.create.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    const res = await createUserAction(input);
    expect(res).toEqual({ ok: false, error: "A user with that email already exists" });
  });
});

describe("setUserRoleAction", () => {
  it("is admin-gated", async () => {
    asStaff();
    const res = await setUserRoleAction({ id: "u1", role: "admin" });
    expect(res).toEqual({ ok: false, error: "Admin only" });
    expect(user.update).not.toHaveBeenCalled();
  });

  it("refuses to change your own role (matched by email)", async () => {
    asAdmin("me@veggievan.local");
    user.findUnique.mockResolvedValue({
      id: "u1",
      email: "me@veggievan.local",
      role: "admin",
    } as never);
    const res = await setUserRoleAction({ id: "u1", role: "staff" });
    expect(res).toEqual({ ok: false, error: "You cannot change your own role" });
    expect(user.update).not.toHaveBeenCalled();
  });

  it("refuses to demote the last admin", async () => {
    asAdmin();
    user.findUnique.mockResolvedValue({
      id: "u2",
      email: "other@veggievan.local",
      role: "admin",
    } as never);
    user.count.mockResolvedValue(1);
    const res = await setUserRoleAction({ id: "u2", role: "staff" });
    expect(res).toEqual({ ok: false, error: "Cannot demote the last admin" });
    expect(user.update).not.toHaveBeenCalled();
  });

  it("demotes an admin when another admin remains", async () => {
    asAdmin();
    user.findUnique.mockResolvedValue({
      id: "u2",
      email: "other@veggievan.local",
      role: "admin",
    } as never);
    user.count.mockResolvedValue(2);
    user.update.mockResolvedValue({} as never);
    const res = await setUserRoleAction({ id: "u2", role: "staff" });
    expect(res).toEqual({ ok: true });
    expect(user.update).toHaveBeenCalledWith({
      where: { id: "u2" },
      data: { role: "staff" },
    });
  });
});

describe("deleteUserAction", () => {
  it("is admin-gated", async () => {
    asStaff();
    const res = await deleteUserAction("u1");
    expect(res).toEqual({ ok: false, error: "Admin only" });
    expect(user.delete).not.toHaveBeenCalled();
  });

  it("refuses to delete your own account", async () => {
    asAdmin("me@veggievan.local");
    user.findUnique.mockResolvedValue({
      id: "u1",
      email: "me@veggievan.local",
      role: "admin",
    } as never);
    const res = await deleteUserAction("u1");
    expect(res).toEqual({ ok: false, error: "You cannot delete your own account" });
    expect(user.delete).not.toHaveBeenCalled();
  });

  it("refuses to delete the last admin", async () => {
    asAdmin();
    user.findUnique.mockResolvedValue({
      id: "u2",
      email: "other@veggievan.local",
      role: "admin",
    } as never);
    user.count.mockResolvedValue(1);
    const res = await deleteUserAction("u2");
    expect(res).toEqual({ ok: false, error: "Cannot delete the last admin" });
    expect(user.delete).not.toHaveBeenCalled();
  });

  it("deletes a staff user", async () => {
    asAdmin();
    user.findUnique.mockResolvedValue({
      id: "u3",
      email: "staff@veggievan.local",
      role: "staff",
    } as never);
    user.delete.mockResolvedValue({} as never);
    const res = await deleteUserAction("u3");
    expect(res).toEqual({ ok: true });
    expect(user.delete).toHaveBeenCalledWith({ where: { id: "u3" } });
  });
});
