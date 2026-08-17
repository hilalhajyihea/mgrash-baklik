import { NextResponse } from "next/server";
import { expireHolds } from "@/lib/availability";

function authorize(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const expired = await expireHolds();
    return NextResponse.json({ ok: true, expired });
  } catch (error) {
    console.error("cron expire-holds error", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
