import { describe, expect, it } from "vitest";

import { isValidEmail, normalizeEmail, validateEmail } from "./validateEmail";

describe("validateEmail", () => {
  it("normalizes email input", () => {
    expect(normalizeEmail("  USER@Example.COM ")).toBe("user@example.com");
  });

  it("accepts a valid email after normalization", () => {
    expect(isValidEmail("  USER@Example.COM ")).toBe(true);
    expect(validateEmail("  USER@Example.COM ")).toEqual({
      isValid: true,
      value: "user@example.com",
    });
  });

  it("rejects an empty value", () => {
    expect(validateEmail("   ")).toEqual({
      isValid: false,
      value: "",
      error: "required",
    });
  });

  it("rejects an invalid email format", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(validateEmail("not-an-email")).toEqual({
      isValid: false,
      value: "not-an-email",
      error: "invalid_format",
    });
  });
});
