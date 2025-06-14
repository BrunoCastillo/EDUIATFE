import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabaseClient';
import Chat from './Chat';
import IntroScreen from '../IntroScreen';
import PDFUpload from './PDFUpload';
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

    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/login');
        }
    }, [authLoading, user, navigate]);

    useEffect(() => {
        if (user) {
            fetchEnrolledSubjects();
            fetchAvailableSubjects();
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

            // Actualizar la lista de materias
            await fetchAvailableSubjects();
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
                } else {
                    throw new Error(`Error al desinscribirse: ${unenrollError.message}`);
                }
            }

            if (!data) {
                throw new Error('No se pudo completar la desinscripción.');
            }

            await fetchEnrolledSubjects();
            await fetchAvailableSubjects();
            alert('Desinscripción exitosa');
        } catch (error) {
            console.error('Error al desinscribirse:', error);
            setError(error.message);
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
                            className={activeTab === 'progress' ? 'active' : ''}
                            onClick={() => setActiveTab('progress')}
                        >
                            Progreso
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
                    <li>
                        <button 
                            className={activeTab === 'documents' ? 'active' : ''}
                            onClick={() => setActiveTab('documents')}
                        >
                            Documentos
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
                                <p>0%</p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'chat' && (
                    <div className="chat-container">
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
                            >
                                <option value="">Selecciona una materia</option>
                                {enrolledSubjects.map(subject => (
                                    <option key={subject.id} value={subject.id}>
                                        {subject.name}
                                    </option>
                                ))}
                            </select>
                            {enrolledSubjects.length === 0 && (
                                <p className="no-subjects-message">
                                    No tienes materias inscritas. Por favor, inscríbete en una materia primero.
                                </p>
                            )}
                        </div>

                        <div className="chat-messages">
                            {!selectedSubjectId ? (
                                <div className="welcome-message">
                                    <h2>Tu Asistente Personal</h2>
                                    <p>Este asistente puede ayudarte a:</p>
                                    <ul>
                                        <li>Responder preguntas sobre el contenido de tus materias</li>
                                        <li>Buscar información específica en tus documentos</li>
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
                                        <li>Documentos cargados</li>
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
                                            {message.content}
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
                        <div className="subjects-grid">
                            {enrolledSubjects.map((subject) => (
                                <div key={subject.id} className="subject-card">
                                    <h4>{subject.name}</h4>
                                    <p>Profesor: {subject.professor.name}</p>
                                    <button>Ver Detalles</button>
                                </div>
                            ))}
                        </div>
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

                {activeTab === 'progress' && (
                    <div className="progress-section">
                        <h2>Mi Progreso</h2>
                        <div className="progress-grid">
                            <div className="progress-card">
                                <h4>Matemáticas</h4>
                                <div className="progress-bar">
                                    <div className="progress-fill" style={{ width: '85%' }}></div>
                                </div>
                                <p>85%</p>
                            </div>
                            <div className="progress-card">
                                <h4>Física</h4>
                                <div className="progress-bar">
                                    <div className="progress-fill" style={{ width: '75%' }}></div>
                                </div>
                                <p>75%</p>
                            </div>
                            <div className="progress-card">
                                <h4>Programación</h4>
                                <div className="progress-bar">
                                    <div className="progress-fill" style={{ width: '90%' }}></div>
                                </div>
                                <p>90%</p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'evaluations' && (
                    <Evaluations />
                )}

                {activeTab === 'documents' && (
                    <PDFUpload />
                )}
            </main>
        </div>
    );
};

export default StudentDashboard; 