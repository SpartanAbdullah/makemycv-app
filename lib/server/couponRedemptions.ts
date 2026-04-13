import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  getNormalizedCouponCode,
  getProCouponDefinition,
} from "../config/coupons";

type CouponRedemptionMap = Record<string, number>;

type RedeemCouponResult =
  | {
      ok: true;
      code: string;
      maxUses: number | null;
      remainingUses: number | null;
      message: string;
    }
  | {
      ok: false;
      status: 400 | 404 | 409;
      message: string;
    };

// This lightweight JSON store works for local development or a single
// persistent Node server. If you deploy to a serverless platform, move
// redemptions into a shared database so counts survive between instances.
const couponRedemptionsFilePath = path.join(
  process.cwd(),
  "data",
  "coupon-redemptions.json",
);

let couponMutationQueue = Promise.resolve();

const readCouponRedemptions = async (): Promise<CouponRedemptionMap> => {
  try {
    const raw = await readFile(couponRedemptionsFilePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([code, uses]) => {
        if (typeof uses !== "number" || !Number.isFinite(uses) || uses < 0) {
          return [];
        }

        return [[getNormalizedCouponCode(code), Math.floor(uses)]];
      }),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }

    throw error;
  }
};

const writeCouponRedemptions = async (redemptions: CouponRedemptionMap) => {
  await mkdir(path.dirname(couponRedemptionsFilePath), { recursive: true });
  await writeFile(
    couponRedemptionsFilePath,
    JSON.stringify(redemptions, null, 2),
    "utf8",
  );
};

const queueCouponMutation = async <T>(job: () => Promise<T>) => {
  const task = couponMutationQueue.then(job, job);
  couponMutationQueue = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
};

export const redeemCoupon = async (value: string): Promise<RedeemCouponResult> => {
  const normalized = getNormalizedCouponCode(value);
  if (!normalized) {
    return { ok: false, status: 400, message: "Enter a promo code to unlock Pro." };
  }

  return queueCouponMutation(async () => {
    const coupon = getProCouponDefinition(normalized);
    if (!coupon) {
      return { ok: false, status: 404, message: "That promo code is not valid." };
    }

    const redemptions = await readCouponRedemptions();
    const currentUses = redemptions[coupon.code] ?? 0;

    if (coupon.maxUses !== null && currentUses >= coupon.maxUses) {
      return { ok: false, status: 409, message: "This promo code has expired." };
    }

    const nextUses = currentUses + 1;
    redemptions[coupon.code] = nextUses;
    await writeCouponRedemptions(redemptions);

    const remainingUses =
      coupon.maxUses === null ? null : Math.max(coupon.maxUses - nextUses, 0);

    return {
      ok: true,
      code: coupon.code,
      maxUses: coupon.maxUses,
      remainingUses,
      message:
        remainingUses === null
          ? "Promo applied. Pro features are now unlocked."
          : remainingUses === 0
            ? "Promo applied. Pro features are now unlocked. This was the final available use."
            : `Promo applied. Pro features are now unlocked. ${remainingUses} use${remainingUses === 1 ? "" : "s"} remaining.`,
    };
  });
};
