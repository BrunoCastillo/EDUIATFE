-- Crear extensión para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Crear extensión para vectores
CREATE EXTENSION IF NOT EXISTS "vector";

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'professor', 'student')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de materias
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    professor_id UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Actualizar la tabla syllabus
DO $$ 
BEGIN
    -- Verificar si la tabla existe
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'syllabus') THEN
        -- Eliminar la tabla existente
        DROP TABLE syllabus;
    END IF;

    -- Crear la tabla syllabus con la estructura correcta
    CREATE TABLE syllabus (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
        file_url TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Crear el índice
    CREATE INDEX idx_syllabus_subject ON syllabus(subject_id);

    -- Crear la política de seguridad
    CREATE POLICY "Professors can manage their subjects' syllabus"
    ON syllabus FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM subjects
            WHERE subjects.id = syllabus.subject_id
            AND subjects.professor_id = auth.uid()
        )
    );
END $$;

-- Crear políticas de seguridad
CREATE POLICY IF NOT EXISTS "Users can insert their own subjects"
ON subjects FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = professor_id);

CREATE POLICY IF NOT EXISTS "Users can view their own subjects"
ON subjects FOR SELECT
TO authenticated
USING (auth.uid() = professor_id);

CREATE POLICY IF NOT EXISTS "Users can delete their own subjects"
ON subjects FOR DELETE
TO authenticated
USING (auth.uid() = professor_id);

-- Permitir a los usuarios autenticados subir archivos
CREATE POLICY IF NOT EXISTS "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Permitir a los usuarios autenticados ver archivos
CREATE POLICY IF NOT EXISTS "Authenticated users can view files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

-- Tabla de inscripciones
CREATE TABLE IF NOT EXISTS enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES users(id),
    subject_id UUID REFERENCES subjects(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, subject_id)
);

-- Tabla de documentos
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    subject_id UUID REFERENCES subjects(id),
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de interacciones con el asistente
CREATE TABLE IF NOT EXISTS assistant_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    subject_id UUID REFERENCES subjects(id),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de mensajes
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES users(id),
    subject_id UUID REFERENCES subjects(id),
    message TEXT NOT NULL,
    response TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    feedback_rating INTEGER CHECK (feedback_rating BETWEEN 1 AND 5),
    feedback_comment TEXT,
    metadata JSONB
);

-- Tabla de embeddings
CREATE TABLE IF NOT EXISTS embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id),
    content_chunk TEXT NOT NULL,
    embedding_vector VECTOR(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para optimizar búsquedas
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_subjects_professor ON subjects(professor_id);
CREATE INDEX IF NOT EXISTS idx_documents_subject ON documents(subject_id);
CREATE INDEX IF NOT EXISTS idx_messages_student ON messages(student_id);
CREATE INDEX IF NOT EXISTS idx_messages_subject ON messages(subject_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_subject ON enrollments(subject_id); 