import {
  parsePhoneNumber,
  isValidPhoneNumber,
  CountryCode,
  PhoneNumber,
} from 'libphonenumber-js';

/**
 * Validates and normalizes a Ghana phone number (country code: 233)
 * If the phone number doesn't include the country code, it will be added
 *
 * @param phoneNumber - The phone number to validate and normalize
 * @param defaultCountry - Default country code (defaults to 'GH' for Ghana)
 * @returns Normalized phone number with country code (e.g., "233241234567")
 * @throws Error if phone number is invalid
 */
export function validateAndNormalizeGhanaPhone(
  phoneNumber: string,
  defaultCountry: CountryCode = 'GH',
): string {
  // Remove any whitespace, dashes, or other formatting
  const cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');

  // Try to parse the phone number
  let parsed: PhoneNumber;
  try {
    // First, try parsing with the default country (Ghana)
    parsed = parsePhoneNumber(cleaned, defaultCountry);
  } catch (error) {
    // If parsing fails, try parsing as international number
    try {
      parsed = parsePhoneNumber(cleaned);
    } catch (e) {
      throw new Error(
        `Invalid phone number format. Please provide a valid Ghana phone number.`,
      );
    }
  }

  // Validate the phone number
  if (!isValidPhoneNumber(parsed.number)) {
    throw new Error(
      `Invalid phone number. Please provide a valid Ghana phone number.`,
    );
  }

  // Check if it's a Ghana number
  if (parsed.country !== 'GH') {
    throw new Error(
      `Phone number must be from Ghana (country code 233). Provided: ${parsed.countryCallingCode}`,
    );
  }

  // Return the number in E.164 format without the '+' (e.g., "233241234567")
  return parsed.number.replace('+', '');
}

/**
 * Validates if a phone number is a valid Ghana phone number
 *
 * @param phoneNumber - The phone number to validate
 * @param defaultCountry - Default country code (defaults to 'GH' for Ghana)
 * @returns true if valid, false otherwise
 */
export function isValidGhanaPhone(
  phoneNumber: string,
  defaultCountry: CountryCode = 'GH',
): boolean {
  try {
    validateAndNormalizeGhanaPhone(phoneNumber, defaultCountry);
    return true;
  } catch {
    return false;
  }
}
