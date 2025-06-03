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
            const prompt = `Basado en los siguientes temas y subtemas de un sílabo, genera 10 preguntas de opción múltiple (a, b, c, d) con sus respuestas correctas. 
Cada pregunta debe estar relacionada con el contenido de los temas y debe tener 4 opciones de respuesta.
Devuelve la respuesta en formato JSON, sin explicaciones ni texto adicional, y usa exactamente estas claves en inglés:
{
  "questions": [
    {
      "id": 1,
      "question": "texto de la pregunta",
      "options": {
        "a": "opción a",
        "b": "opción b",
        "c": "opción c",
        "d": "opción d"
      },
      "correct_answer": "a/b/c/d",
      "topic_id": "número del tema relacionado",
      "explanation": "explicación breve de por qué es la respuesta correcta"
    }
  ]
}
NO uses ninguna clave en español. NO incluyas texto fuera del JSON.

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
            // Reparar JSON truncado (cerrar array y objeto si es necesario)
            if (jsonMatch) {
                let fixed = jsonMatch[0];
                // Si termina con una coma dentro del array, quitar la coma
                fixed = fixed.replace(/,\s*\]$/, ']');
                // Si falta el cierre del array o del objeto
                if ((fixed.match(/\[/g) || []).length > (fixed.match(/\]/g) || []).length) {
                    fixed += ']';
                }
                if ((fixed.match(/\{/g) || []).length > (fixed.match(/\}/g) || []).length) {
                    fixed += '}';
                }
                jsonMatch[0] = fixed;
            }
            if (!jsonMatch) {
                console.error('No se pudo extraer el JSON. Respuesta bruta:', content);
                throw new Error('No se pudo extraer el JSON de la respuesta de DeepSeek. Respuesta bruta: ' + content.slice(0, 1000));
            }
            try {
                let questionsObj = JSON.parse(jsonMatch[0]);
                // Si las claves están en español, mapearlas a inglés
                if (questionsObj.questions === undefined && Array.isArray(questionsObj)) {
                    questionsObj = { questions: questionsObj };
                }
                if (!questionsObj.questions && Array.isArray(questionsObj)) {
                    questionsObj = { questions: questionsObj };
                }
                if (!questionsObj.questions && questionsObj.preguntas) {
                    questionsObj.questions = questionsObj.preguntas;
                }
                // Mapear claves de cada pregunta si están en español
                questionsObj.questions = (questionsObj.questions || []).map((q, idx) => {
                    // Si ya están en inglés, devolver tal cual
                    if (q.question && q.options && q.correct_answer) return q;
                    // Si están en español, mapear
                    return {
                        id: q.id || idx + 1,
                        question: q.pregunta || q.question || '',
                        options: q.opciones || q.options || {},
                        correct_answer: q.respuesta_correcta || q.correct_answer || '',
                        topic_id: q.topic_id || '',
                        explanation: q.explanation || q.explicacion || q.explicación || ''
                    };
                });
                return questionsObj.questions;
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