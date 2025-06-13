import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry';
import { supabase } from '../config/supabaseClient';
import { ragService } from './rag.service';

// Configurar el worker de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

class NLPService {
    constructor() {
        this.DEEPSEEK_API_KEY = process.env.REACT_APP_DEEPSEEK_API_KEY;
        this.DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
        this.config = {
            palabrasPorHoja: 300,
            idioma: 'español',
            stopwordsFile: 'spanish.json'
        };
    }

    async extractTextFromPDF(file) {
        try {
            console.log('Iniciando extracción de texto del PDF...');
            
            // Convertir el archivo a ArrayBuffer
            const arrayBuffer = await file.arrayBuffer();
            
            // Cargar el PDF
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            console.log(`PDF cargado. Número de páginas: ${pdf.numPages}`);
            
            let fullText = '';
            
            // Extraer texto de cada página
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + '\n';
                console.log(`Página ${i} procesada`);
            }
            
            console.log('Extracción de texto completada');
            return fullText;
        } catch (error) {
            console.error('Error al procesar el PDF:', error);
            throw error;
        }
    }

    async processPDF(file, subjectId) {
        try {
            // Cargar el PDF y extraer el texto
            const fullText = await this.extractTextFromPDF(file);

            // Procesar el texto
            const processedText = await this.processText(fullText);

            // Generar estructura JSON
            const jsonResult = this.generateJSON(file.name, processedText, file.numPages);

            // Guardar documento en Supabase y obtener el id
            const documentId = await this.saveDocumentMeta(jsonResult, subjectId);

            // Generar embeddings y guardar por sección/tema
            await this.saveEmbeddingsBySection(documentId, jsonResult);

            // Generar preguntas usando el servicio RAG con el texto extraído
            await ragService.processDocumentWithText(fullText, documentId);

            return jsonResult;
        } catch (error) {
            console.error('Error al procesar el PDF:', error);
            throw new Error('Error al procesar el PDF');
        }
    }

    async processText(text) {
        try {
            console.log('Iniciando procesamiento del texto...');
            
            // Dividir el texto en páginas
            const pages = text.split('\n\n').filter(page => page.trim().length > 0);
            console.log(`Texto dividido en ${pages.length} páginas`);

            // Procesar cada página
            const processedPages = pages.map((page, index) => {
                // Dividir en palabras y limpiar
                const words = page
                    .toLowerCase()
                    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
                    .split(/\s+/)
                    .filter(word => word.length > 0);

                // Calcular estadísticas
                const wordCount = words.length;
                const uniqueWords = [...new Set(words)].length;
                const sentences = page.split(/[.!?]+/).filter(s => s.trim().length > 0);
                const sentenceCount = sentences.length;

                return {
                    pageNumber: index + 1,
                    content: page,
                    wordCount,
                    uniqueWords,
                    sentenceCount,
                    averageWordsPerSentence: sentenceCount > 0 ? wordCount / sentenceCount : 0
                };
            });

            console.log('Procesamiento de texto completado');
            return processedPages;
        } catch (error) {
            console.error('Error al procesar el texto:', error);
            throw error;
        }
    }

    generateJSON(fileName, processedText, numPages) {
        try {
            console.log('Generando estructura JSON...');
            
            // Calcular estadísticas generales
            const totalWords = processedText.reduce((sum, page) => sum + page.wordCount, 0);
            const totalUniqueWords = new Set(
                processedText.flatMap(page => 
                    page.content.toLowerCase()
                        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
                        .split(/\s+/)
                        .filter(word => word.length > 0)
                )
            ).size;
            const totalSentences = processedText.reduce((sum, page) => sum + page.sentenceCount, 0);

            const result = {
                metadata: {
                    fileName,
                    numPages,
                    totalWords,
                    totalUniqueWords,
                    totalSentences,
                    averageWordsPerPage: totalWords / numPages,
                    averageSentencesPerPage: totalSentences / numPages,
                    averageWordsPerSentence: totalWords / totalSentences,
                    pages: processedText
                }
            };

            console.log('Estructura JSON generada');
            return result;
        } catch (error) {
            console.error('Error al generar JSON:', error);
            throw error;
        }
    }

    async saveDocumentMeta(jsonResult, subjectId) {
        const { metadata } = jsonResult;
        const { data: documentData, error: documentError } = await supabase
            .from('documents')
            .insert({
                title: metadata.fileName,
                subject_id: subjectId,
                description: metadata.configuracion?.descripcion || '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();
        if (documentError) throw documentError;
        return documentData.id;
    }

    async saveEmbeddingsBySection(documentId, jsonResult) {
        try {
            // Obtener el documento para extraer subject_id y title
            const { data: documentData, error: docError } = await supabase
                .from('documents')
                .select('subject_id, title')
                .eq('id', documentId)
                .single();
            if (docError) throw docError;

            const { metadata } = jsonResult;
            if (!metadata || !metadata.pages) {
                throw new Error('Estructura de JSON inválida: falta metadata o pages');
            }

            for (const page of metadata.pages) {
                const fragment = page.content;
                const embedding = await this.generateFakeEmbedding(fragment);

                const pageNumber = page.pageNumber || null;
                const sectionTitle = metadata.fileName || documentData.title;

                console.log('Intentando insertar en embeddings:', {
                    document_id: documentId,
                    subject_id: documentData.subject_id,
                    section_title: sectionTitle,
                    page_number: pageNumber,
                    fragment,
                    embedding: embedding ? embedding.slice(0, 5) : embedding,
                    created_at: new Date().toISOString()
                });

                const { error } = await supabase
                    .from('embeddings')
                    .insert({
                        document_id: documentId,
                        subject_id: documentData.subject_id,
                        section_title: sectionTitle,
                        page_number: pageNumber,
                        fragment: fragment,
                        embedding: embedding,
                        created_at: new Date().toISOString()
                    });

                if (error) {
                    console.error('Error de Supabase al insertar embedding:', error);
                    throw error;
                }
            }
            return true;
        } catch (error) {
            console.error('Error al guardar embeddings por sección:', error);
            throw new Error('No se pudieron guardar los embeddings por sección: ' + (error.message || JSON.stringify(error)));
        }
    }

    // Simulación de generación de embeddings (reemplaza por tu lógica real)
    async generateFakeEmbedding(fragment) {
        // Devuelve un vector de ejemplo (rellena con tu modelo real)
        return Array(1536).fill(0).map(() => Math.random());
    }

    async generateAndSaveQuestions(documentId, processedText) {
        try {
            console.log('Iniciando generación de preguntas...');
            
            // Seleccionar páginas para generar preguntas (una pregunta por cada 2 páginas)
            const pagesForQuestions = processedText.filter((_, index) => index % 2 === 0);
            console.log(`Generando preguntas para ${pagesForQuestions.length} páginas`);

            for (const [index, page] of pagesForQuestions.entries()) {
                console.log(`Generando pregunta ${index + 1} de ${pagesForQuestions.length}`);
                
                const prompt = `
                    Genera una pregunta de opción múltiple basada en el siguiente texto:
                    "${page.content}"
                    
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

                const response = await this.generateFakeEmbedding(prompt);
                console.log('Respuesta de DeepSeek:', response);

                try {
                    const questionData = JSON.parse(response);
                    const { error } = await supabase
                        .from('document_questions')
                        .insert({
                            document_id: documentId,
                            question: questionData.question,
                            options: questionData.options,
                            correct_answer: questionData.correct_answer,
                            explanation: questionData.explanation,
                            created_at: new Date().toISOString()
                        });

                    if (error) {
                        console.error('Error al guardar la pregunta:', error);
                        throw error;
                    }

                    console.log(`Pregunta ${index + 1} guardada exitosamente`);
                } catch (parseError) {
                    console.error('Error al procesar la respuesta:', parseError);
                    console.log('Respuesta que causó el error:', response);
                }
            }

            console.log('Generación de preguntas completada');
        } catch (error) {
            console.error('Error al generar preguntas:', error);
            throw new Error('Error al generar preguntas: ' + error.message);
        }
    }
}

export const nlpService = new NLPService();