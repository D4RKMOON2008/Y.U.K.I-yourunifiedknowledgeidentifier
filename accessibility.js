/* ════════════════════════════════════════════════════════════
   ACCESIBILIDAD
   Reemplaza por completo el antiguo chatbot. Pensado para personas
   con discapacidad visual y para cualquier usuario que necesite una
   interfaz más simple. Las funciones de voz usan la Web Speech API
   nativa del navegador (equivalente a lo que antes hacía pyttsx3).
   Aquí conectar reconocimiento facial: cuando el usuario entra al
   sistema por "Modo accesibilidad" (ver app.js / login), el ingreso
   por voz debería poder confirmarse también con reconocimiento
   facial automático, sin que la persona tenga que leer ni escribir
   nada en pantalla.
   ════════════════════════════════════════════════════════════ */

let accessRecognizing = false;

/** Lee en voz alta una descripción de la sección actualmente visible (alias de TalkBack). */
function readScreen() {
  talkbackExplainScreen();
}

/** Reproduce un texto por voz (usado por "Leer pantalla", TalkBack y otros módulos). */
function speak(text) {
  if (!('speechSynthesis' in window)) {
    toast('La síntesis de voz no está disponible en este navegador');
    return;
  }
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = YukiVoice.lang;
  utt.rate = 0.95;
  const fab = document.getElementById('talkback-btn');
  if (fab) {
    fab.classList.add('speaking');
    utt.onend = () => fab.classList.remove('speaking');
    utt.onerror = () => fab.classList.remove('speaking');
  }
  window.speechSynthesis.speak(utt);
}

/** Cambia el idioma usado por todas las funciones de voz (llamado desde Configuración). */
function setVoiceLanguage(lang) {
  YukiVoice.lang = lang;
  if (YukiState.settings) {
    YukiState.settings.voiceLang = lang;
    YukiDB.persistSettings();
  }
  toast('Idioma de voz guardado');
}

/* ════════════════════════════════════════════════════════════
   TALKBACK — describe en voz alta lo que hay en pantalla
   Botón flotante disponible en TODA la aplicación (landing, login
   y cada sección del panel). No es solo "leer el texto tal cual" —
   arma una descripción breve y útil de qué pantalla es, qué se
   puede hacer en ella y, cuando aplica, algún dato en vivo (por
   ejemplo, cuántos registros de asistencia hay hoy).
   ════════════════════════════════════════════════════════════ */
function talkbackExplainScreen() {
  const text = buildScreenDescription();
  speak(text);
  toast('Explicando pantalla…');
}

function buildScreenDescription() {
  if (document.getElementById('s-landing').classList.contains('active')) {
    return 'Estás en la pantalla de bienvenida de Yuki, sistema inteligente para la gestión y accesibilidad escolar. ' +
      'Hay un botón llamado "Ingresar al sistema" para continuar hacia el inicio de sesión.';
  }

  if (document.getElementById('s-login').classList.contains('active')) {
    const activeTab = document.querySelector('.login-tab.active');
    const method = activeTab ? activeTab.dataset.method : 'password';
    if (method === 'face') {
      return 'Estás en la pantalla de inicio de sesión, con el método de reconocimiento facial seleccionado. ' +
        'Primero marca la casilla de consentimiento y luego presiona el botón ' +
        '"Iniciar con mi rostro" para continuar. También puedes cambiar de método con las pestañas de arriba: usuario, rostro o accesible.';
    }
    if (method === 'access') {
      return 'Estás en la pantalla de inicio de sesión, con el modo accesibilidad seleccionado. ' +
        'Elige tu nombre en la lista desplegable y presiona "Ingresar en modo accesible" para entrar con voz y alto contraste activados.';
    }
    return 'Estás en la pantalla de inicio de sesión, con usuario y contraseña seleccionado. ' +
      'Hay un campo para tu correo, un campo para tu contraseña, y un botón para ingresar. ' +
      'También puedes cambiar de método con las pestañas de arriba: usuario, rostro o accesible.';
  }

  // Estamos dentro de la aplicación: describir la sección activa.
  const activeSection = document.querySelector('.section-body.active');
  const name = activeSection ? activeSection.id.replace('sec-', '') : 'inicio';
  return describeSection(name);
}

