// ── Configuración de Marked.js ──
marked.setOptions({
    gfm: true, // Github Flavored Markdown (soporte de tablas)
    breaks: true
});

// ── Lógica Multi-idioma ──
let currentLang = 'es';

function toggleLang() {
    currentLang = currentLang === 'es' ? 'en' : 'es';
    applyLang(currentLang);
    document.getElementById('langToggle').textContent = currentLang === 'es' ? '🌐 EN' : '🌐 ES';
    document.documentElement.setAttribute('data-lang', currentLang);
}

function applyLang(lang) {
    document.querySelectorAll('[data-es]').forEach(el => {
        el.textContent = el.getAttribute(`data-${lang}`);
    });
    document.title = lang === 'es' ? 'WordWeaver Web' : 'WordWeaver Web';
}

function setStatus(msgKey, type) {
    const statusEl = document.getElementById('statusMessage');
    statusEl.className = `status-message status-${type}`;

    const messages = {
        'processing': { es: 'Procesando ecuaciones...', en: 'Processing equations...' },
        'pdf_success': { es: '¡PDF generado con éxito!', en: 'PDF successfully generated!' },
        'word_success': { es: '¡Documento Word (.doc) generado con éxito!', en: 'Word document (.doc) successfully generated!' },
        'empty_error': { es: 'Por favor, pega algún texto primero.', en: 'Please paste some text first.' },
        'pasted': { es: 'Texto pegado.', en: 'Text pasted.' },
        'cleared': { es: 'Texto limpiado.', en: 'Text cleared.' }
    };

    statusEl.textContent = messages[msgKey][currentLang];

    // Clear after 3 seconds if it's a success or info message
    if (type !== 'processing') {
        setTimeout(() => {
            if (statusEl.textContent === messages[msgKey][currentLang]) {
                statusEl.textContent = '';
            }
        }, 3000);
    }
}

// ── Control de Texto ──
async function pasteText() {
    try {
        const text = await navigator.clipboard.readText();
        document.getElementById('markdownInput').value = text;
        setStatus('pasted', 'info');
    } catch (err) {
        alert("No se pudo acceder al portapapeles. Pega el texto manualmente con Ctrl+V.");
    }
}

function clearText() {
    document.getElementById('markdownInput').value = '';
    setStatus('cleared', 'info');
}

// ── Pre-procesadores IA (Recreados de Python) ──
function preprocessDeepSeek(text) {
    let res = text.replace(/\\\[([\s\S]+?)\\\]/g, '$$$$$1$$$$');
    res = res.replace(/\\\(([\s\S]+?)\\\)/g, '$$$1$$');
    return res;
}

function preprocessGemini(text) {
    // Gemini a veces formatea ecuaciones con ** negritas o saltos extra.
    let res = text.replace(/\*\*\$\$([\s\S]+?)\$\$\*\*/g, '$$$$$1$$$$');
    return res;
}

function preprocessGoogleIA(text) {
    let res = text.replace(/-{10,}/g, '---');
    res = res.replace(/\s*\[(\d+)\]/g, '');
    res = res.replace(/\n\[\d+\]\s+https?:\/\/\S+[^\n]*/g, '');
    return res;
}

function preprocessNotebookLM(text) {
    let res = text.replace(/\nNotebookLM funciona mejor cuando.*/gi, '');
    res = res.replace(/\nNotebook.*Deep Research.*/gi, '');
    res = res.replace(/\n¿Te gustaría que realice una.*/gi, '');
    return res;
}

function preprocessGeneric(text) {
    let res = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    res = res.replace(/([^\n])\$\$/g, '$1\n$$$$');
    res = res.replace(/\$\$([^\n])/g, '$$$$\n$1');
    return res;
}

function preprocessText(text, aiSource) {
    text = preprocessGeneric(text);
    const source = aiSource.toLowerCase();

    if (source.includes("deepseek")) text = preprocessDeepSeek(text);
    else if (source.includes("google")) text = preprocessGoogleIA(text);
    else if (source.includes("notebooklm")) text = preprocessNotebookLM(text);
    else if (source.includes("gemini")) text = preprocessGemini(text);

    return text;
}

// Traducciones de la UI
const translations = {
    // ...
};

// ── Sistema de Visitantes ──
async function initVisitorCounter() {
    try {
        // Obtenemos las visitas a través de NUESTRO PROPIO backend para evitar
        // que navegadores estrictos (Edge) o AdBlockers bloqueen el contador.
        const apiUrl = 'https://wordweaver-api-gbrz.onrender.com/api/visits';
        const response = await fetch(apiUrl);
        const data = await response.json();
        document.getElementById('visitCount').innerText = data.count || "-";
    } catch (error) {
        console.error("No se pudo cargar el contador de visitas:", error);
        document.getElementById('visitCount').innerText = "-";
    }
}

