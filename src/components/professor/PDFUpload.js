import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import { Document, Page, pdfjs } from 'react-pdf';
import { nlpService } from '../../services/nlp.service';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import './PDFUpload.css';
import { syllabusService } from '../../services/syllabus.service';
import { deepseekService } from '../../services/deepseek.service';
import { ragService } from '../../services/rag.service';

// Configurar el worker de PDF.js

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;

const PDFUpload = ({ subjectId, session: sessionProp }) => {
    console.log('🔥 PDFUpload renderizando - subjectId:', subjectId);
    
    const [file, setFile] = useState(null);
    const [title, setTitle] = useState('');
    const [uploadedFileUrl, setUploadedFileUrl] = useState(null);
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [activeTab, setActiveTab] = useState('files');
    const [user, setUser] = useState(null);
    const [generatedQuestions, setGeneratedQuestions] = useState([]);
    const [questionLogs, setQuestionLogs] = useState([]);
    const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
    
    console.log('🔥 Estados iniciales - isGeneratingQuestions:', isGeneratingQuestions);
    
    // Estados para barra de progreso detallada
    const [questionProgress, setQuestionProgress] = useState({
        currentFile: '',
        currentStep: '',
        progress: 0,
        totalFiles: 0,
        processedFiles: 0,
        steps: []
    });

    const handleFileChange = (event) => {
        const selectedFile = event.target.files[0];
        if (selectedFile && selectedFile.type === 'application/pdf') {
            setFile(selectedFile);
            setUploadedFileUrl(URL.createObjectURL(selectedFile));
            setError(null);
        } else {
            setError('Por favor, selecciona un archivo PDF válido');
            setFile(null);
            setUploadedFileUrl(null);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log('🔥 handleSubmit iniciado');
        
        if (!file || !title) {
            setError('Por favor, selecciona un archivo y proporciona un título');
            return;
        }

        setLoading(true);
        setError(null);
        setQuestionLogs([]);
        
        console.log('🔥 Estados iniciales configurados');
        
        // MOSTRAR BARRA DE PROGRESO INMEDIATAMENTE
        console.log('🔄 Activando barra de progreso INMEDIATAMENTE...');
        setQuestionProgress({
            currentFile: file.name,
            currentStep: 'Preparando archivo para procesamiento...',
            progress: 5,
            totalFiles: 1,
            processedFiles: 0,
            steps: []
        });
        setIsGeneratingQuestions(true);
        console.log('✅ Estado isGeneratingQuestions establecido a TRUE INMEDIATAMENTE');

        try {
            // Convertir el archivo PDF a base64
            console.log('🔄 Convirtiendo archivo a base64...');
            setQuestionProgress(prev => ({
                ...prev,
                currentStep: 'Convirtiendo archivo a base64...',
                progress: 10
            }));
            
            const toBase64 = file => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result.split(',')[1]); // Solo la parte base64
                reader.onerror = error => reject(error);
            });
            const fileBase64 = await toBase64(file);

            console.log('✅ Archivo convertido a base64');
            setQuestionProgress(prev => ({
                ...prev,
                currentStep: 'Archivo convertido, iniciando procesamiento con IA...',
                progress: 15
            }));

            // Guardar la información en la base de datos
            const fileData = {
                title,
                subject_id: subjectId,
                user_id: sessionProp.user.id,
                file_base64: fileBase64,
                file_name: file.name,
                file_type: file.type,
                file_size: file.size
            };

            console.log('Enviando datos al servidor:', fileData);

            // NO guardar en servidor - procesar directamente con ragService
            console.log('Procesando archivo directamente con IA (sin guardar en servidor)...');

            console.log('📁 Iniciando procesamiento con IA...');
            
            // Esperar un momento para que React actualice el estado y muestre la barra
            await new Promise(resolve => setTimeout(resolve, 500));
            console.log('✅ Después del delay - isGeneratingQuestions debería estar visible');
            
            try {
                console.log('🚀 Iniciando ragService.processDocument con callbacks...');
                const result = await ragService.processDocument(file, subjectId, {
                    onTextExtracted: () => {
                        console.log('📄 Callback: onTextExtracted ejecutado');
                        setQuestionProgress(prev => ({
                            ...prev,
                            currentStep: 'Texto extraído, procesando contenido...',
                            progress: 10
                        }));
                    },
                    onTextProcessed: (stats) => {
                        console.log('🔤 Callback: onTextProcessed ejecutado', stats);
                        setQuestionProgress(prev => ({
                            ...prev,
                            currentStep: `Texto procesado: ${stats.originalWords} palabras → ${stats.filteredWords} palabras (${stats.removedStopwords} stopwords eliminadas)`,
                            progress: 20
                        }));
                    },
                    onChunksCreated: (chunkCount) => {
                        console.log('📚 Callback: onChunksCreated ejecutado', chunkCount);
                        setQuestionProgress(prev => ({
                            ...prev,
                            currentStep: `Texto dividido en ${chunkCount} chunks para procesamiento`,
                            progress: 30
                        }));
                    },
                    onEmbeddingsStart: () => {
                        console.log('🧠 Callback: onEmbeddingsStart ejecutado');
                        setQuestionProgress(prev => ({
                            ...prev,
                            currentStep: 'Generando embeddings para búsqueda semántica...',
                            progress: 40
                        }));
                    },
                    onEmbeddingsComplete: () => {
                        console.log('✅ Callback: onEmbeddingsComplete ejecutado');
                        setQuestionProgress(prev => ({
                            ...prev,
                            currentStep: 'Embeddings generados, iniciando creación de preguntas...',
                            progress: 50
                        }));
                    },
                    onQuestionProgress: (current, total) => {
                        console.log('❓ Callback: onQuestionProgress ejecutado', current, 'de', total);
                        const questionProgressPercentage = 50 + ((current / total) * 40); // 50% a 90%
                        setQuestionProgress(prev => ({
                            ...prev,
                            currentStep: `Generando pregunta ${current} de ${total} con IA...`,
                            progress: questionProgressPercentage
                        }));
                    },
                    onQuestionsComplete: (questionCount) => {
                        console.log('🎯 Callback: onQuestionsComplete ejecutado', questionCount);
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
                    processedFiles: 1
                }));
                
                // Obtener las preguntas recién creadas para mostrar en la UI
                if (result.questionsCount > 0) {
                    const { data: savedQuestions } = await supabase
                        .from('subject_questions')
                        .select('*')
                        .eq('subject_id', subjectId)
                        .order('created_at', { ascending: false })
                        .limit(result.questionsCount);
                        
                    setGeneratedQuestions([{ fileName: file.name, questions: savedQuestions || [] }]);
                }
                
                setQuestionLogs(prev => ([...prev, { fileName: file.name, status: 'exito', message: `¡PDF procesado exitosamente! ${result.questionsCount} preguntas generadas` }]));
                console.log('Procesamiento del PDF completado.');
                
            } catch (processError) {
                console.error('Error durante el procesamiento del PDF:', processError);
                
                // Extraer mensaje de error más específico
                let errorMessage = 'Error durante el procesamiento del PDF';
                
                if (processError.message) {
                    if (processError.message.includes('DeepSeek API error')) {
                        errorMessage = 'Error en el servicio de IA. Verifica la configuración de la API DeepSeek.';
                    } else if (processError.message.includes('Error al procesar documento')) {
                        errorMessage = `Error al procesar el documento: ${processError.message}`;
                    } else if (processError.message.includes('Error al generar preguntas')) {
                        errorMessage = `Error al generar preguntas: ${processError.message}`;
                    } else {
                        errorMessage = `Error: ${processError.message}`;
                    }
                } else {
                    errorMessage = 'Error desconocido durante el procesamiento';
                }
                
                setQuestionLogs(prev => ([...prev, { fileName: file.name, status: 'error', message: errorMessage }]));
                
                setQuestionProgress(prev => ({
                    ...prev,
                    currentStep: 'Error en el procesamiento',
                    progress: 100
                }));
            } finally {
                // Cerrar el modal después de 5 segundos para dar tiempo a ver el resultado
                console.log('⏰ Programando cierre del modal en 5 segundos...');
                setTimeout(() => {
                    console.log('🔄 Cerrando modal de progreso...');
                    setIsGeneratingQuestions(false);
                    setQuestionProgress({
                        currentFile: '',
                        currentStep: '',
                        progress: 0,
                        totalFiles: 0,
                        processedFiles: 0,
                        steps: []
                    });
                }, 5000);
            }

            // Limpiar el formulario
            setFile(null);
            setTitle('');
            setUploadedFileUrl(null);

        } catch (err) {
            console.error('Error completo:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const onDocumentLoadSuccess = ({ numPages }) => {
        setNumPages(numPages);
        setPageNumber(1);
    };

    useEffect(() => {
        // Asegurarse de que fetchSubjects y checkSession se llamen solo una vez o cuando sea necesario
        // Esta lógica de useEffect parece ser para el Dashboard general, no específica de PDFUpload.
        // Si PDFUpload se usa dentro del Dashboard, es probable que esta lógica deba estar en el padre.
        // Si no, asegúrate de que user esté definido correctamente.
        // if (user && (activeTab === 'files' || activeTab === 'chat')) {
        //     fetchSubjects();
        //     checkSession();
        // }
    }, [user, activeTab]); // Dependencias: user, activeTab - si estas no cambian, el efecto solo se ejecuta una vez si se renderiza condicionalmente.

    // Barra de Progreso Simple - NO modal
    const ProgressBar = () => {
        console.log('🎯 ProgressBar renderizando - isGeneratingQuestions:', isGeneratingQuestions);
        if (!isGeneratingQuestions) {
            console.log('❌ ProgressBar no se muestra porque isGeneratingQuestions es false');
            return null;
        }

        const progressPercentage = questionProgress.progress || 0;
        console.log('✅ Renderizando barra de progreso:', progressPercentage, '%', 'Paso:', questionProgress.currentStep);
        
        return (
            <div style={{
                backgroundColor: '#f8f9fa',
                border: '2px solid #007bff',
                borderRadius: '8px',
                padding: '20px',
                margin: '20px 0',
                boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
            }}>
                <div style={{textAlign: 'center', marginBottom: '15px'}}>
                    <h3 style={{color: '#007bff', margin: '0 0 10px 0'}}>
                        🤖 Procesando PDF con IA
                    </h3>
                    <p style={{margin: 0, color: '#6c757d'}}>
                        Por favor espera mientras se procesa el archivo...
                    </p>
                </div>
                
                <div style={{marginBottom: '15px'}}>
                    <div style={{marginBottom: '8px'}}>
                        <strong>📁 Archivo:</strong> {questionProgress.currentFile || 'Sin archivo'}
                    </div>
                    <div style={{marginBottom: '15px'}}>
                        <strong>⚡ Estado:</strong> {questionProgress.currentStep || 'Iniciando...'}
                    </div>
                </div>
                
                <div style={{marginBottom: '15px'}}>
                    <div style={{
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: '8px'
                    }}>
                        <span style={{fontWeight: 'bold'}}>Progreso:</span>
                        <span style={{fontWeight: 'bold', color: '#007bff'}}>{progressPercentage}%</span>
                    </div>
                    <div style={{
                        width: '100%',
                        height: '20px',
                        backgroundColor: '#e9ecef',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        border: '1px solid #dee2e6'
                    }}>
                        <div style={{
                            width: `${progressPercentage}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #28a745, #20c997)',
                            transition: 'width 0.5s ease',
                            borderRadius: '10px'
                        }}></div>
                    </div>
                </div>
                
                <div style={{textAlign: 'center'}}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        <div style={{
                            width: '20px',
                            height: '20px',
                            border: '3px solid #f3f3f3',
                            borderTop: '3px solid #007bff',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                        }}></div>
                        <span style={{color: '#6c757d'}}>Procesando...</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="pdf-upload-container">
            <h2>Subir PDF</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="title">Título:</label>
                    <input
                        type="text"
                        id="title"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="file">Seleccionar PDF:</label>
                    <input
                        type="file"
                        id="file"
                        accept=".pdf"
                        onChange={handleFileChange}
                        required
                    />
                </div>
                {error && <div className="error">{error}</div>}
                <button type="submit" disabled={loading || !file || !title || isGeneratingQuestions}>
                    {isGeneratingQuestions ? 'Procesando...' : (loading ? 'Subiendo y procesando...' : 'Subir y Procesar PDF')}
                </button>
            </form>

            {/* Barra de progreso - se muestra directamente en la página */}
            <ProgressBar />

            {uploadedFiles.length > 0 && (
                <div className="uploaded-files">
                    <h3>Archivos Subidos</h3>
                    {uploadedFiles.map((uploadedFile, index) => (
                        <div key={index} className="file-item">
                            <span>{uploadedFile.title}</span>
                            <div className="file-actions">
                                <button className="action-button view-button">Ver</button>
                                <button className="action-button delete-button">Eliminar</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {uploadedFileUrl && (
                <div className="pdf-viewer">
                    <h4>Vista Previa del PDF</h4>
                    <Document
                        file={uploadedFileUrl}
                        onLoadSuccess={onDocumentLoadSuccess}
                        loading={<div>Cargando PDF...</div>}
                        error={<div>Error al cargar el PDF</div>}
                    >
                        <Page pageNumber={pageNumber} scale={1.2} />
                    </Document>
                    <div>
                        Página {pageNumber} de {numPages}
                        <button onClick={() => setPageNumber(p => Math.max(1, p - 1))} disabled={pageNumber <= 1}>Anterior</button>
                        <button onClick={() => setPageNumber(p => Math.min(numPages, p + 1))} disabled={pageNumber >= numPages}>Siguiente</button>
                    </div>
                </div>
            )}

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
                </div>
            )}

            {/* Estilos CSS inline para la animación del spinner */}
            <style jsx>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default PDFUpload;