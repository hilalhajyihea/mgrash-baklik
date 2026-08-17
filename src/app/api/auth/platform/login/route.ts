import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSessionToken,
  setSessionCookie,
  verifyPlatformCredentials,
} from "@/lib/auth";

const schema = z.object({
  username: z.string().min(1, "נא להזין שם משתמש"),
  password: z.string().min(1, "נא להזין סיסמה"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "נתונים לא תקינים" },
        { status: 400 },
      );
    }

    const ok = verifyPlatformCredentials(
      parsed.data.username,
      parsed.data.password,
    );
    if (!ok) {
      return NextResponse.json(
        { error: "שם משתמש או סיסמה שגויים" },
        { status: 401 },
      );
    }

    const token = await createSessionToken({
      kind: "platform",
      username: parsed.data.username,
    });
    await setSessionCookie(token);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("platform login error", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
