/* ════════════════════════════════════════════════════════════
   OCR INTELIGENTE — real con Tesseract.js
   ════════════════════════════════════════════════════════════ */

let ocrBusy = false;
let lastOcrText = '';

async function startOCR() {
  await startCamera('ocr-video', 'btn-ocr-start', 'btn-ocr-stop');
  YukiState.ocrRunning = true;
  const ph = document.getElementById('ocr-placeholder');
  if (ph) ph.style.display = 'none';
  const txt = document.getElementById('ocr-text');
  if (txt) txt.textContent = 'Iniciando OCR... acerca un documento a la cámara';
  YukiState.ocrInterval = setInterval(runOCR, 3500);
}

function stopOCR() {
  stopCamera('ocr-video', 'btn-ocr-start', 'btn-ocr-stop');
  clearInterval(YukiState.ocrInterval);
  YukiState.ocrRunning = false;
  ocrBusy = false;
  const b1 = document.getElementById('btn-speak');
  const b2 = document.getElementById('btn-ocr-attendance');
  if (b1) b1.disabled = true;
  if (b2) b2.disabled = true;
}

async function runOCR() {
  if (!YukiState.ocrRunning || ocrBusy) return;
  const vid = document.getElementById('ocr-video');
  if (!vid || !vid.videoWidth) return;

  if (typeof Tesseract === 'undefined') {
    document.getElementById('ocr-text').textContent = 'Tesseract no cargó. Revisa tu conexión a internet.';
    return;
  }

  ocrBusy = true;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = vid.videoWidth;
    canvas.height = vid.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(vid, 0, 0);

    const result = await Tesseract.recognize(canvas, 'spa+eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          const el = document.getElementById('ocr-text');
          if (el && !lastOcrText) el.textContent = 'Leyendo... ' + Math.round((m.progress || 0) * 100) + '%';
        }
      }
    });

    const text = (result && result.data && result.data.text || '').trim();
    if (text && text.length > 2) {
      lastOcrText = text;
      document.getElementById('ocr-text').textContent = text;
      document.getElementById('btn-speak').disabled = false;
      document.getElementById('btn-ocr-attendance').disabled = false;
    }
  } catch (e) {
    console.warn('OCR error', e);
  } finally {
    ocrBusy = false;
  }
}

function speakText() {
  const txt = document.getElementById('ocr-text').textContent;
  if (!txt || txt.startsWith('Leyendo') || txt.startsWith('Iniciando')) {
    toast('No hay texto para leer');
    return;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(txt);
    utt.lang = YukiVoice.lang;
    utt.rate = 0.95;
    utt.volume = 1;
    window.speechSynthesis.speak(utt);
    toast('Leyendo texto detectado en voz alta');
  } else {
    toast('La lectura por voz no está disponible en este navegador');
  }
}

function generateAttendanceFromOCR() {
  const txt = (document.getElementById('ocr-text').textContent || '').trim();
  if (!txt || txt.startsWith('Leyendo') || txt.startsWith('Iniciando')) {
    toast('Primero lee un documento con la cámara');
    return;
  }
  // Intentar extraer un nombre (primera línea corta)
  const line = txt.split('\n').map(s => s.trim()).find(s => s.length > 2 && s.length < 40) || txt.slice(0, 24);
  addAttendanceEntry(line, 'OCR', 20, true);
  toast('Registro de asistencia generado desde OCR');
}
