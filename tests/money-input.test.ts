import { describe, expect, it } from "vitest";
import { centsToInput, inputToCents } from "@/lib/money-input";

describe("money input", () => {
  it("converte centavos para edição brasileira", () => {
    expect(centsToInput(117_090)).toBe("1170,90");
    expect(centsToInput()).toBe("");
  });

  it("aceita formatos brasileiros e decimal com ponto", () => {
    expect(inputToCents("R$ 1.234,56")).toBe(123_456);
    expect(inputToCents("1234,56")).toBe(123_456);
    expect(inputToCents("1234.56")).toBe(123_456);
    expect(inputToCents("1.234")).toBe(123_400);
    expect(inputToCents("-10,25")).toBe(-1_025);
  });

  it("usa vazio para remover o ajuste e rejeita valores ambíguos", () => {
    expect(inputToCents("   ")).toBeNull();
    expect(() => inputToCents("1,234.56")).toThrow();
    expect(() => inputToCents("abc")).toThrow();
  });
});
