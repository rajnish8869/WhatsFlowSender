/**
 * Formats a phone number for WhatsApp by cleaning it and applying a default country code if needed.
 *
 * @param num The raw phone number string
 * @param defaultCountryCode The default country code to prepend if applicable
 * @returns The formatted phone number string
 */
export const getFormattedNumber = (num: string, defaultCountryCode: string): string => {
  let clean = num.replace(/[^0-9]/g, "");
  const cc = defaultCountryCode;

  if (!clean) return "";

  if (cc) {
    // If number starts with 0 (common for local numbers), remove it before adding country code
    if (clean.startsWith("0")) clean = clean.substring(1);

    if (clean.startsWith(cc)) {
      // Heuristic: If length is 10 or less, assume it's a local number that coincidentally starts with CC.
      // Most full E.164 numbers (CC + Local) are > 10 digits (e.g. US 1+10=11, UK 44+10=12).
      if (clean.length <= 10) {
        return cc + clean;
      }
      return clean;
    } else {
      return cc + clean;
    }
  }
  return clean;
};
