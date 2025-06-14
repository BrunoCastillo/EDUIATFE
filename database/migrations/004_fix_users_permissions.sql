-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;

-- Eliminar políticas de almacenamiento existentes
DROP POLICY IF EXISTS "Los profesores pueden subir documentos" ON storage.objects;
DROP POLICY IF EXISTS "Los profesores pueden ver sus documentos" ON storage.objects;
DROP POLICY IF EXISTS "Los profesores pueden eliminar sus documentos" ON storage.objects;

-- Eliminar trigger y función existentes
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Crear tabla temporal para mantener los datos existentes
CREATE TABLE IF NOT EXISTS users_temp (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'student',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Copiar datos existentes a la tabla temporal
INSERT INTO users_temp (id, email, full_name, role, created_at, updated_at)
SELECT id, email, full_name, role, created_at, updated_at
FROM users;

-- Eliminar las restricciones de clave foránea existentes
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_user_id_fkey;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_user_id_fkey;
ALTER TABLE subject_students DROP CONSTRAINT IF EXISTS subject_students_student_id_fkey;
ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS enrollments_student_id_fkey;

-- Eliminar la tabla users existente
DROP TABLE IF EXISTS users CASCADE;

-- Recrear la tabla users con la estructura correcta
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'student',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Restaurar los datos desde la tabla temporal
INSERT INTO users (id, email, full_name, role, created_at, updated_at)
SELECT id, email, full_name, role, created_at, updated_at
FROM users_temp;

-- Eliminar la tabla temporal
DROP TABLE IF EXISTS users_temp;

-- Recrear las restricciones de clave foránea
ALTER TABLE documents 
    ADD CONSTRAINT documents_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE messages 
    ADD CONSTRAINT messages_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE subject_students 
    ADD CONSTRAINT subject_students_student_id_fkey 
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE enrollments 
    ADD CONSTRAINT enrollments_student_id_fkey 
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;

-- Habilitar RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Crear políticas de seguridad más permisivas para el registro
CREATE POLICY "Enable insert for authenticated users only"
    ON users FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable select for users based on id"
    ON users FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "Enable update for users based on id"
    ON users FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Recrear políticas de almacenamiento
CREATE POLICY "Los profesores pueden subir documentos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'professor'
        )
    );

CREATE POLICY "Los profesores pueden ver sus documentos"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'professor'
        )
    );

CREATE POLICY "Los profesores pueden eliminar sus documentos"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'professor'
        )
    );

-- Crear función para manejar nuevos usuarios
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'student')
    );
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE LOG 'Error en handle_new_user: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger para nuevos usuarios
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Otorgar permisos necesarios
GRANT ALL ON users TO authenticated;
GRANT ALL ON users TO service_role;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role; 