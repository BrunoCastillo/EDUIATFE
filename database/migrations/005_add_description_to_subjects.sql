-- Agregar columna description a la tabla subjects
ALTER TABLE subjects
ADD COLUMN IF NOT EXISTS description TEXT;

-- Actualizar registros existentes con una descripción por defecto
UPDATE subjects
SET description = 'Sin descripción'
WHERE description IS NULL; 