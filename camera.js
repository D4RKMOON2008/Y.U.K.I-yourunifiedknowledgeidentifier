/* ════════════════════════════════════════════════════════════
   CÁMARA
   Responsable únicamente de abrir/cerrar el stream de la webcam
   y capturar fotogramas. No hace detección ni reconocimiento:
   eso vive en detector.js y recognition.js.
   ════════════════════════════════════════════════════════════ */

/**
 * Abre la cámara del navegador y la conecta a un elemento <video>.
 * Equivale al acceso a webcam que antes hacía un script dedicado;
 * aquí es un módulo reutilizable para todas las secciones (Cámara,
 * Reconocimiento, Gestión de Personas, OCR, Login por rostro).
 */
async function startCamera(vidId, btnStartId, btnStopId) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    const vid = document.getElementById(vidId);
    vid.srcObject = stream;
    YukiState.streams[vidId] = stream;
    if (btnStartId) document.getElementById(btnStartId).disabled = true;
    if (btnStopId) document.getElementById(btnStopId).disabled = false;

    const statusEl = document.getElementById('cam-status-txt');
    if (statusEl) {
      statusEl.textContent = 'Cámara: activa';
      statusEl.style.color = 'var(--green)';
    }
    return stream;
  } catch (err) {
    toast('No se pudo acceder a la cámara: ' + err.message);
    return null;
  }
}

/** Detiene el stream de un <video> específico y libera la cámara. */
function stopCamera(vidId, btnStartId, btnStopId) {
  const vid = document.getElementById(vidId);
  if (vid && vid.srcObject) {
    vid.srcObject.getTracks().forEach(t => t.stop());
    vid.srcObject = null;
  }
  delete YukiState.streams[vidId];
  if (btnStartId) document.getElementById(btnStartId).disabled = false;
  if (btnStopId) document.getElementById(btnStopId).disabled = true;

  const statusEl = document.getElementById('cam-status-txt');
  if (statusEl) {
    statusEl.textContent = 'Cámara: inactiva';
    statusEl.style.color = 'var(--muted)';
  }
}

/** Apaga todas las cámaras y procesos activos (usado al cerrar sesión). */
function stopAllCams() {
  ['cam-video', 'rec-video', 'cap-video', 'ocr-video', 'face-login-video'].forEach(id =>
    stopCamera(id, null, null)
  );
  clearInterval(YukiState.detectInterval);
  clearInterval(YukiState.recInterval);
  clearInterval(YukiState.ocrInterval);
  clearInterval(YukiState.capInterval);
  YukiState.detecting = false;
  YukiState.recRunning = false;
  YukiState.ocrRunning = false;
  YukiState.capRunning = false;
}

/** Captura el fotograma actual de un <video> y lo descarga como PNG. */
function captureFrame(vidId) {
  const vid = document.getElementById(vidId);
  if (!vid || !vid.srcObject) {
    toast('Primero abre la cámara');
    return;
  }
  const c = document.createElement('canvas');
  c.width = vid.videoWidth;
  c.height = vid.videoHeight;
  c.getContext('2d').drawImage(vid, 0, 0);
  const a = document.createElement('a');
  a.download = 'captura_yuki.png';
  a.href = c.toDataURL('image/png');
  a.click();
  toast('Frame capturado y descargado');
}
