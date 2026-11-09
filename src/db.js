const sql = require('mssql');

// A string de conexão vem SEMPRE da variável de ambiente DATABASE_URL.
let poolPromise = null;

function getPool() {
  if (!process.env.DATABASE_URL) {
    return Promise.reject(new Error('DATABASE_URL não definida'));
  }
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(process.env.DATABASE_URL)
      .connect()
      .catch((err) => {
        poolPromise = null; // permite nova tentativa (ex.: banco acordando da pausa)
        throw err;
      });
  }
  return poolPromise;
}

module.exports = { sql, getPool };