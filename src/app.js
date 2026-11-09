const express = require('express');
const { sql, getPool } = require('./db');

const app = express();
app.use(express.json());

const iniciadoEm = new Date().toISOString();

// "Hoje" = data de Brasília, calculada no banco (o App Service roda em UTC).
// Constantes internas do código, nunca texto digitado pelo usuário.
const HOJE = "CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'E. South America Standard Time' AS DATE)";
const COLUNAS = `id, titulo, responsavel, prioridade,
  CONVERT(char(10), prazo, 23) AS prazo, concluida_em, criada_em,
  CAST(CASE WHEN concluida_em IS NULL AND prazo < ${HOJE} THEN 1 ELSE 0 END AS BIT) AS atrasada`;

const FILTROS = {
  pendentes: 'concluida_em IS NULL',
  concluidas: 'concluida_em IS NOT NULL',
  atrasadas: `concluida_em IS NULL AND prazo < ${HOJE}`, // regra central (CA4)
};
const PRIORIDADES = ['baixa', 'media', 'alta'];

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

function dataValida(texto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const d = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === texto;
}

function validarTarefa(body) {
  const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
  if (titulo.length < 3 || titulo.length > 120) {
    return { erro: 'O título deve ter de 3 a 120 caracteres.' };
  }
  const responsavel = typeof body.responsavel === 'string' ? body.responsavel.trim() : '';
  if (responsavel.length < 2 || responsavel.length > 100) {
    return { erro: 'O responsável deve ter de 2 a 100 caracteres.' };
  }
  let prioridade = 'media';
  if (body.prioridade !== undefined && body.prioridade !== null && body.prioridade !== '') {
    prioridade = String(body.prioridade).trim().toLowerCase().replace('é', 'e');
    if (!PRIORIDADES.includes(prioridade)) {
      return { erro: 'A prioridade deve ser baixa, média ou alta.' };
    }
  }
  let prazo = null;
  if (body.prazo !== undefined && body.prazo !== null && body.prazo !== '') {
    prazo = String(body.prazo).trim();
    if (!dataValida(prazo)) return { erro: 'O prazo deve ser uma data válida no formato AAAA-MM-DD.' };
  }
  return { dados: { titulo, responsavel, prioridade, prazo } };
}

function lerId(req, res) {
  const texto = req.params.id;
  if (!/^\d+$/.test(texto) || Number(texto) > 2147483647) {
    res.status(400).json({ erro: 'Id inválido.' });
    return null;
  }
  return Number(texto);
}

async function buscarPorId(pool, id) {
  const r = await pool
    .request()
    .input('id', sql.Int, id)
    .query(`SELECT ${COLUNAS} FROM dbo.tarefas WHERE id = @id`);
  return r.recordset[0] || null;
}

// GET /health: testa a conexão com o banco
app.get('/health', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1 AS ok');
    res.json({ status: 'ok', banco: 'ok', iniciado_em: iniciadoEm });
  } catch (err) {
    console.error('Falha no /health:', err.message);
    res.status(503).json({ status: 'erro', banco: 'indisponivel', iniciado_em: iniciadoEm });
  }
});

// RF1: cadastrar tarefa
app.post('/api/tarefas', wrap(async (req, res) => {
  const { erro, dados } = validarTarefa(req.body || {});
  if (erro) return res.status(400).json({ erro });

  const pool = await getPool();
  if (dados.prazo) {
    const r = await pool.request().query(`SELECT CONVERT(char(10), ${HOJE}, 23) AS hoje`);
    if (dados.prazo < r.recordset[0].hoje) {
      return res.status(400).json({ erro: 'O prazo não pode ser anterior a hoje.' });
    }
  }
  const ins = await pool
    .request()
    .input('titulo', sql.NVarChar(120), dados.titulo)
    .input('responsavel', sql.NVarChar(100), dados.responsavel)
    .input('prioridade', sql.VarChar(10), dados.prioridade)
    .input('prazo', sql.VarChar(10), dados.prazo)
    .query(`INSERT INTO dbo.tarefas (titulo, responsavel, prioridade, prazo)
            OUTPUT INSERTED.id
            VALUES (@titulo, @responsavel, @prioridade, CONVERT(date, @prazo, 23))`);
  const tarefa = await buscarPorId(pool, ins.recordset[0].id);
  res.status(201).json(tarefa);
}));

// RF2 e RF4: listar, com filtro ?situacao=pendentes|concluidas|atrasadas
app.get('/api/tarefas', wrap(async (req, res) => {
  const { situacao } = req.query;
  let where = '';
  if (situacao !== undefined) {
    if (typeof situacao !== 'string' || !Object.hasOwn(FILTROS, situacao)) {
      return res.status(400).json({ erro: 'Situação inválida. Use pendentes, concluidas ou atrasadas.' });
    }
    where = `WHERE ${FILTROS[situacao]}`;
  }
  const pool = await getPool();
  const r = await pool
    .request()
    .query(`SELECT ${COLUNAS} FROM dbo.tarefas ${where} ORDER BY prazo, id`);
  res.json(r.recordset);
}));

// RF3: concluir tarefa (regra central, CA3)
app.patch('/api/tarefas/:id/concluir', wrap(async (req, res) => {
  const id = lerId(req, res);
  if (id === null) return;
  const pool = await getPool();
  // UPDATE atômico: só conclui se ainda estiver pendente
  const upd = await pool
    .request()
    .input('id', sql.Int, id)
    .query(`UPDATE dbo.tarefas SET concluida_em = SYSDATETIMEOFFSET()
            WHERE id = @id AND concluida_em IS NULL`);
  if (upd.rowsAffected[0] === 0) {
    const existente = await buscarPorId(pool, id);
    if (!existente) return res.status(404).json({ erro: 'Tarefa não encontrada.' });
    return res.status(409).json({ erro: 'Esta tarefa já foi concluída.' });
  }
  res.json(await buscarPorId(pool, id));
}));

// RF5: excluir tarefa
app.delete('/api/tarefas/:id', wrap(async (req, res) => {
  const id = lerId(req, res);
  if (id === null) return;
  const pool = await getPool();
  const del = await pool
    .request()
    .input('id', sql.Int, id)
    .query('DELETE FROM dbo.tarefas WHERE id = @id');
  if (del.rowsAffected[0] === 0) return res.status(404).json({ erro: 'Tarefa não encontrada.' });
  res.status(204).end();
}));

app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

// Erros: detalhes só no log, resposta genérica ao cliente
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido.' });
  console.error(err);
  const indisponivel =
    err.name === 'ConnectionError' ||
    ['ESOCKET', 'ELOGIN', 'ETIMEOUT', 'ECONNCLOSED', 'ENOTOPEN'].includes(err.code) ||
    err.message === 'DATABASE_URL não definida';
  if (indisponivel) {
    return res.status(503).json({ erro: 'Serviço temporariamente indisponível. Tente novamente.' });
  }
  res.status(500).json({ erro: 'Erro interno.' });
});

module.exports = app;