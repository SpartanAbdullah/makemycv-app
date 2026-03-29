const normalizeCouponCode = (value: string) => value.trim().toUpperCase();

export const PRO_COUPON_CODES = [
  "EARLY-ACCESS",
  "MARY AN",
  "MAKEMYCVPRO",

  // Add internal or testing coupon codes here.
  // Matching is case-insensitive and ignores extra spaces around the code.
  //
  // Example:
  // "FOUNDER-ACCESS",
] as const;

export const getNormalizedCouponCode = (value: string) =>
  normalizeCouponCode(value);

export const isValidProCoupon = (value: string) => {
  const normalized = normalizeCouponCode(value);
  if (!normalized) return false;

  return PRO_COUPON_CODES.some(
    (code) => normalizeCouponCode(code) === normalized,
  );
};
