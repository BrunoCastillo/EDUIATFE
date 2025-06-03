-- Crear la tabla files
CREATE TABLE IF NOT EXISTS files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    type TEXT NOT NULL,
    size BIGINT NOT NULL,
    folder TEXT NOT NULL,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_files_subject_id ON files(subject_id);
CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder);

-- Habilitar RLS
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Crear políticas
CREATE POLICY "Permitir acceso público de lectura a archivos"
    ON files FOR SELECT
    USING (true);

CREATE POLICY "Permitir inserción de archivos a usuarios autenticados"
    ON files FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Permitir actualización de archivos a usuarios autenticados"
    ON files FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Permitir eliminación de archivos a usuarios autenticados"
    ON files FOR DELETE
    TO authenticated
    USING (true);

-- Crear función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Crear trigger para actualizar updated_at
CREATE TRIGGER update_files_updated_at
    BEFORE UPDATE ON files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 