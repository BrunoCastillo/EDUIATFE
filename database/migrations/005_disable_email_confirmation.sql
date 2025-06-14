-- Desactivar la confirmación de email en la configuración de autenticación
UPDATE auth.config
SET confirm_email = false
WHERE id = 1;

-- Asegurarse de que los usuarios existentes estén confirmados
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- Crear política para permitir el acceso sin confirmación de email
CREATE POLICY "Allow access without email confirmation"
    ON users FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true); 