-- Agregar columna enrolled_at a la tabla enrollments
ALTER TABLE enrollments 
ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Crear índice para mejorar el rendimiento de consultas por fecha
CREATE INDEX IF NOT EXISTS idx_enrollments_enrolled_at ON enrollments(enrolled_at);

-- Habilitar RLS en la tabla enrollments
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- Crear políticas de seguridad para la tabla enrollments
CREATE POLICY "Students can view their own enrollments"
    ON enrollments FOR SELECT
    USING (student_id = auth.uid());

CREATE POLICY "Professors can view enrollments for their subjects"
    ON enrollments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM subjects
            WHERE subjects.id = enrollments.subject_id
            AND subjects.professor_id = auth.uid()
        )
    );

CREATE POLICY "Students can enroll themselves"
    ON enrollments FOR INSERT
    WITH CHECK (
        student_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM subjects
            WHERE subjects.id = subject_id
        )
    ); 