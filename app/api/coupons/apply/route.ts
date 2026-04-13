import { NextResponse } from "next/server";
import { z } from "zod";
import { redeemCoupon } from "@/lib/server/couponRedemptions";

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

    const result = await redeemCoupon(parsed.data.code);

    if (!result.ok) {
      return NextResponse.json(
        { message: result.message },
        { status: result.status },
      );
    }

    return NextResponse.json({
      code: result.code,
      maxUses: result.maxUses,
      remainingUses: result.remainingUses,
      message: result.message,
    });
  } catch {
    return NextResponse.json(
      { message: "We couldn't apply that promo right now. Please try again." },
      { status: 500 },
    );
  }
}
