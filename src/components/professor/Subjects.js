import React, { useState, useEffect } from 'react';
import { subjectService } from '../../services/subject.service';
import SubjectForm from './SubjectForm';
import './Subjects.css';

export const Subjects = ({ professorId }) => {
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [notification, setNotification] = useState(null);
    const [editingSubject, setEditingSubject] = useState(null);

    useEffect(() => {
        loadSubjects();
    }, [professorId]);

    const loadSubjects = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await subjectService.getSubjects(professorId);
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
            // Asegurarse de que el professorId esté incluido
            const dataWithProfessor = {
                ...subjectData,
                professor_id: professorId
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
        try {
            setError(null);
            await subjectService.deleteSubject(subjectId);
            setSubjects(subjects.filter(subject => subject.id !== subjectId));
            setNotification({
                type: 'success',
                message: 'Asignatura eliminada exitosamente'
            });
        } catch (error) {
            console.error('Error al eliminar asignatura:', error);
            setError('Error al eliminar la asignatura. Por favor, intente nuevamente.');
            setNotification({
                type: 'error',
                message: 'Error al eliminar la asignatura'
            });
        }
    };

    const handleEditClick = (subject) => {
        setEditingSubject(subject);
        setShowForm(true);
    };

    if (loading) {
        return <div className="loading">Cargando asignaturas...</div>;
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