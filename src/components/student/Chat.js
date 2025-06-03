import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../config';
import { ragService } from '../../services/rag.service';
import './Chat.css';

const Chat = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [subjects, setSubjects] = useState([]);
    const [selectedSubjectId, setSelectedSubjectId] = useState('');
    const [session, setSession] = useState(null);

    useEffect(() => {
        checkUser();
        checkSession();
    }, []);

    useEffect(() => {
        if (user) {
            fetchSubjects();
        }
    }, [user]);

    const checkUser = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate('/login');
                return;
            }
            setUser({
                id: user.id,
                email: user.email,
                full_name: user.user_metadata?.full_name || user.email.split('@')[0]
            });
        } catch (error) {
            console.error('Error al verificar usuario:', error);
            navigate('/login');
        } finally {
            setLoading(false);
        }
    };

    const checkSession = async () => {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) {
                console.error('Error al obtener sesión:', error);
                setSession(null);
                return;
            }
            setSession(session);
        } catch (error) {
            console.error('Error al verificar sesión:', error);
            setSession(null);
        }
    };

    const fetchSubjects = async () => {
        try {
            const { data, error } = await supabase
                .from('students_subjects')
                .select(`
                    subject_id,
                    subjects (
                        id,
                        name,
                        code,
                        description
                    )
                `)
                .eq('student_id', user.id);

            if (error) throw error;
            // Extraer solo los datos de la materia
            const subjects = (data || []).map(item => item.subjects);
            setSubjects(subjects);
            if (subjects.length > 0 && !selectedSubjectId) {
                setSelectedSubjectId(subjects[0].id);
            }
        } catch (error) {
            console.error('Error al cargar materias inscritas:', error);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!message.trim() || isProcessing || !selectedSubjectId) return;

        const userMessage = message.trim();
        setMessage('');
        setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsProcessing(true);

        try {
            console.log('Enviando pregunta al asistente RAG:', userMessage);
            console.log('Materia seleccionada:', selectedSubjectId);
            
            const response = await ragService.processQuestion(userMessage, selectedSubjectId);
            
            setChatHistory(prev => [...prev, { 
                role: 'assistant', 
                content: response.answer,
                sources: response.sources
            }]);
        } catch (error) {
            console.error('Error al enviar mensaje:', error);
            setChatHistory(prev => [...prev, { 
                role: 'assistant', 
                content: error.message || 'Lo siento, ha ocurrido un error al procesar tu mensaje.' 
            }]);
        } finally {
            setIsProcessing(false);
        }
    };

    if (loading) {
        return <div className="loading">Cargando...</div>;
    }

    if (!user) {
        return null;
    }

    return (
        <div className="chat-container">
            <div className="select-subject-section">
                <label htmlFor="select-subject">Selecciona una materia:</label>
                <select
                    id="select-subject"
                    value={selectedSubjectId}
                    onChange={e => setSelectedSubjectId(e.target.value)}
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
                        No hay materias disponibles. Por favor, contacta a tu profesor.
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
                    chatHistory.map((message, index) => (
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

            <form onSubmit={handleSendMessage} className="chat-input">
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={selectedSubjectId ? "Escribe tu pregunta sobre la materia..." : "Selecciona una materia primero..."}
                    disabled={isProcessing || !selectedSubjectId}
                />
                <button 
                    type="submit" 
                    disabled={isProcessing || !message.trim() || !selectedSubjectId}
                >
                    {isProcessing ? 'Procesando...' : 'Enviar'}
                </button>
            </form>
        </div>
    );
};

export default Chat; 