import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import './Evaluations.css';
import { subjectService } from '../../services/subject.service';

const Evaluations = () => {
    const { session, user, loading } = useAuth();
    const [subjects, setSubjects] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState('');
    const [selectedDocument, setSelectedDocument] = useState('');
    const [questions, setQuestions] = useState([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [error, setError] = useState(null);
    const [answers, setAnswers] = useState({});
    const [showResults, setShowResults] = useState(false);
    const [score, setScore] = useState(0);
    const [activeQuestion, setActiveQuestion] = useState(0);
    const [flagged, setFlagged] = useState({});
    const [testStarted, setTestStarted] = useState(false);

    // LOG: Estado del contexto de autenticación en cada render
    console.log('[Evaluations] Render:', { session, user, loading });

    useEffect(() => {
        console.log('[Evaluations] useEffect user:', user);
        if (user) {
            fetchSubjects();
        }
    }, [user]);

    useEffect(() => {
        if (selectedSubject) {
            fetchDocuments(selectedSubject);
            setSelectedDocument('');
            setQuestions([]);
            setTestStarted(false);
        }
    }, [selectedSubject]);

    useEffect(() => {
        if (selectedDocument) {
            console.log('[Evaluations][DEBUG] selectedDocument:', selectedDocument);
            fetchQuestions(selectedDocument);
            setTestStarted(false);
        }
    }, [selectedDocument]);

    const fetchSubjects = async () => {
        try {
            setDataLoading(true);
            setError(null);
            console.log('[Evaluations] fetchSubjects user.id:', user?.id);
            const { data: studentData, error: studentError } = await supabase
                .from('students_subjects')
                .select('subject_id')
                .eq('student_id', user.id);
            console.log('[Evaluations] Resultado students_subjects:', studentData, studentError);
            if (studentError) throw studentError;
            if (!studentData || studentData.length === 0) {
                setSubjects([]);
                setDataLoading(false);
                return;
            }
            const subjectIds = studentData.map(item => item.subject_id);
            console.log('[Evaluations] IDs de materias a buscar:', subjectIds);
            const { data: subjectsData, error: subjectsError } = await supabase
                .from('subjects')
                .select('*')
                .in('id', subjectIds);
            console.log('[Evaluations] Resultado subjects:', subjectsData, subjectsError);
            if (subjectsError) throw subjectsError;
            setSubjects(subjectsData || []);
            setDataLoading(false);
        } catch (error) {
            console.error('[Evaluations] Error al cargar materias:', error);
            setError('Error al cargar las materias');
            setDataLoading(false);
        }
    };

    const fetchDocuments = async (subjectId) => {
        try {
            setDataLoading(true);
            setError(null);
            const { data: docs, error: docsError } = await supabase
                .from('documents')
                .select('id, title')
                .eq('subject_id', subjectId);
            if (docsError) throw docsError;
            setDocuments(docs || []);
            setDataLoading(false);
        } catch (error) {
            setError('Error al cargar los documentos');
            setDataLoading(false);
        }
    };

    const fetchQuestions = async (documentId) => {
        try {
            setDataLoading(true);
            setError(null);
            console.log('[Evaluations] fetchQuestions documentId:', documentId);
            const { data: questionsData, error: questionsError } = await supabase
                .from('document_questions')
                .select('*')
                .eq('document_id', documentId);
            console.log('[Evaluations][DEBUG] Resultado crudo preguntas:', questionsData, questionsError);
            if (questionsError) throw questionsError;
            // Validar y transformar options a array si es necesario
            const processedQuestions = (questionsData || []).map(q => ({
                ...q,
                options: Array.isArray(q.options)
                    ? q.options
                    : (typeof q.options === 'string' ? JSON.parse(q.options) : [])
            }));
            console.log('[Evaluations][DEBUG] Preguntas procesadas:', processedQuestions);
            setQuestions(processedQuestions);
            setAnswers({});
            setShowResults(false);
            setScore(0);
            setActiveQuestion(0);
            setFlagged({});
            setDataLoading(false);
        } catch (error) {
            console.error('[Evaluations] Error al cargar las preguntas:', error);
            setError('Error al cargar las preguntas');
            setDataLoading(false);
        }
    };

    const handleAnswerSelect = (questionId, answer) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: answer
        }));
    };

    const handleFlag = (questionId) => {
        setFlagged(prev => ({
            ...prev,
            [questionId]: !prev[questionId]
        }));
    };

    const calculateScore = async () => {
        let correctAnswers = 0;
        questions.forEach(question => {
            if (answers[question.id] === question.correct_answer) {
                correctAnswers++;
            }
        });
        const finalScore = (correctAnswers / questions.length) * 100;
        setScore(finalScore);
        setShowResults(true);

        // Guardar progreso en la base de datos
        try {
            // Buscar el student_subje correspondiente
            const { data: studentSubject } = await supabase
                .from('students_subjects')
                .select('id')
                .eq('student_id', user.id)
                .eq('subject_id', selectedSubject)
                .single();
            if (!studentSubject) throw new Error('No se encontró la relación estudiante-materia');
            await subjectService.saveStudentProgress({
                student_subject_id: studentSubject.id,
                document_id: selectedDocument,
                status: 'completado',
                completion_percentage: 100,
                assessment_score: finalScore,
                notes: null
            });
        } catch (err) {
            console.error('Error al guardar el progreso del estudiante:', err);
        }
    };

    const goToQuestion = (idx) => setActiveQuestion(idx);

    // Progreso
    const answeredCount = Object.keys(answers).length;
    const totalQuestions = questions.length;
    const progressPercent = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

    if (loading) {
        console.log('[Evaluations] loading:', loading);
        return <div className="loading">Cargando sesión...</div>;
    }
    if (!session || !user) {
        console.log('[Evaluations] No hay sesión activa:', { session, user });
        return <div className="error">No hay sesión activa.</div>;
    }
    if (dataLoading) {
        console.log('[Evaluations] dataLoading:', dataLoading);
        return <div className="loading">Cargando datos...</div>;
    }
    if (error) {
        console.log('[Evaluations] error:', error);
        return <div className="error">{error}</div>;
    }

    return (
        <div className="evaluations-test-layout">
            <div className="test-main-panel">
                <h2>Evaluaciones</h2>
                <div className="combo-row">
                    <div className="combo-group">
                        <label htmlFor="subject-select">Selecciona una materia:</label>
                        <select
                            id="subject-select"
                            value={selectedSubject}
                            onChange={e => setSelectedSubject(e.target.value)}
                        >
                            <option value="">Selecciona una materia</option>
                            {subjects.map(subject => (
                                <option key={subject.id} value={subject.id}>{subject.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="combo-group">
                        <label htmlFor="document-select">Selecciona un archivo:</label>
                        <select
                            id="document-select"
                            value={selectedDocument}
                            onChange={e => setSelectedDocument(e.target.value)}
                            disabled={!selectedSubject}
                        >
                            <option value="">Selecciona un archivo</option>
                            {documents.map(doc => (
                                <option key={doc.id} value={doc.id}>{doc.title}</option>
                            ))}
                        </select>
                    </div>
                    <div className="combo-group combo-btn-group">
                        <button
                            className="start-test-btn"
                            style={{ marginTop: '2rem' }}
                            onClick={() => setTestStarted(true)}
                            disabled={!selectedDocument || dataLoading || questions.length === 0 || testStarted}
                        >
                            Empezar test
                        </button>
                    </div>
                </div>
                {testStarted && questions.length > 0 && !showResults && (
                    <>
                        <div className="test-progress-bar">
                            <div className="test-progress-label">
                                Progreso: {answeredCount} / {totalQuestions} respondidas
                            </div>
                            <div className="test-progress-outer">
                                <div className="test-progress-inner" style={{ width: `${progressPercent}%` }}></div>
                            </div>
                        </div>
                        <div className="test-questions-panel">
                            {questions.map((question, idx) => (
                                <div
                                    key={question.id}
                                    className={`test-question-card ${activeQuestion === idx ? 'active' : ''}`}
                                    style={{ display: activeQuestion === idx ? 'block' : 'none' }}
                                >
                                    <div className="test-question-header">
                                        <span className="test-question-number">Pregunta {idx + 1}</span>
                                        <button
                                            className={`flag-btn ${flagged[question.id] ? 'flagged' : ''}`}
                                            onClick={() => handleFlag(question.id)}
                                            title={flagged[question.id] ? 'Desmarcar pregunta' : 'Marcar pregunta'}
                                        >
                                            {flagged[question.id] ? '🚩 Marcar pregunta' : '🏳️ Marcar pregunta'}
                                        </button>
                                    </div>
                                    <div className="test-question-body">
                                        <p className="test-question-text">{question.question}</p>
                                        <div className="test-options-list">
                                            {question.options.map((option, optIdx) => (
                                                <label key={optIdx} className="test-option-label">
                                                    <input
                                                        type="radio"
                                                        name={`question-${question.id}`}
                                                        value={option}
                                                        checked={answers[question.id] === option}
                                                        onChange={() => handleAnswerSelect(question.id, option)}
                                                    />
                                                    {option}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div className="test-navigation-row">
                                <button
                                    className="test-nav-btn"
                                    onClick={() => goToQuestion(activeQuestion - 1)}
                                    disabled={activeQuestion === 0}
                                >Anterior</button>
                                <button
                                    className="test-nav-btn"
                                    onClick={() => goToQuestion(activeQuestion + 1)}
                                    disabled={activeQuestion === questions.length - 1}
                                >Siguiente</button>
                                <button
                                    className="submit-button"
                                    onClick={calculateScore}
                                    disabled={Object.keys(answers).length !== questions.length}
                                >Terminar intento...</button>
                            </div>
                        </div>
                    </>
                )}
                {showResults && (
                    <div className="results-container">
                        <h3>Resultados</h3>
                        <p className="score">Puntuación: {score.toFixed(2)}%</p>
                        <div className="questions-review">
                            {questions.map((question, index) => (
                                <div key={question.id} className="question-review">
                                    <h4>Pregunta {index + 1}</h4>
                                    <p>{question.question}</p>
                                    <p className={`answer ${answers[question.id] === question.correct_answer ? 'correct' : 'incorrect'}`}>
                                        Tu respuesta: {answers[question.id]}
                                    </p>
                                    <p className="correct-answer">
                                        Respuesta correcta: {question.correct_answer}
                                    </p>
                                    <p className="explanation">
                                        Explicación: {question.explanation}
                                    </p>
                                </div>
                            ))}
                        </div>
                        <button
                            className="retry-button"
                            onClick={() => {
                                setShowResults(false);
                                setAnswers({});
                                setScore(0);
                                setTestStarted(false);
                            }}
                        >Intentar de nuevo</button>
                    </div>
                )}
            </div>
            {testStarted && questions.length > 0 && !showResults && (
                <div className="test-side-panel">
                    <div className="test-nav-title">Navegación por el test</div>
                    <div className="test-nav-grid">
                        {questions.map((_, idx) => (
                            <button
                                key={idx}
                                className={`test-nav-number ${activeQuestion === idx ? 'active' : ''} ${answers[questions[idx].id] ? 'answered' : ''} ${flagged[questions[idx].id] ? 'flagged' : ''}`}
                                onClick={() => goToQuestion(idx)}
                                title={flagged[questions[idx].id] ? 'Pregunta marcada' : ''}
                            >
                                {idx + 1}
                            </button>
                        ))}
                    </div>
                    <div className="test-nav-actions">
                        <button
                            className="submit-button"
                            onClick={calculateScore}
                            disabled={Object.keys(answers).length !== questions.length}
                        >Terminar intento...</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Evaluations; 