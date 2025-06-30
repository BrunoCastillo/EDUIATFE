const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno
require('dotenv').config({ path: path.resolve(__dirname, 'EDUIA/.env') });

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

console.log('Configuración de Supabase:');
console.log('URL:', SUPABASE_URL);
console.log('Service Key existe:', !!SUPABASE_SERVICE_KEY);

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Error: Variables de entorno de Supabase no configuradas');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function applyMigration() {
    try {
        console.log('Aplicando migración 011_fix_syllabus_rls_policies.sql...');
        
        // Leer el archivo de migración
        const migrationPath = path.join(__dirname, 'EDUIA/database/migrations/011_fix_syllabus_rls_policies.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('Contenido de la migración:');
        console.log(migrationSQL.substring(0, 200) + '...');
        
        // Ejecutar la migración
        const { data, error } = await supabase.rpc('exec_sql', {
            sql: migrationSQL
        });
        
        if (error) {
            console.error('Error al ejecutar la migración:', error);
            
            // Intentar ejecutar directamente con una consulta simple
            console.log('Intentando ejecutar directamente...');
            
            // Dividir la migración en partes más pequeñas
            const statements = migrationSQL.split(';').filter(stmt => stmt.trim());
            
            for (const statement of statements) {
                if (statement.trim()) {
                    console.log('Ejecutando:', statement.trim().substring(0, 100) + '...');
                    const { error: stmtError } = await supabase.rpc('exec_sql', {
                        sql: statement.trim() + ';'
                    });
                    
                    if (stmtError) {
                        console.error('Error en statement:', stmtError);
                    } else {
                        console.log('✓ Statement ejecutado correctamente');
                    }
                }
            }
        } else {
            console.log('✓ Migración aplicada exitosamente');
            console.log('Resultado:', data);
        }
        
        // Verificar las políticas resultantes
        console.log('\nVerificando políticas de syllabus_topics...');
        const { data: topicPolicies, error: topicError } = await supabase
            .from('pg_policies')
            .select('*')
            .eq('tablename', 'syllabus_topics');
            
        if (!topicError) {
            console.log('Políticas de syllabus_topics:', topicPolicies);
        }
        
        console.log('\nVerificando políticas de syllabus_subtopics...');
        const { data: subtopicPolicies, error: subtopicError } = await supabase
            .from('pg_policies')
            .select('*')
            .eq('tablename', 'syllabus_subtopics');
            
        if (!subtopicError) {
            console.log('Políticas de syllabus_subtopics:', subtopicPolicies);
        }
        
    } catch (error) {
        console.error('Error general:', error);
    }
}

applyMigration(); 