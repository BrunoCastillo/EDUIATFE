import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabaseClient';
import { ragService } from '../../services/rag.service';
import { subjectService } from '../../services/subject.service';
import Chat from './Chat';
import IntroScreen from '../IntroScreen';

import Evaluations from './Evaluations';
import './Dashboard.css';

const StudentDashboard = () => {
    const navigate = useNavigate();
    const { user, session, loading: authLoading, signOut } = useAuth();
    const [activeTab, setActiveTab] = useState('evaluations');
    const [chatMessage, setChatMessage] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [availableSubjects, setAvailableSubjects] = useState([]);
    const [enrolledSubjects, setEnrolledSubjects] = useState([]);
    const [error, setError] = useState(null);
    const [notification, setNotification] = useState(null);
    const [selectedSubjectId, setSelectedSubjectId] = useState('');
    const [progressBySubject, setProgressBySubject] = useState({});
    const [expandedSubject, setExpandedSubject] = useState(null);

    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/login');
        }
    }, [authLoading, user, navigate]);

    useEffect(() => {
        if (user) {
            fetchEnrolledSubjects();
            fetchAvailableSubjects();
            fetchStudentProgress();
        }
    }, [user]);

    const fetchEnrolledSubjects = async () => {
        try {
            console.log('Iniciando fetchEnrolledSubjects para el estudiante:', user.id);
            
            // Primero obtener las inscripciones
            const { data: enrollments, error: enrollmentsError } = await supabase
                .from('students_subjects')
                .select('subject_id')
                .eq('student_id', user.id);

            if (enrollmentsError) {
                console.error('Error al cargar inscripciones:', enrollmentsError);
                throw new Error('Error al cargar las inscripciones');
            }

            console.log('Inscripciones encontradas:', enrollments);

            if (!enrollments || enrollments.length === 0) {
                console.log('No hay materias inscritas');
                setEnrolledSubjects([]);
                return;
            }

            // Obtener los IDs de las materias
            const subjectIds = enrollments.map(e => e.subject_id);
            console.log('IDs de materias a consultar:', subjectIds);

            // Obtener los detalles de las materias
            const { data: subjects, error: subjectsError } = await supabase
                .from('subjects')
                .select(`
                    id,
                    name,
                    description,
                    professor_id,
                    profiles!subjects_professor_id_fkey (
                        id,
                        email
                    )
                `)
                .in('id', subjectIds);

            if (subjectsError) {
                console.error('Error al cargar detalles de materias:', subjectsError);
                throw new Error('Error al cargar los detalles de las materias');
            }

            console.log('Detalles de materias:', subjects);

            // Formatear los datos para mostrar
            const formattedSubjects = subjects.map(subject => ({
                id: subject.id,
                name: subject.name,
                description: subject.description,
                professor: subject.profiles ? {
                    id: subject.profiles.id,
                    name: subject.profiles.email
                } : null
            }));

            console.log('Materias formateadas:', formattedSubjects);
            setEnrolledSubjects(formattedSubjects);
            
            // Si la materia seleccionada ya no está en la lista, limpiar la selección
            if (selectedSubjectId && !formattedSubjects.some(s => s.id === selectedSubjectId)) {
                setSelectedSubjectId('');
                setChatHistory([]);
            }
        } catch (error) {
            console.error('Error al cargar asignaturas inscritas:', error);
            setNotification({
                type: 'error',
                message: error.message
            });
            setEnrolledSubjects([]);
        }
    };

    const fetchAvailableSubjects = async () => {
        try {
            console.log('Iniciando fetchAvailableSubjects');
            
            // Verificar si hay materias en la base de datos
            const { count, error: countError } = await supabase
                .from('subjects')
                .select('*', { count: 'exact', head: true });

            if (countError) {
                console.error('Error al contar materias:', countError);
                throw new Error('Error al verificar las materias disponibles');
            }

            console.log('Número total de materias en la base de datos:', count);

            if (count === 0) {
                console.log('No hay materias en la base de datos');
                setAvailableSubjects([]);
                return;
            }
            
            // Obtener todas las materias disponibles
            const { data: subjects, error: subjectsError } = await supabase
                .from('subjects')
                .select(`
                    id,
                    name,
                    description,
                    professor_id
                `)
                .order('name');

            if (subjectsError) {
                console.error('Error detallado al cargar materias:', subjectsError);
                throw new Error('Error al cargar las materias disponibles');
            }

            console.log('Materias obtenidas:', subjects);

            if (!subjects || subjects.length === 0) {
                console.log('No se encontraron materias');
                setAvailableSubjects([]);
                return;
            }

            // Obtener las materias en las que ya está inscrito
            const { data: enrolledSubjects, error: enrolledError } = await supabase
                .from('students_subjects')
                .select('subject_id')
                .eq('student_id', user.id);

            if (enrolledError) {
                console.error('Error al cargar materias inscritas:', enrolledError);
                throw new Error('Error al cargar las materias inscritas');
            }

            console.log('Materias inscritas:', enrolledSubjects);

            // Filtrar las materias disponibles
            const enrolledIds = enrolledSubjects?.map(es => es.subject_id) || [];
            const availableSubjects = subjects.filter(subject => !enrolledIds.includes(subject.id));

            console.log('Materias disponibles después de filtrar:', availableSubjects);
            setAvailableSubjects(availableSubjects);
        } catch (error) {
            console.error('Error al cargar materias:', error);
            setNotification({
                type: 'error',
                message: error.message
            });
            setAvailableSubjects([]);
        }
    };

    const fetchStudentProgress = async () => {
        try {
            console.log('[Dashboard] Obteniendo progreso del estudiante:', user.id);
            
            // Obtener todas las inscripciones del estudiante con sus materias
            const { data: enrollments, error: enrollmentsError } = await supabase
                .from('students_subjects')
                .select(`
                    id,
                    subject_id,
                    subjects (
                        id,
                        name
                    )
                `)
                .eq('student_id', user.id);

            if (enrollmentsError) {
                console.error('Error al obtener inscripciones:', enrollmentsError);
                throw enrollmentsError;
            }

            console.log('[Dashboard] Inscripciones encontradas:', enrollments);

            if (!enrollments || enrollments.length === 0) {
                setProgressBySubject({});
                return;
            }

            // Obtener el progreso para cada inscripción
            const enrollmentIds = enrollments.map(e => e.id);
            const { data: progressData, error: progressError } = await supabase
                .from('student_progress')
                .select('*')
                .in('student_subject_id', enrollmentIds)
                .order('completion_date', { ascending: false });

            if (progressError) {
                console.error('Error al obtener progreso:', progressError);
                throw progressError;
            }

            console.log('[Dashboard] Datos de progreso obtenidos:', progressData);

            // Agrupar progreso por materia
            const progressMap = {};
            enrollments.forEach(enrollment => {
                const subjectId = enrollment.subject_id;
                const subjectProgress = progressData.filter(p => p.student_subject_id === enrollment.id);
                progressMap[subjectId] = subjectProgress;
            });

            console.log('[Dashboard] Progreso agrupado por materia:', progressMap);
            setProgressBySubject(progressMap);
        } catch (err) {
            console.error('Error al obtener el progreso del estudiante:', err);
            setProgressBySubject({});
        }
    };

    const handleEnroll = async (subjectId) => {
        try {
            console.log('Iniciando handleEnroll para subjectId:', subjectId);
            
            // Primero verificar si el estudiante tiene perfil
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profileError && profileError.code !== 'PGRST116') {
                console.error('Error al verificar perfil:', profileError);
                throw new Error('Error al verificar el perfil del estudiante');
            }

            if (!profile) {
                console.log('Creando perfil para el estudiante:', user.id);
                // Si no tiene perfil, crearlo
                const { data: newProfile, error: createProfileError } = await supabase
                    .from('profiles')
                    .insert([
                        {
                            id: user.id,
                            email: user.email,
                            role: 'student'
                        }
                    ])
                    .select()
                    .single();

                if (createProfileError) {
                    console.error('Error detallado al crear perfil:', createProfileError);
                    throw new Error(`Error al crear el perfil del estudiante: ${createProfileError.message}`);
                }

                console.log('Perfil creado exitosamente:', newProfile);
            }

            // Verificar si ya está inscrito
            const { data: existingEnrollment, error: checkError } = await supabase
                .from('students_subjects')
                .select('*')
                .eq('student_id', user.id)
                .eq('subject_id', subjectId)
                .single();

            if (checkError && checkError.code !== 'PGRST116') {
                console.error('Error al verificar inscripción:', checkError);
                throw new Error('Error al verificar la inscripción');
            }

            if (existingEnrollment) {
                throw new Error('Ya estás inscrito en esta materia');
            }

            // Realizar la inscripción
            const { data: enrollment, error: enrollError } = await supabase
                .from('students_subjects')
                .insert([
                    {
                        student_id: user.id,
                        subject_id: subjectId
                    }
                ])
                .select()
                .single();

            if (enrollError) {
                console.error('Error detallado:', enrollError);
                throw new Error('Error de registro. Por favor, contacta al administrador.');
            }

            console.log('Inscripción exitosa:', enrollment);

            // Actualizar ambas listas de materias y el progreso
            await fetchEnrolledSubjects();
            await fetchAvailableSubjects();
            await fetchStudentProgress();
            setNotification({
                type: 'success',
                message: 'Inscripción exitosa'
            });
        } catch (error) {
            console.error('Error al inscribirse:', error);
            setNotification({
                type: 'error',
                message: error.message
            });
        }
    };

    const handleUnenroll = async (subjectId) => {
        try {
            console.log('Iniciando desinscripción para subjectId:', subjectId);
            
            const { data, error: unenrollError } = await supabase
                .from('students_subjects')
                .delete()
                .match({
                    student_id: user.id,
                    subject_id: subjectId
                })
                .select()
                .single();

            if (unenrollError) {
                console.error('Error detallado:', unenrollError);
                if (unenrollError.code === '42501') {
                    throw new Error('No tienes permisos para realizar esta acción.');
                } else if (unenrollError.code === 'PGRST116') {
                    throw new Error('No estás inscrito en esta materia.');
                } else {
                    throw new Error(`Error al desinscribirse: ${unenrollError.message}`);
                }
            }

            if (!data) {
                throw new Error('No se pudo completar la desinscripción.');
            }

            console.log('Desinscripción exitosa:', data);

            // Actualizar todas las listas y el progreso
            await fetchEnrolledSubjects();
            await fetchAvailableSubjects();
            await fetchStudentProgress();
            
            setNotification({
                type: 'success',
                message: 'Te has desinscrito exitosamente de la materia'
            });
        } catch (error) {
            console.error('Error al desinscribirse:', error);
            setNotification({
                type: 'error',
                message: error.message
            });
        }
    };

    const handleLogout = async () => {
        try {
            await signOut();
            navigate('/login');
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
    };

    // Función para formatear el texto de las respuestas de DeepSeek
    const formatResponseText = (text) => {
        if (!text) return '';
        
        let formattedText = text;
        
        // Convertir **texto** a <strong>texto</strong>
        formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Dividir el texto en líneas para procesar mejor
        const lines = formattedText.split('\n');
        const processedLines = [];
        let inList = false;
        let hasStructuredFormat = false;
        
        // Verificar si la respuesta ya tiene formato estructurado
        const hasResumen = lines.some(line => line.includes('**Resumen Principal**'));
        const hasExplicacion = lines.some(line => line.includes('**Explicación Detallada**'));
        const hasPuntos = lines.some(line => line.includes('**Puntos Clave**'));
        const hasFuentes = lines.some(line => line.includes('**Fuentes Consultadas**'));
        
        hasStructuredFormat = hasResumen || hasExplicacion || hasPuntos || hasFuentes;
        
        // Si no tiene formato estructurado, crear uno por defecto
        if (!hasStructuredFormat) {
            processedLines.push('<div class="explicacion-detallada">');
            processedLines.push('<strong>Respuesta del Asistente</strong>');
        }
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Detectar secciones principales
            if (line.includes('**Resumen Principal**')) {
                if (inList) {
                    processedLines.push('</ul>');
                    inList = false;
                }
                processedLines.push('<div class="resumen-principal">');
                processedLines.push(line.replace('**Resumen Principal**', '<strong>Resumen Principal</strong>'));
                continue;
            }
            
            if (line.includes('**Explicación Detallada**')) {
                if (inList) {
                    processedLines.push('</ul>');
                    inList = false;
                }
                processedLines.push('</div><div class="explicacion-detallada">');
                processedLines.push(line.replace('**Explicación Detallada**', '<strong>Explicación Detallada</strong>'));
                continue;
            }
            
            if (line.includes('**Puntos Clave**')) {
                if (inList) {
                    processedLines.push('</ul>');
                    inList = false;
                }
                processedLines.push('</div><div class="puntos-clave">');
                processedLines.push(line.replace('**Puntos Clave**', '<strong>Puntos Clave</strong>'));
                continue;
            }
            
            if (line.includes('**Fuentes Consultadas**')) {
                if (inList) {
                    processedLines.push('</ul>');
                    inList = false;
                }
                processedLines.push('</div><div class="fuentes-consultadas">');
                processedLines.push(line.replace('**Fuentes Consultadas**', '<strong>Fuentes Consultadas</strong>'));
                continue;
            }
            
            // Detectar elementos de lista
            if (line.startsWith('•')) {
                if (!inList) {
                    processedLines.push('<ul>');
                    inList = true;
                }
                processedLines.push('<li>' + line.substring(1).trim() + '</li>');
                continue;
            }
            
            // Si no es un elemento de lista pero estábamos en una lista, cerrar la lista
            if (inList && line.length > 0) {
                processedLines.push('</ul>');
                inList = false;
            }
            
            // Procesar líneas normales
            if (line.length > 0) {
                processedLines.push('<p>' + line + '</p>');
            } else {
                processedLines.push('<br>');
            }
        }
        
        // Cerrar lista si estaba abierta
        if (inList) {
            processedLines.push('</ul>');
        }
        
        // Cerrar todas las secciones abiertas
        if (processedLines.some(line => line.includes('class="resumen-principal"'))) {
            processedLines.push('</div>');
        }
        if (processedLines.some(line => line.includes('class="explicacion-detallada"'))) {
            processedLines.push('</div>');
        }
        if (processedLines.some(line => line.includes('class="puntos-clave"'))) {
            processedLines.push('</div>');
        }
        if (processedLines.some(line => line.includes('class="fuentes-consultadas"'))) {
            processedLines.push('</div>');
        }
        
        // Si no tenía formato estructurado, cerrar la sección por defecto
        if (!hasStructuredFormat) {
            processedLines.push('</div>');
        }
        
        return processedLines.join('');
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!chatMessage.trim() || isProcessing || !selectedSubjectId) return;

        const userMessage = {
            type: 'user',
            content: chatMessage,
            timestamp: new Date().toLocaleTimeString()
        };

        setChatHistory(prev => [...prev, userMessage]);
        setChatMessage('');
        setIsProcessing(true);

        try {
            const response = await ragService.processQuestion(chatMessage, selectedSubjectId);
            const aiMessage = {
                type: 'ai',
                content: response.answer,
                sources: response.sources,
                timestamp: new Date().toLocaleTimeString()
            };
            setChatHistory(prev => [...prev, aiMessage]);
        } catch (error) {
            const errorMessage = {
                type: 'error',
                content: 'Lo siento, ha ocurrido un error al procesar tu mensaje. Por favor, intenta de nuevo.',
                timestamp: new Date().toLocaleTimeString()
            };
            setChatHistory(prev => [...prev, errorMessage]);
        } finally {
            setIsProcessing(false);
        }
    };

    if (authLoading) {
        return <div className="loading">Cargando...</div>;
    }

    if (!user) {
        return null;
    }

    return (
        <div className="student-dashboard-layout">
            <nav className="dashboard-nav">
                <div className="nav-header">
                    <h2>EDUIA</h2>
                    <p>Panel del Estudiante</p>
                </div>
                <ul className="nav-menu">
                    <li>
                        <button 
                            className={activeTab === 'dashboard' ? 'active' : ''}
                            onClick={() => setActiveTab('dashboard')}
                        >
                            Dashboard
                        </button>
                    </li>
                    <li>
                        <button 
                            className={activeTab === 'chat' ? 'active' : ''}
                            onClick={() => setActiveTab('chat')}
                        >
                            Asistente IA
                        </button>
                    </li>
                    <li>
                        <button 
                            className={activeTab === 'subjects' ? 'active' : ''}
                            onClick={() => setActiveTab('subjects')}
                        >
                            Mis Asignaturas
                        </button>
                    </li>
                    <li>
                        <button 
                            className={activeTab === 'enroll' ? 'active' : ''}
                            onClick={() => setActiveTab('enroll')}
                        >
                            Inscribirse
                        </button>
                    </li>

                    <li>
                        <button 
                            className={activeTab === 'evaluations' ? 'active' : ''}
                            onClick={() => setActiveTab('evaluations')}
                        >
                            Evaluaciones
                        </button>
                    </li>

                </ul>
                <button className="logout-button" onClick={handleLogout}>
                    Cerrar Sesión
                </button>
            </nav>

            <main className="dashboard-content">
                {error && <div className="error-message">{error}</div>}
                {notification && <div className={`notification ${notification.type === 'success' ? 'success' : 'error'}`}>{notification.message}</div>}

                {activeTab === 'dashboard' && (
                    <div className="dashboard-overview" style={{ marginBottom: '1rem' }}>
                        <h2>Bienvenido, {user?.email}</h2>
                        <div className="stats-grid">
                            <div className="stat-card">
                                <h4>Materias Inscritas</h4>
                                <p>{enrolledSubjects.length}</p>
                            </div>
                            <div className="stat-card">
                                <h4>Materias Disponibles</h4>
                                <p>{availableSubjects.length}</p>
                            </div>
                            <div className="stat-card">
                                <h4>Progreso General</h4>
                                <p>{enrolledSubjects.length > 0 ? `${Math.round(enrolledSubjects.reduce((acc, subj) => acc + (subj.progress || 0), 0) / enrolledSubjects.length)}%` : '0%'}</p>
                            </div>
                        </div>
                        {/* Progreso detallado por materia */}
                        <div className="progress-section" style={{marginTop: '2rem'}}>
                            <h3>Mi Progreso por Materia</h3>
                            <div className="progress-grid">
                                {enrolledSubjects.length === 0 ? (
                                    <p>No tienes materias inscritas.</p>
                                ) : (
                                    enrolledSubjects.map((subject) => {
                                        const progressList = progressBySubject[subject.id] || [];
                                        const completedEvaluations = progressList.filter(p => p.status === 'completado').length;
                                        const avgScore = progressList.length > 0 ? 
                                            (progressList.reduce((acc, p) => acc + (p.assessment_score || 0), 0) / progressList.length) : 0;
                                        const lastEvaluation = progressList.length > 0 ? progressList[0] : null;
                                        
                                        return (
                                            <div className="progress-card" key={subject.id}>
                                                <h4>{subject.name}</h4>
                                                <div className="progress-stats">
                                                    <div className="stat-item">
                                                        <span className="stat-label">Evaluaciones completadas:</span>
                                                        <span className="stat-value">{completedEvaluations}</span>
                                                    </div>
                                                    <div className="stat-item">
                                                        <span className="stat-label">Nota promedio:</span>
                                                        <span className="stat-value">{avgScore.toFixed(1)}%</span>
                                                    </div>
                                                    {lastEvaluation && (
                                                        <div className="stat-item">
                                                            <span className="stat-label">Última evaluación:</span>
                                                            <span className="stat-value">
                                                                {new Date(lastEvaluation.completion_date).toLocaleDateString()} 
                                                                ({lastEvaluation.assessment_score?.toFixed(1)}%)
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="progress-bar">
                                                    <div className="progress-fill" style={{ 
                                                        width: `${Math.min(avgScore, 100)}%`,
                                                        backgroundColor: avgScore >= 70 ? '#4CAF50' : avgScore >= 50 ? '#FF9800' : '#f44336'
                                                    }}></div>
                                                </div>
                                                <button className="expand-history-btn" onClick={() => setExpandedSubject(expandedSubject === subject.id ? null : subject.id)}>
                                                    {expandedSubject === subject.id ? 'Ocultar historial' : 'Ver historial'}
                                                </button>
                                                {expandedSubject === subject.id && progressList.length > 0 && (
                                                    <div className="progress-history">
                                                        <h5>Historial de Evaluaciones</h5>
                                                        <div className="evaluation-history">
                                                            {progressList.map((p, idx) => (
                                                                <div key={idx} className="evaluation-item">
                                                                    <div className="evaluation-date">
                                                                        {p.completion_date ? new Date(p.completion_date).toLocaleDateString('es-ES', {
                                                                            year: 'numeric',
                                                                            month: 'long',
                                                                            day: 'numeric',
                                                                            hour: '2-digit',
                                                                            minute: '2-digit'
                                                                        }) : 'Fecha no disponible'}
                                                                    </div>
                                                                    <div className="evaluation-score">
                                                                        <span className={`score ${p.assessment_score >= 70 ? 'good' : p.assessment_score >= 50 ? 'average' : 'poor'}`}>
                                                                            {p.assessment_score?.toFixed(1) ?? '0'}%
                                                                        </span>
                                                                    </div>
                                                                    <div className="evaluation-status">
                                                                        {p.status === 'completado' ? '✅ Completado' : '⏳ En progreso'}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {progressList.length === 0 && (
                                                    <div className="no-evaluations">
                                                        <p>No has completado evaluaciones en esta materia.</p>
                                                        <p>Ve a la sección "Evaluaciones" para comenzar.</p>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'chat' && (
                    <div className="chat-container">
                        <div style={{ background: '#f0f0f0', padding: '10px', marginBottom: '10px', borderRadius: '5px' }}>
                            <strong>DEBUG:</strong> Chat activo - Materias inscritas: {enrolledSubjects.length} - Materia seleccionada: {selectedSubjectId || 'Ninguna'}
                        </div>
                        <div className="select-subject-section" style={{ marginBottom: '1rem' }}>
                            <label htmlFor="select-subject">Selecciona una asignatura para consultar:</label>
                            <select
                                id="select-subject"
                                value={selectedSubjectId}
                                onChange={e => {
                                    console.log('Materia seleccionada:', e.target.value);
                                    setSelectedSubjectId(e.target.value);
                                    setChatHistory([]); // Limpiar historial al cambiar de materia
                                }}
                                style={{ marginLeft: '10px', padding: '5px' }}
                            >
                                <option value="">Selecciona una materia...</option>
                                {enrolledSubjects.map(subject => (
                                    <option key={subject.id} value={subject.id}>
                                        {subject.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        
                        {/* Nota informativa sobre el formato */}
                        <div style={{ 
                            background: '#e8f4fd', 
                            padding: '10px', 
                            borderRadius: '6px', 
                            marginBottom: '15px',
                            fontSize: '14px',
                            borderLeft: '4px solid #3498db'
                        }}>
                            <strong>💡 Formato de Respuesta:</strong> El asistente IA proporcionará respuestas estructuradas con:
                            <ul style={{ margin: '5px 0 0 20px', padding: 0 }}>
                                <li><strong>Resumen Principal:</strong> Breve resumen de la respuesta</li>
                                <li><strong>Explicación Detallada:</strong> Información completa sobre el tema</li>
                                <li><strong>Puntos Clave:</strong> Aspectos importantes a recordar</li>
                                <li><strong>Fuentes Consultadas:</strong> Documentos de referencia utilizados</li>
                            </ul>
                        </div>
                        
                        {enrolledSubjects.length === 0 && (
                            <p className="no-subjects-message">
                                No tienes materias inscritas. Por favor, inscríbete en una materia primero.
                            </p>
                        )}

                        <div className="chat-messages">
                            {!selectedSubjectId ? (
                                <div className="welcome-message">
                                    <h2>Tu Asistente Personal</h2>
                                    <p>Este asistente puede ayudarte a:</p>
                                    <ul>
                                        <li>Responder preguntas sobre el contenido de tus materias</li>
                                        <li>Buscar información específica en el contenido de las materias</li>
                                        <li>Explicar conceptos de manera detallada</li>
                                        <li>Proporcionar ejemplos y casos prácticos</li>
                                    </ul>
                                    <p>Selecciona una materia para comenzar.</p>
                                </div>
                            ) : chatHistory.length === 0 ? (
                                <div className="welcome-message">
                                    <h2>Tu Asistente Personal</h2>
                                    <p>Materia seleccionada: {enrolledSubjects.find(s => s.id === selectedSubjectId)?.name}</p>
                                    <p>Puedes hacer preguntas sobre:</p>
                                    <ul>
                                        <li>Contenido de la materia</li>
                                        <li>Material de estudio</li>
                                        <li>Conceptos específicos</li>
                                        <li>Ejemplos y ejercicios</li>
                                    </ul>
                                </div>
                            ) : (
                                chatHistory.map((message, index) => (
                                    <div 
                                        key={index} 
                                        className={`message ${message.type}`}
                                    >
                                        <div className="message-content">
                                            <div dangerouslySetInnerHTML={{ __html: formatResponseText(message.content) }} />
                                            {/* Debug: Mostrar HTML generado */}
                                            {process.env.NODE_ENV === 'development' && (
                                                <details style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
                                                    <summary>Debug: HTML Generado</summary>
                                                    <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px', overflow: 'auto' }}>
                                                        {formatResponseText(message.content)}
                                                    </pre>
                                                </details>
                                            )}
                                            {message.sources && message.sources.length > 0 && (
                                                <div className="message-sources">
                                                    <h4>Fuentes:</h4>
                                                    <ul>
                                                        {message.sources.map((source, idx) => (
                                                            <li key={idx}>
                                                                {source.title} - Página {source.page}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                        <div className="message-timestamp">{message.timestamp}</div>
                                    </div>
                                ))
                            )}
                        </div>

                        <form onSubmit={handleSendMessage} className="chat-input">
                            <input
                                type="text"
                                value={chatMessage}
                                onChange={(e) => setChatMessage(e.target.value)}
                                placeholder="Escribe tu pregunta..."
                                disabled={isProcessing || !selectedSubjectId}
                            />
                            <button 
                                type="submit" 
                                disabled={isProcessing || !selectedSubjectId || !chatMessage.trim()}
                            >
                                {isProcessing ? 'Procesando...' : 'Enviar'}
                            </button>
                        </form>
                    </div>
                )}

                {activeTab === 'subjects' && (
                    <div className="subjects-section">
                        <h2>Mis Asignaturas</h2>
                        {enrolledSubjects.length === 0 ? (
                            <p>No tienes materias inscritas. Ve a la sección "Inscribirse" para inscribirte en una materia.</p>
                        ) : (
                            <div className="subjects-grid">
                                {enrolledSubjects.map((subject) => (
                                    <div key={subject.id} className="subject-card">
                                        <div className="subject-info">
                                            <h4>{subject.name}</h4>
                                            <p>Profesor: {subject.professor?.name || 'No asignado'}</p>
                                            {subject.description && (
                                                <p className="subject-description">{subject.description}</p>
                                            )}
                                        </div>
                                        <div className="subject-actions">
                                            <button 
                                                className="unenroll-button"
                                                onClick={() => {
                                                    if (window.confirm(`¿Estás seguro de que deseas desinscribirte de "${subject.name}"?`)) {
                                                        handleUnenroll(subject.id);
                                                    }
                                                }}
                                                style={{
                                                    backgroundColor: '#dc3545',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '8px 16px',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '14px'
                                                }}
                                            >
                                                Desinscribirse
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'enroll' && (
                    <div className="enroll-section">
                        <h2>Inscribirse a Asignaturas</h2>
                        <div className="subjects-grid">
                            {availableSubjects.map((subject) => {
                                const isEnrolled = enrolledSubjects.some(
                                    enrolled => enrolled.id === subject.id
                                );
                                return (
                                    <div key={subject.id} className="subject-card">
                                        <div className="subject-info">
                                            <h4>{subject.name}</h4>
                                            <p>Código: {subject.code}</p>
                                            <p className="subject-description">
                                                {subject.description}
                                            </p>
                                        </div>
                                        <div className="subject-actions">
                                            {isEnrolled ? (
                                                <button
                                                    className="unenroll-button"
                                                    onClick={() => handleUnenroll(subject.id)}
                                                >
                                                    Desinscribirse
                                                </button>
                                            ) : (
                                                <button
                                                    className="enroll-button"
                                                    onClick={() => handleEnroll(subject.id)}
                                                >
                                                    Inscribirse
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {activeTab === 'evaluations' && (
                    <Evaluations onProgressUpdate={fetchStudentProgress} />
                )}


            </main>
        </div>
    );
};

export default StudentDashboard; 