import { confirmHoldAction } from "@/app/confirm/[token]/actions";

export function ConfirmHoldButton({ token }: { token: string }) {
  return (
    <form action={confirmHoldAction} className="mt-6">
      <input type="hidden" name="token" value={token} />
      <button
        type="submit"
        className="btn-primary w-full rounded-xl px-6 py-3 font-semibold"
      >
        تأكيد الحجز
      </button>
    </form>
  );
}
