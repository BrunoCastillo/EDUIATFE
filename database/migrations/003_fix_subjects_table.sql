-- Verificar si la columna professor_id existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'subjects' 
        AND column_name = 'professor_id'
    ) THEN
        -- Si no existe, agregarla
        ALTER TABLE subjects
        ADD COLUMN professor_id UUID REFERENCES users(id) NOT NULL;
    END IF;
END $$;

-- Actualizar las políticas de seguridad
DROP POLICY IF EXISTS "Professors can manage their subjects" ON subjects;
CREATE POLICY "Professors can manage their subjects" ON subjects
    FOR ALL
    USING (professor_id = auth.uid());

-- Crear índice para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_subjects_professor ON subjects(professor_id); 