import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import './FileUpload.css';
import { syllabusService } from '../../services/syllabus.service';
import { deepseekService } from '../../services/deepseek.service';

// Configurar el worker de PDF.js con la versión compatible
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js`;

const FileUpload = ({ subjectId, session: sessionProp }) => {
    const navigate = useNavigate();
    const [files, setFiles] = useState([]);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [error, setError] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState({});
    const [selectedFolder, setSelectedFolder] = useState('documents');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [session, setSession] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [showPdfViewer, setShowPdfViewer] = useState(false);
    const [generatedQuestions, setGeneratedQuestions] = useState([]);
    const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
    const [questionsStatus, setQuestionsStatus] = useState(null);
    const [questionsError, setQuestionsError] = useState(null);
    const [questionLogs, setQuestionLogs] = useState([]);

    useEffect(() => {
        checkAuth();
    }, [sessionProp]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchUploadedFiles();
        }
    }, [selectedFolder, subjectId, isAuthenticated]);

    const checkAuth = async () => {
        try {
            setIsLoading(true);
            let currentSession = sessionProp;
            if (!currentSession) {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) {
                    console.error('Error al verificar sesión:', error);
                    throw error;
                }
                currentSession = session;
            }
            console.log('[FileUpload] Sesión recibida:', currentSession);
            setSession(currentSession);
            if (!currentSession) {
                console.log('[FileUpload] No hay sesión activa, redirigiendo a login...');
                navigate('/login');
                return;
            }
            setIsAuthenticated(true);
        } catch (error) {
            console.error('[FileUpload] Error checking auth:', error);
            setIsAuthenticated(false);
            navigate('/login');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchUploadedFiles = async () => {
        try {
            console.log('Intentando obtener archivos para subjectId:', subjectId);
            const { data, error } = await supabase
                .from('files')
                .select('*')
                .eq('folder', selectedFolder)
                .eq('subject_id', subjectId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error al obtener archivos:', error);
                throw error;
            }
            console.log('Archivos obtenidos:', data);
            setUploadedFiles(data || []);
        } catch (error) {
            console.error('Error al cargar archivos:', error);
            setError('Error al cargar los archivos');
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
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-powerpoint',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                'image/jpeg',
                'image/png',
                'image/gif'
            ];
            return validTypes.includes(file.type);
        });

        if (validFiles.length !== selectedFiles.length) {
            setError('Algunos archivos no son válidos. Solo se permiten PDF, Word, PowerPoint e imágenes.');
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
        setQuestionsError(null);
        setGeneratedQuestions([]);
        setQuestionsStatus(null);
        setQuestionLogs([]);

        try {
            // Verificar la sesión antes de subir
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw sessionError;
            if (!session) throw new Error('No hay sesión activa');

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileName = `${Date.now()}-${file.name}`;
                const filePath = fileName;
                setProgress(prev => ({ ...prev, [fileName]: 0 }));

                // Subir archivo al storage
                const { error: uploadError } = await supabase.storage
                    .from('documents')
                    .upload(filePath, file, {
                        cacheControl: '3600',
                        upsert: false
                    });
                if (uploadError) {
                    console.error('Error al subir archivo:', uploadError);
                    throw new Error('Error al subir el archivo al almacenamiento');
                }

                // Guardar en la base de datos
                const { error: dbError } = await supabase
                    .from('files')
                    .insert([
                        {
                            subject_id: subjectId,
                            name: file.name,
                            path: filePath,
                            type: file.type,
                            size: file.size,
                            folder: selectedFolder
                        }
                    ]);
                if (dbError) {
                    console.error('Error al guardar en la base de datos:', dbError);
                    throw new Error('Error al guardar la información del archivo');
                }

                setProgress(prev => ({ ...prev, [fileName]: 100 }));

                // === Generar preguntas solo para archivos de texto (PDF, Word, PowerPoint) ===
                const validTextTypes = [
                    'application/pdf',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/vnd.ms-powerpoint',
                    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                ];
                if (validTextTypes.includes(file.type)) {
                    setIsGeneratingQuestions(true);
                    setQuestionsStatus('generando');
                    // Mostrar log de inicio
                    setQuestionLogs(prev => ([...prev, { fileName: file.name, status: 'generando', message: 'Generando preguntas para ' + file.name + '...' }]));
                    try {
                        // Extraer texto del archivo
                        const text = await syllabusService.extractTextFromFile(file);
                        // Construir un objeto de "tema único" para DeepSeek
                        const topics = [{ number: 1, title: file.name, content: text, subtopics: [] }];
                        // Generar preguntas
                        const questions = await deepseekService.generateQuestions(topics);
                        // Guardar preguntas en la base de datos
                        const questionsToInsert = questions.map(q => ({
                            subject_id: subjectId,
                            topic_id: null, // No hay topic_id porque no es sílabo
                            question_text: q.question,
                            option_a: q.options.a,
                            option_b: q.options.b,
                            option_c: q.options.c,
                            option_d: q.options.d,
                            correct_answer: q.correct_answer,
                            explanation: q.explanation
                        }));
                        const { data, error } = await supabase
                            .from('subject_questions')
                            .insert(questionsToInsert)
                            .select();
                        if (error) {
                            setQuestionsStatus('error');
                            setQuestionsError('Error al guardar preguntas: ' + error.message);
                            // Log de error
                            setQuestionLogs(prev => ([...prev, { fileName: file.name, status: 'error', message: 'Error al guardar preguntas para ' + file.name + ': ' + error.message }]));
                            throw error;
                        }
                        // Acumular preguntas por archivo
                        setGeneratedQuestions(prev => ([
                            ...prev,
                            { fileName: file.name, questions: data }
                        ]));
                        setQuestionsStatus('exito');
                        // Log de éxito
                        setQuestionLogs(prev => ([...prev, { fileName: file.name, status: 'exito', message: '¡Preguntas generadas y guardadas para ' + file.name + '!' }]));
                    } catch (err) {
                        setQuestionsStatus('error');
                        setQuestionsError('Error al generar preguntas: ' + (err.message || err));
                        // Log de error
                        setQuestionLogs(prev => ([...prev, { fileName: file.name, status: 'error', message: 'Error al generar preguntas para ' + file.name + ': ' + (err.message || err) }]));
                    } finally {
                        setIsGeneratingQuestions(false);
                    }
                }
            }

            await fetchUploadedFiles();
            setFiles([]);
            setProgress({});
        } catch (error) {
            console.error('Error al subir archivos:', error);
            setError(error.message || 'Error al subir los archivos');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (fileId, filePath) => {
        if (!isAuthenticated) {
            setError('Debes iniciar sesión para eliminar archivos');
            return;
        }

        try {
            // Primero eliminar el archivo del storage
            const { error: storageError } = await supabase.storage
                .from('documents')
                .remove([filePath]);

            if (storageError) {
                console.error('Error al eliminar archivo del storage:', storageError);
                throw new Error('Error al eliminar el archivo del almacenamiento');
            }

            // Luego eliminar el registro de la base de datos
            const { error: dbError } = await supabase
                .from('files')
                .delete()
                .eq('id', fileId);

            if (dbError) {
                console.error('Error al eliminar registro de la base de datos:', dbError);
                throw new Error('Error al eliminar el registro del archivo');
            }

            // Actualizar la lista de archivos
            await fetchUploadedFiles();
            setError(null);
        } catch (error) {
            console.error('Error al eliminar archivo:', error);
            setError('Error al eliminar el archivo: ' + error.message);
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleViewFile = async (file) => {
        try {
            // Construir la URL del archivo correctamente
            const fileName = file.path.split('/').pop();
            const fileUrl = `http://localhost:3001/uploads/${fileName}`;
            console.log('Intentando cargar archivo desde:', fileUrl);
            
            setSelectedFile(fileUrl);
            setShowPdfViewer(true);
        } catch (error) {
            console.error('Error al cargar el archivo:', error);
            setError('Error al cargar el archivo para visualización');
        }
    };

    const onDocumentLoadSuccess = ({ numPages }) => {
        setNumPages(numPages);
        setPageNumber(1);
    };

    const changePage = (offset) => {
        setPageNumber(prevPageNumber => prevPageNumber + offset);
    };

    const previousPage = () => changePage(-1);
    const nextPage = () => changePage(1);

    if (isLoading) {
        return (
            <div className="file-upload-container">
                <div className="loading-message">
                    Verificando autenticación...
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="file-upload-container">
                <div className="error-message">
                    Debes iniciar sesión para subir y gestionar archivos.
                    <button 
                        onClick={() => navigate('/login')}
                        className="login-button"
                    >
                        Ir a inicio de sesión
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="file-upload-container">
            <div className="folder-selector">
                <label htmlFor="folder">Seleccionar carpeta:</label>
                <select
                    id="folder"
                    value={selectedFolder}
                    onChange={(e) => setSelectedFolder(e.target.value)}
                >
                    <option value="documents">Documentos</option>
                    <option value="assignments">Tareas</option>
                    <option value="resources">Recursos</option>
                </select>
            </div>

            <div className="upload-section">
                <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.gif"
                />
                <button 
                    onClick={handleUpload}
                    disabled={uploading || files.length === 0}
                    className="upload-button"
                >
                    {uploading ? 'Subiendo...' : 'Subir archivos'}
                </button>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="files-list">
                <h3>Archivos subidos:</h3>
                {uploadedFiles.length === 0 ? (
                    <p>No hay archivos subidos</p>
                ) : (
                    <div className="files-grid">
                        {uploadedFiles.map((file) => (
                            <div key={file.id} className="file-card">
                                <div className="file-info">
                                    <h4>{file.name}</h4>
                                    <p>Tamaño: {formatFileSize(file.size)}</p>
                                    <p>Fecha: {new Date(file.created_at).toLocaleDateString()}</p>
                                </div>
                                <div className="file-actions">
                                    <button 
                                        onClick={() => handleViewFile(file)}
                                        className="view-button"
                                    >
                                        Ver
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(file.id, file.path)}
                                        className="delete-button"
                                    >
                                        Eliminar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {generatedQuestions.length > 0 && (
                <div className="questions-grid" style={{marginTop:'2rem'}}>
                    <h3>Preguntas de evaluación generadas</h3>
                    {generatedQuestions.map((block, idx) => (
                        <div key={block.fileName + '-' + idx} className="questions-list">
                            <h4 style={{marginBottom:'1rem', color:'#357abd'}}>{block.fileName}</h4>
                            {block.questions.map((question, index) => (
                                <div key={question.id || index} className="question-card">
                                    <div className="question-header">
                                        <span className="question-number">Pregunta {index + 1}</span>
                                        <span className="question-topic">Archivo: {block.fileName}</span>
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
                    ))}
                    {questionsStatus==='exito' && <div style={{color:'green',marginTop:'1rem'}}>¡Preguntas generadas y guardadas correctamente!</div>}
                    {questionsStatus==='error' && <div style={{color:'red',marginTop:'1rem'}}>{questionsError}</div>}
                    {isGeneratingQuestions && <div style={{color:'#4a90e2',marginTop:'1rem'}}>Generando preguntas...</div>}
                </div>
            )}

            {showPdfViewer && selectedFile && (
                <div className="pdf-viewer-modal">
                    <div className="pdf-viewer-content">
                        <div className="pdf-controls">
                            <button onClick={previousPage} disabled={pageNumber <= 1}>
                                Anterior
                            </button>
                            <span>
                                Página {pageNumber} de {numPages || '?'}
                            </span>
                            <button onClick={nextPage} disabled={pageNumber >= (numPages || 1)}>
                                Siguiente
                            </button>
                            <button 
                                onClick={() => setShowPdfViewer(false)}
                                className="close-button"
                            >
                                Cerrar
                            </button>
                        </div>
                        <Document
                            file={selectedFile}
                            onLoadSuccess={onDocumentLoadSuccess}
                            onLoadError={(error) => {
                                console.error('Error al cargar el PDF:', error);
                                setError('Error al cargar el PDF. Por favor, intenta nuevamente.');
                                setShowPdfViewer(false);
                            }}
                            loading={
                                <div className="pdf-loading">
                                    Cargando documento...
                                </div>
                            }
                            className="pdf-document"
                        >
                            <Page 
                                pageNumber={pageNumber} 
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                                loading={
                                    <div className="pdf-loading">
                                        Cargando página...
                                    </div>
                                }
                            />
                        </Document>
                    </div>
                </div>
            )}

            {files.length > 0 && (
                <div className="selected-files">
                    <h3>Archivos seleccionados:</h3>
                    <div className="files-grid">
                        {files.map((file, index) => (
                            <div key={index} className="file-card">
                                <div className="file-info">
                                    <h4>{file.name}</h4>
                                    <p>Tamaño: {formatFileSize(file.size)}</p>
                                </div>
                                <button 
                                    onClick={() => removeFile(index)}
                                    className="remove-button"
                                >
                                    Eliminar
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Mostrar logs visuales del proceso de generación de preguntas */}
            {questionLogs.length > 0 && (
                <div className="question-logs" style={{marginTop:'1.5rem'}}>
                    <h4>Estado de generación de preguntas:</h4>
                    <ul style={{paddingLeft:'1.2rem'}}>
                        {questionLogs.map((log, idx) => (
                            <li key={log.fileName + '-' + idx} style={{color: log.status==='error' ? 'red' : (log.status==='exito' ? 'green' : '#357abd')}}>
                                {log.message}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default FileUpload; 