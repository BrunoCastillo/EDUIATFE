-- Función para ejecutar SQL dinámicamente
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    EXECUTE sql;
END;
$$;

-- Otorgar permisos a la función
GRANT EXECUTE ON FUNCTION exec_sql(text) TO service_role; 