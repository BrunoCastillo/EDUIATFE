import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import { syllabusService } from '../../services/syllabus.service';
import './SyllabusUpload.css';

const SyllabusUpload = ({ subjectId, setSubjectId, subjects, session: sessionProp }) => {
    const [files, setFiles] = useState([]);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [error, setError] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState({});
    const [session, setSession] = useState(sessionProp || null);
    const [isAuthenticated, setIsAuthenticated] = useState(!!sessionProp);
    const [processingStatus, setProcessingStatus] = useState({});
    const [extractedTopics, setExtractedTopics] = useState([]);
    const [saveStatus, setSaveStatus] = useState(null);
    const [generatedQuestions, setGeneratedQuestions] = useState([]);
    const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
    const [questionsStatus, setQuestionsStatus] = useState(null);

    useEffect(() => {
        if (sessionProp) {
            setSession(sessionProp);
            setIsAuthenticated(!!sessionProp);
        } else {
            checkAuth();
        }
        fetchUploadedFiles();
    }, [subjectId, sessionProp]);

    const checkAuth = async () => {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) throw error;
            setIsAuthenticated(!!session);
        } catch (error) {
            console.error('Error checking auth:', error);
            setIsAuthenticated(false);
        }
    };

    const fetchUploadedFiles = async () => {
        if (!subjectId) {
            setUploadedFiles([]);
            return;
        }

        try {
            // Primero obtenemos los sílabos
            const { data: syllabusData, error: syllabusError } = await supabase
                .from('syllabus')
                .select('*')
                .eq('subject_id', subjectId)
                .order('created_at', { ascending: false });

            if (syllabusError) throw syllabusError;

            // Luego obtenemos los temas para cada sílabo
            const syllabusWithTopics = await Promise.all(
                (syllabusData || []).map(async (syllabus) => {
                    const { data: topicsData } = await supabase
                        .from('syllabus_topics')
                        .select('*')
                        .eq('subject_id', syllabus.subject_id);

                    return {
                        ...syllabus,
                        syllabus_topics: topicsData || []
                    };
                })
            );

            setUploadedFiles(syllabusWithTopics);
            setError(null);
        } catch (error) {
            console.error('Error fetching files:', error);
            setError('Error al cargar los archivos: ' + error.message);
            setUploadedFiles([]);
        }
    };

    const handleFileChange = (event) => {
        if (!isAuthenticated) {
            setError('Debes iniciar sesión para subir archivos');
            return;
        }

        const selectedFiles = Array.from(event.target.files);
        const validFiles = selectedFiles.filter(file => {
            const validTypes = [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ];
            const validExtensions = ['.pdf', '.doc', '.docx'];
            const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
            
            return validTypes.includes(file.type) || validExtensions.includes(fileExtension);
        });

        if (validFiles.length !== selectedFiles.length) {
            setError('Solo se permiten archivos PDF (.pdf) y Word (.doc, .docx)');
            return;
        }

        // Validar tamaño máximo (10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB en bytes
        const oversizedFiles = validFiles.filter(file => file.size > maxSize);
        
        if (oversizedFiles.length > 0) {
            setError('Algunos archivos exceden el tamaño máximo permitido de 10MB');
            return;
        }

        setFiles(prevFiles => [...prevFiles, ...validFiles]);
        setError(null);
    };

    const removeFile = (index) => {
        setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
    };

    const handleUpload = async () => {
        if (!isAuthenticated) {
            setError('Debes iniciar sesión para subir archivos');
            return;
        }

        if (files.length === 0) {
            setError('Por favor, selecciona al menos un archivo');
            return;
        }

        setUploading(true);
        setError(null);

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                setProgress(prev => ({ ...prev, [file.name]: 0 }));
                setProcessingStatus(prev => ({ ...prev, [file.name]: 'Procesando con IA...' }));

                try {
                    // Extraer temas y subtemas usando DeepSeek (IA)
                    const topics = await syllabusService.extractSyllabusTopicsWithAI(file);
                    setExtractedTopics(topics);
                    setProgress(prev => ({ ...prev, [file.name]: 100 }));
                    setProcessingStatus(prev => ({ ...prev, [file.name]: 'Completado' }));
                } catch (error) {
                    console.error(`Error procesando ${file.name}:`, error);
                    setProcessingStatus(prev => ({ 
                        ...prev, 
                        [file.name]: `Error: ${error.message}` 
                    }));
                }
            }

            setFiles([]);
            setProgress({});
            setProcessingStatus({});
        } catch (error) {
            console.error('Error uploading files:', error);
            setError(error.message || 'Error al procesar los archivos');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (fileId) => {
        if (!isAuthenticated) {
            setError('Debes iniciar sesión para eliminar archivos');
            return;
        }

        try {
            const { error } = await supabase
                .from('syllabus')
                .delete()
                .eq('id', fileId);

            if (error) throw error;

            await fetchUploadedFiles();
        } catch (error) {
            console.error('Error deleting file:', error);
            setError('Error al eliminar el archivo');
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Guardar en base de datos los temas y subtemas extraídos por IA
    const handleSaveToDB = async () => {
        if (!extractedTopics.length || !subjectId) return;
        setSaveStatus('guardando');
        try {
            // Guardar temas y subtemas
            for (const topic of extractedTopics) {
                // Insertar tema
                const { data: topicData, error: topicError } = await supabase
                    .from('syllabus_topics')
                    .insert([{
                        subject_id: subjectId,
                        topic_number: topic.number,
                        title: topic.title,
                        description: topic.content || ''
                    }])
                    .select()
                    .single();
                if (topicError) throw topicError;
                // Insertar subtemas
                if (topic.subtopics && topic.subtopics.length > 0) {
                    const subtopicsToInsert = topic.subtopics.map(sub => ({
                        topic_id: topicData.id,
                        subtopic_number: sub.number,
                        title: sub.title,
                        description: sub.content || ''
                    }));
                    const { error: subtopicError } = await supabase
                        .from('syllabus_subtopics')
                        .insert(subtopicsToInsert);
                    if (subtopicError) throw subtopicError;
                }
            }
            setSaveStatus('exito');
        } catch (error) {
            setSaveStatus('error');
            setError('Error al guardar en base de datos: ' + (error.message || error));
        }
    };

    const handleGenerateQuestions = async () => {
        if (!extractedTopics.length || !subjectId) return;
        
        setIsGeneratingQuestions(true);
        setQuestionsStatus('generando');
        try {
            const questions = await syllabusService.generateAndSaveQuestions(subjectId, extractedTopics);
            setGeneratedQuestions(questions);
            setQuestionsStatus('exito');
        } catch (error) {
            console.error('Error generando preguntas:', error);
            setQuestionsStatus('error');
            setError('Error al generar preguntas: ' + error.message);
        } finally {
            setIsGeneratingQuestions(false);
        }
    };

    // Loader si la sesión aún no está definida
    if (sessionProp === undefined) {
        return <div className="syllabus-upload-container">Cargando...</div>;
    }

    // Si no está autenticado, mostrar error
    if (!isAuthenticated) {
        return (
            <div className="syllabus-upload-container">
                <div className="error-message">
                    Debes iniciar sesión para subir y gestionar archivos.
                </div>
            </div>
        );
    }

    if (!subjectId) {
        return (
            <div className="syllabus-upload-container">
                <div className="error-message">
                    Por favor, selecciona una materia para cargar el sílabo.
                </div>
                <div className="upload-section">
                    <div className="upload-instructions">
                        <p>Formatos permitidos: PDF (.pdf), Word (.doc, .docx)</p>
                        <p>Tamaño máximo por archivo: 10MB</p>
                    </div>
                    <input
                        type="file"
                        className="file-input"
                        style={{display: 'block', width: 'auto', opacity: 1, position: 'static'}}
                        onChange={handleFileChange}
                        multiple
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        disabled
                    />
                    <button
                        className="upload-button"
                        onClick={handleUpload}
                        disabled
                    >
                        Subir Archivos
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="syllabus-upload-container">
            <div className="select-subject-section" style={{ marginBottom: '1rem' }}>
                <label htmlFor="select-syllabus-subject">Selecciona una asignatura:</label>
                <select
                    id="select-syllabus-subject"
                    value={subjectId}
                    onChange={e => setSubjectId(e.target.value)}
                >
                    <option value="">Selecciona una asignatura</option>
                    {subjects && subjects.map(subject => (
                        <option key={subject.id} value={subject.id}>{subject.name}</option>
                    ))}
                </select>
                {subjects && subjects.length === 0 && (
                    <p className="no-subjects-message">
                        No tienes asignaturas registradas. Por favor, crea una primero.
                    </p>
                )}
            </div>
            <div className="upload-section">
                <div className="upload-instructions">
                    <p>Formatos permitidos: PDF (.pdf), Word (.doc, .docx)</p>
                    <p>Tamaño máximo por archivo: 10MB</p>
                </div>
                <input
                    type="file"
                    className="file-input"
                    style={{display: 'block', width: 'auto', opacity: 1, position: 'static'}}
                    onChange={handleFileChange}
                    multiple
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                />
                <button
                    className="upload-button"
                    onClick={handleUpload}
                    disabled={uploading || files.length === 0}
                >
                    {uploading ? 'Subiendo...' : 'Subir Archivos'}
                </button>
            </div>

            {error && <div className="error-message">{error}</div>}

            {files.length > 0 && (
                <div className="files-queue">
                    <h4>Archivos en cola</h4>
                    <div className="files-list">
                        {files.map((file, index) => (
                            <div key={index} className="file-item">
                                <div className="file-details">
                                    <span className="file-name">{file.name}</span>
                                    <span className="file-type">{file.type}</span>
                                    <span className="file-size">{formatFileSize(file.size)}</span>
                                    {progress[file.name] !== undefined && (
                                        <div className="progress-bar">
                                            <div
                                                className="progress-fill"
                                                style={{ width: `${progress[file.name]}%` }}
                                            />
                                        </div>
                                    )}
                                    {processingStatus[file.name] && (
                                        <span className="processing-status">
                                            {processingStatus[file.name]}
                                        </span>
                                    )}
                                </div>
                                <div className="file-actions">
                                    <button
                                        className="remove-button"
                                        onClick={() => removeFile(index)}
                                        disabled={uploading}
                                    >
                                        Eliminar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {uploadedFiles.length > 0 && subjectId && (
                <div className="uploaded-files">
                    <h4>Archivos subidos</h4>
                    <div className="files-list">
                        {uploadedFiles.map((file) => (
                            <div key={file.id} className="file-item">
                                <div className="file-details">
                                    <span className="file-name">{file.file_name}</span>
                                    <span className="file-type">{file.file_type}</span>
                                    {file.syllabus_topics && (
                                        <span className="topics-count">
                                            {file.syllabus_topics.length} temas analizados
                                        </span>
                                    )}
                                </div>
                                <div className="file-actions">
                                    <a
                                        href={file.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="view-button"
                                    >
                                        Ver
                                    </a>
                                    <button
                                        className="delete-button"
                                        onClick={() => handleDelete(file.id)}
                                        disabled={uploading}
                                    >
                                        Eliminar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Mostrar la grilla de temas extraídos si existen */}
            {extractedTopics.length > 0 && (
                <div className="syllabus-grid" style={{marginTop:'2rem'}}>
                    <h3>Temas y subtemas extraídos del sílabo</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>N° Tema</th>
                                <th>Título</th>
                                <th>Descripción</th>
                                <th>Subtemas</th>
                            </tr>
                        </thead>
                        <tbody>
                            {extractedTopics.map(topic => (
                                <tr key={topic.number + '-' + topic.title}>
                                    <td>{topic.number}</td>
                                    <td>{topic.title}</td>
                                    <td>{topic.content}</td>
                                    <td>
                                        {topic.subtopics && topic.subtopics.length > 0 ? (
                                            <ul>
                                                {topic.subtopics.map(sub => (
                                                    <li key={sub.number + '-' + sub.title}>
                                                        <strong>{sub.number}:</strong> {sub.title}
                                                        <div style={{ fontSize: '0.95em', color: '#666' }}>{sub.content}</div>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <span style={{ color: '#aaa' }}>Sin subtemas</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="action-buttons" style={{marginTop:'1.5rem', display:'flex', gap:'1rem'}}>
                        <button 
                            className="upload-button" 
                            onClick={handleSaveToDB}
                            disabled={saveStatus==='guardando'}
                        >
                            {saveStatus==='guardando' ? 'Guardando...' : 'Guardar en base de datos'}
                        </button>
                        <button 
                            className="upload-button" 
                            onClick={handleGenerateQuestions}
                            disabled={isGeneratingQuestions || saveStatus!=='exito'}
                            style={{backgroundColor: saveStatus==='exito' ? '#4CAF50' : '#ccc'}}
                        >
                            {isGeneratingQuestions ? 'Generando preguntas...' : 'Generar preguntas de evaluación'}
                        </button>
                    </div>
                    {saveStatus==='exito' && <div style={{color:'green',marginTop:'1rem'}}>¡Temas y subtemas guardados correctamente!</div>}
                    {saveStatus==='error' && <div style={{color:'red',marginTop:'1rem'}}>Ocurrió un error al guardar en base de datos.</div>}
                    {questionsStatus==='exito' && <div style={{color:'green',marginTop:'1rem'}}>¡Preguntas generadas y guardadas correctamente!</div>}
                    {questionsStatus==='error' && <div style={{color:'red',marginTop:'1rem'}}>Error al generar preguntas.</div>}
                </div>
            )}

            {/* Mostrar las preguntas generadas */}
            {generatedQuestions.length > 0 && (
                <div className="questions-grid" style={{marginTop:'2rem'}}>
                    <h3>Preguntas de evaluación generadas</h3>
                    <div className="questions-list">
                        {generatedQuestions.map((question, index) => (
                            <div key={question.id} className="question-card">
                                <div className="question-header">
                                    <span className="question-number">Pregunta {index + 1}</span>
                                    <span className="question-topic">Tema: {question.syllabus_topics?.title || 'N/A'}</span>
                                </div>
                                <div className="question-content">
                                    <p className="question-text">{question.question_text}</p>
                                    <div className="options-list">
                                        <div className={`option ${question.correct_answer === 'a' ? 'correct' : ''}`}>
                                            <span className="option-label">a)</span> {question.option_a}
                                        </div>
                                        <div className={`option ${question.correct_answer === 'b' ? 'correct' : ''}`}>
                                            <span className="option-label">b)</span> {question.option_b}
                                        </div>
                                        <div className={`option ${question.correct_answer === 'c' ? 'correct' : ''}`}>
                                            <span className="option-label">c)</span> {question.option_c}
                                        </div>
                                        <div className={`option ${question.correct_answer === 'd' ? 'correct' : ''}`}>
                                            <span className="option-label">d)</span> {question.option_d}
                                        </div>
                                    </div>
                                    <div className="explanation">
                                        <strong>Explicación:</strong> {question.explanation}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SyllabusUpload; 