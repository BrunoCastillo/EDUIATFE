import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config';
import { deepseekService } from '../../services/deepseek.service';
import { ragService } from '../../services/rag.service';
import { Subjects } from './Subjects';
import PDFUpload from './PDFUpload';
import FileUpload from './FileUpload';
import SyllabusUpload from './SyllabusUpload';
import SyllabusTopicsGrid from './SyllabusTopicsGrid';
import './Dashboard.css';

const Dashboard = () => {
    const navigate = useNavigate();
    const { user, session, loading: authLoading, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('subjects');
    const [chatMessage, setChatMessage] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [subjects, setSubjects] = useState([]);
    const [selectedSubjectId, setSelectedSubjectId] = useState('');
    const [ragChatMessage, setRagChatMessage] = useState('');
    const [ragChatHistory, setRagChatHistory] = useState([]);
    const [isRagProcessing, setIsRagProcessing] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/login');
        }
    }, [authLoading, user, navigate]);

    useEffect(() => {
        if (user) {
            fetchSubjects();
        }
    }, [user]);

    const fetchSubjects = async () => {
        try {
            const { data, error } = await supabase
                .from('subjects')
                .select('*')
                .eq('professor_id', user.id)
                .order('created_at', { ascending: false });
            setSubjects(data || []);
            if (data && data.length > 0 && !selectedSubjectId) {
                setSelectedSubjectId(data[0].id);
            }
        } catch (error) {
            setSubjects([]);
        }
    };

    const handleRagSendMessage = async (e) => {
        e.preventDefault();
        if (!ragChatMessage.trim() || isRagProcessing || !selectedSubjectId) return;

        const userMessage = ragChatMessage.trim();
        setRagChatMessage('');
        setRagChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsRagProcessing(true);

        try {
            // Validar que selectedSubjectId sea un UUID válido
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(selectedSubjectId)) {
                throw new Error('ID de materia inválido');
            }
            const response = await ragService.processQuestion(userMessage, selectedSubjectId);
            setRagChatHistory(prev => [...prev, { 
                role: 'assistant', 
                content: response.answer,
                sources: response.sources
            }]);
        } catch (error) {
            setRagChatHistory(prev => [...prev, { 
                role: 'assistant', 
                content: error.message || 'Lo siento, ha ocurrido un error al procesar tu mensaje.' 
            }]);
        } finally {
            setIsRagProcessing(false);
        }
    };

    if (authLoading) {
        return <div className="loading">Cargando...</div>;
    }

    if (!user) {
        return null;
    }

    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <div className="user-info">
                    <h1>Bienvenido, {user.full_name || user.email}</h1>
                    <p>{user.email}</p>
                </div>
                <button className="logout-button" onClick={logout}>
                    Cerrar Sesión
                </button>
            </header>
            <div className="dashboard-content">
                <nav className="dashboard-nav">
                    <div className="nav-header">
                        <h2>EDUIA</h2>
                        <p>Panel del Profesor</p>
                    </div>
                    <ul className="nav-menu">
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
                                className={activeTab === 'Syllabus' ? 'active' : ''}
                                onClick={() => setActiveTab('Syllabus')}
                            >
                                Cargar Silabo
                            </button>
                        </li>
                        <li>
                            <button 
                                className={activeTab === 'assistant' ? 'active' : ''}
                                onClick={() => setActiveTab('assistant')}
                            >
                                Tu Asistente
                            </button>
                        </li>
                        <li>
                            <button 
                                className={activeTab === 'files' ? 'active' : ''}
                                onClick={() => setActiveTab('files')}
                            >
                                Carga de Archivos
                            </button>
                        </li>
                    </ul>
                    <button className="logout-button" onClick={logout}>
                        Cerrar Sesión
                    </button>
                </nav>
                <main className="dashboard-main">
                    {activeTab === 'subjects' && (
                        <Subjects professorId={user.id} session={session} user={user} />
                    )}
                    {activeTab === 'chat' && (
                        <div className="chat-container">
                            <div className="select-subject-section" style={{ marginBottom: '1rem' }}>
                                <label htmlFor="select-chat-subject">Selecciona una asignatura para el chat:</label>
                                <select
                                    id="select-chat-subject"
                                    value={selectedSubjectId}
                                    onChange={e => setSelectedSubjectId(e.target.value)}
                                >
                                    {subjects.map(subject => (
                                        <option key={subject.id} value={subject.id}>{subject.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="chat-messages">
                                {chatHistory.length === 0 ? (
                                    <div className="welcome-message">
                                        <h2>Bienvenido al Asistente IA</h2>
                                        <p>Puedo ayudarte con:</p>
                                        <ul>
                                            <li>Diseño de planes de estudio</li>
                                            <li>Creación de materiales didácticos</li>
                                            <li>Evaluación de estudiantes</li>
                                            <li>Resolución de dudas pedagógicas</li>
                                        </ul>
                                    </div>
                                ) : (
                                    chatHistory.map((message, index) => (
                                        <div 
                                            key={index} 
                                            className={`message ${message.role}`}
                                        >
                                            {message.content}
                                        </div>
                                    ))
                                )}
                            </div>
                            <form onSubmit={handleSendMessage} className="chat-input">
                                <input
                                    type="text"
                                    value={chatMessage}
                                    onChange={(e) => setChatMessage(e.target.value)}
                                    placeholder="Escribe tu mensaje..."
                                    disabled={isProcessing}
                                />
                                <button 
                                    type="submit" 
                                    disabled={isProcessing || !chatMessage.trim()}
                                >
                                    {isProcessing ? 'Enviando...' : 'Enviar'}
                                </button>
                            </form>
                        </div>
                    )}
                    {activeTab === 'assistant' && (
                        <div className="chat-container">
                            <div className="select-subject-section" style={{ marginBottom: '1rem' }}>
                                <label htmlFor="select-rag-subject">Selecciona una asignatura para consultar:</label>
                                <select
                                    id="select-rag-subject"
                                    value={selectedSubjectId}
                                    onChange={e => {
                                        console.log('[Dashboard] Materia seleccionada:', e.target.value);
                                        setSelectedSubjectId(e.target.value);
                                    }}
                                >
                                    <option value="">Selecciona una materia</option>
                                    {subjects.map(subject => (
                                        <option key={subject.id} value={subject.id}>
                                            {subject.name} ({subject.code})
                                        </option>
                                    ))}
                                </select>
                                {subjects.length === 0 && (
                                    <p className="no-subjects-message">
                                        No tienes materias registradas. Por favor, crea una materia primero.
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
                                ) : ragChatHistory.length === 0 ? (
                                    <div className="welcome-message">
                                        <h2>Tu Asistente Personal</h2>
                                        <p>Materia seleccionada: {subjects.find(s => s.id === selectedSubjectId)?.name}</p>
                                        <p>Puedes hacer preguntas sobre:</p>
                                        <ul>
                                            <li>Contenido de la materia</li>
                                            <li>Documentos cargados</li>
                                            <li>Conceptos específicos</li>
                                            <li>Ejemplos y ejercicios</li>
                                        </ul>
                                    </div>
                                ) : (
                                    ragChatHistory.map((message, index) => (
                                        <div 
                                            key={index} 
                                            className={`message ${message.role}`}
                                        >
                                            <div className="message-content">
                                                <p>{message.content}</p>
                                                {message.sources && (
                                                    <div className="sources">
                                                        <h4>Fuentes:</h4>
                                                        {message.sources.map((source, idx) => (
                                                            <div key={idx} className="source">
                                                                <p><strong>{source.title}</strong> (Página {source.page})</p>
                                                                <p className="source-fragment">{source.fragment}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <form onSubmit={handleRagSendMessage} className="chat-input">
                                <input
                                    type="text"
                                    value={ragChatMessage}
                                    onChange={(e) => setRagChatMessage(e.target.value)}
                                    placeholder={selectedSubjectId ? "Escribe tu pregunta sobre la materia..." : "Selecciona una materia primero..."}
                                    disabled={isRagProcessing || !selectedSubjectId}
                                />
                                <button 
                                    type="submit" 
                                    disabled={isRagProcessing || !ragChatMessage.trim() || !selectedSubjectId}
                                >
                                    {isRagProcessing ? 'Procesando...' : 'Enviar'}
                                </button>
                            </form>
                        </div>
                    )}
                    {activeTab === 'files' && (
                        <div className="files-section">
                            <h2>Carga de Archivos</h2>
                            <pre style={{background:'#f8f9fa',padding:'10px',borderRadius:'6px',fontSize:'0.95em',color:'#333'}}>
                                Estado de sesión: {session ? 'ACTIVA' : 'NO ACTIVA'}
                                {session && session.user ? ` | Usuario: ${session.user.email}` : ''}
                            </pre>
                            {!session ? (
                                <div className="no-subjects">
                                    <p>No hay sesión activa. Por favor, vuelve a iniciar sesión.</p>
                                    <button onClick={() => navigate('/login')} className="login-button">
                                        Ir a Iniciar Sesión
                                    </button>
                                </div>
                            ) : subjects.length === 0 ? (
                                <div className="no-subjects">
                                    <p>No tienes asignaturas registradas. Crea una para poder cargar archivos.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="select-subject-section">
                                        <label htmlFor="select-subject">Selecciona una asignatura:</label>
                                        <select
                                            id="select-subject"
                                            value={selectedSubjectId}
                                            onChange={e => setSelectedSubjectId(e.target.value)}
                                        >
                                            <option value="">Selecciona una asignatura</option>
                                            {subjects.map(subject => (
                                                <option key={subject.id} value={subject.id}>{subject.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {selectedSubjectId ? (
                                        <>
                                            <PDFUpload subjectId={selectedSubjectId} session={session} />
                                            <FileUpload subjectId={selectedSubjectId} session={session} />
                                        </>
                                    ) : (
                                        <div className="no-subjects">
                                            <p>Selecciona una asignatura para cargar archivos.</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                    {activeTab === 'Syllabus' && (
                        <div className="syllabus-section">
                            <h2>Cargar Silabo</h2>
                            <SyllabusUpload 
                                subjectId={selectedSubjectId} 
                                setSubjectId={setSelectedSubjectId}
                                subjects={subjects}
                                session={session} 
                            />
                            <h3 style={{marginTop:'2rem'}}>Temas y subtemas analizados</h3>
                            <SyllabusTopicsGrid subjectId={selectedSubjectId} />
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default Dashboard; 