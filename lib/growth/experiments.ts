export const EXPERIMENTS = {
  checkout_reassurance_v1: { version: 1, variants: ["control", "treatment"], conversionEvent: "order_completed" },
  related_product_ranking_v1: { version: 1, variants: ["control", "treatment"], conversionEvent: "add_to_cart" },
} as const;

export type ExperimentKey = keyof typeof EXPERIMENTS;
export type Variant = "control" | "treatment";
export type ExperimentDefinition = (typeof EXPERIMENTS)[ExperimentKey];

export function assignVariant(sessionId: string, key: ExperimentKey): Variant {
  const value = `${sessionId}:${key}:${EXPERIMENTS[key].version}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 2 ** 32 < 0.5 ? "control" : "treatment";
}
