import { supabase } from '../config/supabaseClient';
import { deepseekService } from './deepseek.service';

class RAGService {
    constructor() {
        this.DEEPSEEK_API_KEY = process.env.REACT_APP_DEEPSEEK_API_KEY;
        this.DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
        this.deepseek = deepseekService;
        this.config = {
            chunkSize: 1000,
            chunkOverlap: 200
        };
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

    async processDocument(file, subjectId) {
        try {
            console.log('Iniciando procesamiento del documento...');
            
            // 1. Extraer texto del PDF
            const text = await this.extractTextFromPDF(file);
            console.log('Texto extraído del PDF');
            
            // 2. Dividir en chunks
            const chunks = this.splitIntoChunks(text);
            console.log(`Documento dividido en ${chunks.length} chunks`);
            
            // 3. Generar embeddings
            const embeddings = await this.generateEmbeddings(chunks);
            console.log('Embeddings generados');
            
            // 4. Guardar en Supabase
            const { data: document, error: docError } = await supabase
                .from('documents')
                .insert([{
                    subject_id: subjectId,
                    file_name: file.name,
                    file_type: file.type,
                    file_size: file.size,
                    content: text
                }])
                .select()
                .single();

            if (docError) throw docError;
            console.log('Documento guardado en base de datos');

            // 5. Guardar embeddings
            const embeddingsToInsert = embeddings.map((embedding, index) => ({
                document_id: document.id,
                chunk_index: index,
                content: chunks[index],
                embedding: embedding
            }));

            const { error: embeddingError } = await supabase
                .from('document_embeddings')
                .insert(embeddingsToInsert);

            if (embeddingError) throw embeddingError;
            console.log('Embeddings guardados en base de datos');

            // 6. Generar preguntas de opción múltiple
            console.log('Iniciando generación de preguntas...');
            const questions = await this.generateMultipleChoiceQuestions(chunks, document.id);
            console.log(`Se generaron ${questions.length} preguntas`);

            if (questions.length === 0) {
                console.warn('No se generaron preguntas para el documento');
                return {
                    success: true,
                    documentId: document.id,
                    questionsCount: 0
                };
            }

            // 7. Guardar preguntas en la base de datos
            const { error: questionsError } = await supabase
                .from('document_questions')
                .insert(questions);

            if (questionsError) {
                console.error('Error al guardar las preguntas:', questionsError);
                throw questionsError;
            }
            console.log('Preguntas guardadas en base de datos');

            return {
                success: true,
                documentId: document.id,
                questionsCount: questions.length
            };
        } catch (error) {
            console.error('Error en processDocument:', error);
            throw error;
        }
    }

    async generateMultipleChoiceQuestions(chunks, documentId) {
        try {
            console.log('Iniciando generación de preguntas...');
            const questions = [];
            const chunksForQuestions = this.selectChunksForQuestions(chunks);
            console.log(`Seleccionados ${chunksForQuestions.length} chunks para generar preguntas`);

            for (const [index, chunk] of chunksForQuestions.entries()) {
                console.log(`Generando pregunta ${index + 1} de ${chunksForQuestions.length}`);
                
                const prompt = `
                    Genera una pregunta de opción múltiple basada en el siguiente texto:
                    "${chunk}"
                    
                    La pregunta debe:
                    1. Ser clara y concisa
                    2. Tener 4 opciones de respuesta
                    3. Tener solo una respuesta correcta
                    4. Incluir una explicación de la respuesta correcta
                    
                    Formato de respuesta:
                    {
                        "question": "pregunta",
                        "options": ["opción A", "opción B", "opción C", "opción D"],
                        "correct_answer": "opción correcta",
                        "explanation": "explicación de la respuesta correcta"
                    }
                `;

                const response = await fetch(this.DEEPSEEK_API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.DEEPSEEK_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: "deepseek-chat",
                        messages: [
                            {
                                role: "system",
                                content: "Eres un experto en crear preguntas de opción múltiple educativas y desafiantes."
                            },
                            {
                                role: "user",
                                content: prompt
                            }
                        ],
                        temperature: 0.7,
                        max_tokens: 500
                    })
                });

                const data = await response.json();
                console.log('Respuesta de DeepSeek:', data);

                try {
                    const questionData = JSON.parse(data.choices[0].message.content);
                    questions.push({
                        document_id: documentId,
                        question: questionData.question,
                        options: questionData.options,
                        correct_answer: questionData.correct_answer,
                        explanation: questionData.explanation,
                        created_at: new Date().toISOString()
                    });

                    console.log(`Pregunta ${index + 1} generada exitosamente`);
                } catch (parseError) {
                    console.error('Error al procesar la respuesta:', parseError);
                    console.log('Respuesta que causó el error:', data);
                }
            }

