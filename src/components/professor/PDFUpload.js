import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import { Document, Page, pdfjs } from 'react-pdf';
import { nlpService } from '../../services/nlp.service';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import './PDFUpload.css';
import { syllabusService } from '../../services/syllabus.service';
import { deepseekService } from '../../services/deepseek.service';

// Configurar el worker de PDF.js

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;

const PDFUpload = ({ subjectId, session: sessionProp }) => {
    const [file, setFile] = useState(null);
    const [title, setTitle] = useState('');
    const [uploadedFileUrl, setUploadedFileUrl] = useState(null);
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [processedJSON, setProcessedJSON] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showJSON, setShowJSON] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [activeTab, setActiveTab] = useState('files');
    const [user, setUser] = useState(null);
    const [generatedQuestions, setGeneratedQuestions] = useState([]);
    const [questionLogs, setQuestionLogs] = useState([]);

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

    const handleProcess = async () => {
        if (!file) {
            setError('Por favor, selecciona un archivo PDF');
            return;
        }

        setIsProcessing(true);
        try {
            const jsonResult = await nlpService.processPDF(file, subjectId);
            setProcessedJSON(jsonResult);
            setError(null);
        } catch (err) {
            console.error('Error al procesar el PDF:', err);
            setError('Error al procesar el PDF: ' + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file || !title) {
            setError('Por favor, selecciona un archivo y proporciona un título');
            return;
        }

        setLoading(true);
        setError(null);
        setQuestionLogs([]);
        setGeneratedQuestions([]);

        try {
            // Primero subir el archivo
            const formData = new FormData();
            formData.append('file', file);

            const uploadResponse = await fetch('http://localhost:3001/upload', {
                method: 'POST',
                body: formData
            });

            if (!uploadResponse.ok) {
                const errorData = await uploadResponse.json();
                throw new Error(`Error al subir el archivo: ${errorData.error || uploadResponse.statusText}`);
            }

            const { fileUrl, filePath } = await uploadResponse.json();

            // Luego guardar la información en la base de datos
            const fileData = {
                title,
                subject_id: subjectId,
                user_id: sessionProp.user.id,
                file_path: filePath,
                file_url: fileUrl,
                file_name: file.name,
                file_type: file.type,
                file_size: file.size
            };

            console.log('Enviando datos al servidor:', fileData);

            const dbResponse = await fetch('http://localhost:3001/api/files', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(fileData)
            });

            if (!dbResponse.ok) {
                const errorData = await dbResponse.json();
                console.error('Error del servidor:', errorData);
                throw new Error(`Error al guardar la información del archivo: ${errorData.error || errorData.details || dbResponse.statusText}`);
            }

            const responseData = await dbResponse.json();
            console.log('Respuesta del servidor:', responseData);

            // === Generar preguntas ===
            setQuestionLogs([{ fileName: file.name, status: 'generando', message: 'Generando preguntas para ' + file.name + '...' }]);
            try {
                // Extraer texto del PDF
                const text = await syllabusService.extractTextFromFile(file);
                // Construir objeto de tema único
                const topics = [{ number: 1, title: file.name, content: text, subtopics: [] }];
                // Generar preguntas
                const questions = await deepseekService.generateQuestions(topics);
                // Guardar preguntas en la base de datos
                const questionsToInsert = questions.map(q => ({
                    subject_id: subjectId,
                    topic_id: null,
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
                    setQuestionLogs(prev => ([...prev, { fileName: file.name, status: 'error', message: 'Error al guardar preguntas: ' + error.message }]));
                    throw error;
                }
                setGeneratedQuestions([{ fileName: file.name, questions: data }]);
                setQuestionLogs(prev => ([...prev, { fileName: file.name, status: 'exito', message: '¡Preguntas generadas y guardadas para ' + file.name + '!' }]));
            } catch (err) {
                setQuestionLogs(prev => ([...prev, { fileName: file.name, status: 'error', message: 'Error al generar preguntas: ' + (err.message || err) }]));
            }

            // Limpiar el formulario
            setFile(null);
            setTitle('');
            setUploadedFileUrl(null);
            setError(null);
            alert('Archivo subido exitosamente');
            setUploadedFiles(prevFiles => [...prevFiles, {
                title: title,
                fileName: file.name,
                id: responseData.id
            }]);
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
        if (user && (activeTab === 'files' || activeTab === 'chat')) {
            fetchSubjects();
            checkSession();
        }
    }, [user, activeTab]);

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
                <button type="submit" disabled={loading}>
                    {loading ? 'Subiendo...' : 'Subir PDF'}
                </button>
            </form>

            <button 
                onClick={handleProcess} 
                disabled={!file || isProcessing}
                className="process-button"
            >
                {isProcessing ? 'Procesando...' : 'Procesar PDF'}
            </button>

            {processedJSON && (
                <div className="json-viewer">
                    <h4>Resultado del Procesamiento</h4>
                    <pre>{JSON.stringify(processedJSON, null, 2)}</pre>
                </div>
            )}

            {uploadedFiles.length > 0 && (
                <div className="uploaded-files">
                    <h3>Archivos Subidos</h3>
                    {uploadedFiles.map((uploadedFile, index) => (
                        <div key={index} className="file-item">
                            <span>{uploadedFile.title}</span>
                            <div className="file-actions">
                                <button className="action-button view-button">Ver</button>
                                <button 
                                    className="action-button process-button"
                                    onClick={() => handleProcess()}
                                    disabled={isProcessing}
                                >
                                    {isProcessing ? 'Procesando...' : 'Procesar'}
                                </button>
                                <button 
                                    className="action-button json-button"
                                    onClick={() => setShowJSON(!showJSON)}
                                    disabled={!processedJSON}
                                >
                                    {showJSON ? 'Ocultar JSON' : 'Ver JSON'}
                                </button>
                                <button className="action-button delete-button">Eliminar</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showJSON && processedJSON && (
                <div className="json-viewer">
                    <h4>Resultado del Procesamiento</h4>
                    <pre>{JSON.stringify(processedJSON, null, 2)}</pre>
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

            {/* Mostrar preguntas generadas */}
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
        </div>
    );
};

export default PDFUpload;