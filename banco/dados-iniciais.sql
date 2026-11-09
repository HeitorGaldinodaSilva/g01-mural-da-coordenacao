-- Dados FICTÍCIOS para o teste do CA4 (filtro "atrasadas").
-- A API recusa prazo no passado (CA2), por isso estas tarefas
-- são inseridas direto no banco, com prazo de ontem (data de Brasília).

DECLARE @ontem DATE =
    CAST(DATEADD(DAY, -1, SYSDATETIMEOFFSET() AT TIME ZONE 'E. South America Standard Time') AS DATE);

-- Pendente: DEVE aparecer em "atrasadas"
INSERT INTO dbo.tarefas (titulo, responsavel, prioridade, prazo, concluida_em)
VALUES (N'[TESTE CA4] Publicar horários do semestre', N'Ana Exemplo', 'alta', @ontem, NULL);

-- Concluída: NÃO deve aparecer em "atrasadas"
INSERT INTO dbo.tarefas (titulo, responsavel, prioridade, prazo, concluida_em)
VALUES (N'[TESTE CA4] Reservar o auditório', N'Bruno Exemplo', 'media', @ontem, SYSDATETIMEOFFSET());