            return questions;
        } catch (error) {
            console.error('Error generando preguntas:', error);
            throw error;
        }
    }

    selectChunksForQuestions(chunks) {
        // Seleccionar chunks que tengan suficiente contenido para generar preguntas
        const validChunks = chunks.filter(chunk => 
            chunk.length > 100 && // Mínimo 100 caracteres
            chunk.split(' ').length > 20 // Mínimo 20 palabras
        );

        // Seleccionar 10 chunks aleatorios o todos si hay menos de 10
        const selectedChunks = validChunks.length <= 10 
            ? validChunks 
            : this.getRandomChunks(validChunks, 10);

        return selectedChunks;
    }

    getRandomChunks(chunks, count) {
        const shuffled = [...chunks].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    async processDocumentWithText(text, documentId) {
        try {
            console.log('Iniciando procesamiento del documento con texto...');
            
            // Dividir en chunks
            const chunks = this.splitIntoChunks(text);
            console.log(`Documento dividido en ${chunks.length} chunks`);
            
            // Generar embeddings
            const embeddings = await this.generateEmbeddings(chunks);
            console.log('Embeddings generados');
            
            // Guardar embeddings
            const embeddingsToInsert = embeddings.map((embedding, index) => ({
                document_id: documentId,
                page_number: index + 1,
                fragment: chunks[index],
                embedding: embedding
            }));

            const { error: embeddingError } = await supabase
                .from('embeddings')
                .insert(embeddingsToInsert);

            if (embeddingError) throw embeddingError;
            console.log('Embeddings guardados en base de datos');

            // Generar preguntas de opción múltiple
            console.log('Iniciando generación de preguntas...');
            const questions = await this.generateMultipleChoiceQuestions(chunks, documentId);
            console.log(`Se generaron ${questions.length} preguntas`);

            if (questions.length === 0) {
                console.warn('No se generaron preguntas para el documento');
                return {
                    success: true,
                    documentId: documentId,
                    questionsCount: 0
                };
            }

            // Guardar preguntas en la base de datos
            const { error: questionsError } = await supabase
                .from('document_questions')
                .insert(questions);

            if (questionsError) {
                console.error('Error al guardar las preguntas:', questionsError);
                throw questionsError;
            }
            console.log('Preguntas guardadas en base de datos');

            return {
                success: true,
                documentId: documentId,
                questionsCount: questions.length
            };
        } catch (error) {
            console.error('Error en processDocumentWithText:', error);
            throw error;
        }
    }

    splitIntoChunks(text) {
        try {
            console.log('Iniciando división del texto en chunks...');
            
            // Dividir el texto en oraciones
            const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
            console.log(`Texto dividido en ${sentences.length} oraciones`);
            
            const chunks = [];
            let currentChunk = '';
            
            for (const sentence of sentences) {
                // Si agregar la siguiente oración excede el tamaño del chunk
                if ((currentChunk + sentence).length > this.config.chunkSize) {
                    // Si el chunk actual no está vacío, guardarlo
                    if (currentChunk.trim().length > 0) {
                        chunks.push(currentChunk.trim());
                    }
                    // Iniciar nuevo chunk con la oración actual
                    currentChunk = sentence;
                } else {
                    // Agregar la oración al chunk actual
                    currentChunk += (currentChunk ? ' ' : '') + sentence;
                }
            }
            
            // Agregar el último chunk si no está vacío
            if (currentChunk.trim().length > 0) {
                chunks.push(currentChunk.trim());
            }
            
            console.log(`Texto dividido en ${chunks.length} chunks`);
            return chunks;
        } catch (error) {
            console.error('Error al dividir el texto en chunks:', error);
            throw error;
        }
    }

    async generateEmbeddings(chunks) {
        try {
            console.log('Iniciando generación de embeddings...');
            const embeddings = chunks.map(chunk => this.generateFakeEmbedding(chunk));
            console.log('Embeddings generados');
            return embeddings;
        } catch (error) {
            console.error('Error al generar embeddings:', error);
            throw error;
        }
    }

    generateFakeEmbedding(text) {
        // Generar un vector aleatorio de 1536 dimensiones
        return Array(1536).fill(0).map(() => Math.random());
    }
}

export const ragService = new RAGService(); 