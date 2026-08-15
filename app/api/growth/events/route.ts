import { persistPublicEvent } from "@/lib/growth/persistence";
import { publicGrowthEventSchema } from "@/lib/growth/schema";

const MAX_BODY_BYTES = 16 * 1024;

function errorResponse(status: 400 | 413 | 503) {
  const error = status === 400
    ? "Invalid growth event"
    : status === 413
      ? "Request body too large"
      : "Growth event service unavailable";
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

  const parsed = publicGrowthEventSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400);

  try {
    const result = await persistPublicEvent(parsed.data);
    if (!result.accepted) return errorResponse(400);
    return Response.json({ accepted: true }, { status: 202 });
  } catch {
    return errorResponse(503);
  }
}
