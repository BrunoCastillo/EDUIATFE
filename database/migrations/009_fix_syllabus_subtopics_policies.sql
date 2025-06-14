-- Habilitar RLS en la tabla syllabus_subtopics si no está habilitado
ALTER TABLE syllabus_subtopics ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Professors can manage their subjects' subtopics" ON syllabus_subtopics;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON syllabus_subtopics;

-- Crear nuevas políticas más específicas
CREATE POLICY "Professors can view their subjects' subtopics"
ON syllabus_subtopics FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM syllabus_topics st
        JOIN subjects s ON s.id = st.subject_id
        WHERE st.id = syllabus_subtopics.topic_id
        AND s.professor_id = auth.uid()
    )
);

CREATE POLICY "Professors can insert their subjects' subtopics"
ON syllabus_subtopics FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM syllabus_topics st
        JOIN subjects s ON s.id = st.subject_id
        WHERE st.id = syllabus_subtopics.topic_id
        AND s.professor_id = auth.uid()
    )
);

CREATE POLICY "Professors can update their subjects' subtopics"
ON syllabus_subtopics FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM syllabus_topics st
        JOIN subjects s ON s.id = st.subject_id
        WHERE st.id = syllabus_subtopics.topic_id
        AND s.professor_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM syllabus_topics st
        JOIN subjects s ON s.id = st.subject_id
        WHERE st.id = syllabus_subtopics.topic_id
        AND s.professor_id = auth.uid()
    )
);

CREATE POLICY "Professors can delete their subjects' subtopics"
ON syllabus_subtopics FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM syllabus_topics st
        JOIN subjects s ON s.id = st.subject_id
        WHERE st.id = syllabus_subtopics.topic_id
        AND s.professor_id = auth.uid()
    )
);

-- Política para permitir a los estudiantes ver los subtemas de las materias en las que están inscritos
CREATE POLICY "Students can view enrolled subjects' subtopics"
ON syllabus_subtopics FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM syllabus_topics st
        JOIN subjects s ON s.id = st.subject_id
        JOIN enrollments e ON e.subject_id = s.id
        WHERE st.id = syllabus_subtopics.topic_id
        AND e.student_id = auth.uid()
    )
); 