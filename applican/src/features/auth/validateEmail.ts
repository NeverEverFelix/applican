export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type EmailValidationError = "required" | "invalid_format";

export type EmailValidationResult =
  | {
      isValid: true;
      value: string;
    }
  | {
      isValid: false;
      value: string;
      error: EmailValidationError;
    };

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidEmail(input: string): boolean {
  return EMAIL_PATTERN.test(normalizeEmail(input));
}

export function validateEmail(input: string): EmailValidationResult {
  const value = normalizeEmail(input);

  if (value.length === 0) {
    return { isValid: false, value, error: "required" };
  }

  if (!EMAIL_PATTERN.test(value)) {
    return { isValid: false, value, error: "invalid_format" };
  }

  return { isValid: true, value };
}
