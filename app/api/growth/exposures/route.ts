import { z } from "zod";
import { assignVariant } from "@/lib/growth/experiments";
import { recordExposure } from "@/lib/growth/persistence";
import {
  attributionSchema,
  experimentKeySchema,
  variantSchema,
} from "@/lib/growth/schema";

const MAX_BODY_BYTES = 16 * 1024;
const exposureSchema = z.object({
  sessionId: z.string().regex(/^[a-zA-Z0-9_-]{8,80}$/),
  experiment: experimentKeySchema,
  variant: variantSchema,
  exposedAt: z.string().datetime(),
  attribution: attributionSchema.optional(),
}).strict();

function errorResponse(status: 400 | 413 | 503) {
  const error = status === 400
    ? "Invalid growth exposure"
    : status === 413
      ? "Request body too large"
      : "Growth exposure service unavailable";
  return Response.json({ error }, { status });
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return errorResponse(413);
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
      return errorResponse(413);
    }
    body = JSON.parse(text);
  } catch {
    return errorResponse(400);
  }

  const parsed = exposureSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400);
  if (assignVariant(parsed.data.sessionId, parsed.data.experiment) !== parsed.data.variant) {
    return errorResponse(400);
  }

  try {
    await recordExposure({
      ...parsed.data,
      exposedAt: new Date(parsed.data.exposedAt),
    });
    return Response.json({ accepted: true }, { status: 202 });
  } catch {
    return errorResponse(503);
  }
}
