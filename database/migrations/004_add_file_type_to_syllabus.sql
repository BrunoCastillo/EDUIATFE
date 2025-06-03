-- Agregar columna file_type a la tabla syllabus
ALTER TABLE syllabus
ADD COLUMN IF NOT EXISTS file_type VARCHAR(50);

-- Actualizar registros existentes con el tipo de archivo basado en la extensión
UPDATE syllabus
SET file_type = CASE 
    WHEN file_name LIKE '%.pdf' THEN 'application/pdf'
    WHEN file_name LIKE '%.doc' THEN 'application/msword'
    WHEN file_name LIKE '%.docx' THEN 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    WHEN file_name LIKE '%.ppt' THEN 'application/vnd.ms-powerpoint'
    WHEN file_name LIKE '%.pptx' THEN 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ELSE 'application/octet-stream'
END
WHERE file_type IS NULL; 