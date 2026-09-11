/** Mate-Craft: estado, guardado, ciclo, mundo, voxels, jugador */
var scene, camera, renderer, controls;
var tamMundoXZ = 128;
var tamMundoY = 64;

// ===== SISTEMA DE MUNDOS (carpeta "mundos") =====
var nombreMundoActual = null;
var esMundoNuevo = true;
var ultimoGuardado = 0;
var dirHandleMundos = null; // File System Access API
var guardadoEnCarpetaOk = false;
var guardandoEnCurso = false;
var mundoListoParaGuardar = false;

function obtenerParamsURL() {
    const p = new URLSearchParams(window.location.search);
    return {
        mundo: p.get('mundo'),
        nuevo: p.get('nuevo')
    };
}

function uint8ToBase64(u8) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < u8.length; i += chunk) {
        binary += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
    }
    return btoa(binary);
}

function base64ToUint8(b64) {
    const binary = atob(b64);
    const u8 = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) u8[i] = binary.charCodeAt(i);
    return u8;
}

// IndexedDB para recuperar el handle de la carpeta
function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('MateCraftFS', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('handles');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function obtenerHandleCarpeta() {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('handles', 'readonly');
            const req = tx.objectStore('handles').get('mundosDir');
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    } catch (e) { return null; }
}

async function asegurarPermisoCarpeta() {
    if (!dirHandleMundos) {
        dirHandleMundos = await obtenerHandleCarpeta();
    }
    if (!dirHandleMundos) return false;
    const opts = { mode: 'readwrite' };
    if ((await dirHandleMundos.queryPermission(opts)) === 'granted') return true;
    if ((await dirHandleMundos.requestPermission(opts)) === 'granted') return true;
    return false;
}

/** Copia limpia de cofres para JSON (sin referencias vivas) */
function serializarCofres() {
    const out = {};
    for (const k of Object.keys(cofresData)) {
        const d = cofresData[k];
        if (!d || !Array.isArray(d.slots)) continue;
        const slots = [];
        let tieneAlgo = false;
        for (let i = 0; i < COFRE_SLOTS; i++) {
            const s = d.slots[i];
            if (s && s.tipo && (s.cant | 0) > 0) {
                slots.push({ tipo: String(s.tipo), cant: s.cant | 0 });
            } else {
                slots.push(null);
            }
        }
        out[k] = { slots: slots };
    }
    return out;
}

function cargarCofres(data) {
    cofresData = {};
    if (!data || typeof data !== 'object') return;
    for (const k of Object.keys(data)) {
        const d = data[k];
        const slots = new Array(COFRE_SLOTS).fill(null);
        if (d && Array.isArray(d.slots)) {
            for (let i = 0; i < COFRE_SLOTS; i++) {
                const s = d.slots[i];
                if (s && s.tipo && (s.cant | 0) > 0) {
                    slots[i] = { tipo: String(s.tipo), cant: s.cant | 0 };
                }
            }
        }
        cofresData[k] = { slots: slots };
    }
}

function serializarHornos() {
    const out = {};
    for (const k of Object.keys(hornosData)) {
        const d = hornosData[k];
        if (!d) continue;
        function pack(st) {
            if (!st || !st.tipo || !(st.cant > 0)) return null;
            return { tipo: String(st.tipo), cant: st.cant | 0 };
        }
        out[k] = {
            input: pack(d.input),
            fuel: pack(d.fuel),
            output: pack(d.output),
            progress: typeof d.progress === 'number' ? d.progress : 0,
            fuelRemaining: typeof d.fuelRemaining === 'number' ? d.fuelRemaining : 0
        };
    }
    return out;
}

function cargarHornos(data) {
    hornosData = {};
    if (!data || typeof data !== 'object') return;
    for (const k of Object.keys(data)) {
        const d = data[k] || {};
        function unpack(st) {
            if (!st) return null;
            if (typeof st === 'string') return { tipo: st, cant: 1 };
            if (st.tipo && (st.cant | 0) > 0) return { tipo: String(st.tipo), cant: st.cant | 0 };
            return null;
        }
        hornosData[k] = {
            input: unpack(d.input),
            fuel: unpack(d.fuel),
            output: unpack(d.output),
            progress: typeof d.progress === 'number' ? d.progress : 0,
            fuelRemaining: typeof d.fuelRemaining === 'number' ? d.fuelRemaining : 0
        };
    }
}

