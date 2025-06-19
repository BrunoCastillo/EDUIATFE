# Configuración del Sistema RAG para EDUIA

## Problema Identificado
El asistente IA por materia no funciona correctamente debido a problemas en la configuración de la base de datos y la función `match_fragments`.

## Solución

### 1. Ejecutar la Migración de Base de Datos

Ejecuta el siguiente SQL en tu base de datos Supabase:

```sql
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
```

### 2. Verificar Variables de Entorno

Asegúrate de que tienes configurada la variable de entorno `REACT_APP_DEEPSEEK_API_KEY` en tu archivo `.env`:

```env
REACT_APP_DEEPSEEK_API_KEY=tu_api_key_de_deepseek
```

### 3. Verificar la Estructura de la Base de Datos

Asegúrate de que las siguientes tablas existen y tienen la estructura correcta:

#### Tabla `embeddings`:
```sql
CREATE TABLE IF NOT EXISTS embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id),
    content_chunk TEXT NOT NULL,
    embedding_vector VECTOR(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Tabla `documents`:
```sql
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    subject_id UUID REFERENCES subjects(id),
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 4. Probar el Sistema

1. Inicia sesión como estudiante
2. Inscríbete en una materia
3. Ve a la pestaña "Asistente IA"
4. Selecciona una materia
5. Escribe una pregunta

### 5. Verificar Logs

Revisa la consola del navegador para ver los logs de depuración que indican:
- Si el chat se está renderizando
- Si las materias se están cargando correctamente
- Si hay errores en las llamadas al servicio RAG

### 6. Posibles Errores y Soluciones

#### Error: "La función match_fragments no está disponible"
- Ejecuta la migración SQL anterior
- Verifica que la extensión `vector` esté habilitada

#### Error: "No se encontraron fragmentos relevantes"
- Asegúrate de que hay documentos cargados en la materia
- Verifica que los documentos tienen embeddings generados

#### Error: "Error en la respuesta de DeepSeek"
- Verifica que la API key de DeepSeek es válida
- Revisa los logs de la consola para más detalles

## Archivos Modificados

1. `EDUIA/src/components/student/Dashboard.js` - Agregada importación de ragService y corregido renderizado
2. `EDUIA/src/db/functions.sql` - Actualizada función match_fragments
3. `EDUIA/database/migrations/010_fix_rag_function.sql` - Nueva migración
4. `EDUIA/SETUP_RAG.md` - Este archivo de instrucciones

## Estado del Sistema

Después de aplicar estos cambios, el asistente IA por materia debería funcionar correctamente para los estudiantes. 