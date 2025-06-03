import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

// Verificar si la configuración de Supabase está completa
if (!config.isSupabaseConfigured) {
    console.error('Error: La configuración de Supabase no está completa.');
    throw new Error('Por favor, configura las variables de entorno de Supabase en el archivo .env');
}

const supabase = createClient(config.supabaseUrl, config.supabaseKey);

export const authService = {
    async login(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            return data;
        } catch (error) {
            throw error;
        }
    },

    async register(email, password, fullName, role) {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        role: role
                    }
                }
            });
            
            if (error) throw error;
            return data;
        } catch (error) {
            throw error;
        }
    },

    async logout() {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
        } catch (error) {
            throw error;
        }
    },

    async getCurrentUser() {
        try {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error) throw error;
            return user;
        } catch (error) {
            throw error;
        }
    },

    async resetPassword(email) {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            if (error) throw error;
        } catch (error) {
            throw error;
        }
    }
}; 