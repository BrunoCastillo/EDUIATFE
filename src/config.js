import { createClient } from '@supabase/supabase-js';

// Configuración de Supabase
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Configuración de DeepSeek
const deepseekApiKey = process.env.REACT_APP_DEEPSEEK_API_KEY;
const deepseekApiUrl = process.env.REACT_APP_DEEPSEEK_API_URL;

// Debug: Mostrar las variables (sin mostrar las claves completas)
console.log('=== DEBUG: Configuración ===');
console.log('Entorno:', process.env.NODE_ENV);
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key existe:', !!supabaseKey);
console.log('DeepSeek Key existe:', !!deepseekApiKey);
console.log('DeepSeek Key valor:', deepseekApiKey ? 'Configurada' : 'No configurada');
console.log('Variables de entorno disponibles:', 
    Object.keys(process.env)
        .filter(key => key.startsWith('REACT_APP_'))
        .map(key => `${key}: ${process.env[key] ? 'Configurada' : 'No configurada'}`)
);
console.log('==========================');

// Validación de variables de entorno
if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Las variables de entorno de Supabase no están configuradas.');
    console.error('Variables actuales:');
    console.error('REACT_APP_SUPABASE_URL:', supabaseUrl);
    console.error('REACT_APP_SUPABASE_ANON_KEY existe:', !!supabaseKey);
    console.error('Asegúrate de que:');
    console.error('1. El archivo .env existe en la raíz del proyecto');
    console.error('2. Las variables comienzan con REACT_APP_');
    console.error('3. Has reiniciado el servidor de desarrollo después de crear/modificar el archivo .env');
}

if (!deepseekApiKey) {
    console.error('Error: La API key de DeepSeek no está configurada.');
    console.error('Asegúrate de que:');
    console.error('1. La variable REACT_APP_DEEPSEEK_API_KEY está en el archivo .env');
    console.error('2. Has reiniciado el servidor de desarrollo después de modificar el archivo .env');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export const config = {
    supabaseUrl,
    supabaseKey,
    deepseekApiKey,
    deepseekApiUrl,
    isSupabaseConfigured: Boolean(supabaseUrl && supabaseKey),
    isDeepSeekConfigured: Boolean(deepseekApiKey)
}; 