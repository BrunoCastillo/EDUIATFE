import { supabase } from '../config/supabaseClient';

class RAGService {
    constructor() {
        this.DEEPSEEK_API_KEY = process.env.REACT_APP_DEEPSEEK_API_KEY;
        this.DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
    }

    async generateEmbedding(text) {
        console.log('Generando embedding para el texto:', text);
        // TODO: Implementar generación real de embeddings
        // Por ahora usamos el mismo método que en nlp.service.js
        const embedding = Array(1536).fill(0).map(() => Math.random());
        console.log('Embedding generado (primeros 20 valores):', embedding.slice(0, 20));
        return embedding;
    }

    async findRelevantFragments(question, subjectId, limit = 10) {
        try {
            console.log('Buscando fragmentos relevantes para la pregunta:', question);
            console.log('Materia ID:', subjectId);
            
            if (!subjectId) {
                throw new Error('Se requiere el ID de la materia');
            }

            // Validar que subjectId sea un UUID válido
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(subjectId)) {
                throw new Error('ID de materia inválido');
            }

            // Generar embedding de la pregunta
            const questionEmbedding = await this.generateEmbedding(question);
            console.log('Embedding de la pregunta generado (primeros 20 valores):', questionEmbedding.slice(0, 20));

            // Buscar fragmentos similares usando pgvector con parámetros optimizados
            console.log('Consultando la base de datos con pgvector...');
            const { data: fragments, error } = await supabase.rpc('match_fragments', {
                query_embedding: questionEmbedding,
                match_threshold: 0.1,
                match_count: limit,
                p_subject_id: subjectId
            });

            if (error) {
                console.error('Error en la consulta pgvector:', error);
                if (error.code === 'PGRST202') {
                    throw new Error('La función match_fragments no está disponible. Por favor, contacta al administrador.');
                }
                if (error.code === '54000') {
                    throw new Error('Error de memoria. Por favor, intenta con una pregunta más específica o contacta al administrador.');
                }
                if (error.code === '22P02') {
                    throw new Error('Error en el formato del ID de la materia. Por favor, contacta al administrador.');
                }
                if (error.code === '42702') {
                    throw new Error('Error en la configuración de la base de datos. Por favor, contacta al administrador.');
                }
                if (error.code === '42804' || error.code === '42846') {
                    throw new Error('Error en la configuración de la base de datos. Por favor, contacta al administrador.');
                }
                if (error.message && error.message.includes('Could not choose the best candidate function')) {
                    throw new Error('Error en la configuración de la base de datos. Por favor, contacta al administrador.');
                }
                if (error.message && error.message.includes('structure of query does not match function result type')) {
                    throw new Error('Error en la configuración de la base de datos. Por favor, contacta al administrador.');
                }
                throw new Error(error.message || 'Error al buscar fragmentos relevantes');
            }

            if (!fragments || fragments.length === 0) {
                console.log('No se encontraron fragmentos relevantes');
                return [];
            }

            // Limitar el tamaño de los fragmentos para reducir el uso de memoria
            const processedFragments = fragments.map(fragment => ({
                ...fragment,
                id: fragment.id.toString(),
                document_id: fragment.document_id.toString(),
                subject_id: fragment.subject_id.toString(),
                fragment: fragment.fragment.substring(0, 500)
            }));

            console.log('Fragmentos encontrados:', processedFragments.length);
            processedFragments.forEach((fragment, index) => {
                console.log(`Fragmento ${index + 1}:`, {
                    titulo: fragment.section_title,
                    pagina: fragment.page_number,
                    similitud: fragment.similarity,
                    fragmento: fragment.fragment.substring(0, 100) + '...'
                });
            });

            return processedFragments;
        } catch (error) {
            console.error('Error al buscar fragmentos relevantes:', error);
            throw new Error(error.message || 'No se pudieron encontrar fragmentos relevantes');
        }
    }

    async generateResponse(question, fragments) {
        try {
            console.log('Generando respuesta para la pregunta:', question);
            console.log('Usando', fragments.length, 'fragmentos como contexto');

            // Construir el mensaje del sistema con los fragmentos y sus embeddings
            const systemMessage = this.buildSystemMessage(fragments);
            console.log('Mensaje del sistema construido:', systemMessage.substring(0, 200) + '...');

            // Preparar el mensaje para DeepSeek con información de similitud
            const messages = [
                {
                    role: 'system',
                    content: systemMessage
                },
                {
                    role: 'user',
                    content: question
                }
            ];

            // Preparar los embeddings y su información de similitud
            const embeddings = fragments.map(fragment => ({
                id: fragment.id,
                embedding: fragment.embedding,
                similarity: fragment.similarity,
                metadata: {
                    section_title: fragment.section_title,
                    page_number: fragment.page_number,
                    fragment: fragment.fragment
                }
            }));

            // Log detallado de la solicitud
            console.log('=== SOLICITUD A DEEPSEEK ===');
            console.log('URL:', this.DEEPSEEK_API_URL);
            console.log('Headers:', {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + this.DEEPSEEK_API_KEY.substring(0, 10) + '...'
            });
            console.log('Body:', JSON.stringify({
                model: 'deepseek-chat',
                messages: messages,
                temperature: 0.7,
                max_tokens: 1000,
                embeddings: embeddings,
                context: {
                    fragments: fragments.map(f => ({
                        title: f.section_title,
                        page: f.page_number,
                        content: f.fragment,
                        similarity: f.similarity
                    }))
                }
            }, null, 2));
            console.log('========================');

            console.log('Enviando solicitud a DeepSeek API...');
            // Llamar a la API de DeepSeek
            const response = await fetch(this.DEEPSEEK_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.DEEPSEEK_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 1000,
                    embeddings: embeddings,
                    context: {
                        fragments: fragments.map(f => ({
                            title: f.section_title,
                            page: f.page_number,
                            content: f.fragment,
                            similarity: f.similarity
                        }))
                    }
                })
            });

            if (!response.ok) {
                console.error('Error en la respuesta de DeepSeek:', response.status, response.statusText);
                const errorText = await response.text();
                console.error('Detalles del error:', errorText);
                throw new Error('Error en la respuesta de DeepSeek');
            }

            const data = await response.json();
            console.log('=== RESPUESTA DE DEEPSEEK ===');
            console.log('Status:', response.status);
            console.log('Headers:', Object.fromEntries(response.headers.entries()));
            console.log('Body:', JSON.stringify(data, null, 2));
            console.log('==========================');

            return data.choices[0].message.content;
        } catch (error) {
            console.error('Error al generar respuesta:', error);
            throw new Error('No se pudo generar una respuesta');
        }
    }

    buildSystemMessage(fragments) {
        // Ordenar fragmentos por similitud
        const sortedFragments = [...fragments].sort((a, b) => b.similarity - a.similarity);
        
        const context = sortedFragments.map(fragment => {
            return `[Fragmento de "${fragment.section_title}", página ${fragment.page_number}, similitud: ${(fragment.similarity * 100).toFixed(2)}%]:\n${fragment.fragment}\n`;
        }).join('\n');

        return `Eres un asistente educativo experto especializado en la materia. Tu objetivo es proporcionar respuestas precisas y detalladas basadas en el contenido de los documentos proporcionados.

Fragmentos de referencia (ordenados por relevancia):
${context}

Instrucciones específicas:
1. Analiza cuidadosamente todos los fragmentos proporcionados, dando más peso a los que tienen mayor similitud.
2. Proporciona respuestas detalladas y completas, citando específicamente los fragmentos relevantes.
3. Si la información en los fragmentos es insuficiente, indícalo claramente y sugiere qué información adicional sería necesaria.
4. Mantén un tono educativo y amigable, pero profesional.
5. Si la pregunta está fuera del contexto de los fragmentos, indícalo respetuosamente y sugiere reformular la pregunta.
6. Incluye ejemplos o casos prácticos cuando sea relevante.
7. Estructura tu respuesta de manera clara y organizada.
8. Si hay contradicciones entre fragmentos, señálalas y explica cómo reconciliarlas.
9. Incluye el fragmento completo en tu respuesta para referencia.
10. Si la pregunta es sobre un tema que no está en los fragmentos, proporciona el fragmento más relacionado y sugiere buscar información adicional en internet.

Recuerda que tu objetivo es ayudar al estudiante a comprender mejor el tema, no solo proporcionar información.`;
    }

    async processQuestion(question, subjectId) {
        try {
            console.log('Procesando pregunta para la materia:', subjectId);
            
            if (!subjectId) {
                throw new Error('Se requiere el ID de la materia');
            }

            // 1. Encontrar fragmentos relevantes
            const fragments = await this.findRelevantFragments(question, subjectId);

            if (!fragments || fragments.length === 0) {
                return {
                    answer: "Lo siento, no encontré información relevante en los documentos de esta materia. Por favor, asegúrate de que haya documentos cargados o reformula tu pregunta.",
                    sources: []
                };
            }

            // 2. Generar respuesta usando DeepSeek
            const response = await this.generateResponse(question, fragments);

            return {
                answer: response,
                sources: fragments.map(f => ({
                    title: f.section_title,
                    page: f.page_number,
                    fragment: f.fragment
                }))
            };
        } catch (error) {
            console.error('Error al procesar la pregunta:', error);
            throw new Error(error.message || 'No se pudo procesar la pregunta');
        }
    }
}

export const ragService = new RAGService(); 