function construirDatosMundo() {
    const pos = controls.getObject().position;
    // Asegurar que el cofre abierto tenga datos actualizados
    if (cofreAbierto && cofreActualPos) {
        asegurarCofre(cofreActualPos.x, cofreActualPos.y, cofreActualPos.z);
    }
    return {
        version: 2,
        nombre: nombreMundoActual,
        fecha: new Date().toISOString(),
        voxel: uint8ToBase64(mundoVoxel),
        inventario: { ...inventarioRecursos },
        barra: barraSlots.slice(),
        inv: invSlots.slice(),
        player: { x: pos.x, y: pos.y, z: pos.z },
        hornos: serializarHornos(),
        cofres: serializarCofres(),
        materialSeleccionadoIndex: materialSeleccionadoIndex,
        tiempoMundo: tiempoMundo,
        vidaJugador: vidaJugador,
        hambreJugador: hambreJugador,
        mobs: (window.MateCraftMobs ? MateCraftMobs.serialize() : []),
        mateQuizActivo: !!mateQuizActivo,
        mateHitosSuperados: Object.assign({}, mateHitosSuperados),
        mateXP: mateXP | 0,
        mateNivel: mateNivel | 0,
        modoVidasActivo: !!modoVidasActivo,
        vidasRestantes: vidasRestantes | 0
    };
}

function mostrarEstadoGuardado(msg, tipo) {
    const el = document.getElementById('estado-guardado');
    if (!el) return;
    el.textContent = msg;
    el.className = tipo === 'ok' ? 'ok' : (tipo === 'error' ? 'error' : '');
    el.id = 'estado-guardado';
    if (tipo === 'ok' || tipo === 'error') {
        el.classList.add(tipo);
    }
}

