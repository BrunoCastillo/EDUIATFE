-- Función para buscar fragmentos similares usando pgvector
CREATE OR REPLACE FUNCTION match_fragments(
    query_embedding vector(1536),
    match_threshold float,
    match_count int
)
RETURNS TABLE (
    id bigint,
    document_id bigint,
    subject_id bigint,
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
        embeddings.id,
        embeddings.document_id,
        embeddings.subject_id,
        embeddings.section_title,
        embeddings.page_number,
        embeddings.fragment,
        1 - (embeddings.embedding <=> query_embedding) as similarity
    FROM embeddings
    WHERE 1 - (embeddings.embedding <=> query_embedding) > match_threshold
    ORDER BY embeddings.embedding <=> query_embedding
    LIMIT match_count;
END;
$$; 