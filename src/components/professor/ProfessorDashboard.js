import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import SubjectList from './SubjectList';
import SubjectForm from './SubjectForm';
import FileUpload from './FileUpload';
import PDFUpload from './PDFUpload';
import ChatIA from './ChatIA';
import './ProfessorDashboard.css';

const ProfessorDashboard = () => {
    const [subjects, setSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeOption, setActiveOption] = useState('details'); // 'details', 'chat', 'files'

    useEffect(() => {
        console.log('ProfessorDashboard montado');
        fetchSubjects();
    }, []);

    const fetchSubjects = async () => {
        try {
            console.log('Buscando materias del profesor...');
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No hay usuario autenticado');

            const { data, error } = await supabase
                .from('subjects')
                .select('*')
                .eq('professor_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            console.log('Materias encontradas:', data?.length || 0);
            setSubjects(data || []);
        } catch (error) {
            console.error('Error al cargar materias:', error);
            setError('Error al cargar las materias');
        } finally {
            setLoading(false);
        }
    };

    const handleSubjectSelect = (subject) => {
        console.log('Materia seleccionada:', subject);
        setSelectedSubject(subject);
        setShowForm(false);
    };

    const handleAddSubject = () => {
        setSelectedSubject(null);
        setShowForm(true);
    };

    const handleSubjectCreated = () => {
        fetchSubjects();
        setShowForm(false);
    };

    const renderOptionContent = () => {
        console.log('=== Renderizando opción ===');
        console.log('Opción activa:', activeOption);
        console.log('Materia seleccionada:', selectedSubject);

        switch (activeOption) {
            case 'chat':
                return (
                    <div className="option-content">
                        <h3>Chat con IA</h3>
                        {selectedSubject ? (
                            <>
                                <p>Materia: {selectedSubject.name}</p>
                                <ChatIA subjectId={selectedSubject.id} />
                            </>
                        ) : (
                            <p>Por favor, selecciona una materia para usar el chat con IA</p>
                        )}
                    </div>
                );
            case 'files':
                return (
                    <div className="option-content">
                        <h3>Carga de Archivos</h3>
                        <PDFUpload subjectId={selectedSubject?.id} />
                        <FileUpload subjectId={selectedSubject?.id} />
                    </div>
                );
            default:
                return (
                    <div className="subject-info">
                        <h3>{selectedSubject?.name}</h3>
                        <p><strong>Código:</strong> {selectedSubject?.code}</p>
                        <p><strong>Créditos:</strong> {selectedSubject?.credits}</p>
                        <p><strong>Descripción:</strong> {selectedSubject?.description}</p>
                    </div>
                );
        }
    };

    if (loading) {
        return <div className="loading">Cargando...</div>;
    }

    return (
        <div className="professor-dashboard">
            <div className="dashboard-header">
                <h2>Panel del Profesor</h2>
                <button onClick={handleAddSubject} className="add-subject-button">
                    Agregar Materia
                </button>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="dashboard-content">
                <div className="subjects-section">
                    <SubjectList
                        subjects={subjects}
                        onSubjectSelect={handleSubjectSelect}
                        selectedSubject={selectedSubject}
                    />
                </div>

                <div className="subject-details">
                    {showForm ? (
                        <SubjectForm
                            onSubjectCreated={handleSubjectCreated}
                            onCancel={() => setShowForm(false)}
                        />
                    ) : selectedSubject ? (
                        <>
                            <div className="options-menu">
                                <button
                                    className={`option-button ${activeOption === 'details' ? 'active' : ''}`}
                                    onClick={() => setActiveOption('details')}
                                >
                                    Detalles
                                </button>
                                <button
                                    className={`option-button ${activeOption === 'chat' ? 'active' : ''}`}
                                    onClick={() => setActiveOption('chat')}
                                >
                                    Chat con IA
                                </button>
                                <button
                                    className={`option-button ${activeOption === 'files' ? 'active' : ''}`}
                                    onClick={() => setActiveOption('files')}
                                >
                                    Carga de Archivos
                                </button>
                            </div>
                            {renderOptionContent()}
                        </>
                    ) : (
                        <div className="no-subject-selected">
                            <p>Selecciona una materia para ver sus detalles y documentos</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfessorDashboard; 