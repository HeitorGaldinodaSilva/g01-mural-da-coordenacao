-- Usuário da aplicação, sem privilégio de administrador.
-- A senha real NUNCA vai para o Git: só na variável DATABASE_URL.

CREATE USER app_mural WITH PASSWORD = 'TROQUE_POR_UMA_SENHA_FORTE';

GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.tarefas TO app_mural;