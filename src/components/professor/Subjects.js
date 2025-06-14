import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { subjectService } from '../../services/subject.service';
import SubjectForm from './SubjectForm';
import './Subjects.css';
import { supabase } from '../../config/supabaseClient';

console.log('[Subjects] Archivo Subjects.js cargado');

export const Subjects = () => {
    const { user, session } = useAuth();
    const professorId = user?.id;
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [notification, setNotification] = useState(null);
    const [editingSubject, setEditingSubject] = useState(null);

    // Log de depuración en cada render
    console.log('[Subjects] Render:', { session, user, professorId, loading, error, subjects });

    useEffect(() => {
        if (!session || !user) {
            setError('No hay una sesión activa. Por favor, inicia sesión nuevamente.');
            setLoading(false);
            return;
        }
        if (!professorId) {
            setError('No se encontró el identificador del profesor. Por favor, recarga la página o contacta soporte.');
            setLoading(false);
            console.error('professorId inválido:', professorId);
            return;
        }
        // Limpiar error si la sesión y el usuario existen
        setError(null);
        setLoading(true);
        loadSubjects();
    }, [professorId, session, user]);

    const loadSubjects = async () => {
        try {
            const data = await subjectService.getSubjects(professorId);
            console.log('[Subjects] Respuesta de getSubjects:', data);
            if (!Array.isArray(data)) {
                setError('La respuesta de asignaturas no es válida.');
                setSubjects([]);
                setLoading(false);
                console.error('Respuesta inesperada de getSubjects:', data);
                return;
            }
            setSubjects(data);
        } catch (error) {
            console.error('Error al cargar asignaturas:', error);
            setError('Error al cargar las asignaturas. Por favor, intente nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSubject = async (subjectData) => {
        try {
            setError(null);
            if (!user || !user.id) {
                throw new Error('No hay un usuario autenticado. Por favor, inicia sesión nuevamente.');
            }
            const dataWithProfessor = {
                ...subjectData,
                professor_id: user.id
            };
            console.log('Creando asignatura con datos:', dataWithProfessor);
            const newSubject = await subjectService.createSubject(dataWithProfessor);
            setSubjects([newSubject, ...subjects]);
            setShowForm(false);
            setNotification({
                type: 'success',
                message: 'Asignatura creada exitosamente'
            });
        } catch (error) {
            console.error('Error al crear asignatura:', error);
            setError(error.message || 'Error al crear la asignatura. Por favor, intente nuevamente.');
            setNotification({
                type: 'error',
                message: error.message || 'Error al crear la asignatura'
            });
        }
    };

    const handleEditSubject = async (subjectData) => {
        try {
            setError(null);
            const updatedSubject = await subjectService.updateSubject(editingSubject.id, subjectData);
            setSubjects(subjects.map(subject => 
                subject.id === updatedSubject.id ? updatedSubject : subject
            ));
            setEditingSubject(null);
            setShowForm(false);
            setNotification({
                type: 'success',
                message: 'Asignatura actualizada exitosamente'
            });
        } catch (error) {
            console.error('Error al actualizar asignatura:', error);
            setError(error.message || 'Error al actualizar la asignatura. Por favor, intente nuevamente.');
            setNotification({
                type: 'error',
                message: error.message || 'Error al actualizar la asignatura'
            });
        }
    };

    const handleDeleteSubject = async (subjectId) => {
        // Mostrar diálogo de confirmación
        const confirmDelete = window.confirm(
            '¿Estás seguro de que deseas eliminar esta asignatura? ' +
            'Esta acción eliminará todos los documentos asociados y no se puede deshacer.'
        );

        if (!confirmDelete) {
            return;
        }

        try {
            // Primero eliminar todos los documentos asociados
            const { error: documentsError } = await supabase
                .from('files')
                .delete()
                .eq('subject_id', subjectId);

            if (documentsError) {
                console.error('Error al eliminar documentos:', documentsError);
                throw new Error('Error al eliminar los documentos asociados');
            }

            // Luego eliminar la asignatura
            const { error: subjectError } = await subjectService.deleteSubject(subjectId);
            
            if (subjectError) {
                console.error('Error al eliminar asignatura:', subjectError);
                throw new Error('Error al eliminar la asignatura');
            }

            // Actualizar la lista de asignaturas
            fetchSubjects();
            
            // Mostrar mensaje de éxito
            alert('Asignatura eliminada exitosamente');
        } catch (error) {
            console.error('Error al eliminar asignatura:', error);
            alert('Error al eliminar la asignatura: ' + error.message);
        }
    };

    const handleEditClick = (subject) => {
        setEditingSubject(subject);
        setShowForm(true);
    };

    if (loading) {
        return (
            <div className="loading">
                Cargando Materias...
                {error && <div className="error-message">{error}</div>}
                <button className="add-subject-button" onClick={() => setShowForm(true)}>
                    Crear Nueva Asignatura
                </button>
            </div>
        );
    }

    // Mostrar error de sesión solo si NO hay sesión
    if (!session) {
        return (
            <div className="error-message">
                No hay una sesión activa. Por favor, inicia sesión nuevamente.
            </div>
        );
    }

    return (
        <div className="subjects-container">
            {notification && (
                <div className={`notification ${notification.type}`}>
                    {notification.message}
                    <button 
                        className="close-notification"
                        onClick={() => setNotification(null)}
                    >
                        ×
                    </button>
                </div>
            )}

            <div className="subjects-header">
                <h2>Mis Asignaturas</h2>
                <button 
                    className="add-subject-button"
                    onClick={() => {
                        setEditingSubject(null);
                        setShowForm(!showForm);
                    }}
                >
                    {showForm ? 'Cancelar' : 'Nueva Asignatura'}
                </button>
            </div>

            {/* Mostrar otros errores solo si hay sesión */}
            {error && <div className="error-message">{error}</div>}

            {showForm && (
                <SubjectForm 
                    onSubmit={editingSubject ? handleEditSubject : handleCreateSubject}
                    onCancel={() => {
                        setShowForm(false);
                        setEditingSubject(null);
                    }}
                    initialData={editingSubject}
                />
            )}

            {subjects.length === 0 ? (
                <div className="no-subjects">
                    <p>No tienes asignaturas registradas.</p>
                    <button 
                        className="add-subject-button"
                        onClick={() => setShowForm(true)}
                    >
                        Crear Primera Asignatura
                    </button>
                </div>
            ) : (
                <div className="subjects-grid">
                    {subjects.map(subject => (
                        <div key={subject.id} className="subject-card">
                            <div className="subject-info">
                                <h3>{subject.name}</h3>
                                <p className="subject-code">Código: {subject.code}</p>
                                <p className="subject-description">{subject.description}</p>
                            </div>
                            <div className="subject-actions">
                                <button 
                                    className="edit-button"
                                    onClick={() => handleEditClick(subject)}
                                >
                                    Editar
                                </button>
                                <button 
                                    className="delete-button"
                                    onClick={() => handleDeleteSubject(subject.id)}
                                >
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}; 