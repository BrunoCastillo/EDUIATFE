import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from './supabaseConfig';

// Crear el cliente de Supabase con configuración mejorada
const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'supabase.auth.token',
    },
    db: {
        schema: 'public'
    },
    global: {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Prefer': 'return=representation'
        }
    },
    realtime: {
        params: {
            eventsPerSecond: 10
        }
    }
});

// Verificar la conexión y manejar cambios en la autenticación
supabase.auth.onAuthStateChange((event, session) => {
    console.log('Estado de autenticación:', event, session ? 'sesión activa' : 'sin sesión');
    
    // Actualizar los headers cuando cambia la sesión
    if (session) {
        supabase.rest.headers = {
            ...supabase.rest.headers,
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseConfig.anonKey
        };
    }
});

// Función para verificar la sesión actual
export const checkSession = async () => {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        return session;
    } catch (error) {
        console.error('Error verificando sesión:', error);
        return null;
    }
};

// Función para actualizar la sesión
export const updateSession = async (session) => {
    if (session) {
        try {
            await supabase.auth.setSession({
                access_token: session.access_token,
                refresh_token: session.refresh_token
            });

            // Actualizar headers después de establecer la sesión
            supabase.rest.headers = {
                ...supabase.rest.headers,
                'Authorization': `Bearer ${session.access_token}`,
                'apikey': supabaseConfig.anonKey
            };
        } catch (error) {
            console.error('Error actualizando sesión:', error);
            throw error;
        }
    }
};

export { supabase }; 