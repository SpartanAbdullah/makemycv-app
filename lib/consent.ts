/**
 * Analytics consent (2026-10-24) — shared, byte-identical, between
 * makemycv-app and makemycv-site (same rule as the TipJar and Logo: edit both).
 *
 * Model: Google Consent Mode v2. The inline script in each layout sets the
 * DEFAULT before GTM loads: EU/UK/CH visitors start with analytics denied,
 * everyone else starts with analytics granted; ad_* is denied for everyone
 * (we run no ads and never will here). A stored choice always wins.
 *
 * Region comes from a cookie the edge proxy sets from Vercel's country
 * header (mmcv_geo = eu | row). The choice is stored in mmcv_consent and
 * shared across www and app via the root domain.
 *
 * NOTE: GTM does not define `gtag()`. Consent commands are plain
 * `arguments` objects pushed onto dataLayer, which GTM reads natively, so
 * we push them with our own tiny function and never create a global gtag.
 */

export const CONSENT_COOKIE = "mmcv_consent";
export const GEO_COOKIE = "mmcv_geo";
export type ConsentChoice = "granted" | "denied";

/** EEA + UK + Switzerland: analytics off until accepted. */
export const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU",
  "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH",
]);

export const geoBucket = (country: string | null | undefined): "eu" | "row" =>
  country && EU_COUNTRIES.has(country.toUpperCase()) ? "eu" : "row";

/**
 * Inline bootstrap, as a string so both layouts can render it before GTM.
 * Keep it dependency-free and ES5: it runs before anything else.
 */
export const CONSENT_DEFAULT_SCRIPT = `(function(){
  window.dataLayer=window.dataLayer||[];
  function push(){window.dataLayer.push(arguments);}
  var c=document.cookie;
  var m=c.match(/(?:^|; )${CONSENT_COOKIE}=(granted|denied)/);
  var eu=/(?:^|; )${GEO_COOKIE}=eu(?:;|$)/.test(c);
  var a=m?m[1]:(eu?'denied':'granted');
  push('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:a,wait_for_update:0});
  window.__mmcvConsent={choice:m?m[1]:null,eu:eu};
})();`;

const readCookie = (name: string): string | null => {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
};

export const readConsent = (): ConsentChoice | null => {
  const v = readCookie(CONSENT_COOKIE);
  return v === "granted" || v === "denied" ? v : null;
};

export const isEuVisitor = (): boolean => readCookie(GEO_COOKIE) === "eu";

const cookieDomain = (): string => {
  const h = typeof location !== "undefined" ? location.hostname : "";
  return h.endsWith("makemycv.ae") ? "; Domain=.makemycv.ae" : "";
};

/**
 * Push a Consent Mode command the only way GTM accepts one: as a real
 * `arguments` object. A plain Array with the same three items is NOT a
 * command — GTM stores it as data and the consent state does not change.
 *
 * Until 2026-11-21 writeConsent() collected its values with a rest parameter
 * and pushed that Array, so "Opt out" and "Accept" did nothing until the next
 * full page load, when the inline default above read the cookie. Checked on
 * production: after the Array push `google_tag_data.ics.entries
 * .analytics_storage` had no `update`; after the `arguments` push it had
 * `update: false`. Do not "tidy" this into a rest parameter or an arrow
 * function (arrows have no `arguments`).
 */
function pushConsentCommand(): void {
  window.dataLayer = window.dataLayer || [];
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments as unknown as Record<string, unknown>);
}

export function writeConsent(choice: ConsentChoice): void {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${choice}; Path=/; Max-Age=${365 * 86400}; SameSite=Lax${secure}${cookieDomain()}`;
  (pushConsentCommand as (...command: unknown[]) => void)("consent", "update", {
    analytics_storage: choice,
  });
  if (choice === "denied") expireGaCookies();
}

/** Remove the GA cookies on decline so the choice is visible, not just logical. */
export function expireGaCookies(): void {
  if (typeof document === "undefined") return;
  const names = document.cookie.split("; ").map((c) => c.split("=")[0]).filter((n) => n === "_ga" || n.startsWith("_ga_") || n === "_gid");
  for (const n of names) {
    for (const domain of ["", cookieDomain(), `; Domain=${location.hostname}`]) {
      document.cookie = `${n}=; Path=/; Max-Age=0; SameSite=Lax${domain}`;
    }
  }
}

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    __mmcvConsent?: { choice: ConsentChoice | null; eu: boolean };
  }
}
