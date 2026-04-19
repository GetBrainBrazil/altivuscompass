import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  getDeadlineTone,
  getAgeTone,
  getValidityBadge,
} from "../quote-status";

const TODAY = "2026-06-15";

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
});
afterAll(() => {
  vi.useRealTimers();
});

describe("getDeadlineTone", () => {
  it("retorna 'none' quando due_date é null", () => {
    expect(getDeadlineTone(null, "new")).toBe("none");
  });
  it("retorna 'none' quando stage é 'confirmed'", () => {
    expect(getDeadlineTone("2026-06-14", "confirmed")).toBe("none");
  });
  it("retorna 'none' quando due_date está distante (>3 dias)", () => {
    expect(getDeadlineTone("2026-06-30", "new")).toBe("none");
  });
  it("retorna 'yellow' quando due_date está em 2-3 dias", () => {
    expect(getDeadlineTone("2026-06-18", "new")).toBe("yellow");
    expect(getDeadlineTone("2026-06-17", "new")).toBe("yellow");
  });
  it("retorna 'orange' quando due_date é hoje ou amanhã", () => {
    expect(getDeadlineTone("2026-06-15", "new")).toBe("orange");
    expect(getDeadlineTone("2026-06-16", "new")).toBe("orange");
  });
  it("retorna 'red' quando due_date já passou", () => {
    expect(getDeadlineTone("2026-06-10", "new")).toBe("red");
  });
});

describe("getAgeTone", () => {
  it("retorna 'none' quando criado há <3 dias", () => {
    expect(getAgeTone("2026-06-14", "new")).toBe("none");
  });
  it("retorna 'yellow' quando criado entre 3 e 7 dias", () => {
    expect(getAgeTone("2026-06-10", "new")).toBe("yellow");
    expect(getAgeTone("2026-06-08", "new")).toBe("yellow");
  });
  it("retorna 'red' quando criado há >7 dias", () => {
    expect(getAgeTone("2026-06-01", "new")).toBe("red");
  });
  it("retorna 'none' quando stage está fechado", () => {
    expect(getAgeTone("2026-05-01", "confirmed")).toBe("none");
    expect(getAgeTone("2026-05-01", "lost")).toBe("none");
  });
  it("retorna 'none' sem createdAt", () => {
    expect(getAgeTone(null, "new")).toBe("none");
  });
});

describe("getValidityBadge", () => {
  it("retorna null quando validade > 1 dia no futuro", () => {
    expect(getValidityBadge("2026-06-20", "new")).toBeNull();
  });
  it("retorna 'Expira amanhã' (yellow) quando validade = today+1", () => {
    const b = getValidityBadge("2026-06-16", "new");
    expect(b).toEqual({ label: "Expira amanhã", tone: "yellow" });
  });
  it("retorna 'Expira hoje' (orange) quando validade = today", () => {
    const b = getValidityBadge("2026-06-15", "new");
    expect(b).toEqual({ label: "Expira hoje", tone: "orange" });
  });
  it("retorna 'Expirada' (red) quando validade < today", () => {
    const b = getValidityBadge("2026-06-10", "new");
    expect(b).toEqual({ label: "Expirada", tone: "red" });
  });
  it("retorna null quando stage = 'confirmed'", () => {
    expect(getValidityBadge("2026-06-15", "confirmed")).toBeNull();
  });
  it("retorna null quando validity é null", () => {
    expect(getValidityBadge(null, "new")).toBeNull();
  });
});
