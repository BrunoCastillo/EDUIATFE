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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file || !title) {
            setError('Por favor, selecciona un archivo y proporciona un título');
            return;
        }

        setLoading(true);
        setError(null);
        setQuestionLogs([]);

        try {
            // Convertir el archivo PDF a base64
            const toBase64 = file => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result.split(',')[1]); // Solo la parte base64
                reader.onerror = error => reject(error);
            });
            const fileBase64 = await toBase64(file);

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

            alert('Archivo subido exitosamente');
            setUploadedFiles(prevFiles => [...prevFiles, {
                title: title,
                fileName: file.name,
                id: responseData.id
            }]);

            // Procesamiento del PDF (opcional)
            try {
                await nlpService.processPDF(file, subjectId);
                console.log('Procesamiento del PDF completado.');
            } catch (processError) {
                console.error('Error durante el procesamiento del PDF:', processError);
                setQuestionLogs(prev => ([...prev, { fileName: file.name, status: 'error', message: 'Error durante el procesamiento del PDF: ' + (processError.message || processError) }]));
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
                <button type="submit" disabled={loading || !file || !title}>
                    {loading ? 'Subiendo y procesando...' : 'Subir y Procesar PDF'}
                </button>
            </form>

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
        </div>
    );
};

export default PDFUpload;