import { describe, it, expect, beforeEach } from "vitest";
import { useCart } from "@/lib/stores";

function reset() {
  useCart.setState({ items: [], drawerOpen: false });
}

describe("useCart", () => {
  beforeEach(() => {
    reset();
    localStorage.clear();
  });

  it("starts empty with drawer closed", () => {
    const { items, drawerOpen } = useCart.getState();
    expect(items).toEqual([]);
    expect(drawerOpen).toBe(false);
  });

  it("adds a new item and opens the drawer", () => {
    useCart.getState().add("p01");
    const { items, drawerOpen } = useCart.getState();
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ productId: "p01", qty: 1 });
    expect(drawerOpen).toBe(true);
  });

  it("increments qty when adding an existing item", () => {
    useCart.getState().add("p01", 2);
    useCart.getState().add("p01", 3);
    const { items } = useCart.getState();
    expect(items).toHaveLength(1);
    expect(items[0].qty).toBe(5);
  });

  it("adds multiple distinct items", () => {
    useCart.getState().add("p01");
    useCart.getState().add("p02");
    expect(useCart.getState().items).toHaveLength(2);
  });

  it("removes an item", () => {
    useCart.getState().add("p01");
    useCart.getState().add("p02");
    useCart.getState().remove("p01");
    const { items } = useCart.getState();
    expect(items).toHaveLength(1);
    expect(items[0].productId).toBe("p02");
  });

  it("setQty updates quantity", () => {
    useCart.getState().add("p01");
    useCart.getState().setQty("p01", 5);
    expect(useCart.getState().items[0].qty).toBe(5);
  });

  it("setQty(0) removes the item", () => {
    useCart.getState().add("p01");
    useCart.getState().setQty("p01", 0);
    expect(useCart.getState().items).toHaveLength(0);
  });

  it("setQty with negative removes the item", () => {
    useCart.getState().add("p01");
    useCart.getState().setQty("p01", -1);
    expect(useCart.getState().items).toHaveLength(0);
  });

  it("clear resets items to empty", () => {
    useCart.getState().add("p01");
    useCart.getState().add("p02");
    useCart.getState().clear();
    expect(useCart.getState().items).toEqual([]);
  });

  it("toggles the drawer", () => {
    useCart.getState().openDrawer();
    expect(useCart.getState().drawerOpen).toBe(true);
    useCart.getState().toggleDrawer();
    expect(useCart.getState().drawerOpen).toBe(false);
    useCart.getState().toggleDrawer();
    expect(useCart.getState().drawerOpen).toBe(true);
  });
});
