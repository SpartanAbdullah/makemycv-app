/**
 * Social profiles offered in the app. Deliberately only two: six icons and a
 * label do not fit the post-export card at 320px. The full list of six lives
 * in the site's lib/social.ts.
 */
export const FOLLOW_PROFILES = [
  { id: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/company/makemycv-ae" },
  { id: "instagram", label: "Instagram", url: "https://www.instagram.com/makemycv.ae/" },
] as const;
