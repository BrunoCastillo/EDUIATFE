-- Migración para corregir la función match_fragments con las columnas correctas
-- Fecha: 2024-01-XX

-- Eliminar la función anterior si existe
DROP FUNCTION IF EXISTS match_fragments(vector(1536), float, int, uuid);

-- Crear la función actualizada para match_fragments con las columnas correctas
CREATE OR REPLACE FUNCTION match_fragments(
    query_embedding vector(1536),
    match_threshold float,
    match_count int,
    p_subject_id uuid
)
RETURNS TABLE (
    id uuid,
    document_id uuid,
    subject_id uuid,
    section_title text,
    page_number int,
    fragment text,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.document_id,
        e.subject_id,
        COALESCE(e.section_title, 'Documento') as section_title,
        COALESCE(e.page_number, 1) as page_number,
        e.fragment,
        1 - (e.embedding <=> query_embedding) as similarity
    FROM embeddings e
    WHERE 1 - (e.embedding <=> query_embedding) > match_threshold
    AND e.subject_id = p_subject_id
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Crear índices para optimizar búsquedas de embeddings si no existen
CREATE INDEX IF NOT EXISTS idx_embeddings_document_id ON embeddings(document_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_subject_id ON embeddings(subject_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings USING ivfflat (embedding vector_cosine_ops);

-- Asegurar que la extensión vector esté habilitada
CREATE EXTENSION IF NOT EXISTS vector;

-- Comentario sobre la función
COMMENT ON FUNCTION match_fragments(vector(1536), float, int, uuid) IS 
'Función para buscar fragmentos similares usando pgvector para el sistema RAG de EDUIA - Versión corregida'; 