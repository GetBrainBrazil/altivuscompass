import { describe, it, expect } from "vitest";
import {
  cleanDigits,
  isValidEmail,
  isValidCPFLength,
  isValidPhoneLength,
} from "../validators";

describe("cleanDigits", () => {
  it("remove tudo que não é dígito", () => {
    expect(cleanDigits("(11) 98765-4321")).toBe("11987654321");
    expect(cleanDigits("123.456.789-00")).toBe("12345678900");
  });
  it("trata null/undefined/empty como string vazia", () => {
    expect(cleanDigits(null)).toBe("");
    expect(cleanDigits(undefined)).toBe("");
    expect(cleanDigits("")).toBe("");
  });
});

describe("isValidEmail", () => {
  it("aceita formatos válidos", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("a.b+c@sub.dominio.co")).toBe(true);
  });
  it("rejeita formatos inválidos", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail("semarroba.com")).toBe(false);
    expect(isValidEmail("user@")).toBe(false);
    expect(isValidEmail("@dominio.com")).toBe(false);
    expect(isValidEmail("user@dominio")).toBe(false);
  });
});

describe("isValidCPFLength", () => {
  it("aceita 11 dígitos (formatado ou não)", () => {
    expect(isValidCPFLength("12345678900")).toBe(true);
    expect(isValidCPFLength("123.456.789-00")).toBe(true);
  });
  it("rejeita comprimentos errados", () => {
    expect(isValidCPFLength("123")).toBe(false);
    expect(isValidCPFLength("123456789012")).toBe(false);
    expect(isValidCPFLength("")).toBe(false);
    expect(isValidCPFLength(null)).toBe(false);
  });
});

describe("isValidPhoneLength", () => {
  it("aceita 10-13 dígitos", () => {
    expect(isValidPhoneLength("1133334444")).toBe(true); // 10
    expect(isValidPhoneLength("11987654321")).toBe(true); // 11
    expect(isValidPhoneLength("5511987654321")).toBe(true); // 13
  });
  it("rejeita fora do range", () => {
    expect(isValidPhoneLength("123456")).toBe(false);
    expect(isValidPhoneLength("12345678901234")).toBe(false);
    expect(isValidPhoneLength("")).toBe(false);
    expect(isValidPhoneLength(null)).toBe(false);
  });
});
