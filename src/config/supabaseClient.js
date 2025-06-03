import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from './supabaseConfig';

// Crear el cliente de Supabase
const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'supabase.auth.token'
    },
    db: {
        schema: 'public'
    }
});

// Verificar la conexión
supabase.auth.onAuthStateChange((event, session) => {
    console.log('Estado de autenticación:', event, session ? 'sesión activa' : 'sin sesión');
});

export { supabase }; 