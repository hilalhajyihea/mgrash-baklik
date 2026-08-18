import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateField } from "@/lib/fields";
import { createSessionToken, setSessionCookie } from "@/lib/auth";

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }

    const field = await authenticateField(
      parsed.data.username,
      parsed.data.password,
    );
    if (!field) {
      return NextResponse.json(
        { error: "اسم المستخدم أو كلمة المرور غير صحيحة" },
        { status: 401 },
      );
    }

    const token = await createSessionToken({
      kind: "field",
      fieldId: field.id,
      username: field.username,
      displayName: field.displayName,
      slug: field.slug,
    });
    await setSessionCookie(token);

    return NextResponse.json({
      field: {
        id: field.id,
        slug: field.slug,
        displayName: field.displayName,
      },
    });
  } catch (error) {
    console.error("field login error", error);
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 });
  }
}
