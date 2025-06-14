import { config } from '../config';

class DeepSeekService {
    constructor() {
        this.apiUrl = 'https://api.deepseek.com/v1/chat/completions';
        // Usar directamente la API key
        this.apiKey = 'sk-0728bc5b19fa40309517fa81eea0f130';
        
        console.log('=== DEBUG: DeepSeek Service ===');
        console.log('API Key configurada:', !!this.apiKey);
        console.log('API URL:', this.apiUrl);
        console.log('=============================');
    }

    async sendMessage(message) {
        try {
            console.log('Enviando mensaje a DeepSeek...');
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    messages: [{
                        role: 'user',
                        content: message
                    }],
                    model: 'deepseek-chat',
                    temperature: 0.7,
                    max_tokens: 1000
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Error en la respuesta de DeepSeek:', errorData);
                throw new Error(`Error en la API: ${response.status} - ${errorData.error?.message || 'Error desconocido'}`);
            }

            const data = await response.json();
            console.log('Respuesta recibida de DeepSeek:', data);
            return data.choices[0].message.content;
        } catch (error) {
            console.error('Error al enviar mensaje a DeepSeek:', error);
            throw new Error('No se pudo obtener una respuesta del asistente. Por favor, intenta de nuevo.');
        }
    }

    async generateQuestions(topics) {
        try {
            // Limitar el contenido a máximo 3000 palabras por tema
            const limitedTopics = topics.map(t => ({
                ...t,
                content: t.content ? t.content.split(/\s+/).slice(0, 3000).join(' ') : ''
            }));
            console.log('Generando preguntas para los temas (limitado):', limitedTopics);
            // Construir el prompt para generar preguntas
            const prompt = `
             * Generador de preguntas tipo test a partir de un documento educativo
 *
 * Objetivo:
 * - Leer el contenido de un archivo educativo (PDF o texto plano ya extraído).
 * - Identificar los conceptos o ideas más importantes del documento.
 * - Generar 10 preguntas de opción múltiple basadas en esa información clave.
 * - Para cada pregunta, generar cuatro opciones: a), b), c), d)
 * - Indicar claramente cuál opción es la correcta.
 * - Devolver todo el conjunto de preguntas y respuestas en formato JSON.
 *
 * Formato de salida esperado (JSON):
 * [
 *   {
 *     "pregunta": "¿Cuál es la fórmula general para resolver ecuaciones cuadráticas?",
 *     "opciones": {
 *       "a": "x = (-b ± √(b² - 4ac)) / 2a",
 *       "b": "x = b² - 4ac",
 *       "c": "x = (b ± √(4ac)) / 2a",
 *       "d": "x = (2a ± √(b² - 4ac)) / 2b"
 *     },
 *     "respuesta_correcta": "a"
 *     "topic_id": "Titulo del tema relacionado",
 *     "explanation": "explicación breve de por qué es la respuesta correcta"
 *   },
 *   ...
 * ]
 *
 * Instrucciones adicionales:
 * - Evita repetir temas en múltiples preguntas.
 * - Asegúrate de que solo una opción sea correcta por pregunta.
 * - Redacta las preguntas en un nivel adecuado para estudiantes.
 * - Si el documento es muy largo, selecciona los fragmentos más relevantes.
 *
 * Idioma: Español
 */
}

Temas y subtemas:
${JSON.stringify(limitedTopics, null, 2)}`;

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    messages: [{
                        role: 'user',
                        content: prompt
                    }],
                    model: 'deepseek-chat',
                    temperature: 0.7,
                    max_tokens: 2000
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Error en la respuesta de DeepSeek:', errorData);
                throw new Error(`Error en la API: ${response.status} - ${errorData.error?.message || 'Error desconocido'}`);
            }

            const data = await response.json();
            console.log('Respuesta recibida de DeepSeek:', data);
            // Extraer el JSON de la respuesta
            const content = data.choices[0].message.content;
            let jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                // Intentar limpiar la respuesta buscando el primer { y el último }
                const first = content.indexOf('{');
                const last = content.lastIndexOf('}');
                if (first !== -1 && last !== -1 && last > first) {
                    jsonMatch = [content.substring(first, last + 1)];
                }
            }
            if (!jsonMatch) {
                console.error('No se pudo extraer el JSON. Respuesta bruta:', content);
                throw new Error('No se pudo extraer el JSON de la respuesta de DeepSeek. Respuesta bruta: ' + content.slice(0, 1000));
            }
            try {
                const questions = JSON.parse(jsonMatch[0]);
                return questions.questions;
            } catch (err) {
                console.error('Error al parsear JSON. Respuesta bruta:', jsonMatch[0]);
                throw new Error('Error al parsear JSON de DeepSeek. Respuesta bruta: ' + jsonMatch[0].slice(0, 1000));
            }
        } catch (error) {
            console.error('Error al generar preguntas:', error);
            throw new Error('No se pudieron generar las preguntas. ' + (error.message || 'Por favor, intenta de nuevo.'));
        }
    }
}

export const deepseekService = new DeepSeekService(); 