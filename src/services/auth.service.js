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
            // Validaciones básicas
            if (!email || !password || !fullName || !role) {
                throw new Error('Todos los campos son requeridos');
            }

            // Validar formato de email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                throw new Error('Formato de email inválido');
            }

            // Validar longitud de contraseña
            if (password.length < 6) {
                throw new Error('La contraseña debe tener al menos 6 caracteres');
            }

            // Validar rol
            if (!['student', 'professor'].includes(role)) {
                throw new Error('Rol inválido');
            }

            // Intentar el registro sin confirmación de email
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        role: role
                    },
                    emailRedirectTo: null,
                    shouldCreateUser: true
                }
            });
            
            if (error) {
                console.error('Error en registro:', error);
                // Manejar errores específicos de Supabase
                if (error.message.includes('already registered')) {
                    throw new Error('Este correo electrónico ya está registrado');
                } else if (error.message.includes('password')) {
                    throw new Error('La contraseña no cumple con los requisitos mínimos');
                } else if (error.message.includes('Database error')) {
                    console.error('Error de base de datos:', error);
                    // Intentar crear el usuario manualmente en la tabla users
                    try {
                        const { error: insertError } = await supabase
                            .from('users')
                            .insert([
                                {
                                    id: data?.user?.id,
                                    email: email,
                                    full_name: fullName,
                                    role: role
                                }
                            ]);
                        
                        if (insertError) {
                            console.error('Error al insertar usuario manualmente:', insertError);
                            throw new Error('Error al crear el usuario. Por favor, contacta al administrador.');
                        }
                    } catch (insertError) {
                        console.error('Error en inserción manual:', insertError);
                        throw new Error('Error al crear el usuario. Por favor, contacta al administrador.');
                    }
                } else {
                    throw new Error(error.message || 'Error al registrar usuario');
                }
            }

            // Verificar si el usuario se creó correctamente
            if (!data?.user) {
                throw new Error('Error al crear el usuario. Por favor, intenta nuevamente.');
            }

            // Iniciar sesión automáticamente después del registro
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (signInError) {
                console.error('Error al iniciar sesión automáticamente:', signInError);
            }

            return data;
        } catch (error) {
            console.error('Error en registro:', error);
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