-- Migración para corregir la estructura de la tabla embeddings
-- Fecha: 2024-01-XX

-- Verificar si la tabla embeddings existe y corregir su estructura
DO $$ 
BEGIN
    -- Agregar la columna content_chunk si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'embeddings' 
        AND column_name = 'content_chunk'
    ) THEN
        ALTER TABLE embeddings ADD COLUMN content_chunk TEXT NOT NULL DEFAULT '';
        RAISE NOTICE 'Columna content_chunk agregada a la tabla embeddings';
    END IF;

    -- Verificar si existe la columna embedding (antigua) y renombrarla
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'embeddings' 
        AND column_name = 'embedding'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'embeddings' 
        AND column_name = 'embedding_vector'
    ) THEN
        ALTER TABLE embeddings RENAME COLUMN embedding TO embedding_vector;
        RAISE NOTICE 'Columna embedding renombrada a embedding_vector';
    END IF;

    -- Si no existe embedding_vector, crearla
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'embeddings' 
        AND column_name = 'embedding_vector'
    ) THEN
        ALTER TABLE embeddings ADD COLUMN embedding_vector VECTOR(1536);
        RAISE NOTICE 'Columna embedding_vector agregada a la tabla embeddings';
    END IF;

    -- Crear índices si no existen
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'embeddings' 
        AND indexname = 'idx_embeddings_document_id'
    ) THEN
        CREATE INDEX idx_embeddings_document_id ON embeddings(document_id);
        RAISE NOTICE 'Índice idx_embeddings_document_id creado';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'embeddings' 
        AND indexname = 'idx_embeddings_vector'
    ) THEN
        CREATE INDEX idx_embeddings_vector ON embeddings USING ivfflat (embedding_vector vector_cosine_ops);
        RAISE NOTICE 'Índice idx_embeddings_vector creado';
    END IF;

    RAISE NOTICE 'Migración de tabla embeddings completada exitosamente';
END $$;

-- Comentario sobre la tabla
COMMENT ON TABLE embeddings IS 'Tabla para almacenar embeddings de documentos para el sistema RAG de EDUIA';
COMMENT ON COLUMN embeddings.content_chunk IS 'Fragmento de texto del documento';
COMMENT ON COLUMN embeddings.embedding_vector IS 'Vector de embeddings generado a partir del contenido'; 