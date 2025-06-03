-- Actualizar la tabla subjects
ALTER TABLE subjects
    DROP COLUMN IF EXISTS user_id,
    ADD COLUMN IF NOT EXISTS professor_id UUID REFERENCES users(id) NOT NULL;

-- Crear índice para mejorar el rendimiento de las consultas
CREATE INDEX IF NOT EXISTS idx_subjects_professor ON subjects(professor_id);

-- Actualizar las políticas de seguridad
DROP POLICY IF EXISTS "Professors can manage their subjects" ON subjects;
CREATE POLICY "Professors can manage their subjects" ON subjects
    FOR ALL
    USING (professor_id = auth.uid()); 