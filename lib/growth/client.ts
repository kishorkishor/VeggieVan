import type { ExperimentKey, Variant } from "@/lib/growth/experiments";
import type { GrowthAttribution } from "@/lib/growth/persistence";
import { attributionSchema, type PublicGrowthEvent } from "@/lib/growth/schema";

const IDENTITY_STORAGE_KEY = "veggievan-growth-identity-v1";
const SESSION_ID_PATTERN = /^sess_[a-f0-9-]{36}$/;
const ACQUISITION_TOKEN_PATTERN = /^[a-zA-Z0-9_-]+$/;
const EXACT_LANDING_PATHS = new Set([
  "/",
  "/products",
  "/checkout",
  "/checkout/success",
  "/compare",
  "/wishlist",
]);

export type GrowthIdentity = {
  sessionId: string;
  attribution: GrowthAttribution;
};

export type ExposureTransportInput = {
  sessionId: string;
  experiment: ExperimentKey;
  variant: Variant;
  exposedAt: string;
  attribution?: GrowthAttribution;
};

let inMemoryIdentity: GrowthIdentity | undefined;

function storedIdentity(): GrowthIdentity | undefined {
  let value: string | null;
  try {
    value = sessionStorage.getItem(IDENTITY_STORAGE_KEY);
  } catch {
    return inMemoryIdentity;
  }

  if (!value) return inMemoryIdentity;
  try {
    const parsed = JSON.parse(value) as Partial<GrowthIdentity>;
    const attribution = attributionSchema.safeParse(parsed.attribution);
    if (!parsed.sessionId || !SESSION_ID_PATTERN.test(parsed.sessionId) || !attribution.success) {
      return inMemoryIdentity;
    }
    // A valid stored value is authoritative over the temporary fallback.
    inMemoryIdentity = undefined;
    return { sessionId: parsed.sessionId, attribution: attribution.data };
  } catch {
    return inMemoryIdentity;
  }
}

function acquisitionValue(params: URLSearchParams, key: string, maxLength: number) {
  const value = params.get(key)?.trim();
  return value
    && value.length <= maxLength
    && ACQUISITION_TOKEN_PATTERN.test(value)
    ? value
    : undefined;
}

export function coarsenLandingPath(pathname: string): GrowthAttribution["landingPath"] {
  if (EXACT_LANDING_PATHS.has(pathname)) return pathname;
  if (/^\/products\/[^/]+$/.test(pathname)) return "/products/:slug";
  return "/other";
}

function referrerCategory(): GrowthAttribution["referrerCategory"] {
  if (!document.referrer) return "direct";

  try {
    const referrer = new URL(document.referrer);
    if (referrer.origin === window.location.origin) return "internal";
    const hostname = referrer.hostname.toLowerCase();
    if (/^(www\.)?(google|bing|yahoo|duckduckgo|baidu)\./.test(hostname)) return "search";
    if (/^(www\.)?(facebook|instagram|linkedin|twitter|x|tiktok)\./.test(hostname)) return "social";
    return "referral";
  } catch {
    return "direct";
  }
}

function createIdentity(): GrowthIdentity {
  const params = new URLSearchParams(window.location.search);
  const attribution: GrowthAttribution = {
    landingPath: coarsenLandingPath(window.location.pathname),
    referrerCategory: referrerCategory(),
  };
  const utmSource = acquisitionValue(params, "utm_source", 80);
  const utmMedium = acquisitionValue(params, "utm_medium", 80);
  const utmCampaign = acquisitionValue(params, "utm_campaign", 120);
  if (utmSource) attribution.utmSource = utmSource;
  if (utmMedium) attribution.utmMedium = utmMedium;
  if (utmCampaign) attribution.utmCampaign = utmCampaign;

  return {
    sessionId: `sess_${crypto.randomUUID()}`,
    attribution,
  };
}

export function getGrowthIdentity(): GrowthIdentity {
  const existing = storedIdentity();
  if (existing) return existing;

  const identity = createIdentity();
  try {
    sessionStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
    inMemoryIdentity = undefined;
  } catch {
    inMemoryIdentity ??= identity;
    return inMemoryIdentity;
  }
  return identity;
}

function post(url: "/api/growth/events" | "/api/growth/exposures", body: unknown) {
  try {
    void fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Event collection is fail-open and never blocks shopper interactions.
  }
}

export function trackGrowthEvent(event: PublicGrowthEvent) {
  post("/api/growth/events", event);
}

export function trackExposure(input: ExposureTransportInput) {
  post("/api/growth/exposures", input);
}
