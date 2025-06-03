-- Habilitar RLS en todas las tablas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE students_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

-- Políticas para users
CREATE POLICY "Users can view their own data" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own data" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Políticas para subjects
CREATE POLICY "Professors can manage their subjects" ON subjects
    FOR ALL USING (auth.uid() = professor_id);

CREATE POLICY "Students can view enrolled subjects" ON subjects
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM students_subjects
            WHERE student_id = auth.uid()
            AND subject_id = subjects.id
        )
    );

-- Políticas para documents
CREATE POLICY "Professors can manage their subject documents" ON documents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM subjects
            WHERE id = documents.subject_id
            AND professor_id = auth.uid()
        )
    );

CREATE POLICY "Students can view enrolled subject documents" ON documents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM students_subjects
            WHERE student_id = auth.uid()
            AND subject_id = documents.subject_id
        )
    );

-- Políticas para students_subjects
CREATE POLICY "Professors can manage enrollments in their subjects" ON students_subjects
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM subjects
            WHERE id = students_subjects.subject_id
            AND professor_id = auth.uid()
        )
    );

CREATE POLICY "Students can view their own enrollments" ON students_subjects
    FOR SELECT USING (student_id = auth.uid());

-- Políticas para messages
CREATE POLICY "Students can manage their messages" ON messages
    FOR ALL USING (student_id = auth.uid());

CREATE POLICY "Professors can view messages in their subjects" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM subjects
            WHERE id = messages.subject_id
            AND professor_id = auth.uid()
        )
    );

-- Políticas para embeddings
CREATE POLICY "Professors can manage embeddings in their subjects" ON embeddings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM documents
            JOIN subjects ON subjects.id = documents.subject_id
            WHERE documents.id = embeddings.document_id
            AND subjects.professor_id = auth.uid()
        )
    ); 