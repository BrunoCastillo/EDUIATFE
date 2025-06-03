import { supabase } from '../config/supabaseClient';
import { deepseekService } from './deepseek.service';

export const syllabusService = {
    async uploadSyllabus(file, subjectId) {
        try {
            // 1. Procesar el sílabo para extraer e insertar temas y subtemas ANTES de subir el archivo
            await this.processSyllabus(null, subjectId, file);

            // 2. Subir el archivo a Supabase Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${subjectId}/${Date.now()}.${fileExt}`;
            console.log('[syllabusService] Subiendo archivo:', fileName, file);
            const { data: fileData, error: uploadError } = await supabase.storage
                .from('syllabus')
                .upload(fileName, file, { upsert: true });
            console.log('[syllabusService] Resultado de upload:', fileData, uploadError);

            if (uploadError) throw uploadError;

            // 3. Obtener la URL pública del archivo
            const { data: publicUrlData, error: publicUrlError } = supabase.storage
                .from('syllabus')
                .getPublicUrl(fileName);
            console.log('[syllabusService] URL pública:', publicUrlData, publicUrlError);
            if (publicUrlError) throw publicUrlError;

            // 4. Guardar la referencia en la tabla syllabus
            const { data, error: dbError } = await supabase
                .from('syllabus')
                .insert([
                    {
                        subject_id: subjectId,
                        file_name: file.name,
                        file_type: file.type,
                        file_url: publicUrlData.publicUrl,
                        file_path: fileName
                    }
                ])
                .select()
                .single();
            console.log('[syllabusService] Resultado de insert en tabla syllabus:', data, dbError);

            if (dbError) throw dbError;

            return data;
        } catch (error) {
            console.error('Error uploading syllabus:', error);
            throw error;
        }
    },

    async processSyllabus(syllabusId, subjectId, file) {
        try {
            console.log('[processSyllabus] Iniciando procesamiento de sílabo:', file);
            // 1. Leer el contenido del archivo
            const text = await this.extractTextFromFile(file);
            console.log('[processSyllabus] Texto extraído:', text.slice(0, 500)); // Solo los primeros 500 caracteres

            // 2. Procesar el texto para extraer temas y subtemas
            const { topics } = this.extractTopicsAndSubtopics(text);
            console.log('[processSyllabus] Temas extraídos:', topics);

            if (!topics || topics.length === 0) {
                console.warn('[processSyllabus] No se detectaron temas en el sílabo.');
                return { topics: [] };
            }

            // 3. Guardar los temas en la base de datos
            for (const topic of topics) {
                const { data: topicData, error: topicError } = await supabase
                    .from('syllabus_topics')
                    .insert([{
                        subject_id: subjectId,
                        topic_number: topic.number,
                        title: topic.title,
                        description: topic.content
                    }])
                    .select()
                    .single();
                console.log('[processSyllabus] Insertando tema:', topic, 'Resultado:', topicData, topicError);

                if (topicError) throw topicError;

                // 4. Guardar los subtemas asociados al tema
                if (topic.subtopics && topic.subtopics.length > 0) {
                    const subtopicsToInsert = topic.subtopics.map(subtopic => ({
                        topic_id: topicData.id,
                        subtopic_number: subtopic.number,
                        title: subtopic.title,
                        description: subtopic.content
                    }));
                    const { error: subtopicError } = await supabase
                        .from('syllabus_subtopics')
                        .insert(subtopicsToInsert);
                    console.log('[processSyllabus] Insertando subtemas:', subtopicsToInsert, 'Error:', subtopicError);

                    if (subtopicError) throw subtopicError;
                }
            }

            return { topics };
        } catch (error) {
            console.error('Error en processSyllabus:', error);
            throw error;
        }
    },

    async extractTextFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (event) => {
                try {
                    const arrayBuffer = event.target.result;
                    
                    if (file.type === 'application/pdf') {
                        // Para PDFs, usamos pdf-parse
                        const pdfjs = await import('pdfjs-dist');
                        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
                        let text = '';
                        
                        for (let i = 1; i <= pdf.numPages; i++) {
                            const page = await pdf.getPage(i);
                            const content = await page.getTextContent();
                            text += content.items.map(item => item.str).join(' ') + '\n';
                        }
                        
                        resolve(text);
                    } else if (file.type.includes('word')) {
                        // Para documentos Word, usamos mammoth
                        const mammoth = await import('mammoth');
                        const result = await mammoth.extractRawText({ arrayBuffer });
                        resolve(result.value);
                    } else {
                        reject(new Error('Tipo de archivo no soportado'));
                    }
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Error al leer el archivo'));
            reader.readAsArrayBuffer(file);
        });
    },

    extractTopicsAndSubtopics(text) {
        const topics = [];
        const lines = text.split('\n');
        let currentTopic = null;
        let currentSubtopic = null;

        // Patrones para detectar temas y subtemas
        const topicPatterns = [
            // Ejemplo: 1. Título del tema
            { regex: /^(\d+)\.\s+(.+)$/ },
            // También soporta: 1. Título (sin espacio)
            { regex: /^(\d+)\.(.+)$/ },
            // Clásicos
            { regex: /^(?:TEMA|Tema|UNIDAD|Unidad|CAP[IÍ]TULO|Cap[ií]tulo)\s+([\dIVX]+)[:.]?\s*(.+)$/i },
            { regex: /^([A-ZÁÉÍÓÚÜÑ\s]{10,})$/ },
        ];

        const subtopicPatterns = [
            // Ejemplo: 1.1. Título del subtema
            { regex: /^(\d+\.\d+)\.\s+(.+)$/ },
            // Ejemplo: 1.1 Título del subtema
            { regex: /^(\d+\.\d+)\s+(.+)$/ },
            // Ejemplo: 1.1.1. Título subsubtema
            { regex: /^(\d+\.\d+\.\d+)\.\s+(.+)$/ },
            { regex: /^(\d+\.\d+\.\d+)\s+(.+)$/ },
        ];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Buscar coincidencias con los patrones de tema
            let isTopic = false;
            for (const pattern of topicPatterns) {
                const match = line.match(pattern.regex);
                if (match) {
                    if (currentTopic) {
                        topics.push(currentTopic);
                    }
                    currentTopic = {
                        number: match[1] || topics.length + 1,
                        title: match[2] ? match[2].trim() : match[1].trim(),
                        content: '',
                        subtopics: []
                    };
                    currentSubtopic = null;
                    isTopic = true;
                    break;
                }
            }

            // Si no es un tema, buscar coincidencias con los patrones de subtema
            if (!isTopic && currentTopic) {
                let isSubtopic = false;
                for (const pattern of subtopicPatterns) {
                    const match = line.match(pattern.regex);
                    if (match) {
                        if (currentSubtopic) {
                            currentTopic.subtopics.push(currentSubtopic);
                        }
                        currentSubtopic = {
                            number: match[1],
                            title: match[2].trim(),
                            content: ''
                        };
                        isSubtopic = true;
                        break;
                    }
                }

                // Si no es un subtema, agregar al contenido actual
                if (!isSubtopic) {
                    if (currentSubtopic) {
                        currentSubtopic.content += line + '\n';
                    } else {
                        currentTopic.content += line + '\n';
                    }
                }
            }
        }

        // Agregar el último subtema y tema
        if (currentSubtopic && currentTopic) {
            currentTopic.subtopics.push(currentSubtopic);
        }
        if (currentTopic) {
            topics.push(currentTopic);
        }

        return { topics };
    },

    async extractSyllabusTopics(file) {
        try {
            // 1. Leer el contenido del archivo
            const text = await this.extractTextFromFile(file);
            // 2. Procesar el texto para extraer temas y subtemas
            const { topics } = this.extractTopicsAndSubtopics(text);
            return topics;
        } catch (error) {
            console.error('Error extrayendo temas del sílabo:', error);
            throw error;
        }
    },

    async extractSyllabusTopicsWithAI(file) {
        try {
            // 1. Extraer el texto del archivo
            const text = await this.extractTextFromFile(file);
            // 2. Prompt para DeepSeek
            const prompt = `Extrae los temas y subtemas del siguiente sílabo. Devuelve la respuesta en formato JSON con la estructura: [{"number": "número", "title": "título", "subtopics": [{"number": "número", "title": "título"}]}]. Si no hay subtemas, pon un array vacío.\n\nSílabo:\n${text}`;
            // 3. Llamar a DeepSeek
            const response = await deepseekService.sendMessage(prompt);
            // 4. Buscar y parsear el JSON en la respuesta
            const jsonMatch = response.match(/\[.*\]/s);
            if (!jsonMatch) throw new Error('No se pudo extraer el JSON de la respuesta de DeepSeek');
            const topics = JSON.parse(jsonMatch[0]);
            return topics;
        } catch (error) {
            console.error('Error extrayendo temas con IA:', error);
            throw error;
        }
    },

    async generateAndSaveQuestions(subjectId, topics) {
        try {
            console.log('Generando preguntas para la materia:', subjectId);
            
            // 1. Generar preguntas usando DeepSeek
            const questions = await deepseekService.generateQuestions(topics);
            
            // 2. Guardar preguntas en la base de datos
            const questionsToInsert = questions.map(q => ({
                subject_id: subjectId,
                topic_id: q.topic_id,
                question_text: q.question,
                option_a: q.options.a,
                option_b: q.options.b,
                option_c: q.options.c,
                option_d: q.options.d,
                correct_answer: q.correct_answer,
                explanation: q.explanation
            }));

            const { data, error } = await supabase
                .from('subject_questions')
                .insert(questionsToInsert)
                .select();

            if (error) {
                console.error('Error al guardar preguntas:', error);
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Error en generateAndSaveQuestions:', error);
            throw error;
        }
    },

    async getQuestionsBySubject(subjectId) {
        try {
            const { data, error } = await supabase
                .from('subject_questions')
                .select(`
                    *,
                    syllabus_topics (
                        topic_number,
                        title
                    )
                `)
                .eq('subject_id', subjectId)
                .order('topic_id', { ascending: true });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error al obtener preguntas:', error);
            throw error;
        }
    }
}; 