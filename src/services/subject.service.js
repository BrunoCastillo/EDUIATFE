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
                .eq('professor_id', professorId);

            if (error) throw error;
            const sortedData = (data || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            return sortedData;
        } catch (error) {
            console.error('Error al obtener Materias:', error);
            throw error;
        }
    }

    async createSubject(subjectData) {
        try {
            // Validar datos requeridos
            if (!subjectData.name || !subjectData.professor_id) {
                throw new Error('Faltan datos requeridos');
            }

            // Verificar sesión actual
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw sessionError;

            if (!session) {
                throw new Error('No hay una sesión activa. Por favor, inicia sesión nuevamente.');
            }

            const user = session.user;
            console.log('Usuario autenticado:', user);

            // Verificar que el usuario autenticado coincida con el professor_id
            if (user.id !== subjectData.professor_id) {
                throw new Error('No tienes permiso para crear Materias para otros profesores');
            }

            // Verificar si el usuario existe en nuestra tabla profiles y tiene el rol correcto
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .eq('role', 'professor')
                .single();

            if (profileError || !profile) {
                console.log('Perfil no encontrado o no es profesor, creando/actualizando perfil...');
                const { data: newProfile, error: createProfileError } = await supabase
                    .from('profiles')
                    .upsert([
                        {
                        id: user.id,
                        email: user.email,
                        role: 'professor'
                        }
                    ])
                        .select()
                        .single();

                if (createProfileError) {
                    console.error('Error al crear/actualizar perfil:', createProfileError);
                    throw new Error('No se pudo crear/actualizar el perfil del profesor');
                }
            }

            // Intentar crear la asignatura
            const subjectToCreate = {
                name: subjectData.name,
                professor_id: user.id
            };

            console.log('Intentando crear asignatura con datos:', subjectToCreate);

            const { data: subject, error: subjectError } = await supabase
                .from('subjects')
                .insert([subjectToCreate])
                .select()
                .single();

            if (subjectError) {
                console.error('Error al crear materia:', subjectError);
                throw new Error('Error al crear la materia. Por favor, intente nuevamente.');
            }

            console.log('Materia creada exitosamente:', subject);

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

    async saveStudentProgress({ student_subject_id, document_id, status, completion_percentage, assessment_score, notes }) {
        try {
            const { data, error } = await supabase
                .from('student_progress')
                .insert([
                    {
                        student_subject_id,
                        document_id,
                        status,
                        completion_percentage,
                        assessment_score,
                        notes,
                        completion_date: new Date().toISOString(),
                        last_activity: new Date().toISOString(),
                    }
                ])
                .select()
                .single();
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error al guardar el progreso del estudiante:', error);
            throw error;
        }
    }

    async getStudentProgressByUser(userId) {
        try {
            const { data, error } = await supabase
                .from('student_progress')
                .select('student_subject_id, document_id, completion_percentage, assessment_score, completion_date')
                .in('student_subject_id', (
                    await supabase
                        .from('students_subjects')
                        .select('id')
                        .eq('student_id', userId)
                ).data.map(row => row.id)
                );
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error al obtener el progreso del estudiante:', error);
            throw error;
        }
    }
}

export const subjectService = new SubjectService(); 