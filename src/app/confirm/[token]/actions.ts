"use server";

import { revalidatePath } from "next/cache";
import { confirmHold } from "@/lib/availability";
import { sanitizeToken } from "@/lib/tokens";

export async function confirmHoldAction(formData: FormData) {
  const token = sanitizeToken(String(formData.get("token") || ""));
  if (!token) return;
  await confirmHold(token);
  revalidatePath(`/confirm/${token}`);
}
