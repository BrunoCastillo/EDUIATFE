-- Habilitar RLS en la tabla syllabus si no está habilitado
ALTER TABLE syllabus ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Professors can manage their subjects' syllabus" ON syllabus;

-- Crear nuevas políticas más específicas
CREATE POLICY "Professors can view their subjects' syllabus"
ON syllabus FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM subjects
        WHERE subjects.id = syllabus.subject_id
        AND subjects.professor_id = auth.uid()
    )
);

CREATE POLICY "Professors can insert their subjects' syllabus"
ON syllabus FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM subjects
        WHERE subjects.id = syllabus.subject_id
        AND subjects.professor_id = auth.uid()
    )
);

CREATE POLICY "Professors can update their subjects' syllabus"
ON syllabus FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM subjects
        WHERE subjects.id = syllabus.subject_id
        AND subjects.professor_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM subjects
        WHERE subjects.id = syllabus.subject_id
        AND subjects.professor_id = auth.uid()
    )
);

CREATE POLICY "Professors can delete their subjects' syllabus"
ON syllabus FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM subjects
        WHERE subjects.id = syllabus.subject_id
        AND subjects.professor_id = auth.uid()
    )
);

-- Política para permitir a los estudiantes ver los sílabos de las materias en las que están inscritos
CREATE POLICY "Students can view enrolled subjects' syllabus"
ON syllabus FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM enrollments
        WHERE enrollments.student_id = auth.uid()
        AND enrollments.subject_id = syllabus.subject_id
    )
); 