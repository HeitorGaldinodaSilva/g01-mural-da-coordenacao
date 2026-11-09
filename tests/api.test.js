// Testes de caixa-preta: rodam contra a API já no ar (npm run dev em outro terminal).
// Preparação do T5: as tarefas "[TESTE CA4]" com prazo de ontem foram inseridas
// direto no banco (banco/dados-iniciais.sql), porque a API recusa prazo no passado (CA2).
const { test } = require('node:test');
const assert = require('node:assert');

const BASE = process.env.BASE_URL || 'http://localhost:3000';

async function chamar(metodo, caminho, corpo) {
  const resp = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await resp.text();
  return { status: resp.status, corpo: texto ? JSON.parse(texto) : null };
}

test('T1 - GET /health responde 200 com iniciado_em', async () => {
  const r = await chamar('GET', '/health');
  assert.strictEqual(r.status, 200);
  assert.ok(r.corpo.iniciado_em);
});

test('T2 - CA1: título com 2 caracteres devolve 400 com mensagem', async () => {
  const r = await chamar('POST', '/api/tarefas', { titulo: 'ab', responsavel: 'Ana Exemplo' });
  assert.strictEqual(r.status, 400);
  assert.ok(r.corpo.erro);
});

test('T3 - CA2: prazo anterior a hoje devolve 400', async () => {
  const r = await chamar('POST', '/api/tarefas', {
    titulo: 'Tarefa com prazo vencido',
    responsavel: 'Ana Exemplo',
    prazo: '2020-01-01',
  });
  assert.strictEqual(r.status, 400);
});

test('T4 - CA3: concluir preenche concluida_em e concluir de novo devolve 409', async () => {
  const criada = await chamar('POST', '/api/tarefas', {
    titulo: 'Tarefa de teste T4',
    responsavel: 'Ana Exemplo',
  });
  assert.strictEqual(criada.status, 201);
  const id = criada.corpo.id;

  const primeira = await chamar('PATCH', `/api/tarefas/${id}/concluir`);
  assert.strictEqual(primeira.status, 200);
  assert.ok(primeira.corpo.concluida_em);

  const segunda = await chamar('PATCH', `/api/tarefas/${id}/concluir`);
  assert.strictEqual(segunda.status, 409);

  await chamar('DELETE', `/api/tarefas/${id}`); // limpeza
});

test('T5 - CA4: "atrasadas" mostra só a pendente (ambas com prazo de ontem)', async () => {
  const r = await chamar('GET', '/api/tarefas?situacao=atrasadas');
  assert.strictEqual(r.status, 200);
  const titulos = r.corpo.map((t) => t.titulo);
  assert.ok(titulos.some((t) => t.includes('Publicar horários do semestre')), 'a pendente deve aparecer');
  assert.ok(!titulos.some((t) => t.includes('Reservar o auditório')), 'a concluída não deve aparecer');
});

test('T6 - CA5: excluir id inexistente devolve 404', async () => {
  const r = await chamar('DELETE', '/api/tarefas/999999999');
  assert.strictEqual(r.status, 404);
});

test('T7 - situação de filtro inválida devolve 400', async () => {
  const r = await chamar('GET', '/api/tarefas?situacao=qualquer');
  assert.strictEqual(r.status, 400);
});