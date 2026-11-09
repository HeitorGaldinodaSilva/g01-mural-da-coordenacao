-- Criação das tabelas e restrições
-- Mural da Coordenação (Grupo 01) - Azure SQL Database (T-SQL)

IF OBJECT_ID('dbo.tarefas', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.tarefas (
        id            INT IDENTITY(1,1) NOT NULL,
        titulo        NVARCHAR(120)     NOT NULL,
        responsavel   NVARCHAR(100)     NOT NULL,
        prioridade    VARCHAR(10)       NOT NULL
            CONSTRAINT df_tarefas_prioridade DEFAULT 'media',
        prazo         DATE              NULL,
        concluida_em  DATETIMEOFFSET    NULL,
        criada_em     DATETIMEOFFSET    NOT NULL
            CONSTRAINT df_tarefas_criada_em DEFAULT SYSDATETIMEOFFSET(),

        CONSTRAINT pk_tarefas PRIMARY KEY (id),
        CONSTRAINT ck_tarefas_titulo CHECK (LEN(titulo) BETWEEN 3 AND 120),
        CONSTRAINT ck_tarefas_responsavel CHECK (LEN(responsavel) >= 2),
        CONSTRAINT ck_tarefas_prioridade CHECK (prioridade IN ('baixa', 'media', 'alta'))
    );

    CREATE INDEX idx_tarefas_prazo ON dbo.tarefas (prazo);
END;