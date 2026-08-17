import { NextResponse } from "next/server";
import { confirmHold } from "@/lib/availability";
import { sanitizeToken } from "@/lib/tokens";

export async function POST(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token: raw } = await context.params;
  const token = sanitizeToken(raw);
  if (!token) {
    return NextResponse.json({ error: "הקישור אינו תקין" }, { status: 400 });
  }

  const result = await confirmHold(token);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    already: result.already,
    fieldName: result.fieldName,
    startsAt: result.startsAt.toISOString(),
  });
}
