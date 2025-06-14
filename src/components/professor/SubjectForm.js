import React, { useState, useEffect } from 'react';
import './SubjectForm.css';
import SyllabusUpload from './SyllabusUpload';
import FileUpload from './FileUpload';

const SubjectForm = ({ onSubmit, onCancel, initialData }) => {
    const [formData, setFormData] = useState({
        name: ''
    });
    const [error, setError] = useState(null);
    const [syllabusUrl, setSyllabusUrl] = useState(null);
    const [subjectId, setSubjectId] = useState(null);
    const [isSubjectCreated, setIsSubjectCreated] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || ''
            });
            setSubjectId(initialData.id);
            setIsSubjectCreated(true);
        }
    }, [initialData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (!formData.name.trim()) {
            setError('Por favor, ingrese el nombre de la asignatura');
            return;
        }

        try {
            const result = await onSubmit({
                ...formData
            });
            
            if (result && result.id && !initialData) {
                setSubjectId(result.id);
                setIsSubjectCreated(true);
            }
        } catch (error) {
            setError(error.message);
        }
    };

    const handleSyllabusUpload = (url) => {
        setSyllabusUrl(url);
    };

    const handleNewSubject = () => {
        setIsSubjectCreated(false);
        setFormData({ name: '' });
        setSubjectId(null);
        setSyllabusUrl(null);
    };

    return (
        <div className="subject-form-container">
            <form onSubmit={handleSubmit} className="subject-form">
                <div className="form-section">
                    <h3>{initialData ? 'Editar Asignatura' : 'Información de la Asignatura'}</h3>
                    <div className="form-group">
                        <label htmlFor="name">Nombre de la Asignatura</label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="Ej: Matemáticas Avanzadas"
                            required
                            disabled={isSubjectCreated && !initialData}
                        />
                    </div>
                </div>

                {error && <div className="error-message">{error}</div>}

                {isSubjectCreated && (
                    <>
                        <div className="form-section">
                            <div className="success-message">
                                <h3>¡Asignatura {initialData ? 'actualizada' : 'creada'} exitosamente!</h3>
                                <p>Ahora puedes subir el sílabo de la asignatura.</p>
                            </div>
                            <div className="syllabus-upload-section">
                                <h4>Carga del Sílabo</h4>
                                <SyllabusUpload
                                    subjectId={subjectId}
                                    onUploadComplete={handleSyllabusUpload}
                                />
                            </div>
                        </div>
                        <div className="form-section">
                            <h4>Carga de Documentos de la Materia</h4>
                            <FileUpload subjectId={subjectId} />
                        </div>
                    </>
                )}

                <div className="form-actions">
                    {isSubjectCreated && !initialData ? (
                        <button 
                            type="button" 
                            className="cancel-button" 
                            onClick={handleNewSubject}
                        >
                            Crear otra asignatura
                        </button>
                    ) : (
                        <>
                            <button type="button" className="cancel-button" onClick={onCancel}>
                                Cancelar
                            </button>
                            <button type="submit" className="submit-button">
                                {initialData ? 'Actualizar Asignatura' : 'Crear Asignatura'}
                            </button>
                        </>
                    )}
                </div>
            </form>
        </div>
    );
};

export default SubjectForm; 