// ── Inicialización ──
document.addEventListener('DOMContentLoaded', () => {
    initVisitorCounter();

    document.getElementById('markdownInput').addEventListener('input', () => {
        const val = document.getElementById('markdownInput').value;
        if (val) {
            setStatus('processing', 'info');
            clearTimeout(window.previewTimeout);
            window.previewTimeout = setTimeout(() => {
                prepareContent(false).then(() => setStatus('success', 'success'));
            }, 800);
        } else {
            document.getElementById('renderArea').innerHTML = '';
            document.getElementById('statusMessage').innerText = '';
        }
    });
});

// ── Renderización y Pipeline de Contenido ──
async function prepareContent(forWord = false) {
    const rawText = document.getElementById('markdownInput').value.trim();
    if (!rawText) {
        setStatus('empty_error', 'error');
        return { success: false };
    }

    setStatus('processing', 'info');

    const aiSource = document.getElementById('aiSource').value;
    const fontName = document.getElementById('fontSelect').value;
    const fontSize = document.getElementById('fontSize').value;

    // 1. Preprocesar texto de la IA
    let processedText = preprocessText(rawText, aiSource);

    // 2. Proteger las ecuaciones para que marked.js no rompa subíndices (_) o asteriscos (*)
    let mathBlocks = [];
    let mathId = 0;

    // Bloques $$...$$ o \[...\]
    processedText = processedText.replace(/\$\$([\s\S]+?)\$\$/g, (match, p1) => {
        let id = `MATHBLOCKPLACEHOLDER${mathId}XYZ`;
        mathBlocks.push({ id: id, tex: p1, display: true });
        mathId++;
        return id;
    });
    processedText = processedText.replace(/\\\[([\s\S]+?)\\\]/g, (match, p1) => {
        let id = `MATHBLOCKPLACEHOLDER${mathId}XYZ`;
        mathBlocks.push({ id: id, tex: p1, display: true });
        mathId++;
        return id;
    });

    // Inline $...$ o \(...\)
    processedText = processedText.replace(/\$([^\n$]+?)\$/g, (match, p1) => {
        let id = `MATHINLINEPLACEHOLDER${mathId}XYZ`;
        mathBlocks.push({ id: id, tex: p1, display: false });
        mathId++;
        return id;
    });
    processedText = processedText.replace(/\\\(([^\n]+?)\\\)/g, (match, p1) => {
        let id = `MATHINLINEPLACEHOLDER${mathId}XYZ`;
        mathBlocks.push({ id: id, tex: p1, display: false });
        mathId++;
        return id;
    });

    // 3. Convertir Markdown a HTML (Asegura las tablas y formato texto)
    let htmlContent = marked.parse(processedText);

    // INYECCIÓN DE ESTILOS EN LÍNEA PARA TABLAS DE WORD
    if (forWord) {
        htmlContent = htmlContent.replace(/<table\b[^>]*>/g, '<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%; border: 1px solid #000;">');
        htmlContent = htmlContent.replace(/<th\b[^>]*>/g, '<th style="background-color: #4472C4; color: white; font-weight: bold; border: 1px solid #000; text-align: center; padding: 5px;">');
        htmlContent = htmlContent.replace(/<td\b[^>]*>/g, '<td style="border: 1px solid #000; padding: 5px;">');
    }

    // 4. Restaurar / Procesar matemáticas
    if (forWord) {
        // Para Word: Generamos MathML nativo
        for (let block of mathBlocks) {
            try {
                // MathJax.tex2mmlPromise es la API oficial asíncrona para la web
                let mmlString = await MathJax.tex2mmlPromise(block.tex, { display: block.display });

                // Asegurar que el namespace esté presente para Word
                if (!mmlString.includes('xmlns:mml')) {
                    mmlString = mmlString.replace('<math', '<math xmlns:mml="http://www.w3.org/1998/Math/MathML"');
                }

                // Si es bloque, centrarlo
                if (block.display) {
                    mmlString = `<div align="center" style="text-align: center; margin: 10px 0;">${mmlString}</div>`;
                }

                htmlContent = htmlContent.replace(block.id, mmlString);
            } catch (e) {
                console.error("MathJax conversion error:", e);
                // Fallback a texto si algo falla
                let fallback = block.display ? `$$${block.tex}$$` : `$${block.tex}$`;
                htmlContent = htmlContent.replace(block.id, fallback);
            }
        }

        // Aplicar la fuente configurada al HTML crudo y retornarlo INMEDIATAMENTE
        // (Sin inyectarlo en el DOM para evitar que el navegador elimine los namespaces MathML)
        htmlContent = `<div style="font-family: '${fontName}', sans-serif; font-size: ${fontSize}pt;">${htmlContent}</div>`;
        return { success: true, htmlWord: htmlContent };
    } else {
        // Para PDF/Pantalla: Restaurar los delimitadores LaTeX estándar para que typesetPromise actúe
        for (let block of mathBlocks) {
            let texStr = block.display ? `\\[${block.tex}\\]` : `\\(${block.tex}\\)`;
            htmlContent = htmlContent.replace(block.id, texStr);
        }
    }

    // 5. Inyectar en el DOM (Solo para PDF/Vista Web)
    const renderArea = document.getElementById('renderArea');
    renderArea.innerHTML = htmlContent;

    // Aplicar estilos generales
    renderArea.style.fontFamily = fontName;
    renderArea.style.fontSize = fontSize + 'pt';

    if (!forWord) {
        // Renderizar visualmente con HTML/SVG (MathJax normal)
        await MathJax.typesetPromise([renderArea]);
    }

    return { success: true };
}

