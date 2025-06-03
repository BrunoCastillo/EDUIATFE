-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Permitir acceso público a syllabi" ON storage.objects;
DROP POLICY IF EXISTS "Permitir a usuarios autenticados subir a syllabi" ON storage.objects;
DROP POLICY IF EXISTS "Permitir a usuarios autenticados actualizar en syllabi" ON storage.objects;
DROP POLICY IF EXISTS "Permitir a usuarios autenticados eliminar en syllabi" ON storage.objects;

-- Crear un archivo vacío en la carpeta syllabi para asegurar que existe
INSERT INTO storage.objects (bucket_id, name, owner, metadata)
VALUES (
    'documents',
    'syllabi/.placeholder',
    auth.uid(),
    '{"mimetype": "text/plain", "size": 0}'
)
ON CONFLICT (bucket_id, name) DO NOTHING;

-- Asegurar que las políticas permitan acceso a la carpeta syllabi
CREATE POLICY "Permitir acceso público a syllabi"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'documents' 
    AND name LIKE 'syllabi/%'
);

CREATE POLICY "Permitir a usuarios autenticados subir a syllabi"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'documents' 
    AND name LIKE 'syllabi/%'
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Permitir a usuarios autenticados actualizar en syllabi"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'documents' 
    AND name LIKE 'syllabi/%'
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Permitir a usuarios autenticados eliminar en syllabi"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'documents' 
    AND name LIKE 'syllabi/%'
    AND auth.role() = 'authenticated'
); 