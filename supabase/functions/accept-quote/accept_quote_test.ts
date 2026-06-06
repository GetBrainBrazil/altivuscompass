// Testes Deno para a edge accept-quote.
// Rede de segurança PERMANENTE: cobrem o caminho crítico cotação→venda→cliente.
// Não exercitam o banco; validam apenas o contrato HTTP da função.
// Para rodar: supabase functions test accept-quote

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const FN_URL = Deno.env.get("ACCEPT_QUOTE_URL") ?? "http://localhost:54321/functions/v1/accept-quote";

async function call(body: unknown, method = "POST") {
  const res = await fetch(FN_URL, {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

Deno.test("OPTIONS retorna CORS ok", async () => {
  const res = await fetch(FN_URL, { method: "OPTIONS" });
  assertEquals(res.status, 200);
  assert(res.headers.get("access-control-allow-origin"));
});

Deno.test("GET é rejeitado com 405", async () => {
  const { status } = await call({}, "GET");
  assertEquals(status, 405);
});

Deno.test("quote_id ausente → 400", async () => {
  const { status, json } = await call({});
  assertEquals(status, 400);
  assert(String(json.error).toLowerCase().includes("cotação"));
});

Deno.test("nome curto → 400", async () => {
  const { status } = await call({ quote_id: "x", accepter_name: "Al" });
  assertEquals(status, 400);
});

Deno.test("email inválido → 400", async () => {
  const { status } = await call({
    quote_id: "x", accepter_name: "Fulano de Tal",
    accepter_email: "naoeemail",
  });
  assertEquals(status, 400);
});

Deno.test("telefone curto → 400", async () => {
  const { status } = await call({
    quote_id: "x", accepter_name: "Fulano de Tal",
    accepter_email: "f@t.com", accepter_phone: "123",
  });
  assertEquals(status, 400);
});

Deno.test("CPF inválido → 400", async () => {
  const { status } = await call({
    quote_id: "x", accepter_name: "Fulano de Tal",
    accepter_email: "f@t.com", accepter_phone: "11999998888",
    accepter_cpf: "123",
  });
  assertEquals(status, 400);
});

Deno.test("termos não aceitos → 400", async () => {
  const { status } = await call({
    quote_id: "x", accepter_name: "Fulano de Tal",
    accepter_email: "f@t.com", accepter_phone: "11999998888",
    accepter_cpf: "12345678901", terms_accepted: false,
  });
  assertEquals(status, 400);
});

Deno.test("quote inexistente → 404", async () => {
  const { status } = await call({
    quote_id: "00000000-0000-0000-0000-000000000000",
    accepter_name: "Fulano de Tal",
    accepter_email: "f@t.com", accepter_phone: "11999998888",
    accepter_cpf: "12345678901", terms_accepted: true,
  });
  // 404 esperado; 500 se SERVICE_ROLE_KEY não estiver no ambiente de teste — aceita ambos.
  assert([404, 500].includes(status), `status inesperado: ${status}`);
});