const SECTION_DESCRIPTIONS = {
  inicio: () => {
    const hoy = document.getElementById('m-today')?.textContent || '0';
    return `Estás en Inicio. Aquí ves cuántas personas están registradas, cuántos reconocimientos van hoy (${hoy}), ` +
      'el estado del sistema, los últimos registros de asistencia, y una sección de acciones rápidas para ir directo ' +
      'a cámara, reconocimiento, registrar persona, asistencia, OCR o accesibilidad.';
  },
  camara: () => {
    const activa = YukiState.streams['cam-video'] ? 'la cámara está encendida' : 'la cámara está apagada';
    return `Estás en Cámara en Vivo. Ahora mismo ${activa}. Hay botones para iniciar la cámara, detenerla, ` +
      'activar la detección de rostros y capturar una foto del video. La detección de rostros usa el motor ONYX. ' +
      'todavía no usa un detector real.';
  },
  reconocer: () => {
    const nombre = document.getElementById('rec-name')?.textContent || '—';
    return `Estás en Reconocimiento Facial. Hay botones para iniciar y detener el reconocimiento frente a la cámara. ` +
      `El último resultado mostrado es: ${nombre === '—' ? 'ninguno todavía' : nombre}. El reconocimiento usa el modelo ONYX.`;
  },
  dataset: () => {
    const total = YukiState.dataset.length;
    return `Estás en Gestión de Personas. Hay ${total} personas registradas. Puedes escribir un nombre y capturar ` +
      'fotografías para registrar a alguien nuevo, y en cada tarjeta hay botones para actualizar información, ' +
      'capturar más fotos, o eliminar a esa persona. Se requiere aceptar el consentimiento de datos biométricos antes de capturar fotos.';
  },
  entrenar: () => {
    const img = document.getElementById('model-images')?.textContent || '0';
    return `Estás en Modelo IA. Se han usado ${img} imágenes en el entrenamiento. Hay un botón para entrenar el ` +
      'modelo desde cero, y otro para actualizarlo solo con los cambios nuevos. El entrenamiento actualiza el índice ONYX con las plantillas guardadas.';
  },
  ocr: () => 'Estás en OCR Inteligente. Hay un botón para iniciar la lectura de documentos con la cámara, otro para ' +
    'detenerla, uno para escuchar en voz alta el texto detectado, y otro para generar un registro de asistencia ' +
    'a partir de ese texto. La lectura de texto usa Tesseract.js en el navegador.',
  asistencia: () => {
    const total = YukiState.attendance.length;
    return `Estás en Registro de Asistencia. Hay ${total} registros en la tabla, con nombre, curso, fecha, hora y ` +
      'estado de cada persona. Hay un buscador por nombre, y botones para exportar a CSV, Excel o PDF.';
  },
  accesibilidad: () => 'Estás en Accesibilidad. Aquí puedes activar el asistente por voz, pedir que se lea la ' +
    'pantalla actual, activar el modo de alto contraste, y activar el modo accesible que agranda el texto.',
  configuracion: () => 'Estás en Configuración. Aquí puedes ajustar el umbral de confianza del reconocimiento, ' +
    'el idioma del asistente de voz, las notificaciones, y cerrar tu sesión.',
};

function describeSection(name) {
  const fn = SECTION_DESCRIPTIONS[name];
  return fn ? fn() : 'No encontré una descripción para esta sección.';
}

/**
 * Botón "Escuchar": activa el micrófono para recibir un comando de voz.
 * No implementado todavía (solo interfaz preparada, según lo solicitado).
 * Aquí conectar modelo IA: integrar reconocimiento de voz real
 * (por ejemplo, con la Web Speech API en modo reconocimiento, o un
 * servicio externo) para interpretar comandos como "abrir cámara".
 */
function startVoiceListening() {
  toast('Asistente por voz: función en preparación');
}

/**
 * Botón "Hablar": el sistema anuncia una instrucción o respuesta.
 * Hoy solo reproduce un mensaje de bienvenida de ejemplo.
 * Aquí conectar modelo IA: reemplazar por respuestas generadas
 * dinámicamente según lo que el usuario necesite en cada pantalla.
 */
function speakAssistant() {
  speak('Hola, soy el asistente de accesibilidad de Y U K I. Puedo leer la pantalla o ayudarte a navegar por el sistema.');
}

/** Alterna el modo de alto contraste (clase global en <body>). */
function toggleHighContrast(checkbox) {
  document.body.classList.toggle('high-contrast', checkbox.checked);
  toast(checkbox.checked ? 'Modo alto contraste activado' : 'Modo alto contraste desactivado');
}

/** Alterna el modo accesible (texto más grande y foco más visible). */
function toggleAccessMode(checkbox) {
  document.body.classList.toggle('access-mode', checkbox.checked);
  toast(checkbox.checked ? 'Modo accesible activado' : 'Modo accesible desactivado');
}
