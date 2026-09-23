import { describe, expect, it } from "vitest";

import { calcularPrestacao } from "./_client";

describe("calcularPrestacao", () => {
  it("divide o principal quando a taxa e zero", () => {
    expect(calcularPrestacao(12000, 12, 0)).toBe(1000);
  });

  it("calcula uma prestacao Price", () => {
    expect(calcularPrestacao(20000, 48, 1.49)).toBeCloseTo(586.25, 2);
  });

  it("recusa entradas invalidas", () => {
    expect(calcularPrestacao(0, 12, 1)).toBe(0);
    expect(calcularPrestacao(1000, 0, 1)).toBe(0);
    expect(calcularPrestacao(1000, 12, -1)).toBe(0);
  });
});
