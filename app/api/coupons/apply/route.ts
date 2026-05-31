import { NextResponse } from "next/server";
import { z } from "zod";
import { getProCouponDefinition } from "@/lib/config/coupons";

const applyCouponSchema = z.object({
  code: z.string().trim().min(1).max(100),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = applyCouponSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Enter a promo code to unlock Pro." },
        { status: 400 },
      );
    }

    const coupon = getProCouponDefinition(parsed.data.code);
    if (!coupon) {
      return NextResponse.json(
        { message: "That promo code is not valid." },
        { status: 404 },
      );
    }

    // MakeMyCV is now fully free — see DECISION_LOG.md 2026-05-31. This
    // endpoint stays mounted for back-compat with any stale clients but
    // returns honest copy: the code "applies" without unlocking anything
    // (because everything is already unlocked for everyone).
    return NextResponse.json({
      code: coupon.code,
      message: "MakeMyCV is now free for everyone — no promo code needed.",
    });
  } catch {
    return NextResponse.json(
      { message: "We couldn't apply that promo right now. Please try again." },
      { status: 500 },
    );
  }
}
