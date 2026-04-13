export type ProCouponDefinition = {
  code: string;
  maxUses: number | null;
};

const normalizeCouponCode = (value: string) => value.trim().toUpperCase();

const normalizeMaxUses = (value?: number | null) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
    return null;
  }

  return Math.floor(value);
};

const defineCoupon = (
  code: string,
  maxUses?: number | null,
): ProCouponDefinition => ({
  code: normalizeCouponCode(code),
  maxUses: normalizeMaxUses(maxUses),
});

export const PRO_COUPONS: readonly ProCouponDefinition[] = [
  defineCoupon("EARLY-ACCESS", 10),
  defineCoupon("MARY AN", 10),
  defineCoupon("MAKEMYCVPRO", 2),

  // Add internal or testing promo codes here.
  // Matching is case-insensitive and ignores extra spaces around the code.
  //
  // Example:
  // defineCoupon("FOUNDER-ACCESS", 10),
] as const;

export const getNormalizedCouponCode = (value: string) =>
  normalizeCouponCode(value);

export const getProCouponDefinition = (value: string) => {
  const normalized = normalizeCouponCode(value);
  if (!normalized) return null;

  return PRO_COUPONS.find((coupon) => coupon.code === normalized) ?? null;
};

export const isValidProCoupon = (value: string) => {
  return getProCouponDefinition(value) !== null;
};
