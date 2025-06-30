-- Corregir políticas de RLS para syllabus_topics y syllabus_subtopics que están causando errores 403
-- Simplificar las políticas para que sean más permisivas pero seguras

-- Habilitar RLS si no está habilitado
ALTER TABLE syllabus_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE syllabus_subtopics ENABLE ROW LEVEL SECURITY;

-- CORREGIR POLÍTICAS DE SYLLABUS_TOPICS
-- Eliminar políticas existentes que pueden estar causando conflictos
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON syllabus_topics;
DROP POLICY IF EXISTS "Professors can manage their subjects' topics" ON syllabus_topics;
DROP POLICY IF EXISTS "Professors can view their subjects' topics" ON syllabus_topics;
DROP POLICY IF EXISTS "Professors can insert their subjects' topics" ON syllabus_topics;
DROP POLICY IF EXISTS "Professors can update their subjects' topics" ON syllabus_topics;
DROP POLICY IF EXISTS "Professors can delete their subjects' topics" ON syllabus_topics;

-- Crear política simplificada para syllabus_topics
CREATE POLICY "Professors can manage topics of their subjects"
ON syllabus_topics FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM subjects s
        WHERE s.id = syllabus_topics.subject_id
        AND s.professor_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM subjects s
        WHERE s.id = syllabus_topics.subject_id
        AND s.professor_id = auth.uid()
    )
);

-- Política para estudiantes en syllabus_topics
CREATE POLICY "Students can view topics of enrolled subjects"
ON syllabus_topics FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM subjects s
        JOIN enrollments e ON e.subject_id = s.id
        WHERE s.id = syllabus_topics.subject_id
        AND e.student_id = auth.uid()
    )
);

-- CORREGIR POLÍTICAS DE SYLLABUS_SUBTOPICS
-- Eliminar políticas existentes que pueden estar causando conflictos
DROP POLICY IF EXISTS "Professors can view their subjects' subtopics" ON syllabus_subtopics;
DROP POLICY IF EXISTS "Professors can insert their subjects' subtopics" ON syllabus_subtopics;
DROP POLICY IF EXISTS "Professors can update their subjects' subtopics" ON syllabus_subtopics;
DROP POLICY IF EXISTS "Professors can delete their subjects' subtopics" ON syllabus_subtopics;
DROP POLICY IF EXISTS "Students can view enrolled subjects' subtopics" ON syllabus_subtopics;
DROP POLICY IF EXISTS "Professors can manage their subjects' subtopics" ON syllabus_subtopics;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON syllabus_subtopics;

-- Crear una política más simple y funcional para profesores
CREATE POLICY "Professors can manage subtopics of their subjects"
ON syllabus_subtopics FOR ALL
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

-- Política para estudiantes (solo lectura)
CREATE POLICY "Students can view subtopics of enrolled subjects"
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