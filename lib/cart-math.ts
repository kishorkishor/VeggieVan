// Shared pricing math. No "use client" / "use server" directive on purpose:
// this module is imported by both the client cart store and server actions.

// Money is stored in paisa (1 BDT = 100 paisa) so every integer-money helper,
// cart total, and order field keeps working exactly as before.
//
// The business plan (§4.B) sets a flat BDT 40 delivery charge per order,
// charged separately from the product or basket price. There is no
// free-delivery threshold and no minimum order.
export const DELIVERY_CHARGE = 4_000; // paisa (৳40 per order)

export function shippingFor(subtotal: number): number {
  return subtotal === 0 ? 0 : DELIVERY_CHARGE;
}
