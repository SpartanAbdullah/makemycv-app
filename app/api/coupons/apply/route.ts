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

    return NextResponse.json({
      code: coupon.code,
      message: "Promo applied. Pro features are now unlocked.",
    });
  } catch {
    return NextResponse.json(
      { message: "We couldn't apply that promo right now. Please try again." },
      { status: 500 },
    );
  }
}
