-- Migración para arreglar la función match_fragments para RAG
-- Fecha: 2024-01-XX

-- Eliminar la función anterior si existe
DROP FUNCTION IF EXISTS match_fragments(vector(1536), float, int);
DROP FUNCTION IF EXISTS match_fragments(vector(1536), float, int, uuid);

-- Crear la función actualizada para match_fragments
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
        d.subject_id,
        COALESCE(d.name, 'Documento') as section_title,
        1 as page_number,
        e.content_chunk as fragment,
        1 - (e.embedding_vector <=> query_embedding) as similarity
    FROM embeddings e
    JOIN documents d ON e.document_id = d.id
    WHERE 1 - (e.embedding_vector <=> query_embedding) > match_threshold
    AND d.subject_id = p_subject_id
    ORDER BY e.embedding_vector <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Crear índice para optimizar búsquedas de embeddings
CREATE INDEX IF NOT EXISTS idx_embeddings_document_id ON embeddings(document_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings USING ivfflat (embedding_vector vector_cosine_ops);

-- Asegurar que la extensión vector esté habilitada
CREATE EXTENSION IF NOT EXISTS vector;

-- Comentario sobre la función
COMMENT ON FUNCTION match_fragments(vector(1536), float, int, uuid) IS 
'Función para buscar fragmentos similares usando pgvector para el sistema RAG de EDUIA'; 