// ── Exportación a PDF ──
async function exportPDF() {
    const result = await prepareContent(false);
    if (!result || !result.success) return;

    const renderArea = document.getElementById('renderArea');
    const aiSource = document.getElementById('aiSource').value.replace(/ /g, "_");
    const filename = `Documento_${aiSource}.pdf`;

    renderArea.style.display = 'block';

    const opt = {
        margin: 1,
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, windowWidth: 800 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(renderArea).save().then(() => {
        renderArea.style.display = 'none';
        setStatus('pdf_success', 'success');
    });
}

// ── Exportación a Word (.doc) mediante API Backend ──
async function exportWord() {
    const rawText = document.getElementById('markdownInput').value.trim();
    if (!rawText) {
        setStatus('empty_error', 'error');
        return;
    }

    const aiSource = document.getElementById('aiSource').value;
    const fontName = document.getElementById('fontSelect').value;
    const fontSize = document.getElementById('fontSize').value;

    setStatus('processing', 'info');

    const btn = document.getElementById('btnWord');
    const originalBtnHTML = btn.innerHTML;
    const isEnglish = document.documentElement.getAttribute('data-lang') === 'en';

    // Cambiar botón a estado de carga
    btn.disabled = true;
    btn.style.opacity = '0.7';
    btn.innerHTML = isEnglish ? '⏳ Processing... (May take a moment)' : '⏳ Procesando... (Puede tardar un momento)';

    try {
        // MUY IMPORTANTE: Asegúrate de que esta URL sea la de Render para producción
        // Ejemplo: const apiUrl = 'https://wordweaver-api-abcd.onrender.com/api/export_word';
        const apiUrl = 'https://wordweaver-api-gbrz.onrender.com/api/export_word';

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: rawText,
                aiSource: aiSource,
                fontName: fontName,
                fontSize: fontSize
            })
        });

        if (!response.ok) {
            throw new Error(`Error del servidor: ${response.status}`);
        }
        
        // Revisamos qué nos respondió el servidor (JSON nuevo o Archivo viejo)
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            // --- NUEVO SISTEMA (2 Pasos) ---
            const result = await response.json();
            
            if (result.success && result.download_url) {
                const baseUrl = apiUrl.replace('/api/export_word', '');
                const finalUrl = baseUrl + result.download_url + `?filename=${encodeURIComponent(result.filename)}`;
                window.location.href = finalUrl;
                setStatus('success', 'success');
            } else {
                throw new Error("El servidor no devolvió una respuesta válida");
            }
        } else {
            // --- VIEJO SISTEMA (Compatibilidad hacia atrás) ---
            const blob = await response.blob();
            
            if (window.navigator && window.navigator.msSaveOrOpenBlob) {
                window.navigator.msSaveOrOpenBlob(blob, `Documento_${aiSource.replace(/ /g, "_")}.docx`);
            } else {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `Documento_${aiSource.replace(/ /g, "_")}.docx`;
                document.body.appendChild(a);
                a.click();
                
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                }, 500);
            }
            setStatus('success', 'success');
        }
        
    } catch (error) {
        console.error("Error exportando a Word:", error);
        setStatus('general_error', 'error');
    } finally {
        // Restaurar el estado del botón EXACTAMENTE CUANDO LA DESCARGA EMPIEZA
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.innerHTML = originalBtnHTML;
    }
}
