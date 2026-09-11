/** Mate-Craft — lógica del juego */
var scene, camera, renderer, controls;
var tamMundoXZ = 128;
var tamMundoY = 64;

// ===== SISTEMA DE MUNDOS (carpeta "mundos") =====
var nombreMundoActual = null;
var esMundoNuevo = true;
var ultimoGuardado = 0;
var INTERVALO_AUTOGUARDADO = 300; // auto-guardado en carpeta cada 5 minutos
var dirHandleMundos = null; // File System Access API
var guardadoEnCarpetaOk = false;

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
        mobs: (window.MateCraftMobs ? MateCraftMobs.serialize() : [])
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
    if (!nombreMundoActual) return false;
    const ahora = performance.now() / 1000;
    if (!forzar && (ahora - ultimoGuardado) < 5) return false;

    let data;
    try {
        data = construirDatosMundo();
    } catch (e) {
        console.error(e);
        mostrarEstadoGuardado('Error al preparar datos', 'error');
        return false;
    }
    const json = JSON.stringify(data);
    let guardadoDisco = false;

    // 1) PRINCIPAL: carpeta del ordenador
    try {
        if (await asegurarPermisoCarpeta()) {
            const fileHandle = await dirHandleMundos.getFileHandle(nombreMundoActual + '.json', { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(json);
            await writable.close();
            guardadoDisco = true;
            guardadoEnCarpetaOk = true;
            console.log('[Mate-Craft] Guardado en disco:', nombreMundoActual + '.json');
        }
    } catch (e) {
        console.warn('Error guardando en carpeta:', e);
        guardadoEnCarpetaOk = false;
    }

    // 2) Copia de seguridad en localStorage
    try {
        localStorage.setItem('matecraft_mundo_' + nombreMundoActual, json);
        let lista = [];
        try { lista = JSON.parse(localStorage.getItem('matecraft_mundos') || '[]'); } catch (e) {}
        if (!lista.includes(nombreMundoActual)) {
            lista.push(nombreMundoActual);
            localStorage.setItem('matecraft_mundos', JSON.stringify(lista));
        }
    } catch (e) {
        console.warn('Backup localStorage falló:', e);
    }

    ultimoGuardado = ahora;

    if (guardadoDisco) {
        const t = new Date();
        const hh = String(t.getHours()).padStart(2, '0');
        const mm = String(t.getMinutes()).padStart(2, '0');
        const ss = String(t.getSeconds()).padStart(2, '0');
        mostrarEstadoGuardado('✓ Guardado ' + hh + ':' + mm + ':' + ss, 'ok');
        return true;
    }

    // Sin carpeta: avisar y ofrecer descarga
    mostrarEstadoGuardado('⚠ Sin carpeta — descarga', 'error');
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
}

function aplicarDatosMundo(data) {
    if (!data || !data.voxel) return false;
    mundoVoxel = base64ToUint8(data.voxel);
    // Reiniciar inventario y aplicar guardado (items + cantidades)
    for (let k in inventarioRecursos) inventarioRecursos[k] = 0;
    if (data.inventario) {
        for (let k in data.inventario) {
            if (inventarioRecursos.hasOwnProperty(k)) {
                inventarioRecursos[k] = data.inventario[k] | 0;
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
            scene.fog.density = densidadNiebla(horas);
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

var inventarioRecursos = { roca: 0, tierra: 0, tronco: 0, tablon: 0, palito: 0, mesacra: 0, picm: 0, picp: 0, horno: 0, carbon: 0, manzana: 0, manzanad: 0, carne: 0, carnec: 0, carne2: 0, carnec2: 0, carne3: 0, carnec3: 0, carne4: 0, carnec4: 0, lana: 0, cofre: 0, hachm: 0, hachp: 0, espm: 0, espp: 0, palam: 0, palap: 0 };
var materialesDisponiblesEnBarra = [];
var materialSeleccionadoIndex = 0;
var BARRA_SIZE = 12;
var barraSlots = new Array(BARRA_SIZE).fill(null); // tipos en la barra rápida
var INV_SIZE = 27; // 3×9 casillas fijas inventario general
var invSlots = new Array(INV_SIZE).fill(null);

var inventarioAbierto = false;
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
var COMBUSTIBLES = { tronco: 8.0, tablon: 4.0, mesacra: 6.0, carbon: 12.0 }; // segundos de quemado
var RECETAS_HORNO = { tronco: 'carbon', carne: 'carnec', carne2: 'carnec2', carne3: 'carnec3', carne4: 'carnec4' };

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
    carnec4:  { hambre: 6, vida: 1, tiempo: 1.5 }   // oveja cocida
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

var texturasIconos = { roca: 'roc.png', tierra: 't.png', tronco: 'tr.png', tablon: 'tab.png', palito: 'palo.png', mesacra: 'crafta.png', picm: 'picm.png', picp: 'picp.png', horno: 'hora.png', carbon: 'car.png', manzana: 'manzana.png', manzanad: 'manzanad.png', carne: 'carne.png', carnec: 'carnec.png', carne2: 'carne2.png', carnec2: 'carnec2.png', carne3: 'carne3.png', carnec3: 'carnec3.png', carne4: 'carne4.png', carnec4: 'carnec4.png', lana: 'lan.png', cofre: 'cof.png', hachm: 'hachm.png', hachp: 'hachp.png', espm: 'espm.png', espp: 'espp.png', palam: 'palam.png', palap: 'palap.png' };

// Mapeo actualizado: el ID 1 da 'roca', y el ID 12 también da 'roca' al romperse
var ID_A_TIPO = { 1: 'roca', 2: 'tierra', 3: 'tierra', 4: null, 5: null, 6: 'tronco', 7: 'agua', 8: 'tablon', 9: 'palito', 10: 'mesacra', 12: 'roca', 13: 'horno', 14: 'horno', 15: 'horno', 16: 'horno', 17: 'horno', 18: 'horno', 19: 'horno', 20: 'horno', 21: 'lana', 22: 'cofre', 23: 'cofre', 24: 'cofre', 25: 'cofre' };

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

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.FogExp2(0x87CEEB, 0.012);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 45, 8);

    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const textureLoader = new THREE.TextureLoader();
    function cargarTex(archivo) {
        let tex = textureLoader.load('texturas/' + archivo);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        return tex;
    }

    // Material 12: Cobblestone | 13: Horno frente
    materialesMundo = [
        new THREE.MeshBasicMaterial({ map: cargarTex('p.png') }),   // 0: Piedra lisa
        new THREE.MeshBasicMaterial({ map: cargarTex('t.png') }),   // 1: Tierra
        new THREE.MeshBasicMaterial({ map: cargarTex('c.png') }),   // 2: Costado pasto
        new THREE.MeshBasicMaterial({ map: cargarTex('ta.png') }),  // 3: Tapa pasto
        new THREE.MeshBasicMaterial({ map: cargarTex('h.png') }),   // 4: Hojas
        new THREE.MeshBasicMaterial({ map: cargarTex('b.png') }),   // 5: Bedrock
        new THREE.MeshBasicMaterial({ map: cargarTex('tr.png') }),  // 6: Tronco lado
        new THREE.MeshBasicMaterial({ map: cargarTex('tra.png') }), // 7: Tronco tapa
        new THREE.MeshBasicMaterial({ map: cargarTex('ag.png'), transparent: true, opacity: 0.8, depthWrite: false }), // 8: Agua
        new THREE.MeshBasicMaterial({ map: cargarTex('tab.png') }), // 9: Tablón
        new THREE.MeshBasicMaterial({ map: cargarTex('crafta.png') }), // 10: Mesa arriba
        new THREE.MeshBasicMaterial({ map: cargarTex('crafl.png') }),  // 11: Mesa lado
        new THREE.MeshBasicMaterial({ map: cargarTex('roc.png') }),  // 12: Cobblestone / top-bottom horno
        new THREE.MeshBasicMaterial({ map: cargarTex('hora.png') }), // 13: Horno frente (apagado)
        new THREE.MeshBasicMaterial({ map: cargarTex('horl.png') }), // 14: Horno lados
        new THREE.MeshBasicMaterial({ map: cargarTex('hore.png') }), // 15: Horno frente (prendido)
        new THREE.MeshBasicMaterial({ map: cargarTex('lan.png') }), // 16: Lana
        new THREE.MeshBasicMaterial({ map: cargarTex('cof.png') }),  // 17: Cofre frente
        new THREE.MeshBasicMaterial({ map: cargarTex('cofl.png') }), // 18: Cofre lados
        new THREE.MeshBasicMaterial({ map: cargarTex('cofa.png') })  // 19: Cofre arriba
    ];

    controls = new THREE.PointerLockControls(camera, document.body);

    const pantallaBloqueo = document.getElementById('bloqueo-pantalla');
    pantallaBloqueo.addEventListener('click', () => { 
        if (!inventarioAbierto && !hornoAbierto && !cofreAbierto) controls.lock(); 
    });
    controls.addEventListener('lock', () => { pantallaBloqueo.style.display = 'none'; });
    controls.addEventListener('unlock', () => { 
        if (!inventarioAbierto && !hornoAbierto && !cofreAbierto) pantallaBloqueo.style.display = 'flex'; 
        cancelarRuptura(); 
    });

    scene.add(controls.getObject());

    // ===== Cargar o generar mundo =====
    const params = obtenerParamsURL();
    let datosCargados = null;
    esMundoNuevo = true;
    nombreMundoActual = null;

    // 1) Datos enviados por el menú (sessionStorage)
    try {
        const rawCargar = sessionStorage.getItem('matecraft_cargar');
        if (rawCargar) {
            const obj = JSON.parse(rawCargar);
            if (obj && obj.data && obj.data.voxel) {
                nombreMundoActual = obj.nombre || params.mundo || 'mundo';
                datosCargados = obj.data;
                esMundoNuevo = false;
            }
            sessionStorage.removeItem('matecraft_cargar');
        }
    } catch (e) {
        console.warn('Error leyendo mundo a cargar:', e);
        sessionStorage.removeItem('matecraft_cargar');
    }

    // 2) Fallback: localStorage (sobrevive actualizaciones del código)
    if (!datosCargados && params.mundo) {
        try {
            const rawLS = localStorage.getItem('matecraft_mundo_' + params.mundo);
            if (rawLS) {
                const dataLS = JSON.parse(rawLS);
                if (dataLS && dataLS.voxel) {
                    nombreMundoActual = params.mundo;
                    datosCargados = dataLS;
                    esMundoNuevo = false;
                    console.log('[Mate-Craft] Mundo cargado desde localStorage');
                }
            }
        } catch (e) {
            console.warn('Error localStorage load:', e);
        }
    }

    // 3) Si aún no hay datos, mirar la URL
    if (!datosCargados) {
        if (params.nuevo) {
            nombreMundoActual = params.nuevo;
            esMundoNuevo = true;
        } else if (params.mundo) {
            nombreMundoActual = params.mundo;
            esMundoNuevo = true;
        } else {
            window.location.replace('index.html');
            return;
        }
    }

    sessionStorage.removeItem('matecraft_nuevo');

    if (datosCargados) {
        try {
            aplicarDatosMundo(datosCargados);
            if (datosCargados.player) {
                camera.position.set(
                    datosCargados.player.x || 0,
                    datosCargados.player.y || 40,
                    datosCargados.player.z || 0
                );
            }
        } catch (e) {
            console.error('Error aplicando mundo, se genera uno nuevo:', e);
            datosCargados = null;
            esMundoNuevo = true;
            mundoVoxel = new Uint8Array(tamMundoXZ * tamMundoY * tamMundoXZ);
        }
    }

    if (!datosCargados) {
        // Generar terreno nuevo
        let semillaX = Math.random() * 1000;
        let semillaZ = Math.random() * 1000;
        let desplazamiento = tamMundoXZ / 2;
        let nivelDelMar = 4;

        for (let x = 0; x < tamMundoXZ; x++) {
            for (let z = 0; z < tamMundoXZ; z++) {
                let alturaColina = Math.floor(
                    Math.sin((x + semillaX) * 0.08) * Math.cos((z + semillaZ) * 0.08) * 10 + 
                    Math.sin((x + semillaX) * 0.03) * Math.cos((z + semillaZ) * 0.03) * 8 + 14
                );
                if (alturaColina < 4) alturaColina = 4;
                if (alturaColina >= tamMundoY - 6) alturaColina = tamMundoY - 7;

                let esLago = alturaColina <= nivelDelMar;
                let alturaTerrenoReal = esLago ? 3 : alturaColina;

                for (let y = 0; y <= alturaTerrenoReal; y++) {
                    let idMat = 1; 
                    if (y === 0) idMat = 5; 
                    else if (y === alturaTerrenoReal) idMat = 3; 
                    else if (y >= alturaTerrenoReal - 3) idMat = 2; 

                    let posX = x - desplazamiento;
                    let posZ = z - desplazamiento;
                    establecerIdVoxel(posX, y, posZ, idMat);
                }

                if (esLago) {
                    for (let yWaters = 3; yWaters <= nivelDelMar; yWaters++) {
                        establecerIdVoxel(x - desplazamiento, yWaters, z - desplazamiento, 7);
                    }
                }

                let probabilidadArbol = Math.sin((x + semillaX) * 12.9898 + (z + semillaZ) * 78.233) * 43758.5453;
                let valorAleatorio = probabilidadArbol - Math.floor(probabilidadArbol);

                if (valorAleatorio < 0.012 && alturaColina > 5 && !esLago) {
                    let baseArbolY = alturaColina + 1;
                    let posX = x - desplazamiento;
                    let posZ = z - desplazamiento;

                    for (let t = 0; t < 5; t++) {
                        establecerIdVoxel(posX, baseArbolY + t, posZ, 6);
                    }

                    let alturaCopa = baseArbolY + 4;
                    for (let hx = -2; hx <= 2; hx++) {
                        for (let hz = -2; hz <= 2; hz++) {
                            for (let hy = 0; hy <= 2; hy++) {
                                if (Math.abs(hx) === 2 && Math.abs(hz) === 2 && hy === 2) continue;
                                let hX = posX + hx;
                                let hY = alturaCopa + hy;
                                let hZ = posZ + hz;
                                if (obtenerIdVoxel(hX, hY, hZ) === 0) {
                                    establecerIdVoxel(hX, hY, hZ, 4);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    reconstruirMallaMundo();

    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyW') moveForward = true;
        if (e.code === 'KeyS') moveBackward = true;
        if (e.code === 'KeyA') moveLeft = true;
        if (e.code === 'KeyD') moveRight = true;
        if (e.code === 'Space') {
            spacePressed = true;
            if (enSuelo) { velocityY = fuerzaSalto; enSuelo = false; }
        }

        if (e.code === 'KeyE') {
            if (hornoAbierto) {
                cerrarHorno();
            } else if (cofreAbierto) {
                cerrarCofre();
            } else {
                toggleInventario(false); 
            }
        }

        // M = Guardar y volver al menú (único momento de guardado)
        if (e.code === 'KeyM') {
            if (nombreMundoActual) {
                Promise.resolve(guardarMundo(true)).finally(() => {
                    window.location.href = 'index.html';
                });
            } else {
                window.location.href = 'index.html';
            }
        }
        
        if (!inventarioAbierto && !hornoAbierto && !cofreAbierto) {
            if (e.key >= '1' && e.key <= '9') {
                materialSeleccionadoIndex = parseInt(e.key, 10) - 1;
                actualizarUIInventario();
            } else if (e.key === '0') {
                materialSeleccionadoIndex = 9;
                actualizarUIInventario();
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'KeyW') moveForward = false;
        if (e.code === 'KeyS') moveBackward = false;
        if (e.code === 'KeyA') moveLeft = false;
        if (e.code === 'KeyD') moveRight = false;
        if (e.code === 'Space') spacePressed = false;
    });

    window.addEventListener('wheel', (e) => {
        if (inventarioAbierto || hornoAbierto || cofreAbierto || !controls.isLocked) return;
        if (e.deltaY > 0) materialSeleccionadoIndex = (materialSeleccionadoIndex + 1) % BARRA_SIZE;
        else materialSeleccionadoIndex = (materialSeleccionadoIndex - 1 + BARRA_SIZE) % BARRA_SIZE;
        actualizarUIInventario();
    });

    window.addEventListener('mousedown', (e) => {
        if (inventarioAbierto || hornoAbierto || cofreAbierto || !controls.isLocked || jugadorMuerto) return;
        raycaster.setFromCamera(mouse, camera);

        // Golpear mobs con clic izquierdo
        if (e.button === 0 && window.MateCraftMobs) {
            const mobHit = MateCraftMobs.raycastHit(raycaster, camera, mouse, 5);
            if (mobHit) {
                let arma = itemBarraActual();
                let golpes = 1;
                if (arma === 'espp') golpes = 3;
                else if (arma === 'espm') golpes = 2;
                for (let gi = 0; gi < golpes; gi++) {
                    if (!mobHit || mobHit.vida <= 0) break;
                    MateCraftMobs.hit(mobHit);
                }
                cancelarRuptura();
                return;
            }
        }

        let intersects = raycaster.intersectObject(meshMundo);

        if (intersects.length > 0 && intersects[0].distance < 6) {
            let hit = intersects[0];
            let normal = hit.face.normal.clone();
            let pImp = hit.point.clone().add(normal.clone().multiplyScalar(-0.01));
            let vx = Math.floor(pImp.x + 0.5), vy = Math.floor(pImp.y + 0.5), vz = Math.floor(pImp.z + 0.5);

            if (e.button === 0) {
                let idB = obtenerIdVoxel(vx, vy, vz);
                if (idB === 7 || idB === 5) { cancelarRuptura(); return; } 
                
                cancelarComer();
                objetivoRompiendoPos = { x: vx, y: vy, z: vz };
                estaRompiendo = true;
                tiempoRompiendo = 0;

                let itemActual = itemBarraActual();
                let esPiedra = (idB === 1 || idB === 12);
                let esTierra = (idB === 2 || idB === 3);
                let esMadera = (idB === 6 || idB === 8 || idB === 10); // tronco, tablón, mesa
                let esHojas = (idB === 4);
                let conHerramienta = itemActual && HERRAMIENTAS.has(itemActual);

                // Mano vacía: más lento en casi todo
                if (!itemActual || (!conHerramienta && !esComida(itemActual))) {
                    if (esPiedra) tiempoRequeridoRomper = 2.4;
                    else if (esMadera) tiempoRequeridoRomper = 1.5;
                    else if (esTierra) tiempoRequeridoRomper = 0.9;
                    else if (esHojas) tiempoRequeridoRomper = 0.45;
                    else tiempoRequeridoRomper = 1.0;
                } else if (esPiedra && itemActual === 'picp') {
                    tiempoRequeridoRomper = 0.2;
                } else if (esPiedra && itemActual === 'picm') {
                    tiempoRequeridoRomper = 0.35;
                } else if (esPiedra) {
                    tiempoRequeridoRomper = 2.0; // sin pico adecuado
                } else if (esMadera && (itemActual === 'hachp')) {
                    tiempoRequeridoRomper = 0.18;
                } else if (esMadera && (itemActual === 'hachm')) {
                    tiempoRequeridoRomper = 0.28;
                } else if (esHojas && (itemActual === 'hachm' || itemActual === 'hachp')) {
                    tiempoRequeridoRomper = 0.12;
                } else if (esTierra && itemActual === 'palap') {
                    tiempoRequeridoRomper = 0.12;
                } else if (esTierra && itemActual === 'palam') {
                    tiempoRequeridoRomper = 0.2;
                } else if (esHojas) {
                    tiempoRequeridoRomper = 0.2;
                } else {
                    tiempoRequeridoRomper = 0.45;
                }

                document.getElementById('barra-romper-container').style.display = 'block';
            } else if (e.button === 2) {
                let idBajoClic = obtenerIdVoxel(vx, vy, vz);
                
                if (idBajoClic === 10) {
                    toggleInventario(true);
                    return;
                }

                // Abrir horno (apagado 13-16 o prendido 17-20)
                if (idBajoClic >= 13 && idBajoClic <= 20) {
                    abrirHorno(vx, vy, vz);
                    return;
                }

                // Abrir cofre (cualquier orientación 22-25)
                if (idBajoClic >= 22 && idBajoClic <= 25) {
                    abrirCofre(vx, vy, vz);
                    return;
                }

                let tipoMatStr = itemBarraActual();
                // Comida u objetos no colocables
                if (tipoMatStr && (esComida(tipoMatStr) || HERRAMIENTAS.has(tipoMatStr) || tipoMatStr === 'carbon' || tipoMatStr === 'carne' || tipoMatStr === 'carnec' || tipoMatStr === 'carne2' || tipoMatStr === 'carnec2' || tipoMatStr === 'carne3' || tipoMatStr === 'carnec3' || tipoMatStr === 'carne4' || tipoMatStr === 'carnec4')) {
                    if (esComida(tipoMatStr)) comerAlimento(tipoMatStr);
                    return;
                }
                if (!tipoMatStr) return;

                let cx, cy, cz;
                if (idBajoClic === 7) {
                    cx = vx; cy = vy; cz = vz;
                } else {
                    let pConsOffset = hit.point.clone().add(normal.clone().multiplyScalar(0.01));
                    cx = Math.floor(pConsOffset.x + 0.5); 
                    cy = Math.floor(pConsOffset.y + 0.5); 
                    cz = Math.floor(pConsOffset.z + 0.5);
                }

                if (inventarioRecursos[tipoMatStr] > 0) {
                    let camPos = controls.getObject().position;
                    if (!colisionaConCajaJugador(cx, cy, cz, camPos.x, camPos.y, camPos.z)) {
                        let idAsignar = 1; 
                        if (tipoMatStr === 'tierra') idAsignar = 2; 
                        else if (tipoMatStr === 'tronco') idAsignar = 6;
                        else if (tipoMatStr === 'tablon') idAsignar = 8;
                        else if (tipoMatStr === 'mesacra') idAsignar = 10;
                        else if (tipoMatStr === 'roca') idAsignar = 12;
                        else if (tipoMatStr === 'lana') idAsignar = 21;
                        else if (tipoMatStr === 'cofre') {
                            // Frente en la dirección a la que mira el jugador
                            let dir = new THREE.Vector3();
                            camera.getWorldDirection(dir);
                            dir.y = 0;
                            dir.normalize();
                            if (Math.abs(dir.x) > Math.abs(dir.z)) {
                                // Mira en X → frente en +X o -X
                                idAsignar = (dir.x > 0) ? 24 : 25; // 24=+X | 25=-X
                            } else {
                                // Mira en Z → frente en +Z o -Z
                                idAsignar = (dir.z > 0) ? 22 : 23; // 22=+Z | 23=-Z
                            }
                        }
                        else if (tipoMatStr === 'horno') {
                            // Orientar el frente del horno hacia el jugador
                            let dir = new THREE.Vector3();
                            camera.getWorldDirection(dir);
                            dir.y = 0;
                            dir.normalize();

                            // Elegir el eje dominante
                            if (Math.abs(dir.x) > Math.abs(dir.z)) {
                                // Mira más en X
                                idAsignar = (dir.x > 0) ? 16 : 15; // 16 = frente -X | 15 = frente +X
                            } else {
                                // Mira más en Z
                                idAsignar = (dir.z > 0) ? 14 : 13; // 14 = frente -Z | 13 = frente +Z
                            }
                        }

                        establecerIdVoxel(cx, cy, cz, idAsignar);
                        if (tipoMatStr === 'cofre') {
                            asegurarCofre(cx, cy, cz);
                        }
                        if (tipoMatStr === 'horno') {
                            obtenerDatosHorno(cx, cy, cz);
                        }
                        reconstruirMallaMundo();
                        inventarioRecursos[tipoMatStr]--;
                        limpiarSlotSiVacio(tipoMatStr);
                        actualizarUIInventario();
                    }
                }
            }
        }
    });

    window.addEventListener('mouseup', (e) => { if (e.button === 0) cancelarRuptura(); });
    window.addEventListener('contextmenu', e => e.preventDefault());

    // Colocar al jugador en el suelo (nuevo mundo o posición inválida)
    if (esMundoNuevo || !datosCargados) {
        encontrarSpawnSeguro();
    } else {
        // Asegurar que no quede dentro de un bloque
        let safety = 0;
        while (colisionaConCajaJugadorPuro(camera.position.x, camera.position.y, camera.position.z) && safety < 40) {
            camera.position.y += 0.5;
            safety++;
        }
        // Si sigue muy alto en el aire sin suelo cerca, bajar al suelo
        if (!colisionaConCajaJugadorPuro(camera.position.x, camera.position.y - 2.5, camera.position.z)) {
            // comprobar si hay suelo debajo en un rango razonable
            let haySuelo = false;
            for (let dy = 1; dy < 8; dy++) {
                if (colisionaConCajaJugadorPuro(camera.position.x, camera.position.y - dy, camera.position.z)) {
                    haySuelo = true;
                    break;
                }
            }
            if (!haySuelo) {
                colocarJugadorEnSuelo(Math.floor(camera.position.x), Math.floor(camera.position.z));
            }
        }
    }

    actualizarUIInventario();
    actualizarUIVida();
    actualizarUIHambre();
    actualizarUIAire(false);
    actualizarCicloDiaNoche(0); // aplicar cielo inicial
    // Sistema de mobs
    if (window.MateCraftMobs) {
        MateCraftMobs.init({
            scene,
            THREE,
            obtenerIdVoxel,
            tamMundoY,
            inventarioRecursos,
            actualizarUIInventario,
            anadirItem
        });
        if (datosCargados && Array.isArray(datosCargados.mobs) && datosCargados.mobs.length > 0) {
            MateCraftMobs.load(datosCargados.mobs);
        }
        // Siempre completar mínimos (mundos viejos sin vacas, o spawn fallido)
        MateCraftMobs.setPoblacion(
            { pollo: 6, cerdo: 5, vaca: 4, oveja: 5 },
            { pollo: 8, cerdo: 7, vaca: 6, oveja: 7 },
            55
        );
        MateCraftMobs.asegurarMinimos({ pollo: 6, cerdo: 5, vaca: 4, oveja: 5 }, 55);
    }

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
    animate();
}




function itemBarraActual() {
    let tp = barraSlots[materialSeleccionadoIndex];
    if (!tp || !inventarioRecursos[tp] || inventarioRecursos[tp] <= 0) return null;
    return tp;
}

/** Suma ítems y, si no están en la barra, los pone en el primer hueco libre */
function limpiarSlotsVacios() {
    for (let i = 0; i < BARRA_SIZE; i++) {
        const tp = barraSlots[i];
        if (tp && (!(tp in inventarioRecursos) || inventarioRecursos[tp] <= 0)) barraSlots[i] = null;
    }
    for (let i = 0; i < INV_SIZE; i++) {
        const tp = invSlots[i];
        if (tp && (!(tp in inventarioRecursos) || inventarioRecursos[tp] <= 0)) invSlots[i] = null;
    }
}

function anadirItem(tipo, cant) {
    cant = (cant == null ? 1 : cant) | 0;
    if (!tipo || cant === 0) return;
    // Crear clave si no existía (drops nuevos, mods, etc.)
    if (inventarioRecursos[tipo] === undefined) {
        inventarioRecursos[tipo] = 0;
    }
    inventarioRecursos[tipo] += cant;
    if (inventarioRecursos[tipo] < 0) inventarioRecursos[tipo] = 0;

    limpiarSlotsVacios();

    if (inventarioRecursos[tipo] <= 0) {
        for (let i = 0; i < BARRA_SIZE; i++) if (barraSlots[i] === tipo) barraSlots[i] = null;
        for (let i = 0; i < INV_SIZE; i++) if (invSlots[i] === tipo) invSlots[i] = null;
        actualizarUIInventario();
        return;
    }

    // Si ya está en barra o inventario, solo actualizar cantidad en UI
    if (barraSlots.includes(tipo) || invSlots.includes(tipo)) {
        actualizarUIInventario();
        return;
    }

    // Colocar en primer hueco libre (barra prioritaria)
    let bi = barraSlots.findIndex(s => !s);
    if (bi >= 0) {
        barraSlots[bi] = tipo;
        actualizarUIInventario();
        return;
    }
    let ii = invSlots.findIndex(s => !s);
    if (ii >= 0) {
        invSlots[ii] = tipo;
        actualizarUIInventario();
        return;
    }

    // Inventario lleno: igual se suma la cantidad (queda “en el total”)
    // Intentar empujar a un slot de inv sobrescribiendo uno vacío ya limpio falló:
    // avisar en consola; el jugador puede liberar espacio
    console.warn('[Inventario] Lleno; ítem guardado en total pero sin casilla libre:', tipo, 'x' + cant);
    actualizarUIInventario();
}

/** Obtiene el tipo real desde dataTransfer (tipo | barra:i | inv:i) */
function resolverDragTipo(data) {
    if (!data) return null;
    if (data.indexOf('barra:') === 0) {
        let i = parseInt(data.split(':')[1], 10);
        return (!isNaN(i) && barraSlots[i]) ? barraSlots[i] : null;
    }
    if (data.indexOf('inv:') === 0) {
        let i = parseInt(data.split(':')[1], 10);
        return (!isNaN(i) && invSlots[i]) ? invSlots[i] : null;
    }
    return data;
}

var HERRAMIENTAS = new Set(['picm','picp','hachm','hachp','espm','espp','palam','palap','palito']);

/** Dibuja barra + inventario en un contenedor (horno, cofre, etc.) */
function renderSlotsJugador(container, opts) {
    opts = opts || {};
    if (!container) return;
    container.innerHTML = '';
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(9, 48px)';
    container.style.gap = '5px';
    container.style.maxHeight = '200px';
    container.style.overflowY = 'auto';
    container.style.padding = '6px';
    container.style.background = 'rgba(0,0,0,0.3)';
    container.style.borderRadius = '8px';

    function add(origen, index, tipo) {
        if (!tipo || !inventarioRecursos[tipo] || inventarioRecursos[tipo] <= 0) return;
        let slot = document.createElement('div');
        slot.className = opts.slotClass || 'slot';
        slot.style.width = '48px';
        slot.style.height = '48px';
        slot.style.backgroundSize = 'cover';
        slot.style.backgroundPosition = 'center';
        slot.style.imageRendering = 'pixelated';
        slot.style.cursor = 'grab';
        slot.style.border = '2px solid #777';
        slot.style.borderRadius = '4px';
        slot.style.display = 'flex';
        slot.style.flexDirection = 'column';
        slot.style.justifyContent = 'flex-end';
        slot.style.alignItems = 'center';
        if (texturasIconos[tipo]) slot.style.backgroundImage = "url('texturas/" + texturasIconos[tipo] + "')";
        slot.draggable = true;
        slot.ondragstart = (ev) => {
            ev.dataTransfer.setData('text/plain', origen + ':' + index);
        };
        if (typeof opts.onClickTipo === 'function') {
            slot.onclick = () => opts.onClickTipo(tipo);
        }
        let span = document.createElement('span');
        span.style.background = 'rgba(0,0,0,0.65)';
        span.style.width = '100%';
        span.style.textAlign = 'center';
        span.style.fontSize = '11px';
        span.style.color = '#ffeb3b';
        span.innerText = inventarioRecursos[tipo];
        slot.appendChild(span);
        container.appendChild(slot);
    }
    for (let i = 0; i < BARRA_SIZE; i++) add('barra', i, barraSlots[i]);
    for (let i = 0; i < INV_SIZE; i++) add('inv', i, invSlots[i]);
}

function limpiarSlotSiVacio(tipo) {
    if (!tipo || inventarioRecursos[tipo] > 0) return;
    for (let i = 0; i < BARRA_SIZE; i++) if (barraSlots[i] === tipo) barraSlots[i] = null;
    for (let i = 0; i < INV_SIZE; i++) if (invSlots[i] === tipo) invSlots[i] = null;
}


function actualizarUIBarraEnInventario() {
    let grid = document.getElementById('barra-inventario-grid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 0; i < BARRA_SIZE; i++) {
        let slot = document.createElement('div');
        slot.className = 'slot-barra-inv' + (i === materialSeleccionadoIndex ? ' activo-barra' : '');
        let num = document.createElement('span');
        num.className = 'num-slot';
        num.innerText = (i + 1) <= 9 ? String(i + 1) : (i === 9 ? '0' : '');
        slot.appendChild(num);
        let tipo = barraSlots[i];
        let cant = (tipo && inventarioRecursos[tipo]) ? inventarioRecursos[tipo] : 0;
        if (tipo && cant > 0 && texturasIconos[tipo]) {
            slot.style.backgroundImage = "url('texturas/" + texturasIconos[tipo] + "')";
            let span = document.createElement('span');
            span.innerText = cant;
            slot.appendChild(span);
        }
        slot.draggable = true;
        slot.ondragstart = (ev) => {
            ev.dataTransfer.setData('text/plain', 'barra:' + i);
        };
        slot.ondragover = permitirSoltar;
        slot.ondrop = (ev) => soltarEnSlotBarra(ev, i);
        slot.onclick = (ev) => {
            // Clic simple: seleccionar; doble lógica: si shift o segundo - quitar
            if (ev.detail >= 2) {
                barraSlots[i] = null;
                actualizarUIInventario();
                actualizarUIBarraEnInventario();
            } else {
                materialSeleccionadoIndex = i;
                actualizarUIInventario();
                actualizarUIBarraEnInventario();
            }
        };
        slot.title = 'Arrastra ítems · Doble clic quita de la barra';
        grid.appendChild(slot);
    }
}

function soltarEnSlotBarra(ev, indexDestino) {
    ev.preventDefault();
    let data = ev.dataTransfer.getData('text/plain');
    if (!data) return;
    if (data.indexOf('barra:') === 0) {
        let idxOrigen = parseInt(data.split(':')[1], 10);
        if (isNaN(idxOrigen) || idxOrigen === indexDestino) return;
        let tmp = barraSlots[indexDestino];
        barraSlots[indexDestino] = barraSlots[idxOrigen];
        barraSlots[idxOrigen] = tmp;
    } else if (data.indexOf('inv:') === 0) {
        let idxOrigen = parseInt(data.split(':')[1], 10);
        if (isNaN(idxOrigen)) return;
        let tipo = invSlots[idxOrigen];
        if (!tipo) return;
        // Intercambiar barra <-> inv
        let tmp = barraSlots[indexDestino];
        barraSlots[indexDestino] = tipo;
        invSlots[idxOrigen] = tmp;
    } else {
        let tipo = data;
        if (!inventarioRecursos[tipo] || inventarioRecursos[tipo] <= 0) return;
        for (let j = 0; j < BARRA_SIZE; j++) if (barraSlots[j] === tipo) barraSlots[j] = null;
        for (let j = 0; j < INV_SIZE; j++) if (invSlots[j] === tipo) invSlots[j] = null;
        barraSlots[indexDestino] = tipo;
    }
    actualizarUIInventario();
    if (inventarioAbierto) actualizarUICrafteo();
}

function soltarEnSlotInv(ev, indexDestino) {
    ev.preventDefault();
    let data = ev.dataTransfer.getData('text/plain');
    if (!data) return;
    if (data.indexOf('inv:') === 0) {
        let idxOrigen = parseInt(data.split(':')[1], 10);
        if (isNaN(idxOrigen) || idxOrigen === indexDestino) return;
        let tmp = invSlots[indexDestino];
        invSlots[indexDestino] = invSlots[idxOrigen];
        invSlots[idxOrigen] = tmp;
    } else if (data.indexOf('barra:') === 0) {
        let idxOrigen = parseInt(data.split(':')[1], 10);
        if (isNaN(idxOrigen)) return;
        let tipo = barraSlots[idxOrigen];
        if (!tipo) return;
        let tmp = invSlots[indexDestino];
        invSlots[indexDestino] = tipo;
        barraSlots[idxOrigen] = tmp;
    } else {
        let tipo = data;
        if (!inventarioRecursos[tipo] || inventarioRecursos[tipo] <= 0) return;
        for (let j = 0; j < BARRA_SIZE; j++) if (barraSlots[j] === tipo) barraSlots[j] = null;
        for (let j = 0; j < INV_SIZE; j++) if (invSlots[j] === tipo) invSlots[j] = null;
        invSlots[indexDestino] = tipo;
    }
    actualizarUIInventario();
    if (inventarioAbierto) actualizarUICrafteo();
}

function claveCofre(x, y, z) { return x + ',' + y + ',' + z; }

function asegurarCofre(x, y, z) {
    let k = claveCofre(x, y, z);
    if (!cofresData[k]) {
        cofresData[k] = { slots: new Array(COFRE_SLOTS).fill(null) };
    } else if (!Array.isArray(cofresData[k].slots)) {
        cofresData[k].slots = new Array(COFRE_SLOTS).fill(null);
    } else if (cofresData[k].slots.length < COFRE_SLOTS) {
        while (cofresData[k].slots.length < COFRE_SLOTS) cofresData[k].slots.push(null);
    }
    return cofresData[k];
}

function abrirCofre(x, y, z) {
    if (inventarioAbierto) toggleInventario(false);
    if (hornoAbierto) cerrarHorno();
    cofreAbierto = true;
    cofreActualPos = { x, y, z };
    asegurarCofre(x, y, z);
    document.getElementById('pantalla-cofre').style.display = 'flex';
    controls.unlock();
    actualizarUICofre();
}

function cerrarCofre() {
    cofreAbierto = false;
    cofreActualPos = null;
    document.getElementById('pantalla-cofre').style.display = 'none';
    if (!inventarioAbierto && !hornoAbierto) controls.lock();
}

function actualizarUICofre() {
    if (!cofreActualPos) return;
    let datos = asegurarCofre(cofreActualPos.x, cofreActualPos.y, cofreActualPos.z);
    let grid = document.getElementById('cofre-slots');
    grid.innerHTML = '';
    for (let i = 0; i < COFRE_SLOTS; i++) {
        let slot = document.createElement('div');
        slot.className = 'slot-cofre';
        slot.dataset.index = i;
        let s = datos.slots[i];
        if (s && s.tipo && s.cant > 0) {
            if (texturasIconos[s.tipo]) slot.style.backgroundImage = "url('texturas/" + texturasIconos[s.tipo] + "')";
            let span = document.createElement('span');
            span.innerText = s.cant;
            slot.appendChild(span);
        }
        slot.ondragover = permitirSoltar;
        slot.ondrop = (ev) => soltarEnCofre(ev, i);
        slot.onclick = () => sacarDeCofre(i);
        grid.appendChild(slot);
    }
    renderSlotsJugador(document.getElementById('cofre-inv-grid'), {
        slotClass: 'slot-cofre',
        onClickTipo: meterEnCofre
    });
}

        /** Mueve 1 ítem del inventario al cofre (primer stack del mismo tipo o slot vacío) */
function meterEnCofre(tipo) {
    if (!cofreActualPos) return;
    if (!tipo || !inventarioRecursos[tipo] || inventarioRecursos[tipo] <= 0) return;
    let datos = asegurarCofre(cofreActualPos.x, cofreActualPos.y, cofreActualPos.z);
    let idx = -1;
    for (let i = 0; i < COFRE_SLOTS; i++) {
        let s = datos.slots[i];
        if (s && s.tipo === tipo && s.cant > 0) { idx = i; break; }
    }
    if (idx < 0) {
        for (let i = 0; i < COFRE_SLOTS; i++) {
            let s = datos.slots[i];
            if (!s || !s.tipo || s.cant <= 0) { idx = i; break; }
        }
    }
    if (idx < 0) return; // cofre lleno
    let s = datos.slots[idx];
    if (s && s.tipo === tipo) s.cant++;
    else datos.slots[idx] = { tipo: tipo, cant: 1 };
    inventarioRecursos[tipo]--;
    if (inventarioRecursos[tipo] < 0) inventarioRecursos[tipo] = 0;
    actualizarUIInventario();
    actualizarUICofre();
}

function soltarEnCofre(ev, index) {
    ev.preventDefault();
    if (!cofreActualPos) return;
    let tipo = resolverDragTipo(ev.dataTransfer.getData('text/plain'));
    if (!tipo || !inventarioRecursos[tipo] || inventarioRecursos[tipo] <= 0) return;
    let datos = asegurarCofre(cofreActualPos.x, cofreActualPos.y, cofreActualPos.z);
    let s = datos.slots[index];
    if (s && s.tipo === tipo) {
        s.cant++;
        inventarioRecursos[tipo]--;
    } else if (!s || !s.tipo || s.cant <= 0) {
        datos.slots[index] = { tipo: tipo, cant: 1 };
        inventarioRecursos[tipo]--;
    } else {
        return; // slot ocupado por otro tipo
    }
    if (inventarioRecursos[tipo] < 0) inventarioRecursos[tipo] = 0;
    actualizarUIInventario();
    actualizarUICofre();
}

function sacarDeCofre(index) {
    if (!cofreActualPos) return;
    let datos = asegurarCofre(cofreActualPos.x, cofreActualPos.y, cofreActualPos.z);
    let s = datos.slots[index];
    if (!s || !s.tipo || s.cant <= 0) return;
    if (inventarioRecursos[s.tipo] === undefined) return;
    // Sacar de uno en uno
    anadirItem(s.tipo, 1);
    s.cant--;
    if (s.cant <= 0) datos.slots[index] = null;
    actualizarUICofre();
}

function toggleInventario(esMesa3x3) {
    inventarioAbierto = !inventarioAbierto;
    let pantalla = document.getElementById('pantalla-inventario');
    
    if (inventarioAbierto) {
        modoMesa3x3 = esMesa3x3;
        let tamGrilla = modoMesa3x3 ? 9 : 4;
        grillaCrafteo = new Array(tamGrilla).fill(null);
        
        document.getElementById('titulo-panel-inventario').innerText = modoMesa3x3 ? "MESA DE CRAFTEO (3x3)" : "INVENTARIO Y CRAFTEO (2x2)";
        
        pantalla.style.display = 'flex';
        controls.unlock();
        document.getElementById('bloqueo-pantalla').style.display = 'none';
        actualizarUICrafteo();
    } else {
        grillaCrafteo.forEach(item => {
            if (item) inventarioRecursos[item]++;
        });
        grillaCrafteo = new Array(4).fill(null);
        pantalla.style.display = 'none';
        controls.lock();
        actualizarUIInventario();
    }
}

function cancelarRuptura() {
    estaRompiendo = false; objetivoRompiendoPos = null; tiempoRompiendo = 0;
    let c = document.getElementById('barra-romper-container'); if (c) c.style.display = 'none';
}

function actualizarUIInventario() {
    // La barra y el inventario general son exclusivos (un tipo no aparece en ambos)
    materialesDisponiblesEnBarra = barraSlots.map(tp => (tp && inventarioRecursos[tp] > 0) ? tp : null);

    if (materialSeleccionadoIndex < 0) materialSeleccionadoIndex = 0;
    if (materialSeleccionadoIndex >= BARRA_SIZE) materialSeleccionadoIndex = BARRA_SIZE - 1;

    let contenedor = document.getElementById('inventario');
    contenedor.innerHTML = '';
    for (let index = 0; index < BARRA_SIZE; index++) {
        let tipo = barraSlots[index];
        let slot = document.createElement('div');
        slot.className = 'slot' + (index === materialSeleccionadoIndex ? ' activo' : '');
        let cant = (tipo && inventarioRecursos[tipo]) ? inventarioRecursos[tipo] : 0;
        if (tipo && cant > 0 && texturasIconos[tipo]) {
            slot.style.backgroundImage = "url('texturas/" + texturasIconos[tipo] + "')";
        }
        slot.onclick = () => { materialSeleccionadoIndex = index; actualizarUIInventario(); };
        let span = document.createElement('span');
        span.innerText = cant > 0 ? cant : '';
        slot.appendChild(span);
        contenedor.appendChild(slot);
    }
    if (inventarioAbierto) actualizarUICrafteo();
}

function permitirSoltar(ev) { ev.preventDefault(); }
function iniciarArrastre(ev, tipo) { ev.dataTransfer.setData("text/plain", tipo); }

function tirarABasura(ev) {
    ev.preventDefault();
    let data = ev.dataTransfer.getData("text/plain");
    let tipo = resolverDragTipo(data);
    if (!tipo || !inventarioRecursos[tipo] || inventarioRecursos[tipo] <= 0) return;
    inventarioRecursos[tipo]--;
    if (inventarioRecursos[tipo] < 0) inventarioRecursos[tipo] = 0;
    if (inventarioRecursos[tipo] <= 0) {
        for (let i = 0; i < BARRA_SIZE; i++) if (barraSlots[i] === tipo) barraSlots[i] = null;
        for (let i = 0; i < INV_SIZE; i++) if (invSlots[i] === tipo) invSlots[i] = null;
    }
    actualizarUIInventario();
    if (inventarioAbierto) actualizarUICrafteo();
}

function soltarEnCrafteo(ev, indexGrilla) {
    ev.preventDefault();
    let data = ev.dataTransfer.getData("text/plain");
    let tipo = resolverDragTipo(data);
    if (tipo && inventarioRecursos[tipo] > 0) {
        inventarioRecursos[tipo]--;
        if (inventarioRecursos[tipo] <= 0) {
            for (let i = 0; i < BARRA_SIZE; i++) if (barraSlots[i] === tipo) barraSlots[i] = null;
            for (let i = 0; i < INV_SIZE; i++) if (invSlots[i] === tipo) invSlots[i] = null;
        }
        grillaCrafteo[indexGrilla] = tipo;
        actualizarUIInventario();
        if (inventarioAbierto) actualizarUICrafteo();
    }
}

function evaluarRecetaCrafteo() {
    let g = grillaCrafteo;
    
    if (!modoMesa3x3) {
        let tablonCount = g.filter(item => item === 'tablon').length;
        let totalOcupados = g.filter(item => item !== null).length;
        
        if (tablonCount === 4 && totalOcupados === 4) {
            return { resultado: 'mesacra', cantidad: 1 };
        }
        let troncosEnGrilla = g.filter(item => item === 'tronco').length;
        let otrosItems = g.filter(item => item !== null && item !== 'tronco').length;
        if (otrosItems === 0 && troncosEnGrilla > 0) {
            return { resultado: 'tablon', cantidad: troncosEnGrilla * 4 };
        }
        if (tablonCount === 2 && totalOcupados === 2) {
            if ((g[0] === 'tablon' && g[2] === 'tablon' && g[1] === null && g[3] === null) ||
                (g[1] === 'tablon' && g[3] === 'tablon' && g[0] === null && g[2] === null)) {
                return { resultado: 'palito', cantidad: 4 };
            }
        }
    } else {
        let tablonCount = g.filter(item => item === 'tablon').length;
        let troncoCount = g.filter(item => item === 'tronco').length;
        let palitoCount = g.filter(item => item === 'palito').length;
        let totalOcupados = g.filter(item => item !== null).length;

        if (tablonCount === 4 && totalOcupados === 4 && 
            ((g[0]==='tablon'&&g[1]==='tablon'&&g[3]==='tablon'&&g[4]==='tablon') ||
             (g[1]==='tablon'&&g[2]==='tablon'&&g[4]==='tablon'&&g[5]==='tablon') ||
             (g[3]==='tablon'&&g[4]==='tablon'&&g[6]==='tablon'&&g[7]==='tablon') ||
             (g[4]==='tablon'&&g[5]==='tablon'&&g[7]==='tablon'&&g[8]==='tablon'))) {
            return { resultado: 'mesacra', cantidad: 1 };
        }

        if (troncoCount > 0 && totalOcupados === troncoCount) {
            return { resultado: 'tablon', cantidad: troncoCount * 4 };
        }

        if (tablonCount === 2 && totalOcupados === 2) {
            if ((g[0]==='tablon'&&g[3]==='tablon') || (g[1]==='tablon'&&g[4]==='tablon') || (g[2]==='tablon'&&g[5]==='tablon') ||
                (g[3]==='tablon'&&g[6]==='tablon') || (g[4]==='tablon'&&g[7]==='tablon') || (g[5]==='tablon'&&g[8]==='tablon')) {
                return { resultado: 'palito', cantidad: 4 };
            }
        }

        if (tablonCount === 3 && palitoCount === 2 && totalOcupados === 5) {
            if (g[0]==='tablon' && g[1]==='tablon' && g[2]==='tablon' && g[4]==='palito' && g[7]==='palito') {
                return { resultado: 'picm', cantidad: 1 };
            }
        }

        // Pico de piedra: 3 rocas en la fila superior + 2 palitos en el centro
        let rocaCount = g.filter(item => item === 'roca').length;
        if (rocaCount === 3 && palitoCount === 2 && totalOcupados === 5) {
            if (g[0]==='roca' && g[1]==='roca' && g[2]==='roca' && g[4]==='palito' && g[7]==='palito') {
                return { resultado: 'picp', cantidad: 1 };
            }
        }

        // Horno: 8 rocas en forma de anillo (centro vacío)
        if (rocaCount === 8 && totalOcupados === 8) {
            if (g[0]==='roca' && g[1]==='roca' && g[2]==='roca' &&
                g[3]==='roca' && g[5]==='roca' &&
                g[6]==='roca' && g[7]==='roca' && g[8]==='roca' && g[4] === null) {
                return { resultado: 'horno', cantidad: 1 };
            }
        }

        // Cofre: 8 tablones en anillo (centro vacío)
        if (tablonCount === 8 && totalOcupados === 8) {
            if (g[0]==='tablon' && g[1]==='tablon' && g[2]==='tablon' &&
                g[3]==='tablon' && g[5]==='tablon' &&
                g[6]==='tablon' && g[7]==='tablon' && g[8]==='tablon' && g[4] === null) {
                return { resultado: 'cofre', cantidad: 1 };
            }
        }

        // Hacha madera: 2 tablones forma L invertida + 2 palitos
        //  T T /
        //  T P /
        //    P
        if (tablonCount === 3 && palitoCount === 2 && totalOcupados === 5) {
            if (g[0]==='tablon' && g[1]==='tablon' && g[3]==='tablon' && g[4]==='palito' && g[7]==='palito') {
                return { resultado: 'hachm', cantidad: 1 };
            }
            if (g[1]==='tablon' && g[2]==='tablon' && g[5]==='tablon' && g[4]==='palito' && g[7]==='palito') {
                return { resultado: 'hachm', cantidad: 1 };
            }
        }
        // Hacha piedra
        if (rocaCount === 3 && palitoCount === 2 && totalOcupados === 5) {
            if (g[0]==='roca' && g[1]==='roca' && g[3]==='roca' && g[4]==='palito' && g[7]==='palito') {
                return { resultado: 'hachp', cantidad: 1 };
            }
            if (g[1]==='roca' && g[2]==='roca' && g[5]==='roca' && g[4]==='palito' && g[7]==='palito') {
                return { resultado: 'hachp', cantidad: 1 };
            }
        }
        // Espada madera: 2 tablones vertical + 1 palito
        if (tablonCount === 2 && palitoCount === 1 && totalOcupados === 3) {
            if ((g[1]==='tablon' && g[4]==='tablon' && g[7]==='palito') ||
                (g[0]==='tablon' && g[3]==='tablon' && g[6]==='palito') ||
                (g[2]==='tablon' && g[5]==='tablon' && g[8]==='palito')) {
                return { resultado: 'espm', cantidad: 1 };
            }
        }
        // Espada piedra
        if (rocaCount === 2 && palitoCount === 1 && totalOcupados === 3) {
            if ((g[1]==='roca' && g[4]==='roca' && g[7]==='palito') ||
                (g[0]==='roca' && g[3]==='roca' && g[6]==='palito') ||
                (g[2]==='roca' && g[5]==='roca' && g[8]==='palito')) {
                return { resultado: 'espp', cantidad: 1 };
            }
        }
        // Pala madera: 1 tablón + 2 palitos
        if (tablonCount === 1 && palitoCount === 2 && totalOcupados === 3) {
            if ((g[1]==='tablon' && g[4]==='palito' && g[7]==='palito') ||
                (g[0]==='tablon' && g[3]==='palito' && g[6]==='palito') ||
                (g[2]==='tablon' && g[5]==='palito' && g[8]==='palito')) {
                return { resultado: 'palam', cantidad: 1 };
            }
        }
        // Pala piedra
        if (rocaCount === 1 && palitoCount === 2 && totalOcupados === 3) {
            if ((g[1]==='roca' && g[4]==='palito' && g[7]==='palito') ||
                (g[0]==='roca' && g[3]==='palito' && g[6]==='palito') ||
                (g[2]==='roca' && g[5]==='palito' && g[8]==='palito')) {
                return { resultado: 'palap', cantidad: 1 };
            }
        }
    }

    return { resultado: null, cantidad: 0 };
}

function actualizarUICrafteo() {
    let contenedorGrilla = document.getElementById('contenedor-grilla-crafteo');
    contenedorGrilla.className = modoMesa3x3 ? "cuadros-crafteo-3x3" : "cuadros-crafteo-2x2";
    contenedorGrilla.innerHTML = '';

    for (let i = 0; i < grillaCrafteo.length; i++) {
        let slotDiv = document.createElement('div');
        slotDiv.className = 'slot';
        slotDiv.id = 'craft-' + i;
        slotDiv.ondragover = permitirSoltar;
        slotDiv.ondrop = (ev) => soltarEnCrafteo(ev, i);
        
        let tipoItem = grillaCrafteo[i];
        if (tipoItem) {
            slotDiv.style.backgroundImage = `url('texturas/${texturasIconos[tipoItem]}')`;
            slotDiv.innerHTML = `<span>1</span>`;
        } else {
            slotDiv.style.backgroundImage = 'none';
            slotDiv.innerHTML = '';
        }

        slotDiv.onclick = () => {
            if (tipoItem) {
                inventarioRecursos[tipoItem]++;
                grillaCrafteo[i] = null;
                actualizarUIInventario();
            }
        };

        contenedorGrilla.appendChild(slotDiv);
    }

    let receta = evaluarRecetaCrafteo();
    document.getElementById('craft-res-cant').innerText = receta.cantidad > 0 ? receta.cantidad : '';
    if (receta.resultado) {
        document.getElementById('craft-resultado').style.backgroundImage = `url('texturas/${texturasIconos[receta.resultado]}')`;
    } else {
        document.getElementById('craft-resultado').style.backgroundImage = 'none';
    }

    let gridUsuario = document.getElementById('inventario-completo-grid');
    gridUsuario.innerHTML = '';
    // Casillas fijas del inventario general (como la barra)
    for (let i = 0; i < INV_SIZE; i++) {
        let slot = document.createElement('div');
        slot.className = 'slot-inv';
        let tipo = invSlots[i];
        let cant = (tipo && inventarioRecursos[tipo]) ? inventarioRecursos[tipo] : 0;
        if (tipo && cant > 0 && texturasIconos[tipo]) {
            slot.style.backgroundImage = "url('texturas/" + texturasIconos[tipo] + "')";
            let span = document.createElement('span');
            span.innerText = cant;
            slot.appendChild(span);
        } else if (tipo && cant <= 0) {
            invSlots[i] = null;
        }
        slot.draggable = true;
        slot.ondragstart = (ev) => {
            if (!invSlots[i]) { ev.preventDefault(); return; }
            ev.dataTransfer.setData('text/plain', 'inv:' + i);
        };
        slot.ondragover = permitirSoltar;
        slot.ondrop = (ev) => soltarEnSlotInv(ev, i);
        slot.ondblclick = () => {
            // Doble clic: mover a primer hueco de barra
            if (!invSlots[i]) return;
            let bi = barraSlots.findIndex(s => !s);
            if (bi < 0) return;
            barraSlots[bi] = invSlots[i];
            invSlots[i] = null;
            actualizarUIInventario();
            actualizarUICrafteo();
        };
        slot.title = 'Arrastra a barra / crafteo / horno / cofre · Doble clic → barra';
        gridUsuario.appendChild(slot);
    }
    actualizarUIBarraEnInventario();
}

function reclamarCrafteo() {
    let receta = evaluarRecetaCrafteo();
    if (receta.resultado) {
        anadirItem(receta.resultado, receta.cantidad);
        for (let i = 0; i < grillaCrafteo.length; i++) {
            if (grillaCrafteo[i] !== null) grillaCrafteo[i] = null;
        }
        actualizarUIInventario();
        if (inventarioAbierto) actualizarUICrafteo();
    }
}

// ========== HORNO ==========
// datos: { input: {tipo, cant}|null, fuel: {tipo, cant}|null, output: {tipo, cant}|null, progress, fuelRemaining }

function claveHorno(x, y, z) {
    return x + ',' + y + ',' + z;
}

function obtenerDatosHorno(x, y, z) {
    let k = claveHorno(x, y, z);
    if (!hornosData[k]) {
        hornosData[k] = { input: null, fuel: null, output: null, progress: 0, fuelRemaining: 0 };
    }
    // Migrar datos viejos (sin cantidad) si existen
    let d = hornosData[k];
    if (d.input && typeof d.input === 'string') d.input = { tipo: d.input, cant: 1 };
    if (d.fuel && typeof d.fuel === 'string') d.fuel = { tipo: d.fuel, cant: 1 };
    if (d.output && typeof d.output === 'string') d.output = { tipo: d.output, cant: 1 };
    return d;
}

function abrirHorno(x, y, z) {
    if (inventarioAbierto) toggleInventario(false);
    if (cofreAbierto) cerrarCofre();
    hornoAbierto = true;
    hornoActualPos = { x, y, z };
    document.getElementById('pantalla-horno').style.display = 'flex';
    controls.unlock();
    document.getElementById('bloqueo-pantalla').style.display = 'none';
    actualizarUIHorno();
}

function cerrarHorno() {
    if (!hornoAbierto) return;
    hornoAbierto = false;
    hornoActualPos = null;
    document.getElementById('pantalla-horno').style.display = 'none';
    controls.lock();
    actualizarUIInventario();
}

function soltarEnHorno(ev, slot) {
    ev.preventDefault();
    if (!hornoActualPos) return;
    let tipo = resolverDragTipo(ev.dataTransfer.getData('text/plain'));
    if (!tipo || !inventarioRecursos[tipo] || inventarioRecursos[tipo] <= 0) return;

    let datos = obtenerDatosHorno(hornoActualPos.x, hornoActualPos.y, hornoActualPos.z);

    if (slot === 'input') {
        if (!RECETAS_HORNO[tipo]) return;
        if (datos.input && datos.input.tipo !== tipo) return;
        inventarioRecursos[tipo]--;
        if (!datos.input) {
            datos.input = { tipo: tipo, cant: 1 };
            datos.progress = 0;
        } else {
            datos.input.cant++;
        }
    } else if (slot === 'fuel') {
        if (!COMBUSTIBLES[tipo]) return;
        if (datos.fuel && datos.fuel.tipo !== tipo) return;
        inventarioRecursos[tipo]--;
        if (!datos.fuel) {
            datos.fuel = { tipo: tipo, cant: 1 };
        } else {
            datos.fuel.cant++;
        }
    } else {
        return;
    }
    limpiarSlotSiVacio(tipo);
    actualizarUIHorno();
    actualizarUIInventario();
}

/** Clic desde inventario del panel del horno → meter 1 en entrada o fuel */
function meterEnHornoDesdeInv(tipo) {
    if (!hornoActualPos || !tipo || !inventarioRecursos[tipo] || inventarioRecursos[tipo] <= 0) return;
    let datos = obtenerDatosHorno(hornoActualPos.x, hornoActualPos.y, hornoActualPos.z);
    if (RECETAS_HORNO[tipo]) {
        if (datos.input && datos.input.tipo !== tipo) return;
        inventarioRecursos[tipo]--;
        if (!datos.input) { datos.input = { tipo: tipo, cant: 1 }; datos.progress = 0; }
        else datos.input.cant++;
    } else if (COMBUSTIBLES[tipo]) {
        if (datos.fuel && datos.fuel.tipo !== tipo) return;
        inventarioRecursos[tipo]--;
        if (!datos.fuel) datos.fuel = { tipo: tipo, cant: 1 };
        else datos.fuel.cant++;
    } else {
        return;
    }
    limpiarSlotSiVacio(tipo);
    actualizarUIHorno();
    actualizarUIInventario();
}

function sacarDeHorno(slot) {
    if (!hornoActualPos) return;
    let datos = obtenerDatosHorno(hornoActualPos.x, hornoActualPos.y, hornoActualPos.z);
    if (slot === 'input' && datos.input) {
        anadirItem(datos.input.tipo, datos.input.cant);
        datos.input = null;
        datos.progress = 0;
    } else if (slot === 'fuel' && datos.fuel) {
        anadirItem(datos.fuel.tipo, datos.fuel.cant);
        datos.fuel = null;
    }
    actualizarUIHorno();
}

function reclamarHorno() {
    if (!hornoActualPos) return;
    let datos = obtenerDatosHorno(hornoActualPos.x, hornoActualPos.y, hornoActualPos.z);
    if (datos.output) {
        anadirItem(datos.output.tipo, datos.output.cant);
        datos.output = null;
        actualizarUIHorno();
    }
}

function actualizarUIHorno() {
    if (!hornoActualPos) return;
    let datos = obtenerDatosHorno(hornoActualPos.x, hornoActualPos.y, hornoActualPos.z);

    function pintarSlot(id, stack) {
        let el = document.getElementById(id);
        if (stack && stack.cant > 0) {
            el.style.backgroundImage = `url('texturas/${texturasIconos[stack.tipo]}')`;
            el.innerHTML = '<span>' + stack.cant + '</span>';
        } else {
            el.style.backgroundImage = 'none';
            el.innerHTML = '';
        }
    }

    pintarSlot('horno-input', datos.input);
    pintarSlot('horno-fuel', datos.fuel);
    pintarSlot('horno-output', datos.output);

    let pct = Math.min(datos.progress / TIEMPO_COCCION * 100, 100);
    document.getElementById('barra-horno').style.width = pct + '%';

    renderSlotsJugador(document.getElementById('inventario-horno-grid'), {
        onClickTipo: meterEnHornoDesdeInv
    });
}

// Cambia el bloque del horno a prendido (17-20) o apagado (13-16)
function setHornoPrendido(x, y, z, prendido) {
    let id = obtenerIdVoxel(x, y, z);
    if (id < 13 || id > 20) return;
    let base = (id - 13) % 4; // 0..3
    let nuevoId = prendido ? (17 + base) : (13 + base);
    if (id !== nuevoId) {
        establecerIdVoxel(x, y, z, nuevoId);
        reconstruirMallaMundo();
    }
}

function actualizarHornos(delta) {
    let necesitaRebuild = false;

    for (let k in hornosData) {
        let datos = hornosData[k];
        if (!datos) continue;

        let partes = k.split(',').map(Number);
        let hx = partes[0], hy = partes[1], hz = partes[2];

        // Quemar combustible restante
        if (datos.fuelRemaining > 0) {
            datos.fuelRemaining -= delta;
            if (datos.fuelRemaining < 0) datos.fuelRemaining = 0;
        }

        // Consumir un ítem de fuel si hace falta y hay stack
        if (datos.fuelRemaining <= 0 && datos.fuel && datos.fuel.cant > 0 && COMBUSTIBLES[datos.fuel.tipo]) {
            datos.fuelRemaining = COMBUSTIBLES[datos.fuel.tipo];
            datos.fuel.cant--;
            if (datos.fuel.cant <= 0) datos.fuel = null;
        }

        let tipoInput = datos.input ? datos.input.tipo : null;
        let puedeCocinar = tipoInput && RECETAS_HORNO[tipoInput] && datos.fuelRemaining > 0 && datos.input.cant > 0;
        let resultadoEsperado = tipoInput ? RECETAS_HORNO[tipoInput] : null;

        // ¿El output acepta más del mismo tipo?
        let outputLibre = !datos.output || (datos.output.tipo === resultadoEsperado);

        if (puedeCocinar && outputLibre) {
            datos.progress += delta;
            if (datos.progress >= TIEMPO_COCCION) {
                datos.progress = 0;
                // Añadir al output (apilar)
                if (!datos.output) {
                    datos.output = { tipo: resultadoEsperado, cant: 1 };
                } else {
                    datos.output.cant++;
                }
                // Consumir 1 de input
                datos.input.cant--;
                if (datos.input.cant <= 0) datos.input = null;
            }
        } else {
            if (!puedeCocinar) {
                datos.progress = Math.max(0, datos.progress - delta * 2);
            }
        }

        // Textura prendido / apagado
        let estaPrendido = datos.fuelRemaining > 0;
        let idActual = obtenerIdVoxel(hx, hy, hz);
        if (idActual >= 13 && idActual <= 20) {
            let base = (idActual - 13) % 4;
            let deberiaSer = estaPrendido ? (17 + base) : (13 + base);
            if (idActual !== deberiaSer) {
                establecerIdVoxel(hx, hy, hz, deberiaSer);
                necesitaRebuild = true;
            }
        }
    }

    if (necesitaRebuild) {
        reconstruirMallaMundo();
    }

    if (hornoAbierto) {
        // refrescar barra de progreso sin reconstruir todo cada frame sería ideal;
        // actualizar UI completa ~8 veces/s
        if (!window._ultUiHorno) window._ultUiHorno = 0;
        window._ultUiHorno += delta;
        if (window._ultUiHorno >= 0.12) {
            window._ultUiHorno = 0;
            actualizarUIHorno();
        }
    }
}

function simularPropagacionAgua() {
    let cambiosRealizados = false;
    let listaNuevasAguas = [];

    let desplazamiento = tamMundoXZ / 2;
    for (let x = 0; x < tamMundoXZ; x++) {
        for (let y = 1; y < tamMundoY - 1; y++) {
            for (let z = 0; z < tamMundoXZ; z++) {
                let mx = x - desplazamiento, mz = z - desplazamiento;
                let id = obtenerIdVoxel(mx, y, mz);

                if (id === 7) { 
                    let abajoId = obtenerIdVoxel(mx, y - 1, mz);
                    if (abajoId === 0) {
                        listaNuevasAguas.push({ x: mx, y: y - 1, z: mz });
                    } else {
                        let vecinos = [
                            { x: mx + 1, y: y, z: mz },
                            { x: mx - 1, y: y, z: mz },
                            { x: mx, y: y, z: mz + 1 },
                            { x: mx, y: y, z: mz - 1 }
                        ];

                        vecinos.forEach(v => {
                            if (v.x >= -desplazamiento && v.x < desplazamiento && v.z >= -desplazamiento && v.z < desplazamiento) {
                                let idVecino = obtenerIdVoxel(v.x, v.y, v.z);
                                if (idVecino === 0) {
                                    listaNuevasAguas.push({ x: v.x, y: v.y, z: v.z });
                                }
                            }
                        });
                    }
                }
            }
        }
    }

    if (listaNuevasAguas.length > 0) {
        let maxExpansiones = Math.min(listaNuevasAguas.length, 150);
        for (let i = 0; i < maxExpansiones; i++) {
            let pos = listaNuevasAguas[i];
            if (obtenerIdVoxel(pos.x, pos.y, pos.z) === 0) {
                establecerIdVoxel(pos.x, pos.y, pos.z, 7);
                cambiosRealizados = true;
            }
        }
        if (cambiosRealizados) {
            reconstruirMallaMundo();
        }
    }
}

function reconstruirMallaMundo() {
    if (meshMundo) {
        scene.remove(meshMundo);
        meshMundo.geometry.dispose();
    }

    const geometry = new THREE.BufferGeometry();
    let posPorMaterial = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [], 10: [], 11: [], 12: [], 13: [], 14: [], 15: [], 16: [], 17: [], 18: [], 19: [] };
    let uvPorMaterial = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [], 10: [], 11: [], 12: [], 13: [], 14: [], 15: [], 16: [], 17: [], 18: [], 19: [] };
    let indicesPorMaterial = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [], 10: [], 11: [], 12: [], 13: [], 14: [], 15: [], 16: [], 17: [], 18: [], 19: [] };
    let indicesOffset = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0, 15: 0, 16: 0, 17: 0, 18: 0, 19: 0 };

    let desplazamiento = tamMundoXZ / 2;

    for (let x = 0; x < tamMundoXZ; x++) {
        for (let y = 0; y < tamMundoY; y++) {
            for (let z = 0; z < tamMundoXZ; z++) {
                let mx = x - desplazamiento, my = y, mz = z - desplazamiento;
                let id = obtenerIdVoxel(mx, my, mz);
                if (id === 0) continue;

                let vecinos = {
                    px: obtenerIdVoxel(mx + 1, my, mz),
                    nx: obtenerIdVoxel(mx - 1, my, mz),
                    py: obtenerIdVoxel(mx, my + 1, mz),
                    ny: obtenerIdVoxel(mx, my - 1, mz),
                    pz: obtenerIdVoxel(mx, my, mz + 1),
                    nz: obtenerIdVoxel(mx, my, mz - 1)
                };

                if (id === 7) { 
                    if (vecinos.px !== 7) agregarCaraBloque(id, 'px', mx, my, mz);
                    if (vecinos.nx !== 7) agregarCaraBloque(id, 'nx', mx, my, mz);
                    if (vecinos.py !== 7) agregarCaraBloque(id, 'py', mx, my, mz);
                    if (vecinos.ny !== 7) agregarCaraBloque(id, 'ny', mx, my, mz);
                    if (vecinos.pz !== 7) agregarCaraBloque(id, 'pz', mx, my, mz);
                    if (vecinos.nz !== 7) agregarCaraBloque(id, 'nz', mx, my, mz);
                } else {
                    if (vecinos.px === 0 || (vecinos.px === 4 && id !== 4) || vecinos.px === 7) agregarCaraBloque(id, 'px', mx, my, mz);
                    if (vecinos.nx === 0 || (vecinos.nx === 4 && id !== 4) || vecinos.nx === 7) agregarCaraBloque(id, 'nx', mx, my, mz);
                    if (vecinos.py === 0 || (vecinos.py === 4 && id !== 4) || vecinos.py === 7) agregarCaraBloque(id, 'py', mx, my, mz);
                    if (vecinos.ny === 0 || (vecinos.ny === 4 && id !== 4) || vecinos.ny === 7) agregarCaraBloque(id, 'ny', mx, my, mz);
                    if (vecinos.pz === 0 || (vecinos.pz === 4 && id !== 4) || vecinos.pz === 7) agregarCaraBloque(id, 'pz', mx, my, mz);
                    if (vecinos.nz === 0 || (vecinos.nz === 4 && id !== 4) || vecinos.nz === 7) agregarCaraBloque(id, 'nz', mx, my, mz);
                }
            }
        }
    }

    function agregarCaraBloque(id, cara, x, y, z) {
        let matSubId = 0;
        if (id === 1) matSubId = 0; 
        else if (id === 2) matSubId = 1; 
        else if (id === 3) {
            if (cara === 'py') matSubId = 3;
            else if (cara === 'ny') matSubId = 1;
            else matSubId = 2;
        }
        else if (id === 4) matSubId = 4; 
        else if (id === 5) matSubId = 5; 
        else if (id === 6) {
            if (cara === 'py' || cara === 'ny') matSubId = 7;
            else matSubId = 6;
        }
        else if (id === 7) matSubId = 8; 
        else if (id === 8) matSubId = 9; 
        else if (id === 10) { 
            if (cara === 'py') matSubId = 10;      
            else if (cara === 'ny') matSubId = 9;    
            else matSubId = 11;                      
        }
        else if (id === 12) matSubId = 12; // Cobblestone
        else if (id === 21) matSubId = 16; // Lana
        else if (id >= 22 && id <= 25) { // Cofre orientado: 22=+Z, 23=-Z, 24=+X, 25=-X
            let base = id - 22; // 0,1,2,3
            let esFrente = false;
            if (base === 0 && cara === 'pz') esFrente = true;
            else if (base === 1 && cara === 'nz') esFrente = true;
            else if (base === 2 && cara === 'px') esFrente = true;
            else if (base === 3 && cara === 'nx') esFrente = true;

            if (esFrente) matSubId = 17;          // cof.png
            else if (cara === 'py') matSubId = 19; // cofa.png arriba
            else if (cara === 'ny') matSubId = 9;  // tablón abajo
            else matSubId = 18;                   // cofl.png lados
        }
        else if (id >= 13 && id <= 20) { // Horno (apagado 13-16 | prendido 17-20)
            // Orientación: 13/17=+Z, 14/18=-Z, 15/19=+X, 16/20=-X
            let base = ((id - 13) % 4); // 0,1,2,3
            let prendido = id >= 17;
            let esFrente = false;
            if (base === 0 && cara === 'pz') esFrente = true;
            else if (base === 1 && cara === 'nz') esFrente = true;
            else if (base === 2 && cara === 'px') esFrente = true;
            else if (base === 3 && cara === 'nx') esFrente = true;

            if (esFrente) {
                matSubId = prendido ? 15 : 13; // hore.png o hora.png
            } else if (cara === 'py' || cara === 'ny') {
                matSubId = 12;               // roc.png
            } else {
                matSubId = 14;               // horl.png
            }
        }

        let p = [
            [x-0.5, y-0.5, z+0.5], [x+0.5, y-0.5, z+0.5], [x+0.5, y+0.5, z+0.5], [x-0.5, y+0.5, z+0.5],
            [x+0.5, y-0.5, z-0.5], [x-0.5, y-0.5, z-0.5], [x-0.5, y+0.5, z-0.5], [x+0.5, y+0.5, z-0.5],
            [x-0.5, y+0.5, z-0.5], [x-0.5, y+0.5, z+0.5], [x+0.5, y+0.5, z+0.5], [x+0.5, y+0.5, z-0.5],
            [x-0.5, y-0.5, z+0.5], [x-0.5, y-0.5, z-0.5], [x+0.5, y-0.5, z-0.5], [x+0.5, y-0.5, z+0.5],
            [x+0.5, y-0.5, z+0.5], [x+0.5, y-0.5, z-0.5], [x+0.5, y+0.5, z-0.5], [x+0.5, y+0.5, z+0.5],
            [x-0.5, y-0.5, z-0.5], [x-0.5, y-0.5, z+0.5], [x-0.5, y+0.5, z+0.5], [x-0.5, y+0.5, z-0.5]
        ];

        let verticesCara;
        if (cara === 'nz') verticesCara = [p[4], p[5], p[6], p[7]];
        if (cara === 'pz') verticesCara = [p[0], p[1], p[2], p[3]];
        if (cara === 'py') verticesCara = [p[8], p[9], p[10], p[11]];
        if (cara === 'ny') verticesCara = [p[12], p[13], p[14], p[15]];
        if (cara === 'px') verticesCara = [p[16], p[17], p[18], p[19]];
        if (cara === 'nx') verticesCara = [p[20], p[21], p[22], p[23]];

        let pArr = posPorMaterial[matSubId];
        for(let i = 0; i < verticesCara.length; i++) {
            pArr.push(verticesCara[i][0], verticesCara[i][1], verticesCara[i][2]);
        }

        let uvArr = uvPorMaterial[matSubId];
        uvArr.push(0,0, 1,0, 1,1, 0,1);

        let idx = indicesOffset[matSubId];
        let indArr = indicesPorMaterial[matSubId];
        indArr.push(idx, idx+1, idx+2, idx, idx+2, idx+3);
        indicesOffset[matSubId] += 4;
    }

    let posicionesTotales = [];
    let uvsTotales = [];
    let indicesTotales = [];
    let offsetGlobal = 0;
    let gruposMateriales = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

    gruposMateriales.forEach((mId, indexMaterial) => {
        let pos = posPorMaterial[mId];
        if (pos.length > 0) {
            let inicioIndice = indicesTotales.length;
            
            for(let i = 0; i < pos.length; i++) posicionesTotales.push(pos[i]);
            let uvs = uvPorMaterial[mId];
            for(let i = 0; i < uvs.length; i++) uvsTotales.push(uvs[i]);
            
            let inds = indicesPorMaterial[mId];
            for(let i = 0; i < inds.length; i++) {
                indicesTotales.push(inds[i] + offsetGlobal);
            }
            
            offsetGlobal += pos.length / 3;
            geometry.addGroup(inicioIndice, inds.length, indexMaterial);
        }
    });

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(posicionesTotales, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvsTotales, 2));
    geometry.setIndex(indicesTotales);
    geometry.computeVertexNormals();

    meshMundo = new THREE.Mesh(geometry, materialesMundo);
    scene.add(meshMundo);
}

function estaEnAgua(px, py, pz) {
    let idBajoOjos = obtenerIdVoxel(px, py - 0.5, pz);
    let idPies = obtenerIdVoxel(px, py - 1.2, pz);
    return idBajoOjos === 7 || idPies === 7;
}

function cabezaEnAgua(px, py, pz) {
    // Nivel de los ojos
    return obtenerIdVoxel(px, py - 0.15, pz) === 7;
}

function actualizarUIVida() {
    const cont = document.getElementById('barra-vida');
    if (!cont) return;
    cont.innerHTML = '';
    for (let i = 0; i < 10; i++) {
        const v = vidaJugador - i * 2;
        const d = document.createElement('div');
        d.className = 'corazon ' + (v >= 2 ? 'lleno' : (v >= 1 ? 'medio' : 'vacio'));
        cont.appendChild(d);
    }
}

function actualizarUIAire(mostrar) {
    const cont = document.getElementById('barra-aire');
    if (!cont) return;
    if (!mostrar) {
        cont.style.display = 'none';
        return;
    }
    cont.style.display = 'flex';
    cont.innerHTML = '';
    const llenas = Math.ceil(aireJugador);
    for (let i = 0; i < 10; i++) {
        const d = document.createElement('div');
        d.className = 'burbuja ' + (i < llenas ? 'llena' : 'vacia');
        cont.appendChild(d);
    }
}

function actualizarUIHambre() {
    const cont = document.getElementById('barra-hambre');
    if (!cont) return;
    cont.innerHTML = '';
    for (let i = 0; i < 10; i++) {
        const v = hambreJugador - i * 2;
        const d = document.createElement('div');
        d.className = 'muslo ' + (v >= 2 ? 'lleno' : (v >= 1 ? 'medio' : 'vacio'));
        cont.appendChild(d);
    }
}

function aplicarDanio(cantidad, motivo) {
    if (jugadorMuerto || invulnerabilidad > 0 || cantidad <= 0) return;
    vidaJugador = Math.max(0, vidaJugador - cantidad);
    invulnerabilidad = 0.6;
    actualizarUIVida();
    if (vidaJugador <= 0) {
        morirJugador(motivo || 'muerte');
    }
}

function morirJugador(motivo) {
    if (jugadorMuerto) return;
    jugadorMuerto = true;
    motivoMuerteActual = motivo;
    cancelarRuptura();
    velocityY = 0;
    distanciaCaida = 0;

    const textos = {
        ahogamiento: 'Te has ahogado',
        caida: 'Has muerto de una caída',
        hambre: 'Has muerto de hambre',
        muerte: 'Has muerto'
    };
    const elMotivo = document.getElementById('motivo-muerte');
    if (elMotivo) elMotivo.textContent = textos[motivo] || ('Has muerto (' + motivo + ')');

    document.getElementById('pantalla-muerte').style.display = 'flex';
    try { controls.unlock(); } catch (e) {}
    document.getElementById('bloqueo-pantalla').style.display = 'none';
}

function elegirRespawn() {
    document.getElementById('pantalla-muerte').style.display = 'none';
    jugadorMuerto = false;
    vidaJugador = VIDA_MAX;
    aireJugador = AIRE_MAX;
    hambreJugador = HAMBRE_MAX;
    distanciaCaida = 0;
    velocityY = 0;
    invulnerabilidad = 1.5;
    actualizarUIVida();
    actualizarUIHambre();
    actualizarUIAire(false);
    encontrarSpawnSeguro();
    try { controls.lock(); } catch (e) {}
}

function elegirMenuTrasMuerte() {
    document.getElementById('pantalla-muerte').style.display = 'none';
    jugadorMuerto = false;
    // Guardar estado (muerto / inventario intacto) y salir
    if (nombreMundoActual) {
        vidaJugador = VIDA_MAX; // al volver empezará fresco si reaparece; guardamos mundo
        hambreJugador = HAMBRE_MAX;
        Promise.resolve(guardarMundo(true)).finally(() => {
            window.location.href = 'index.html';
        });
    } else {
        window.location.href = 'index.html';
    }
}

function respawnearJugador(motivo) {
    // compatibilidad: abre pantalla de muerte
    morirJugador(motivo || 'muerte');
}

function actualizarHambre(delta, seMovio) {
    if (jugadorMuerto) return;

    // Agotar hambre al moverse / con el tiempo (más lento)
    let gasto = 0.012 * delta; // pasivo muy bajo
    if (seMovio) gasto += 0.10 * delta; // caminar
    acumuladorHambre += gasto;

    // Cada "1 punto de agotamiento" baja medio muslo (1 punto de hambre)
    while (acumuladorHambre >= 1.0 && hambreJugador > 0) {
        acumuladorHambre -= 1.0;
        hambreJugador = Math.max(0, hambreJugador - 1);
        actualizarUIHambre();
    }

    // Hambre a 0 → daño por inanición (1 corazón / 4 s) si vida > 1
    if (hambreJugador <= 0) {
        acumuladorStarvation += delta;
        if (acumuladorStarvation >= 4.0) {
            acumuladorStarvation = 0;
            if (vidaJugador > 1) {
                aplicarDanio(1, 'hambre');
            } else if (vidaJugador <= 1) {
                aplicarDanio(1, 'hambre'); // puede matar
            }
        }
    } else {
        acumuladorStarvation = 0;
    }

    // Regeneración si hambre alta (>= 18) y no muerto
    if (hambreJugador >= 18 && vidaJugador < VIDA_MAX && vidaJugador > 0) {
        acumuladorRegen += delta;
        if (acumuladorRegen >= 4.0) {
            acumuladorRegen = 0;
            vidaJugador = Math.min(VIDA_MAX, vidaJugador + 1);
            // regenerar cuesta un poco de hambre
            hambreJugador = Math.max(0, hambreJugador - 1);
            actualizarUIVida();
            actualizarUIHambre();
        }
    } else {
        acumuladorRegen = 0;
    }
}

function colocarJugadorEnSuelo(x, z) {
    // Buscar el bloque sólido más alto con espacio libre encima
    for (let y = tamMundoY - 3; y >= 1; y--) {
        let id = obtenerIdVoxel(x, y, z);
        if (id === 0 || id === 7) continue;
        let a1 = obtenerIdVoxel(x, y + 1, z);
        let a2 = obtenerIdVoxel(x, y + 2, z);
        if ((a1 === 0 || a1 === 7) && (a2 === 0 || a2 === 7)) {
            // Cámara = ojos: encima del bloque (y + 0.5) + ojosJugador
            camera.position.set(x + 0.0, y + 0.5 + ojosJugador, z + 0.0);
            velocityY = 0;
            enSuelo = true;
            return true;
        }
    }
    camera.position.set(x, 30, z);
    return false;
}

function encontrarSpawnSeguro() {
    // Probar cerca del origen y alrededor
    const offsets = [[0,0],[2,2],[-2,2],[2,-2],[-2,-2],[4,0],[-4,0],[0,4],[0,-4],[8,8],[-8,8]];
    for (const [ox, oz] of offsets) {
        for (let y = tamMundoY - 3; y >= 1; y--) {
            let id = obtenerIdVoxel(ox, y, oz);
            if (id === 0 || id === 7 || id === 4) continue; // no hojas ni aire/agua
            let a1 = obtenerIdVoxel(ox, y + 1, oz);
            let a2 = obtenerIdVoxel(ox, y + 2, oz);
            if (a1 === 0 && a2 === 0) {
                camera.position.set(ox, y + 0.5 + ojosJugador, oz);
                velocityY = 0;
                enSuelo = true;
                return;
            }
        }
    }
    colocarJugadorEnSuelo(0, 0);
}

function colisionaConCajaJugadorPuro(px, py, pz) {
    let minX = px - radioJugador, maxX = px + radioJugador;
    let minY = py - ojosJugador, maxY = py + (alturaJugador - ojosJugador);
    let minZ = pz - radioJugador, maxZ = pz + radioJugador;
    for (let x = Math.floor(minX + 0.5); x <= Math.floor(maxX + 0.5); x++) {
        for (let y = Math.floor(minY + 0.5); y <= Math.floor(maxY + 0.5); y++) {
            for (let z = Math.floor(minZ + 0.5); z <= Math.floor(maxZ + 0.5); z++) {
                let id = obtenerIdVoxel(x, y, z);
                if (id !== 0 && id !== 7) {
                    if (maxX > x - 0.5 && minX < x + 0.5 && maxZ > z - 0.5 && minZ < z + 0.5 && maxY > y - 0.5 && minY < y + 0.5) return true;
                }
            }
        }
    }
    return false;
}

function colisionaConCajaJugador(bx, by, bz, px, py, pz) {
    let minX = px - radioJugador, maxX = px + radioJugador;
    let minY = py - ojosJugador, maxY = py + (alturaJugador - ojosJugador);
    let minZ = pz - radioJugador, maxZ = pz + radioJugador;
    return (maxX > bx - 0.5 && minX < bx + 0.5 && maxZ > bz - 0.5 && minZ < bz + 0.5 && maxY > by - 0.5 && minY < by + 0.5);
}


function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    const delta = Math.min((time - prevTime) / 1000, 0.1);

    acumuladorTiempoAgua += delta;
    if (acumuladorTiempoAgua >= intervaloPropagacionAgua) {
        acumuladorTiempoAgua = 0;
        simularPropagacionAgua();
    }

    // Ciclo día / noche
    actualizarCicloDiaNoche(delta);

    // Progreso de comer
    actualizarComer(delta);

    // Mobs
    if (window.MateCraftMobs) MateCraftMobs.update(delta);

    // Auto-guardado en carpeta del PC
    if (nombreMundoActual && (performance.now() / 1000 - ultimoGuardado) >= INTERVALO_AUTOGUARDADO) {
        guardarMundo(false);
    }

    // Actualizar hornos (cocción) siempre
    actualizarHornos(delta);

    if (controls.isLocked === true && !jugadorMuerto) {
        if (estaRompiendo && objetivoRompiendoPos) {
            let sigueApuntando = false;
            raycaster.setFromCamera(mouse, camera);
            let intersects = raycaster.intersectObject(meshMundo);
            if (intersects.length > 0 && intersects[0].distance < 6) {
                let hit = intersects[0];
                let normal = hit.face.normal.clone();
                let pImp = hit.point.clone().add(normal.clone().multiplyScalar(-0.01));
                let vx = Math.floor(pImp.x + 0.5), vy = Math.floor(pImp.y + 0.5), vz = Math.floor(pImp.z + 0.5);
                if (vx === objetivoRompiendoPos.x && vy === objetivoRompiendoPos.y && vz === objetivoRompiendoPos.z) sigueApuntando = true;
            }

            if (sigueApuntando) {
                tiempoRompiendo += delta;
                document.getElementById('barra-romper').style.width = Math.min((tiempoRompiendo / tiempoRequeridoRomper) * 100, 100) + '%';
                if (tiempoRompiendo >= tiempoRequeridoRomper) {
                    let idRoto = obtenerIdVoxel(objetivoRompiendoPos.x, objetivoRompiendoPos.y, objetivoRompiendoPos.z);
                    let tipoRotoStr = ID_A_TIPO[idRoto]; 
                    
                    establecerIdVoxel(objetivoRompiendoPos.x, objetivoRompiendoPos.y, objetivoRompiendoPos.z, 0);
                    reconstruirMallaMundo();

                    // La piedra (roca) solo dropea si se rompe con un pico
                    let puedeDropear = true;
                    if (tipoRotoStr === 'roca') {
                        let itemActual = itemBarraActual();
                        if (itemActual !== 'picm' && itemActual !== 'picp') {
                            puedeDropear = false; // Sin pico → no da nada
                        }
                    }

                    if (puedeDropear && tipoRotoStr && inventarioRecursos[tipoRotoStr] !== undefined) {
                        anadirItem(tipoRotoStr, 1);
                    }
                    // Cofre: devolver todo el contenido al inventario
                    if (idRoto >= 22 && idRoto <= 25) {
                        let ck = objetivoRompiendoPos.x + ',' + objetivoRompiendoPos.y + ',' + objetivoRompiendoPos.z;
                        let cd = cofresData[ck];
                        if (cd && cd.slots) {
                            cd.slots.forEach(s => {
                                if (s && s.tipo && s.cant > 0 && inventarioRecursos[s.tipo] !== undefined) {
                                    inventarioRecursos[s.tipo] += s.cant;
                                }
                            });
                        }
                        delete cofresData[ck];
                        if (cofreAbierto && cofreActualPos &&
                            cofreActualPos.x === objetivoRompiendoPos.x &&
                            cofreActualPos.y === objetivoRompiendoPos.y &&
                            cofreActualPos.z === objetivoRompiendoPos.z) {
                            cerrarCofre();
                        }
                        actualizarUIInventario();
                    }
                    // Horno: devolver entrada, combustible y resultado
                    if (idRoto >= 13 && idRoto <= 20) {
                        let hk = objetivoRompiendoPos.x + ',' + objetivoRompiendoPos.y + ',' + objetivoRompiendoPos.z;
                        let hd = hornosData[hk];
                        if (hd) {
                            ['input', 'fuel', 'output'].forEach(campo => {
                                let s = hd[campo];
                                if (s && typeof s === 'string') s = { tipo: s, cant: 1 };
                                if (s && s.tipo && s.cant > 0 && inventarioRecursos[s.tipo] !== undefined) {
                                    inventarioRecursos[s.tipo] += s.cant;
                                }
                            });
                        }
                        delete hornosData[hk];
                        if (hornoAbierto && hornoActualPos &&
                            hornoActualPos.x === objetivoRompiendoPos.x &&
                            hornoActualPos.y === objetivoRompiendoPos.y &&
                            hornoActualPos.z === objetivoRompiendoPos.z) {
                            cerrarHorno();
                        }
                        actualizarUIInventario();
                    }
                    // Hojas
                    if (idRoto === 4) {
                        if (Math.random() < 0.5) anadirItem('manzana', 1);
                        if (Math.random() < 0.01) anadirItem('manzanad', 1);
                    }
                    cancelarRuptura();
                }
            } else { cancelarRuptura(); }
        }

        let camObj = controls.getObject();
        let enElAgua = estaEnAgua(camObj.position.x, camObj.position.y, camObj.position.z);

        let velocidadActual = (enElAgua ? velocidadMovimiento * 0.7 : velocidadMovimiento) * delta;
        let dirX = 0, dirZ = 0;
        let vAdelante = new THREE.Vector3(); camera.getWorldDirection(vAdelante); vAdelante.y = 0; vAdelante.normalize();
        let vDerecha = new THREE.Vector3(); vDerecha.crossVectors(vAdelante, new THREE.Vector3(0, 1, 0));

        if (moveForward) { dirX += vAdelante.x; dirZ += vAdelante.z; }
        if (moveBackward) { dirX -= vAdelante.x; dirZ -= vAdelante.z; }
        if (moveLeft) { dirX -= vDerecha.x; dirZ -= vDerecha.z; }
        if (moveRight) { dirX += vDerecha.x; dirZ += vDerecha.z; }

        let seMovio = false;
        if (dirX !== 0 || dirZ !== 0) {
            let len = Math.sqrt(dirX * dirX + dirZ * dirZ);
            dirX = (dirX / len) * velocidadActual; dirZ = (dirZ / len) * velocidadActual;
            camObj.position.x += dirX;
            if (colisionaConCajaJugadorPuro(camObj.position.x, camObj.position.y, camObj.position.z)) camObj.position.x -= dirX;
            else seMovio = true;
            camObj.position.z += dirZ;
            if (colisionaConCajaJugadorPuro(camObj.position.x, camObj.position.y, camObj.position.z)) camObj.position.z -= dirZ;
            else seMovio = true;
        }
        actualizarHambre(delta, seMovio);

        // Invulnerabilidad
        if (invulnerabilidad > 0) invulnerabilidad -= delta;

        const bajoAgua = cabezaEnAgua(camObj.position.x, camObj.position.y, camObj.position.z);

        // Aire / ahogamiento
        if (bajoAgua) {
            aireJugador -= delta;
            if (aireJugador < 0) aireJugador = 0;
            actualizarUIAire(true);
            if (aireJugador <= 0) {
                acumuladorDanioAhogo += delta;
                if (acumuladorDanioAhogo >= 1.0) {
                    acumuladorDanioAhogo = 0;
                    aplicarDanio(2, 'ahogamiento'); // 1 corazón por segundo
                }
            } else {
                acumuladorDanioAhogo = 0;
            }
        } else {
            if (aireJugador < AIRE_MAX) {
                aireJugador = Math.min(AIRE_MAX, aireJugador + delta * 2);
            }
            if (aireJugador >= AIRE_MAX) actualizarUIAire(false);
            else actualizarUIAire(true);
            acumuladorDanioAhogo = 0;
        }

        if (enElAgua) {
            distanciaCaida = 0; // el agua cancela caída
            if (spacePressed) {
                velocityY = 5.5; 
            } else {
                velocityY = Math.max(velocityY - (gravedad * 0.15) * delta, -1.5); 
            }
        } else {
            velocityY -= gravedad * delta;
            // Acumular distancia de caída
            if (!enSuelo && velocityY < 0) {
                distanciaCaida += -velocityY * delta;
            }
        }

        camObj.position.y += velocityY * delta;
        if (colisionaConCajaJugadorPuro(camObj.position.x, camObj.position.y, camObj.position.z)) {
            camObj.position.y -= velocityY * delta;
            if (velocityY < 0 && !enElAgua) {
                // Daño por caída (como Minecraft: bloques - 3)
                if (distanciaCaida > 3) {
                    let dmg = Math.floor(distanciaCaida - 3);
                    if (dmg > 0) aplicarDanio(dmg, 'caida');
                }
                distanciaCaida = 0;
                enSuelo = true;
            }
            velocityY = 0;
        } else { 
            if (!enElAgua) enSuelo = false; 
        }
    }
    prevTime = time;
    renderer.render(scene, camera);
}

init();
    