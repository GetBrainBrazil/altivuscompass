import { describe, it, expect } from "vitest";
import { buildQuoteSummary } from "../quote-summary";
import { makeQuote, makeItem } from "../../test/fixtures/quote";

describe("buildQuoteSummary", () => {
  it("gera resumo básico com título, destino e datas", () => {
    const out = buildQuoteSummary(makeQuote(), [], [], []);
    expect(out).toContain("Viagem de teste");
    expect(out).toContain("Paris, França");
    expect(out).toContain("10/05/2026");
    expect(out).toContain("17/05/2026");
  });

  it("omite linhas quando campos estão vazios", () => {
    const quote = makeQuote({
      destination: null,
      travel_date_start: null,
      travel_date_end: null,
      total_value: null,
    });
    const out = buildQuoteSummary(quote, [], [], []);
    expect(out).not.toMatch(/Destino:/);
    expect(out).not.toMatch(/Valor total/);
  });

  it("NÃO inclui custo, fornecedor, comissão ou notas internas", () => {
    const quote = makeQuote({ internal_notes: "cliente chato" });
    const items = [
      makeItem({ unit_cost: 9999, commission_amount: 500, supplier_id: "s-1" }),
    ];
    const out = buildQuoteSummary(quote, items, [], []);
    expect(out).not.toContain("9999");
    expect(out).not.toContain("cliente chato");
    expect(out).not.toContain("s-1");
  });

  it("prefixa com option_label quando item faz parte de grupo de opções", () => {
    const items = [
      makeItem({
        option_group: "flight",
        option_label: "Opção A",
        title: "Voo LATAM",
        option_order: 0,
      }),
      makeItem({
        id: "i-2",
        option_group: "flight",
        option_label: "Opção B",
        title: "Voo AIR FRANCE",
        option_order: 1,
      }),
    ];
    const out = buildQuoteSummary(makeQuote(), items, [], []);
    expect(out).toMatch(/Opção A:.*LATAM/);
    expect(out).toMatch(/Opção B:.*AIR FRANCE/);
  });

  it("agrupa items por tipo na ordem correta (voo antes de hotel)", () => {
    const items = [
      makeItem({ item_type: "hotel", title: "Le Bristol", id: "i-h" }),
      makeItem({ item_type: "flight", title: "Voo GRU-CDG", id: "i-f" }),
    ];
    const out = buildQuoteSummary(makeQuote(), items, [], []);
    expect(out.indexOf("Voo GRU-CDG")).toBeLessThan(out.indexOf("Le Bristol"));
  });

  it("mostra mensagem de expirada quando quote_validity < today", () => {
    const quote = makeQuote({ quote_validity: "2020-01-01" });
    const out = buildQuoteSummary(quote, [], [], []);
    expect(out).toMatch(/expirou/i);
  });

  it("trunca pra caber em ~1500 chars mesmo com muitos items longos", () => {
    const items = Array.from({ length: 15 }, (_, i) =>
      makeItem({
        id: `i-${i}`,
        title: "x".repeat(200),
        item_type: "experience",
        sort_order: i,
      }),
    );
    const out = buildQuoteSummary(makeQuote(), items, [], []);
    expect(out.length).toBeLessThanOrEqual(1500);
  });

  it("mostra contagem de passageiros quando há passageiros", () => {
    const out = buildQuoteSummary(
      makeQuote(),
      [],
      [{ id: "p-1" }, { id: "p-2" }],
      [],
    );
    expect(out).toMatch(/2 passageiros/);
  });
});
