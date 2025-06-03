-- Habilitar RLS en todas las tablas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

-- Política para permitir la inserción de usuarios
CREATE POLICY "Permitir inserción de usuarios" ON users
    FOR INSERT
    WITH CHECK (true);

-- Política para permitir que los usuarios vean su propio perfil
CREATE POLICY "Usuarios pueden ver su propio perfil" ON users
    FOR SELECT
    USING (auth.uid() = id);

-- Política para permitir que los usuarios actualicen su propio perfil
CREATE POLICY "Usuarios pueden actualizar su propio perfil" ON users
    FOR UPDATE
    USING (auth.uid() = id);

-- Política para permitir que los administradores vean todos los perfiles
CREATE POLICY "Administradores pueden ver todos los perfiles" ON users
    FOR SELECT
    USING (auth.jwt() ->> 'role' = 'admin');

-- Políticas para la tabla subjects
DROP POLICY IF EXISTS "Los profesores pueden ver sus materias" ON subjects;
DROP POLICY IF EXISTS "Los estudiantes pueden ver las materias en las que están inscritos" ON subjects;
DROP POLICY IF EXISTS "Los administradores pueden ver todas las materias" ON subjects;
DROP POLICY IF EXISTS "Los profesores pueden crear materias" ON subjects;
DROP POLICY IF EXISTS "Los profesores pueden actualizar sus materias" ON subjects;

-- Nueva política para permitir que los profesores gestionen sus materias
CREATE POLICY "Professors can manage their subjects" ON subjects
    FOR ALL
    USING (professor_id = auth.uid());

-- Nueva política para permitir que los estudiantes vean las materias en las que están inscritos
CREATE POLICY "Students can view enrolled subjects" ON subjects
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM enrollments
            WHERE enrollments.student_id = auth.uid()
            AND enrollments.subject_id = subjects.id
        )
    );

-- Nueva política para permitir que los administradores gestionen todas las materias
CREATE POLICY "Admins can manage all subjects" ON subjects
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'admin');

-- Políticas para la tabla enrollments
DROP POLICY IF EXISTS "Los estudiantes pueden ver sus inscripciones" ON enrollments;
DROP POLICY IF EXISTS "Los profesores pueden ver las inscripciones de sus materias" ON enrollments;
DROP POLICY IF EXISTS "Los administradores pueden ver todas las inscripciones" ON enrollments;
DROP POLICY IF EXISTS "Los estudiantes pueden inscribirse a materias" ON enrollments;

-- Políticas actualizadas para enrollments
CREATE POLICY "Students can view their enrollments"
    ON enrollments FOR SELECT
    USING (student_id = auth.uid());

CREATE POLICY "Professors can view their subject enrollments"
    ON enrollments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM subjects
            WHERE subjects.id = enrollments.subject_id
            AND subjects.professor_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all enrollments"
    ON enrollments FOR SELECT
    USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Students can enroll in subjects"
    ON enrollments FOR INSERT
    WITH CHECK (
        student_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM subjects
            WHERE id = subject_id
        )
    );

CREATE POLICY "Students can unenroll from subjects"
    ON enrollments FOR DELETE
    USING (student_id = auth.uid());

CREATE POLICY "Professors can manage enrollments"
    ON enrollments FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM subjects
            WHERE subjects.id = enrollments.subject_id
            AND subjects.professor_id = auth.uid()
        )
    );

-- Políticas para la tabla documents
CREATE POLICY "Los profesores pueden ver los documentos de sus materias"
    ON documents FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM subjects
            WHERE subjects.id = documents.subject_id
            AND subjects.professor_id = auth.uid()
        )
    );

CREATE POLICY "Los estudiantes pueden ver los documentos de sus materias"
    ON documents FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM enrollments
            WHERE enrollments.student_id = auth.uid()
            AND enrollments.subject_id = documents.subject_id
        )
    );

CREATE POLICY "Los administradores pueden ver todos los documentos"
    ON documents FOR SELECT
    USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Los profesores pueden subir documentos a sus materias"
    ON documents FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM subjects
            WHERE subjects.id = documents.subject_id
            AND subjects.professor_id = auth.uid()
        )
    );

-- Políticas para la tabla assistant_interactions
CREATE POLICY "Los usuarios pueden ver sus interacciones"
    ON assistant_interactions FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Los administradores pueden ver todas las interacciones"
    ON assistant_interactions FOR SELECT
    USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Los usuarios pueden crear interacciones"
    ON assistant_interactions FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Políticas para la tabla messages
CREATE POLICY "Los estudiantes pueden ver sus mensajes"
    ON messages FOR SELECT
    USING (student_id = auth.uid());

CREATE POLICY "Los profesores pueden ver los mensajes de sus materias"
    ON messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM subjects
            WHERE subjects.id = messages.subject_id
            AND subjects.professor_id = auth.uid()
        )
    );

CREATE POLICY "Los administradores pueden ver todos los mensajes"
    ON messages FOR SELECT
    USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Los estudiantes pueden crear mensajes"
    ON messages FOR INSERT
    WITH CHECK (student_id = auth.uid());

-- Políticas para la tabla embeddings
CREATE POLICY "Los profesores pueden ver los embeddings de sus documentos"
    ON embeddings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM documents
            JOIN subjects ON subjects.id = documents.subject_id
            WHERE documents.id = embeddings.document_id
            AND subjects.professor_id = auth.uid()
        )
    );

CREATE POLICY "Los estudiantes pueden ver los embeddings de sus materias"
    ON embeddings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM documents
            JOIN enrollments ON enrollments.subject_id = documents.subject_id
            WHERE documents.id = embeddings.document_id
            AND enrollments.student_id = auth.uid()
        )
    );

CREATE POLICY "Los administradores pueden ver todos los embeddings"
    ON embeddings FOR SELECT
    USING (auth.jwt() ->> 'role' = 'admin'); 