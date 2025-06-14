import React, { useState, useRef, useEffect } from 'react';
import { ragService } from '../../services/rag.service';
import './ChatIA.css';
import { useAuth } from '../../contexts/AuthContext';

const ChatIA = ({ subjectId }) => {
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        console.log('=== ChatIA Component ===');
        console.log('Materia ID:', subjectId);
        console.log('Estado inicial:', { messages, isLoading });

        // Limpiar mensajes cuando cambia la materia
        if (subjectId) {
            setMessages([]);
            console.log('Mensajes reiniciados para nueva materia');
        }
    }, [subjectId]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!inputMessage.trim()) return;

        console.log('=== Enviando Pregunta ===');
        console.log('Pregunta:', inputMessage);
        console.log('Materia ID:', subjectId);

        // Agregar mensaje del usuario
        const userMessage = {
            role: 'user',
            content: inputMessage,
            timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');
        setIsLoading(true);

        try {
            console.log('Procesando pregunta con RAG service...');
            // Procesar la pregunta y obtener respuesta
            const result = await ragService.processQuestion(inputMessage, subjectId);
            console.log('Respuesta RAG recibida:', {
                answer: result.answer.substring(0, 100) + '...',
                sources: result.sources.map(s => ({
                    title: s.title,
                    page: s.page,
                    fragment: s.fragment.substring(0, 50) + '...'
                }))
            });
            
            // Agregar respuesta del asistente
            const assistantMessage = {
                role: 'assistant',
                content: result.answer,
                sources: result.sources,
                timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Error en ChatIA:', error);
            // Agregar mensaje de error
            const errorMessage = {
                role: 'error',
                content: 'Lo siento, hubo un error al procesar tu pregunta. Por favor, intenta de nuevo.',
                timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const formatTimestamp = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString();
    };

    if (!subjectId) {
        console.log('ChatIA: No hay materia seleccionada');
        return (
            <div className="chat-container">
                <div className="chat-header">
                    <h4>Chat con IA</h4>
                </div>
                <div className="chat-messages">
                    <div className="welcome-message">
                        <p>Por favor, selecciona una materia para usar el chat con IA</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="chat-container">
            <div className="chat-header">
                <h4>Chat con IA - Materia ID: {subjectId}</h4>
            </div>
            <div className="chat-messages">
                {messages.length === 0 && (
                    <div className="welcome-message">
                        <p>¡Bienvenido al chat con IA! Haz una pregunta sobre el contenido de la materia.</p>
                    </div>
                )}
                {messages.map((message, index) => (
                    <div key={index} className={`message ${message.role}`}>
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
                        <span className="timestamp">{formatTimestamp(message.timestamp)}</span>
                    </div>
                ))}
                {isLoading && (
                    <div className="message assistant">
                        <div className="message-content">
                            <p>Pensando...</p>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="chat-input">
                <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Escribe tu pregunta aquí..."
                    disabled={isLoading}
                />
                <button type="submit" disabled={isLoading}>
                    {isLoading ? 'Enviando...' : 'Enviar'}
                </button>
            </form>
        </div>
    );
};

export default ChatIA; 