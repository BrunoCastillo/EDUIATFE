import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import './FileUpload.css';
import { syllabusService } from '../../services/syllabus.service';
import { deepseekService } from '../../services/deepseek.service';
import { ragService } from '../../services/rag.service';

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
    const [loading, setLoading] = useState(false);
    const [notification, setNotification] = useState(null);
    
    // Nuevos estados para barra de progreso detallada
    const [questionProgress, setQuestionProgress] = useState({
        currentFile: '',
        currentStep: '',
        progress: 0,
        totalFiles: 0,
        processedFiles: 0,
        steps: []
    });

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
            console.log('Consulta ejecutada:', { subjectId, archivosEncontrados: data?.length || 0, primerArchivo: data?.[0] });
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

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            setLoading(true);
            setError(null);

            // 1. Subir archivo a Supabase Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${subjectId}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Obtener URL pública
            const { data: { publicUrl } } = supabase.storage
                .from('documents')
                .getPublicUrl(filePath);

            // 3. Guardar referencia en la base de datos
            const { data: document, error: dbError } = await supabase
                .from('documents')
                .insert([{
                    subject_id: subjectId,
                    file_name: file.name,
                    file_path: filePath,
                    file_url: publicUrl,
                    file_type: file.type,
                    file_size: file.size
                }])
                .select()
                .single();

            if (dbError) throw dbError;

            // 4. Procesar el documento completo (embeddings + preguntas)
            const result = await ragService.processDocument(file, subjectId);
            console.log('Documento procesado:', result);

            setNotification({
                type: 'success',
                message: `Documento subido y procesado exitosamente. Se generaron ${result.questionsCount} preguntas.`
            });

            // 5. Actualizar la lista de documentos
            fetchDocuments();

        } catch (error) {
            console.error('Error al subir el archivo:', error);
            setError(error.message);
            setNotification({
                type: 'error',
                message: 'Error al subir el archivo: ' + error.message
            });
        } finally {
            setLoading(false);
        }
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

                // === Procesar archivos con RAG (Embeddings + Preguntas) ===
                const validTextTypes = [
                    'application/pdf',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/vnd.ms-powerpoint',
                    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                ];
                if (validTextTypes.includes(file.type)) {
                    // Configurar progreso inicial con pasos detallados
                    setQuestionProgress({
                        currentFile: file.name,
                        currentStep: 'Iniciando procesamiento completo...',
                        progress: 0,
                        totalFiles: files.filter(f => validTextTypes.includes(f.type)).length,
                        processedFiles: i,
                        steps: [
                            'Extrayendo texto del archivo',
                            'Procesando texto (eliminando stopwords)',
                            'Dividiendo en chunks',
                            'Generando embeddings',
                            'Generando preguntas con IA',
                            'Guardando en base de datos'
                        ]
                    });
                    
                    setIsGeneratingQuestions(true);
                    setQuestionsStatus('generando');
                    // Mostrar log de inicio
                    setQuestionLogs(prev => ([...prev, { fileName: file.name, status: 'generando', message: 'Procesando documento completo: ' + file.name + '...' }]));
                    
                    try {
                        // Paso 1: Extraer texto del archivo (0-10%)
                        setQuestionProgress(prev => ({
                            ...prev,
                            currentStep: 'Extrayendo texto del archivo...',
                            progress: 5
                        }));
                        
                        // Usar ragService que maneja todo el proceso
                        const result = await ragService.processDocument(file, subjectId, {
                            onTextExtracted: () => {
                                setQuestionProgress(prev => ({
                                    ...prev,
                                    currentStep: 'Texto extraído, procesando contenido...',
                                    progress: 10
                                }));
                            },
                            onTextProcessed: (stats) => {
                                setQuestionProgress(prev => ({
                                    ...prev,
                                    currentStep: `Texto procesado: ${stats.originalWords} palabras → ${stats.filteredWords} palabras (${stats.removedStopwords} stopwords eliminadas)`,
                                    progress: 20
                                }));
                            },
                            onChunksCreated: (chunkCount) => {
                                setQuestionProgress(prev => ({
                                    ...prev,
                                    currentStep: `Texto dividido en ${chunkCount} chunks para procesamiento`,
                                    progress: 30
                                }));
                            },
                            onEmbeddingsStart: () => {
                                setQuestionProgress(prev => ({
                                    ...prev,
                                    currentStep: 'Generando embeddings para búsqueda semántica...',
                                    progress: 40
                                }));
                            },
                            onEmbeddingsComplete: () => {
                                setQuestionProgress(prev => ({
                                    ...prev,
                                    currentStep: 'Embeddings generados, iniciando creación de preguntas...',
                                    progress: 50
                                }));
                            },
                            onQuestionProgress: (current, total) => {
                                const questionProgress = 50 + ((current / total) * 40); // 50% a 90%
                                setQuestionProgress(prev => ({
                                    ...prev,
                                    currentStep: `Generando pregunta ${current} de ${total} con IA...`,
                                    progress: questionProgress
                                }));
                            },
                            onQuestionsComplete: (questionCount) => {
                                setQuestionProgress(prev => ({
                                    ...prev,
                                    currentStep: `${questionCount} preguntas generadas, guardando en base de datos...`,
                                    progress: 95
                                }));
                            }
                        });
                        
                        // Completado
                        setQuestionProgress(prev => ({
                            ...prev,
                            currentStep: `¡Procesamiento completado! ${result.questionsCount} preguntas generadas`,
                            progress: 100,
                            processedFiles: prev.processedFiles + 1
                        }));
                        
                        // Simular las preguntas para mostrar en la UI (ya están guardadas por ragService)
                        if (result.questionsCount > 0) {
                            // Obtener las preguntas recién creadas
                            const { data: savedQuestions } = await supabase
                                .from('subject_questions')
                                .select('*')
                                .eq('subject_id', subjectId)
                                .order('created_at', { ascending: false })
                                .limit(result.questionsCount);
                                
                            setGeneratedQuestions(prev => ([
                                ...prev,
                                { fileName: file.name, questions: savedQuestions || [] }
                            ]));
                        }
                        
                        setQuestionsStatus('exito');
                        // Log de éxito
                        setQuestionLogs(prev => ([...prev, { fileName: file.name, status: 'exito', message: `¡Documento procesado exitosamente! ${result.questionsCount} preguntas generadas para ${file.name}` }]));
                        
                    } catch (err) {
                        setQuestionsStatus('error');
                        setQuestionsError('Error al procesar documento: ' + (err.message || err));
                        // Log de error
                        setQuestionLogs(prev => ([...prev, { fileName: file.name, status: 'error', message: 'Error al procesar documento ' + file.name + ': ' + (err.message || err) }]));
                        
                        // Actualizar progreso con error
                        setQuestionProgress(prev => ({
                            ...prev,
                            currentStep: 'Error en el procesamiento',
                            progress: 100
                        }));
                    } finally {
                        // Si es el último archivo, cerrar el modal después de 3 segundos
                        if (i === files.length - 1) {
                            setTimeout(() => {
                                setIsGeneratingQuestions(false);
                                setQuestionProgress({
                                    currentFile: '',
                                    currentStep: '',
                                    progress: 0,
                                    totalFiles: 0,
                                    processedFiles: 0,
                                    steps: []
                                });
                            }, 3000);
                        }
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

    // Componente del Modal de Progreso
    const ProgressModal = () => {
        if (!isGeneratingQuestions) return null;

        const progressPercentage = questionProgress.progress;
        const overallProgress = questionProgress.totalFiles > 0 
            ? ((questionProgress.processedFiles / questionProgress.totalFiles) * 100) 
            : 0;

        return (
            <div className="progress-modal-overlay">
                <div className="progress-modal">
                    <div className="progress-modal-header">
                        <h3>🤖 Generando Preguntas con IA</h3>
                        <p>Por favor espera mientras procesa los archivos...</p>
                    </div>
                    
                    <div className="progress-modal-content">
                        <div className="current-file">
                            <strong>Archivo actual:</strong> {questionProgress.currentFile}
                        </div>
                        
                        <div className="current-step">
                            <strong>Estado:</strong> {questionProgress.currentStep}
                        </div>
                        
                        <div className="progress-section">
                            <div className="progress-label">
                                Progreso del archivo actual: {progressPercentage}%
                            </div>
                            <div className="progress-bar">
                                <div 
                                    className="progress-fill" 
                                    style={{ width: `${progressPercentage}%` }}
                                ></div>
                            </div>
                        </div>
                        
                        {questionProgress.totalFiles > 1 && (
                            <div className="progress-section">
                                <div className="progress-label">
                                    Progreso general: {questionProgress.processedFiles} de {questionProgress.totalFiles} archivos
                                </div>
                                <div className="progress-bar">
                                    <div 
                                        className="progress-fill overall" 
                                        style={{ width: `${overallProgress}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}
                        
                        <div className="progress-steps">
                            {questionProgress.steps.map((step, index) => {
                                const stepThreshold = (index + 1) * (100 / questionProgress.steps.length);
                                const isCompleted = progressPercentage >= stepThreshold;
                                const isActive = progressPercentage > (index * (100 / questionProgress.steps.length)) && progressPercentage < stepThreshold;
                                
                                return (
                                    <div 
                                        key={index} 
                                        className={`progress-step ${
                                            isCompleted ? 'completed' : ''
                                        } ${
                                            isActive ? 'active' : ''
                                        }`}
                                    >
                                        <div className="step-number">{index + 1}</div>
                                        <div className="step-text">{step}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    
                    <div className="progress-modal-footer">
                        <div className="loading-animation">
                            <div className="spinner"></div>
                            <span>Procesando...</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

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
                    disabled={uploading || files.length === 0 || isGeneratingQuestions}
                    className="upload-button"
                >
                    {isGeneratingQuestions ? 'Procesando...' : (uploading ? 'Subiendo...' : 'Subir y procesar')}
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

            {/* Modal de progreso para generación de preguntas */}
            <ProgressModal />
        </div>
    );
};

export default FileUpload; 