async function guardarMundo(forzar = false) {
    if (!nombreMundoActual || !mundoListoParaGuardar) return false;
    if (guardandoEnCurso) return false;
    const ahora = performance.now() / 1000;
    if (!forzar && ultimoGuardado > 0 && (ahora - ultimoGuardado) < 8) return false;

    guardandoEnCurso = true;
    let okLS = false;
    let okDisco = false;

    try {
        let data;
        try {
            data = construirDatosMundo();
        } catch (e) {
            console.error('[Mate-Craft] Error al preparar datos:', e);
            mostrarEstadoGuardado('Error al preparar datos', 'error');
            return false;
        }

        if (!data || !data.voxel || data.voxel.length < 100) {
            console.warn('[Mate-Craft] Datos de mundo inválidos, no se guarda');
            mostrarEstadoGuardado('Datos inválidos', 'error');
            return false;
        }

        const json = JSON.stringify(data);

        // 1) localStorage SIEMPRE
        try {
            localStorage.setItem('matecraft_mundo_' + nombreMundoActual, json);
            let lista = [];
            try { lista = JSON.parse(localStorage.getItem('matecraft_mundos') || '[]'); } catch (e) {}
            if (!lista.includes(nombreMundoActual)) {
                lista.push(nombreMundoActual);
                localStorage.setItem('matecraft_mundos', JSON.stringify(lista));
            }
            okLS = true;
        } catch (e) {
            console.warn('[Mate-Craft] localStorage falló (¿quota?):', e);
        }

        // 2) Carpeta del PC
        try {
            if (await asegurarPermisoCarpeta()) {
                const fileHandle = await dirHandleMundos.getFileHandle(nombreMundoActual + '.json', { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(json);
                await writable.close();
                okDisco = true;
                guardadoEnCarpetaOk = true;
            } else {
                guardadoEnCarpetaOk = false;
            }
        } catch (e) {
            console.warn('[Mate-Craft] Error guardando en carpeta:', e);
            guardadoEnCarpetaOk = false;
        }

        if (okLS || okDisco) {
            ultimoGuardado = performance.now() / 1000;
            const t = new Date();
            const hh = String(t.getHours()).padStart(2, '0');
            const mm = String(t.getMinutes()).padStart(2, '0');
            const ss = String(t.getSeconds()).padStart(2, '0');
            if (okDisco) mostrarEstadoGuardado('✓ Guardado ' + hh + ':' + mm + ':' + ss, 'ok');
            else mostrarEstadoGuardado('✓ Guardado (navegador) ' + hh + ':' + mm + ':' + ss, 'ok');
            return true;
        }

        mostrarEstadoGuardado('⚠ No se pudo guardar', 'error');
        if (forzar) {
            try {
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = nombreMundoActual + '.json';
                a.click();
                URL.revokeObjectURL(url);
            } catch (e) {
                alert('No se pudo guardar. Selecciona la carpeta "mundos" en el menú.');
            }
        }
        return false;
    } finally {
        guardandoEnCurso = false;
    }
}

function aplicarDatosMundo(data) {
    if (!data || !data.voxel) return false;
    mundoVoxel = base64ToUint8(data.voxel);
    // Reiniciar inventario y aplicar guardado (items + cantidades)
    for (let k in inventarioRecursos) inventarioRecursos[k] = 0;
    if (data.inventario) {
        for (let k in data.inventario) {
            if (inventarioRecursos.hasOwnProperty(k) || data.inventario[k]) {
                let v = data.inventario[k] | 0;
                if (v < 0) v = 0;
                const maxS = (typeof maxStackItem === 'function') ? maxStackItem(k) : 64;
                if (v > maxS) v = maxS;
                inventarioRecursos[k] = v;
            }
        }
    }
    if (data.hornos) cargarHornos(data.hornos);
    else hornosData = {};
    if (data.cofres) cargarCofres(data.cofres);
    else cofresData = {};
    if (Array.isArray(data.barra)) {
        barraSlots = new Array(BARRA_SIZE).fill(null);
        for (let i = 0; i < BARRA_SIZE; i++) barraSlots[i] = data.barra[i] || null;
    }
    if (Array.isArray(data.inv)) {
        invSlots = new Array(INV_SIZE).fill(null);
        for (let i = 0; i < INV_SIZE; i++) invSlots[i] = data.inv[i] || null;
    }
    if (typeof data.materialSeleccionadoIndex === 'number') {
        materialSeleccionadoIndex = data.materialSeleccionadoIndex;
    }
    if (typeof data.tiempoMundo === 'number') {
        tiempoMundo = data.tiempoMundo;
    }
    if (typeof data.vidaJugador === 'number') {
        vidaJugador = Math.max(0, Math.min(VIDA_MAX, data.vidaJugador));
    }
    if (typeof data.hambreJugador === 'number') {
        hambreJugador = Math.max(0, Math.min(HAMBRE_MAX, data.hambreJugador));
    }
    if (typeof data.mateQuizActivo === 'boolean') {
        mateQuizActivo = data.mateQuizActivo;
    } else {
        mateQuizActivo = true; // por defecto activo
    }
    mateHitosSuperados = {};
    if (data.mateHitosSuperados && typeof data.mateHitosSuperados === 'object') {
        mateHitosSuperados = Object.assign({}, data.mateHitosSuperados);
    }
    mateXP = (typeof data.mateXP === 'number') ? data.mateXP : 0;
    mateNivel = (typeof data.mateNivel === 'number') ? Math.max(1, data.mateNivel) : 1;
    modoVidasActivo = (typeof data.modoVidasActivo === 'boolean') ? data.modoVidasActivo : true;
    vidasRestantes = (typeof data.vidasRestantes === 'number') ? data.vidasRestantes : VIDAS_MAX;
    if (vidasRestantes < 0) vidasRestantes = 0;
    if (vidasRestantes > VIDAS_MAX) vidasRestantes = VIDAS_MAX;
    return true;
}

var mundoVoxel = new Uint8Array(tamMundoXZ * tamMundoY * tamMundoXZ);
var meshMundo = null;

var raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2(0, 0);

var moveForward = false, moveBackward = false, moveLeft = false, moveRight = false, spacePressed = false;
var prevTime = performance.now();
var velocityY = 0;

// ===== CICLO DÍA / NOCHE =====
// Un día completo = 12 minutos reales (720 segundos)
var SEGUNDOS_POR_DIA = 720;
// Empieza a las 6:00 (amanecer)
var tiempoMundo = 6 / 24; // 0..1 = 0h..24h
var ultimoUpdateReloj = 0;

function obtenerHoraMundo() {
    let horasFloat = tiempoMundo * 24;
    let h = Math.floor(horasFloat) % 24;
    let m = Math.floor((horasFloat - Math.floor(horasFloat)) * 60);
    return { h, m, horasFloat };
}

function faseDelDia(horasFloat) {
    if (horasFloat >= 5 && horasFloat < 7) return 'Amanecer';
    if (horasFloat >= 7 && horasFloat < 18) return 'Día';
    if (horasFloat >= 18 && horasFloat < 20) return 'Atardecer';
    return 'Noche';
}

function colorCielo(t) {
    // t = 0..1 del día
    // Colores clave por hora (0-24)
    const stops = [
        { h: 0,  c: [8, 10, 30] },      // medianoche
        { h: 5,  c: [25, 30, 60] },     // pre-amanecer
        { h: 6,  c: [255, 140, 80] },   // amanecer
        { h: 7,  c: [135, 206, 235] },  // mañana
        { h: 12, c: [100, 180, 255] },  // mediodía
        { h: 17, c: [135, 190, 230] },  // tarde
        { h: 18.5, c: [255, 120, 60] }, // atardecer
        { h: 20, c: [40, 40, 90] },     // anochecer
        { h: 24, c: [8, 10, 30] }       // medianoche
    ];
    let horas = t * 24;
    let a = stops[0], b = stops[1];
    for (let i = 0; i < stops.length - 1; i++) {
        if (horas >= stops[i].h && horas <= stops[i + 1].h) {
            a = stops[i]; b = stops[i + 1];
            break;
        }
    }
    let span = b.h - a.h || 1;
    let f = (horas - a.h) / span;
    f = Math.max(0, Math.min(1, f));
    return {
        r: (a.c[0] + (b.c[0] - a.c[0]) * f) / 255,
        g: (a.c[1] + (b.c[1] - a.c[1]) * f) / 255,
        b: (a.c[2] + (b.c[2] - a.c[2]) * f) / 255
    };
}

/** Densidad de niebla según la hora (0..24). Noche casi ciega; se disipa al amanecer. */
function densidadNiebla(horas) {
    // Día claro
    const DIA = 0.012;
    // Noche espesa alrededor del jugador (casi no se ve)
    const NOCHE = 0.14;
    // Transiciones suaves
    // 5→7 amanecer: NOCHE → DIA
    // 18→20 atardecer: DIA → NOCHE
    // 20→5 noche profunda
    if (horas >= 7 && horas < 18) return DIA;
    if (horas >= 5 && horas < 7) {
        // amanecer: de noche a día
        let f = (horas - 5) / 2; // 0 en 5:00, 1 en 7:00
        f = f * f * (3 - 2 * f); // smoothstep
        return NOCHE + (DIA - NOCHE) * f;
    }
    if (horas >= 18 && horas < 20) {
        // atardecer: de día a noche
        let f = (horas - 18) / 2;
        f = f * f * (3 - 2 * f);
        return DIA + (NOCHE - DIA) * f;
    }
    // Noche (20–24 y 0–5): máxima
    return NOCHE;
}

/** Límite jugable (el mundo va de -64 a +63 aprox.) */
var MARGEN_BORDE_MUNDO = 0.85;
var ZONA_NIEBLA_BORDE = 14; // bloques desde el borde donde empieza a espesarse

function limiteMundoXZ() {
    return (tamMundoXZ / 2) - MARGEN_BORDE_MUNDO;
}

/** 0 = lejos del borde, 1 = pegado al muro invisible */
function factorNieblaBorde(px, pz) {
    var lim = limiteMundoXZ();
    var dx = lim - Math.abs(px);
    var dz = lim - Math.abs(pz);
    var d = Math.min(dx, dz);
    if (d >= ZONA_NIEBLA_BORDE) return 0;
    if (d <= 0) return 1;
    var f = 1 - (d / ZONA_NIEBLA_BORDE);
    return f * f; // más agresivo cerca del borde
}

/** Empuja al jugador dentro del mapa (muro invisible) */
function aplicarMuroInvisible(pos) {
    if (!pos) return;
    var lim = limiteMundoXZ();
    if (pos.x > lim) pos.x = lim;
    if (pos.x < -lim) pos.x = -lim;
    if (pos.z > lim) pos.z = lim;
    if (pos.z < -lim) pos.z = -lim;
}

function actualizarCicloDiaNoche(delta) {
    tiempoMundo += delta / SEGUNDOS_POR_DIA;
    if (tiempoMundo >= 1) tiempoMundo -= 1;

    const col = colorCielo(tiempoMundo);
    if (scene) {
        scene.background.setRGB(col.r, col.g, col.b);
        if (scene.fog) {
            // Niebla del mismo color que el cielo (envuelve al jugador)
            scene.fog.color.setRGB(col.r, col.g, col.b);
            let horas = tiempoMundo * 24;
            let dens = densidadNiebla(horas);
            // Extra niebla en los bordes del mapa
            if (typeof controls !== 'undefined' && controls && controls.getObject) {
                try {
                    const p = controls.getObject().position;
                    const fb = factorNieblaBorde(p.x, p.z);
                    dens += fb * 0.28; // muy densa en el borde
                } catch (e) {}
            }
            scene.fog.density = dens;
        }
    }

    // Actualizar reloj UI ~4 veces por segundo
    ultimoUpdateReloj += delta;
    if (ultimoUpdateReloj >= 0.25) {
        ultimoUpdateReloj = 0;
        const { h, m, horasFloat } = obtenerHoraMundo();
        const hh = String(h).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        const elHora = document.getElementById('reloj-hora');
        const elFase = document.getElementById('reloj-fase');
        if (elHora) elHora.textContent = hh + ':' + mm;
        if (elFase) elFase.textContent = faseDelDia(horasFloat);
    }
}
var gravedad = 24.0;
var velocidadMovimiento = 4.3;
var fuerzaSalto = 8.5;
var enSuelo = false;

var radioJugador = 0.3;
var alturaJugador = 1.6;
var ojosJugador = 1.4;

/** Posición real del jugador (PointerLock usa un Object3D, no camera.position) */
function getPlayerObject() {
    if (typeof controls !== 'undefined' && controls && controls.getObject) {
        return controls.getObject();
    }
    return camera;
}

// Vida, aire, caída
var VIDA_MAX = 20;
var AIRE_MAX = 10; // segundos de aire bajo el agua
var HAMBRE_MAX = 20;
var vidaJugador = VIDA_MAX;
var aireJugador = AIRE_MAX;
var hambreJugador = HAMBRE_MAX;
var distanciaCaida = 0;
var invulnerabilidad = 0; // segundos sin daño tras recibir golpe
var acumuladorDanioAhogo = 0;
var acumuladorHambre = 0;
var acumuladorStarvation = 0;
var acumuladorRegen = 0;
var jugadorMuerto = false;
var motivoMuerteActual = '';

var estaRompiendo = false;
var objetivoRompiendoPos = null;
var tiempoRompiendo = 0;
var tiempoRequeridoRomper = 0.6; 

var inventarioRecursos = { roca: 0, tierra: 0, tronco: 0, tablon: 0, palito: 0, mesacra: 0, picm: 0, picp: 0, horno: 0, carbon: 0, manzana: 0, manzanad: 0, carne: 0, carnec: 0, carne2: 0, carnec2: 0, carne3: 0, carnec3: 0, carne4: 0, carnec4: 0, lana: 0, cofre: 0, hachm: 0, hachp: 0, espm: 0, espp: 0, palam: 0, palap: 0, agua: 0, hojas: 0, menah: 0, hierro: 0, bloqh: 0, pich: 0, esph: 0, hachh: 0, palah: 0, menao: 0, oro: 0, bloqo: 0, pico: 0, espo: 0, hacho: 0, palao: 0, menad: 0, diamante: 0, bloqd: 0, picd: 0, espd: 0, hachd: 0, palad: 0, menac: 0, bloqc: 0, carnepodrida: 0, hilo: 0, polvora: 0 };
var materialesDisponiblesEnBarra = [];
var materialSeleccionadoIndex = 0;
var BARRA_SIZE = 12;
var barraSlots = new Array(BARRA_SIZE).fill(null); // tipos en la barra rápida
var INV_SIZE = 27; // 3×9 casillas fijas inventario general
var invSlots = new Array(INV_SIZE).fill(null);

var STACK_MAX = 64;
var HERRAMIENTAS_NO_STACK = new Set([
    'picm','picp','pich','pico','hachm','hachp','hachh','hacho','espm','espp','esph','espo','palam','palap','palah','palao','picd','espd','hachd','palad'
]);
function maxStackItem(tipo) {
    if (!tipo) return STACK_MAX;
    if (HERRAMIENTAS_NO_STACK.has(tipo)) return 1;
    return STACK_MAX;
}

var inventarioAbierto = false;
var modoCreativo = false;
/** Mate-Quiz: preguntas de aritmética/álgebra al progresar (activo por defecto) */
var mateQuizActivo = true;
/** Hitos ya superados (respondió bien al menos una vez) */
var mateHitosSuperados = {};
var mateXP = 0;
var mateNivel = 1;
/** Modo 3 vidas (activado por defecto) */
var modoVidasActivo = true;
var vidasRestantes = 3;
var VIDAS_MAX = 3;
var creativoAbierto = false;
var modoMesa3x3 = false; 
var grillaCrafteo = new Array(4).fill(null); 

// Estado del horno
var hornoAbierto = false;
var hornoActualPos = null; // {x,y,z} del horno abierto
var hornosData = {}; // clave "x,y,z" → { input, fuel, output, progress, fuelRemaining }
var cofresData = {}; // clave "x,y,z" → { slots: [null|{tipo,cant}, ...] }
var COFRE_SLOTS = 18; // 3x6 — sin cofre doble por ahora
var cofreAbierto = false;
var cofreActualPos = null;
// progress: 0 a 1 (tiempo de cocción)
// fuelRemaining: tiempo de combustión restante

var TIEMPO_COCCION = 4.0; // segundos para cocinar 1 item
var COMBUSTIBLES = { tronco: 8.0, tablon: 4.0, mesacra: 6.0, carbon: 12.0, bloqc: 80.0 }; // bloque carbón quema mucho
var RECETAS_HORNO = { tronco: 'carbon', carne: 'carnec', carne2: 'carnec2', carne3: 'carnec3', carne4: 'carnec4', menah: 'hierro', menao: 'oro' };

// Comida: hambre | vida | tiempo de comer (segundos)
var COMIDA = {
    manzana:  { hambre: 4, vida: 0, tiempo: 1.2 },
    manzanad: { hambre: 8, vida: 8, tiempo: 1.6 },
    carne:    { hambre: 2, vida: 0, tiempo: 1.4 },
    carnec:   { hambre: 6, vida: 1, tiempo: 1.4 },
    carne2:   { hambre: 2, vida: 0, tiempo: 1.4 },  // cerdo crudo
    carnec2:  { hambre: 7, vida: 1, tiempo: 1.5 },  // cerdo cocido
    carne3:   { hambre: 2, vida: 0, tiempo: 1.4 },  // vaca cruda
    carnec3:  { hambre: 8, vida: 2, tiempo: 1.5 },  // vaca cocida
    carne4:   { hambre: 2, vida: 0, tiempo: 1.4 },  // oveja cruda
    carnec4:  { hambre: 6, vida: 1, tiempo: 1.5 },  // oveja cocida
    carnepodrida: { hambre: 2, vida: 0, tiempo: 1.4 }
};

var comiendo = false;
var comidaEnProgreso = null; // tipo
var tiempoComiendo = 0;
var tiempoComerRequerido = 1.2;

function esComida(tipo) {
    return !!(tipo && COMIDA[tipo]);
}

function iniciarComer(tipo) {
    if (comiendo) return false;
    if (!esComida(tipo)) return false;
    if (!inventarioRecursos[tipo] || inventarioRecursos[tipo] <= 0) return false;
    if (hambreJugador >= HAMBRE_MAX) return false;

    comiendo = true;
    comidaEnProgreso = tipo;
    tiempoComiendo = 0;
    tiempoComerRequerido = COMIDA[tipo].tiempo || 1.2;
    const bar = document.getElementById('barra-comer-container');
    const fill = document.getElementById('barra-comer');
    if (bar) bar.style.display = 'block';
    if (fill) fill.style.width = '0%';
    return true;
}

function cancelarComer() {
    comiendo = false;
    comidaEnProgreso = null;
    tiempoComiendo = 0;
    const bar = document.getElementById('barra-comer-container');
    const fill = document.getElementById('barra-comer');
    if (bar) bar.style.display = 'none';
    if (fill) fill.style.width = '0%';
}

function terminarComer() {
    const tipo = comidaEnProgreso;
    cancelarComer();
    if (!tipo || !esComida(tipo)) return;
    if (!inventarioRecursos[tipo] || inventarioRecursos[tipo] <= 0) return;
    if (hambreJugador >= HAMBRE_MAX) return;

    const info = COMIDA[tipo];
    inventarioRecursos[tipo]--;
    hambreJugador = Math.min(HAMBRE_MAX, hambreJugador + info.hambre);
    if (info.vida && info.vida > 0) {
        vidaJugador = Math.min(VIDA_MAX, vidaJugador + info.vida);
        actualizarUIVida();
    }
    actualizarUIHambre();
    actualizarUIInventario();
}

function actualizarComer(delta) {
    if (!comiendo || !comidaEnProgreso) return;
    // Cancelar si ya no tienes el ítem o no tienes hambre
    if (!inventarioRecursos[comidaEnProgreso] || inventarioRecursos[comidaEnProgreso] <= 0 || hambreJugador >= HAMBRE_MAX) {
        cancelarComer();
        return;
    }
    tiempoComiendo += delta;
    const pct = Math.min(100, (tiempoComiendo / tiempoComerRequerido) * 100);
    const fill = document.getElementById('barra-comer');
    if (fill) fill.style.width = pct + '%';
    if (tiempoComiendo >= tiempoComerRequerido) {
        terminarComer();
    }
}

// compat: llamadas antiguas
function comerAlimento(tipo) {
    return iniciarComer(tipo);
}

var texturasIconos = { roca: 'roc.png', tierra: 't.png', tronco: 'tr.png', tablon: 'tab.png', palito: 'palo.png', mesacra: 'crafta.png', picm: 'picm.png', picp: 'picp.png', horno: 'hora.png', carbon: 'car.png', manzana: 'manzana.png', manzanad: 'manzanad.png', carne: 'carne.png', carnec: 'carnec.png', carne2: 'carne2.png', carnec2: 'carnec2.png', carne3: 'carne3.png', carnec3: 'carnec3.png', carne4: 'carne4.png', carnec4: 'carnec4.png', lana: 'lan.png', cofre: 'cof.png', hachm: 'hachm.png', hachp: 'hachp.png', espm: 'espm.png', espp: 'espp.png', palam: 'palam.png', palap: 'palap.png', agua: 'ag.png', hojas: 'h.png', menah: 'menah.png', hierro: 'hierro.png', bloqh: 'bloqh.png', pich: 'pich.png', esph: 'esph.png', hachh: 'hachh.png', palah: 'palah.png', menao: 'menao.png', oro: 'oro.png', bloqo: 'bloqo.png', pico: 'pico.png', espo: 'espo.png', hacho: 'hacho.png', palao: 'palao.png', menad: 'menad.png', diamante: 'diamante.png', bloqd: 'bloqd.png', picd: 'picd.png', espd: 'espd.png', hachd: 'hachd.png', palad: 'palad.png', menac: 'menac.png', bloqc: 'bloqc.png', carnepodrida: 'carnepodrida.png', hilo: 'hilo.png', polvora: 'polvora.png' };

// Mapeo actualizado: el ID 1 da 'roca', y el ID 12 también da 'roca' al romperse
var ID_A_TIPO = { 1: 'roca', 2: 'tierra', 3: 'tierra', 4: null, 5: null, 6: 'tronco', 7: 'agua', 8: 'tablon', 9: 'palito', 10: 'mesacra', 12: 'roca', 13: 'horno', 14: 'horno', 15: 'horno', 16: 'horno', 17: 'horno', 18: 'horno', 19: 'horno', 20: 'horno', 21: 'lana', 22: 'cofre', 23: 'cofre', 24: 'cofre', 25: 'cofre', 26: 'menah', 27: 'bloqh', 28: 'menao', 29: 'bloqo', 30: null, 31: 'bloqd', 32: null, 33: 'bloqc' };

var acumuladorTiempoAgua = 0;
var intervaloPropagacionAgua = 0.8;

var materialesMundo = [];

function obtenerIdVoxel(x, y, z) {
    let offsetRango = tamMundoXZ / 2;
    let mx = Math.floor(x + offsetRango);
    let my = Math.floor(y);
    let mz = Math.floor(z + offsetRango);
    if (mx < 0 || mx >= tamMundoXZ || my < 0 || my >= tamMundoY || mz < 0 || mz >= tamMundoXZ) return 0;
    return mundoVoxel[mx + my * tamMundoXZ + mz * tamMundoXZ * tamMundoY];
}

function establecerIdVoxel(x, y, z, id) {
    let offsetRango = tamMundoXZ / 2;
    let mx = Math.floor(x + offsetRango);
    let my = Math.floor(y);
    let mz = Math.floor(z + offsetRango);
    if (mx < 0 || mx >= tamMundoXZ || my < 0 || my >= tamMundoY || mz < 0 || mz >= tamMundoXZ) return;
    mundoVoxel[mx + my * tamMundoXZ + mz * tamMundoXZ * tamMundoY] = id;
}
