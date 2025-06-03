import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import { supabase } from '../../config/supabaseClient';
import Chat from './Chat';
import IntroScreen from '../IntroScreen';
import './Dashboard.css';

const StudentDashboard = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [chatMessage, setChatMessage] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [availableSubjects, setAvailableSubjects] = useState([]);
    const [enrolledSubjects, setEnrolledSubjects] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadUser = async () => {
            try {
                const currentUser = await authService.getCurrentUser();
                setUser(currentUser);
                if (currentUser) {
                    await fetchEnrolledSubjects(currentUser.id);
                    await fetchAvailableSubjects();
                }
            } catch (error) {
                console.error('Error al cargar el usuario:', error);
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        loadUser();
    }, [navigate]);

    const fetchEnrolledSubjects = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('students_subjects')
                .select(`
                    subject_id,
                    subjects (
                        id,
                        name,
                        code,
                        description,
                        professor_id
                    )
                `)
                .eq('student_id', userId);

            if (error) throw error;
            setEnrolledSubjects(data.map(item => item.subjects));
        } catch (error) {
            console.error('Error al cargar asignaturas inscritas:', error);
            setError('Error al cargar las asignaturas inscritas');
        }
    };

    const fetchAvailableSubjects = async () => {
        try {
            const { data, error } = await supabase
                .from('subjects')
                .select(`
                    id,
                    name,
                    code,
                    description,
                    professor_id
                `);

            if (error) throw error;
            setAvailableSubjects(data);
        } catch (error) {
            console.error('Error al cargar asignaturas disponibles:', error);
            setError('Error al cargar las asignaturas disponibles');
        }
    };

    const handleEnroll = async (subjectId) => {
        try {
            // Intentamos la inscripción directamente
            const { data, error: enrollError } = await supabase
                .from('students_subjects')
                .insert({
                    student_id: user.id,
                    subject_id: subjectId,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (enrollError) {
                console.error('Error detallado:', enrollError);
                
                if (enrollError.code === '23503') {
                    throw new Error('Error de registro. Por favor, contacta al administrador.');
                } else if (enrollError.code === '23505') {
                    throw new Error('Ya estás inscrito en esta asignatura.');
                } else if (enrollError.code === '42501') {
                    throw new Error('No tienes permisos para realizar esta acción.');
                } else {
                    throw new Error(`Error al inscribirse: ${enrollError.message}`);
                }
            }

            if (!data) {
                throw new Error('No se pudo completar la inscripción.');
            }

            // Actualizar las listas
            await fetchEnrolledSubjects(user.id);
            await fetchAvailableSubjects();
            
            alert('Inscripción exitosa');
        } catch (error) {
            console.error('Error al inscribirse:', error);
            setError(error.message);
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

            // Actualizar las listas
            await fetchEnrolledSubjects(user.id);
            await fetchAvailableSubjects();
            
            alert('Desinscripción exitosa');
        } catch (error) {
            console.error('Error al desinscribirse:', error);
            setError(error.message);
        }
    };

    const handleLogout = async () => {
        try {
            await authService.logout();
            navigate('/login');
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!chatMessage.trim() || isProcessing) return;

        const userMessage = {
            type: 'user',
            content: chatMessage,
            timestamp: new Date().toLocaleTimeString()
        };

        setChatHistory(prev => [...prev, userMessage]);
        setChatMessage('');
        setIsProcessing(true);

        try {
            const response = await deepseekService.sendMessage(chatMessage);
            const aiMessage = {
                type: 'ai',
                content: response,
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

    if (loading) {
        return <div className="loading">Cargando...</div>;
    }

    // Mostrar pantalla de introducción si no hay usuario autenticado
    if (!user) {
        return <IntroScreen role="estudiante" />;
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
                </ul>
                <button className="logout-button" onClick={handleLogout}>
                    Cerrar Sesión
                </button>
            </nav>

            <main className="dashboard-content">
                {error && <div className="error-message">{error}</div>}

                {activeTab === 'dashboard' && (
                    <div className="dashboard-overview">
                        <h2>Bienvenido, {user?.name}</h2>
                        <div className="stats-grid">
                            <div className="stat-card">
                                <h4>Asignaturas Activas</h4>
                                <p>3</p>
                            </div>
                            <div className="stat-card">
                                <h4>Próximas Evaluaciones</h4>
                                <p>2</p>
                            </div>
                            <div className="stat-card">
                                <h4>Promedio General</h4>
                                <p>8.5</p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'chat' && (
                    <Chat />
                )}

                {activeTab === 'subjects' && (
                    <div className="subjects-section">
                        <h2>Mis Asignaturas</h2>
                        <div className="subjects-grid">
                            {enrolledSubjects.map((subject) => (
                                <div key={subject.id} className="subject-card">
                                    <h4>{subject.name}</h4>
                                    <p>Profesor: {subject.professor_id}</p>
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
            </main>
        </div>
    );
};

export default StudentDashboard; 