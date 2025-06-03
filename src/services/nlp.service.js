import { pdfjs } from 'react-pdf';
import { supabase } from '../config/supabaseClient';

class NLPService {
    constructor() {
        this.config = {
            palabrasPorHoja: 300,
            idioma: 'español',
            stopwordsFile: 'spanish.json'
        };
    }

    async processPDF(file, subjectId) {
        try {
            // Cargar el PDF y extraer el texto
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
            const numPages = pdf.numPages;
            let fullText = '';

            // Extraer texto de todas las páginas
            for (let i = 1; i <= numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + ' ';
            }

            // Procesar el texto
            const processedText = await this.processText(fullText);

            // Generar estructura JSON
            const jsonResult = this.generateJSON(file.name, processedText, numPages);

            // Guardar documento en Supabase y obtener el id
            const documentId = await this.saveDocumentMeta(jsonResult, subjectId);

            // Generar embeddings y guardar por sección/tema
            await this.saveEmbeddingsBySection(documentId, jsonResult);

            return jsonResult;
        } catch (error) {
            console.error('Error al procesar el PDF:', error);
            throw new Error('Error al procesar el PDF');
        }
    }

    async processText(text) {
        // Preprocesamiento
        let processedText = text;
        // Dividir el texto en líneas y también por puntos para mayor robustez
        let lines = processedText.split(/\r?\n|\r|(?<=\.)\s+/);

        // Patrones flexibles para detectar títulos de secciones
        const sectionPattern = /^(cap[ií]tulo|secci[oó]n|tema|unidad)[\s\.:\-\d]+/i;
        const mayusPattern = /^([A-ZÁÉÍÓÚÜÑ\s\d\.:\-]{8,})$/;

        let capitulos = [];
        let currentSection = { titulo: null, contenido: [] };

        for (let line of lines) {
            const trimmed = line.trim();
            if (sectionPattern.test(trimmed) || mayusPattern.test(trimmed)) {
                // Si ya hay contenido, guardar la sección anterior
                if (currentSection.contenido.length > 0) {
                    // Si no hay título, usa el primer fragmento como título
                    if (!currentSection.titulo) {
                        currentSection.titulo = currentSection.contenido[0].slice(0, 40) + '...';
                    }
                    capitulos.push({ ...currentSection });
                }
                // Iniciar nueva sección
                currentSection = { titulo: trimmed, contenido: [] };
            } else {
                currentSection.contenido.push(line);
            }
        }
        // Guardar la última sección
        if (currentSection.contenido.length > 0) {
            if (!currentSection.titulo) {
                currentSection.titulo = currentSection.contenido[0].slice(0, 40) + '...';
            }
            capitulos.push({ ...currentSection });
        }

        // Si no se detectó ningún título, todo el documento es una sola sección
        if (capitulos.length === 0) {
            capitulos.push({ titulo: 'Documento Completo', contenido: lines });
        }

        // Para cada sección, tokeniza y divide en páginas/bloques
        const bloquesPorCapitulo = capitulos.map(seccion => {
            // Tokenización
            const tokens = seccion.contenido.join(' ').split(/\s+/).filter(token => token.length > 0);
            // Análisis de frecuencia
            const frecuencias = {};
            tokens.forEach(token => {
                frecuencias[token] = (frecuencias[token] || 0) + 1;
            });
            // Formatear tokens con frecuencia
            const tokensFormateados = tokens.map(token => {
                const frecuencia = frecuencias[token];
                return frecuencia > 1 ? `${token}(${frecuencia})` : token;
            });
            // Dividir en bloques según palabrasPorHoja
            const bloques = [];
            for (let i = 0; i < tokensFormateados.length; i += this.config.palabrasPorHoja) {
                bloques.push(tokensFormateados.slice(i, i + this.config.palabrasPorHoja));
            }
            return {
                titulo: seccion.titulo,
                paginas: bloques.map((tokens, idx) => ({
                    numero: idx + 1,
                    tokens
                }))
            };
        });

        return bloquesPorCapitulo;
    }

    generateJSON(fileName, processedCapitulos, numPages) {
        return {
            documento: {
                nombre: fileName,
                configuracion: this.config,
                capitulos: processedCapitulos
            }
        };
    }

    async saveDocumentMeta(jsonResult, subjectId) {
        const { documento } = jsonResult;
        const { data: documentData, error: documentError } = await supabase
            .from('documents')
            .insert({
                title: documento.nombre,
                subject_id: subjectId,
                description: documento.configuracion?.descripcion || '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();
        if (documentError) throw documentError;
        return documentData.id;
    }

    // fragments: [{ fragment: string, embedding: number[] }]
    async saveEmbeddingsBySection(documentId, jsonResult) {
        try {
            // Obtener el documento para extraer subject_id y title
            const { data: documentData, error: docError } = await supabase
                .from('documents')
                .select('subject_id, title')
                .eq('id', documentId)
                .single();
            if (docError) throw docError;

            const { documento } = jsonResult;
            for (const capitulo of documento.capitulos) {
                for (const pagina of capitulo.paginas) {
                    const fragment = pagina.tokens.join(' ');
                    const embedding = await this.generateFakeEmbedding(fragment);

                    const pageNumber = pagina.numero || null;
                    const sectionTitle = capitulo.titulo || documentData.title;

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
}

export const nlpService = new NLPService();