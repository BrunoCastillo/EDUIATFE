import { supabase } from '../config/supabaseClient';

class SubjectService {
    async getSubjects(professorId) {
        try {
            const { data, error } = await supabase
                .from('subjects')
                .select(`
                    *,
                    syllabus (
                        file_url,
                        file_name
                    )
                `)
                .eq('professor_id', professorId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error al obtener asignaturas:', error);
            throw error;
        }
    }

    async createSubject(subjectData) {
        try {
            // Validar datos requeridos
            if (!subjectData.name || !subjectData.professor_id) {
                throw new Error('Faltan datos requeridos');
            }

            // Generar código automáticamente
            const code = this.generateCode(subjectData.name);

            // Verificar usuario autenticado
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError) throw authError;

            if (!user) {
                throw new Error('Usuario no autenticado');
            }

            console.log('Usuario autenticado:', user);

            // Verificar que el usuario autenticado coincida con el professor_id
            if (user.id !== subjectData.professor_id) {
                throw new Error('No tienes permiso para crear asignaturas para otros profesores');
            }

            // Verificar si el usuario existe en nuestra tabla users
            const { data: existingUserById, error: userErrorById } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

            let userIdToUse = user.id;

            if (userErrorById || !existingUserById) {
                // Buscar por email antes de crear
                const { data: existingUserByEmail, error: userErrorByEmail } = await supabase
                    .from('users')
                    .select('*')
                    .eq('email', user.email)
                    .single();

                if (existingUserByEmail) {
                    // Si existe por email, usar ese usuario
                    userIdToUse = existingUserByEmail.id;
                    console.log('Usuario ya existe por email, usando id:', userIdToUse);
                } else {
                    // Crear el usuario en nuestra tabla
                    const newUser = {
                        id: user.id,
                        email: user.email,
                        full_name: user.user_metadata?.full_name || user.email,
                        role: 'professor'
                    };
                    console.log('Intentando crear usuario con datos:', newUser);
                    const { data: insertedUser, error: insertError } = await supabase
                        .from('users')
                        .insert([newUser])
                        .select()
                        .single();
                    if (insertError) {
                        console.error('Error al crear usuario:', insertError);
                        throw new Error(`Error al sincronizar el usuario: ${insertError.message}`);
                    }
                    userIdToUse = insertedUser.id;
                    console.log('Usuario creado exitosamente:', insertedUser);
                }
            }

            // Verificar nuevamente que el usuario existe
            const { data: finalUser, error: finalUserError } = await supabase
                .from('users')
                .select('id')
                .eq('id', userIdToUse)
                .single();

            if (finalUserError || !finalUser) {
                throw new Error('No se pudo verificar la existencia del usuario');
            }

            console.log('Usuario verificado antes de crear asignatura:', finalUser);

            // Intentar crear la asignatura
            const subjectToCreate = {
                name: subjectData.name,
                code: code,
                professor_id: subjectData.professor_id
            };

            console.log('Intentando crear asignatura con datos:', subjectToCreate);

            const { data: subject, error: subjectError } = await supabase
                .from('subjects')
                .insert([subjectToCreate])
                .select()
                .single();

            if (subjectError) {
                console.error('Error al crear asignatura:', subjectError);
                if (subjectError.code === '42501') {
                    throw new Error('No tienes permiso para crear asignaturas');
                }
                throw subjectError;
            }

            console.log('Asignatura creada exitosamente:', subject);

            // Si hay una URL de sílabo, actualizar la asignatura
            if (subjectData.syllabus_url) {
                const { error: syllabusError } = await supabase
                    .from('syllabus')
                    .insert([
                        {
                            subject_id: subject.id,
                            file_url: subjectData.syllabus_url,
                            file_name: 'Sílabo',
                            file_path: subjectData.syllabus_url
                        }
                    ]);

                if (syllabusError) {
                    console.error('Error al guardar el sílabo:', syllabusError);
                }
            }

            return subject;
        } catch (error) {
            console.error('Error en createSubject:', error);
            throw error;
        }
    }

    generateCode(name) {
        // Tomar las primeras tres letras de cada palabra y convertirlas a mayúsculas
        return name
            .split(' ')
            .map(word => word.substring(0, 3).toUpperCase())
            .join('');
    }

    async deleteSubject(subjectId, professorId) {
        try {
            console.log('Intentando eliminar asignatura:', { subjectId, professorId });

            // Verificar usuario autenticado
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError) throw authError;

            if (!user) {
                throw new Error('Usuario no autenticado');
            }

            console.log('Usuario autenticado:', user);

            // Verificar que el usuario existe en nuestra tabla users
            const { data: existingUser, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

            console.log('Usuario en tabla users:', existingUser);

            if (userError || !existingUser) {
                throw new Error('Usuario no encontrado en el sistema');
            }

            // Verificar que el usuario es profesor
            if (existingUser.role !== 'professor') {
                throw new Error('Solo los profesores pueden eliminar asignaturas');
            }

            // Verificar que el usuario es el propietario de la asignatura
            const { data: subject, error: subjectError } = await supabase
                .from('subjects')
                .select('professor_id')
                .eq('id', subjectId)
                .single();

            console.log('Asignatura encontrada:', subject);

            if (subjectError || !subject) {
                throw new Error('Asignatura no encontrada');
            }

            if (subject.professor_id !== user.id) {
                throw new Error('No tienes permiso para eliminar esta asignatura');
            }

            // Eliminar la asignatura
            const { error: deleteError } = await supabase
                .from('subjects')
                .delete()
                .eq('id', subjectId);

            if (deleteError) {
                console.error('Error al eliminar asignatura:', deleteError);
                if (deleteError.code === '42501') {
                    throw new Error('No tienes permiso para eliminar asignaturas');
                }
                throw deleteError;
            }

            console.log('Asignatura eliminada exitosamente');
            return true;
        } catch (error) {
            console.error('Error en deleteSubject:', error);
            throw error;
        }
    }

    async getSubjectById(subjectId) {
        try {
            if (!subjectId) {
                throw new Error('ID de la asignatura no proporcionado');
            }

            const { data, error } = await supabase
                .from('subjects')
                .select('*')
                .eq('id', subjectId)
                .single();

            if (error) {
                console.error('Error de Supabase:', error);
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Error al obtener la asignatura:', error);
            throw error;
        }
    }

    async updateSubject(subjectId, subjectData) {
        try {
            if (!subjectId) {
                throw new Error('ID de la asignatura no proporcionado');
            }

            const { data, error } = await supabase
                .from('subjects')
                .update({
                    name: subjectData.name,
                    updated_at: new Date().toISOString()
                })
                .eq('id', subjectId)
                .select()
                .single();

            if (error) {
                console.error('Error de Supabase:', error);
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Error al actualizar la asignatura:', error);
            throw error;
        }
    }

    async getEnrolledStudents(subjectId) {
        try {
            const { data, error } = await supabase
                .from('enrollments')
                .select(`
                    student_id,
                    students:profiles (
                        id,
                        full_name,
                        email
                    )
                `)
                .eq('subject_id', subjectId);

            if (error) throw error;
            return data.map(enrollment => enrollment.students);
        } catch (error) {
            console.error('Error al obtener los estudiantes inscritos:', error);
            throw error;
        }
    }
}

export const subjectService = new SubjectService(); 