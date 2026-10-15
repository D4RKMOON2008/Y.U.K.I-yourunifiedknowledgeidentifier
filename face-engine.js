/* ════════════════════════════════════════════════════════════
   FACE ENGINE — reconocimiento facial real en el navegador
   Usa face-api.js (sin Python). Modelos se cargan desde CDN.
   ════════════════════════════════════════════════════════════ */

const FaceEngine = {
  ready: false,
  loading: null,
  // Descriptors por nombre: { name: Float32Array[] }
  labeled: {},
  MATCH_THRESHOLD: 0.55, // distancia euclidiana (más bajo = más estricto)

  MODEL_URL: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model',

  async init() {
    if (this.ready) return true;
    if (this.loading) return this.loading;

    this.loading = (async () => {
      if (typeof faceapi === 'undefined') {
        console.warn('face-api no cargó');
        return false;
      }
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(this.MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(this.MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(this.MODEL_URL),
        ]);
        this._loadDescriptorsFromStorage();
        this.ready = true;
        console.log('FaceEngine listo');
        return true;
      } catch (e) {
        console.error('Error cargando modelos face-api', e);
        return false;
      }
    })();

    return this.loading;
  },

  _storageKey: 'yuki_face_descriptors_v1',

  _loadDescriptorsFromStorage() {
    try {
      const raw = localStorage.getItem(this._storageKey);
      if (!raw) return;
      const obj = JSON.parse(raw);
      this.labeled = {};
      Object.keys(obj).forEach(name => {
        this.labeled[name] = obj[name].map(arr => new Float32Array(arr));
      });
    } catch (_) {}
  },

  _saveDescriptors() {
    const out = {};
    Object.keys(this.labeled).forEach(name => {
      out[name] = this.labeled[name].map(d => Array.from(d));
    });
    try {
      localStorage.setItem(this._storageKey, JSON.stringify(out));
    } catch (e) {
      console.warn('No se pudieron guardar descriptors', e);
    }
  },

  /** Detecta el descriptor del rostro principal en un video o canvas */
  async getDescriptor(input) {
    if (!this.ready) await this.init();
    if (!this.ready) return null;
    try {
      const det = await faceapi
        .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
        .withFaceLandmarks()
        .withFaceDescriptor();
      return det ? det.descriptor : null;
    } catch (e) {
      console.warn('getDescriptor', e);
      return null;
    }
  },

  /** Detecta todas las caras (cajas) para dibujar */
  async detectFaces(input) {
    if (!this.ready) await this.init();
    if (!this.ready) return [];
    try {
      const dets = await faceapi.detectAllFaces(
        input,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 })
      );
      return dets.map(d => {
        const b = d.box;
        return { x: b.x, y: b.y, width: b.width, height: b.height, score: d.score };
      });
    } catch (_) {
      return [];
    }
  },

  /** Registra / agrega un descriptor a un nombre */
  addDescriptor(name, descriptor) {
    if (!name || !descriptor) return;
    const key = name.trim();
    if (!this.labeled[key]) this.labeled[key] = [];
    // Máximo 25 plantillas por persona (calidad ONYX)
    if (this.labeled[key].length >= 25) this.labeled[key].shift();
    this.labeled[key].push(descriptor);
    this._saveDescriptors();
  },

  /** Compara un descriptor contra todos los registrados */
  match(descriptor) {
    if (!descriptor) return null;
    let best = null;
    let bestDist = Infinity;
    Object.keys(this.labeled).forEach(name => {
      const list = this.labeled[name] || [];
      list.forEach(ref => {
        const dist = this._distance(descriptor, ref);
        if (dist < bestDist) {
          bestDist = dist;
          best = { name, distance: dist };
        }
      });
    });
    if (best && best.distance <= this.MATCH_THRESHOLD) {
      // Convertir distancia a "confianza" tipo LBPH-ish (menor distancia = mejor)
      const conf = Math.round(best.distance * 100);
      return { name: best.name, conf, ok: true };
    }
    return { name: 'No registrado', conf: Math.round((best ? best.distance : 1) * 100), ok: false };
  },

  _distance(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const d = a[i] - b[i];
      sum += d * d;
    }
    return Math.sqrt(sum);
  },

  labeledCount() {
    return Object.keys(this.labeled).length;
  },

  removePerson(name) {
    delete this.labeled[name];
    this._saveDescriptors();
  },
};

// Precargar modelos en segundo plano al abrir la página
window.addEventListener('load', () => {
  setTimeout(() => FaceEngine.init(), 800);
});
