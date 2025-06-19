-- Función para buscar fragmentos similares usando pgvector
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