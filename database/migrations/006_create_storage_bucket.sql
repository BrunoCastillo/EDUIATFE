-- Eliminar primero los archivos del bucket
DELETE FROM storage.objects WHERE bucket_id = 'documents';

-- Eliminar el bucket si existe (para evitar conflictos)
DELETE FROM storage.buckets WHERE id = 'documents';

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Permitir acceso público de lectura" ON storage.objects;
DROP POLICY IF EXISTS "Permitir a usuarios autenticados subir archivos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir a usuarios autenticados actualizar sus archivos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir a usuarios autenticados eliminar sus archivos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir a usuarios autenticados crear buckets" ON storage.buckets;
DROP POLICY IF EXISTS "Permitir a usuarios autenticados ver buckets" ON storage.buckets;

-- Habilitar RLS para la tabla storage.buckets
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- Crear política para permitir a usuarios autenticados crear buckets
CREATE POLICY "Permitir a usuarios autenticados crear buckets"
ON storage.buckets
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Crear política para permitir a usuarios autenticados ver buckets
CREATE POLICY "Permitir a usuarios autenticados ver buckets"
ON storage.buckets
FOR SELECT
TO authenticated
USING (true);

-- Crear el bucket 'documents' si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO UPDATE 
SET public = true;

-- Crear políticas para el bucket 'documents'
-- Política para permitir acceso público de lectura
CREATE POLICY "Permitir acceso público de lectura"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents');

-- Política para permitir a usuarios autenticados subir archivos
CREATE POLICY "Permitir a usuarios autenticados subir archivos"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'documents' 
    AND auth.role() = 'authenticated'
);

-- Política para permitir a usuarios autenticados actualizar sus propios archivos
CREATE POLICY "Permitir a usuarios autenticados actualizar sus archivos"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'documents' 
    AND auth.role() = 'authenticated'
);

-- Política para permitir a usuarios autenticados eliminar sus propios archivos
CREATE POLICY "Permitir a usuarios autenticados eliminar sus archivos"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'documents' 
    AND auth.role() = 'authenticated'
); 