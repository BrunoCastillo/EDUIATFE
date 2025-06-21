// Script de prueba para verificar la eliminación de stopwords
const { nlpService } = require('./src/services/nlp.service.js');
const fs = require('fs');
const path = require('path');

async function testStopwordsRemoval() {
    try {
        console.log('=== INICIANDO PRUEBA DE ELIMINACIÓN DE STOPWORDS ===\n');
        
        // Ruta al archivo PDF de prueba
        const pdfPath = './uploads/1749717039542-Caja_de_Arena.pdf';
        
        // Verificar que el archivo existe
        if (!fs.existsSync(pdfPath)) {
            console.error('❌ Archivo PDF no encontrado:', pdfPath);
            return;
        }
        
        console.log('📄 Archivo PDF encontrado:', path.basename(pdfPath));
        console.log('📊 Tamaño del archivo:', (fs.statSync(pdfPath).size / 1024).toFixed(2), 'KB\n');
        
        // Crear un objeto File simulado para el procesamiento
        const fileBuffer = fs.readFileSync(pdfPath);
        const file = {
            name: path.basename(pdfPath),
            arrayBuffer: () => Promise.resolve(fileBuffer),
            numPages: 1 // Valor por defecto, se actualizará durante el procesamiento
        };
        
        console.log('🔄 Iniciando procesamiento del PDF...\n');
        
        // Procesar el PDF (sin guardar en base de datos)
        const result = await nlpService.processText(await nlpService.extractTextFromPDF(file));
        
        console.log('\n=== RESULTADO FINAL ===');
        console.log('✅ Procesamiento completado exitosamente');
        console.log('📈 Estadísticas del documento:');
        console.log('   - Páginas procesadas:', result.length);
        console.log('   - Palabras totales (sin stopwords):', result.reduce((sum, page) => sum + page.wordCount, 0));
        console.log('   - Palabras únicas (sin stopwords):', result.reduce((sum, page) => sum + page.uniqueWords, 0));
        console.log('   - Oraciones totales:', result.reduce((sum, page) => sum + page.sentenceCount, 0));
        
    } catch (error) {
        console.error('❌ Error durante la prueba:', error);
        console.error('Stack trace:', error.stack);
    }
}

// Ejecutar la prueba
testStopwordsRemoval(); 