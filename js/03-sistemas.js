/** Mate-Craft: inventario, crafteo, cofre, horno, UI */


// ========== TRANSFERENCIA SIMPLE (horno / cofre) ==========
// Clic = seleccionar ítem del jugador
// Rueda del ratón sobre casilla de cofre/horno = sumar/quitar 1 del seleccionado
var itemTransferSel = null; // { origen:'barra'|'inv', index:number, tipo:string } | null

function limpiarSeleccionTransfer() {
    itemTransferSel = null;
}

function obtenerTipoSeleccionadoTransfer() {
    if (itemTransferSel) {
        var slots = itemTransferSel.origen === 'barra' ? barraSlots : invSlots;
        var tipo = slots[itemTransferSel.index];
        if (tipo && inventarioRecursos[tipo] && inventarioRecursos[tipo] > 0) {
            itemTransferSel.tipo = tipo;
            return tipo;
        }
        itemTransferSel = null;
    }
    // Fallback: ítem de la barra rápida seleccionada
    var tb = barraSlots[materialSeleccionadoIndex];
    if (tb && inventarioRecursos[tb] && inventarioRecursos[tb] > 0) return tb;
    return null;
}

function seleccionarItemJugador(origen, index) {
    var slots = origen === 'barra' ? barraSlots : invSlots;
    var tipo = slots[index];
    if (!tipo || !inventarioRecursos[tipo] || inventarioRecursos[tipo] <= 0) {
        itemTransferSel = null;
        if (origen === 'barra') materialSeleccionadoIndex = index;
        refrescarUIsTransfer();
        return;
    }
    // Toggle: si ya está seleccionado, deseleccionar
    if (itemTransferSel && itemTransferSel.origen === origen && itemTransferSel.index === index) {
        itemTransferSel = null;
    } else {
        itemTransferSel = { origen: origen, index: index, tipo: tipo };
        if (origen === 'barra') materialSeleccionadoIndex = index;
    }
    refrescarUIsTransfer();
}

function refrescarUIsTransfer() {
    actualizarUIInventario();
    if (inventarioAbierto) actualizarUICrafteo();
    if (typeof hornoAbierto !== 'undefined' && hornoAbierto) actualizarUIHorno();
    if (typeof cofreAbierto !== 'undefined' && cofreAbierto) actualizarUICofre();
}

function esSeleccionadoTransfer(origen, index) {
    return !!(itemTransferSel && itemTransferSel.origen === origen && itemTransferSel.index === index);
}

/** Mueve 1 unidad del ítem seleccionado del jugador hacia un destino */
function transferirUnoDesdeJugador(tipo) {
    if (!tipo || !inventarioRecursos[tipo] || inventarioRecursos[tipo] <= 0) return false;
    inventarioRecursos[tipo]--;
    if (inventarioRecursos[tipo] < 0) inventarioRecursos[tipo] = 0;
    if (inventarioRecursos[tipo] <= 0) {
        for (var i = 0; i < BARRA_SIZE; i++) if (barraSlots[i] === tipo) barraSlots[i] = null;
        for (var j = 0; j < INV_SIZE; j++) if (invSlots[j] === tipo) invSlots[j] = null;
        if (itemTransferSel && itemTransferSel.tipo === tipo) itemTransferSel = null;
    }
    return true;
}

/** Rueda sobre slot de cofre: arriba mete, abajo saca */
function ruedaSlotCofre(ev, index) {
    ev.preventDefault();
    ev.stopPropagation();
    if (!cofreActualPos) return;
    var datos = asegurarCofre(cofreActualPos.x, cofreActualPos.y, cofreActualPos.z);
    var s = datos.slots[index];
    var delta = ev.deltaY < 0 ? 1 : -1; // rueda arriba = meter

    if (delta > 0) {
        var tipo = obtenerTipoSeleccionadoTransfer();
        if (!tipo) return;
        var maxC = (typeof maxStackItem === 'function') ? maxStackItem(tipo) : 64;
        if (s && s.tipo && s.tipo !== tipo) return;
        if (s && s.cant >= maxC) return;
        if (!transferirUnoDesdeJugador(tipo)) return;
        if (!s || !s.tipo) datos.slots[index] = { tipo: tipo, cant: 1 };
        else s.cant++;
    } else {
        if (!s || !s.tipo || s.cant <= 0) return;
        anadirItem(s.tipo, 1);
        s.cant--;
        if (s.cant <= 0) datos.slots[index] = null;
    }
    actualizarUIInventario();
    actualizarUICofre();
}

/** Rueda sobre slot de horno input/fuel */
function ruedaSlotHorno(ev, slot) {
    ev.preventDefault();
    ev.stopPropagation();
    if (!hornoActualPos) return;
    var datos = obtenerDatosHorno(hornoActualPos.x, hornoActualPos.y, hornoActualPos.z);
    var delta = ev.deltaY < 0 ? 1 : -1;

    if (slot === 'output') {
        // Solo sacar con rueda abajo o clic
        if (delta < 0 && datos.output && datos.output.cant > 0) {
            anadirItem(datos.output.tipo, 1);
            datos.output.cant--;
            if (datos.output.cant <= 0) datos.output = null;
            actualizarUIHorno();
            actualizarUIInventario();
        }
        return;
    }

    if (delta > 0) {
        var tipo = obtenerTipoSeleccionadoTransfer();
        if (!tipo) return;
        if (slot === 'input') {
            if (!RECETAS_HORNO[tipo]) return;
            if (datos.input && datos.input.tipo !== tipo) return;
            var maxI = (typeof maxStackItem === 'function') ? maxStackItem(tipo) : 64;
            if (datos.input && datos.input.cant >= maxI) return;
            if (!transferirUnoDesdeJugador(tipo)) return;
            if (!datos.input) { datos.input = { tipo: tipo, cant: 1 }; datos.progress = 0; }
            else datos.input.cant++;
        } else if (slot === 'fuel') {
            if (!COMBUSTIBLES[tipo]) return;
            if (datos.fuel && datos.fuel.tipo !== tipo) return;
            var maxF = (typeof maxStackItem === 'function') ? maxStackItem(tipo) : 64;
            if (datos.fuel && datos.fuel.cant >= maxF) return;
            if (!transferirUnoDesdeJugador(tipo)) return;
            if (!datos.fuel) datos.fuel = { tipo: tipo, cant: 1 };
            else datos.fuel.cant++;
        }
    } else {
        if (slot === 'input' && datos.input && datos.input.cant > 0) {
            anadirItem(datos.input.tipo, 1);
            datos.input.cant--;
            if (datos.input.cant <= 0) { datos.input = null; datos.progress = 0; }
        } else if (slot === 'fuel' && datos.fuel && datos.fuel.cant > 0) {
            anadirItem(datos.fuel.tipo, 1);
            datos.fuel.cant--;
            if (datos.fuel.cant <= 0) datos.fuel = null;
        }
    }
    actualizarUIHorno();
    actualizarUIInventario();
}

/** Clic en slot del cofre: meter si hay ítem usable, si no sacar */
function clicSlotCofreSimple(index, ev) {
    if (!cofreActualPos) return;
    var datos = asegurarCofre(cofreActualPos.x, cofreActualPos.y, cofreActualPos.z);
    var s = datos.slots[index];
    var tipoSel = obtenerTipoSeleccionadoTransfer();
    var shift = ev && ev.shiftKey;

    // Si el slot tiene otro tipo y no queremos meter: sacar
    if (tipoSel && s && s.tipo && s.tipo !== tipoSel) {
        // sacar del cofre
        tipoSel = null;
    }

    if (tipoSel && inventarioRecursos[tipoSel] > 0) {
        var maxC = (typeof maxStackItem === 'function') ? maxStackItem(tipoSel) : 64;
        var cuantos = shift ? inventarioRecursos[tipoSel] : 1;
        var movidos = 0;
        while (movidos < cuantos && inventarioRecursos[tipoSel] > 0) {
            s = datos.slots[index];
            if (s && s.tipo && s.tipo !== tipoSel) break;
            if (s && s.cant >= maxC) break;
            if (!transferirUnoDesdeJugador(tipoSel)) break;
            s = datos.slots[index];
            if (!s || !s.tipo) datos.slots[index] = { tipo: tipoSel, cant: 1 };
            else s.cant++;
            movidos++;
        }
        actualizarUIInventario();
        actualizarUICofre();
        return;
    }

    // Sacar del cofre al inventario
    s = datos.slots[index];
    if (s && s.tipo && s.cant > 0) {
        var sacar = shift ? s.cant : 1;
        for (var k = 0; k < sacar; k++) {
            if (!s || s.cant <= 0) break;
            anadirItem(s.tipo, 1);
            s.cant--;
        }
        if (!s || s.cant <= 0) datos.slots[index] = null;
        actualizarUIInventario();
        actualizarUICofre();
    }
}

function clicSlotHornoSimple(slot) {
    if (!hornoActualPos) return;
    var datos = obtenerDatosHorno(hornoActualPos.x, hornoActualPos.y, hornoActualPos.z);
    var tipoSel = obtenerTipoSeleccionadoTransfer();

    if (slot === 'output') {
        if (datos.output && datos.output.cant > 0) {
            var tOut = datos.output.tipo;
            var cOut = datos.output.cant;
            datos.output = null; // se pierde si falla el quiz
            intentarEntregarConQuiz(tOut, cOut);
            actualizarUIHorno();
            actualizarUIInventario();
        }
        return;
    }

    if (tipoSel) {
        if (slot === 'input' && RECETAS_HORNO[tipoSel]) {
            if (datos.input && datos.input.tipo !== tipoSel) return;
            if (!transferirUnoDesdeJugador(tipoSel)) return;
            if (!datos.input) { datos.input = { tipo: tipoSel, cant: 1 }; datos.progress = 0; }
            else datos.input.cant++;
        } else if (slot === 'fuel' && COMBUSTIBLES[tipoSel]) {
            if (datos.fuel && datos.fuel.tipo !== tipoSel) return;
            if (!transferirUnoDesdeJugador(tipoSel)) return;
            if (!datos.fuel) datos.fuel = { tipo: tipoSel, cant: 1 };
            else datos.fuel.cant++;
        }
        actualizarUIHorno();
        actualizarUIInventario();
        return;
    }

    // Sin selección: sacar todo el stack del slot
    if (slot === 'input' && datos.input) {
        anadirItem(datos.input.tipo, datos.input.cant);
        datos.input = null;
        datos.progress = 0;
    } else if (slot === 'fuel' && datos.fuel) {
        anadirItem(datos.fuel.tipo, datos.fuel.cant);
        datos.fuel = null;
    }
    actualizarUIHorno();
    actualizarUIInventario();
}

/** Crafteo: clic en ítem del jugador pone 1 en la grilla (casilla vacía bajo el ratón o primera libre) */
function ponerUnoEnCrafteo(tipo) {
    if (!tipo || !inventarioRecursos[tipo] || inventarioRecursos[tipo] <= 0) return;
    var idx = -1;
    for (var i = 0; i < grillaCrafteo.length; i++) {
        if (!grillaCrafteo[i]) { idx = i; break; }
    }
    if (idx < 0) return;
    inventarioRecursos[tipo]--;
    if (inventarioRecursos[tipo] <= 0) {
        for (var a = 0; a < BARRA_SIZE; a++) if (barraSlots[a] === tipo) barraSlots[a] = null;
        for (var b = 0; b < INV_SIZE; b++) if (invSlots[b] === tipo) invSlots[b] = null;
    }
    grillaCrafteo[idx] = tipo;
    actualizarUIInventario();
    actualizarUICrafteo();
}

function clicSlotCrafteoSimple(index) {
    var en = grillaCrafteo[index];
    if (en) {
        anadirItem(en, 1);
        grillaCrafteo[index] = null;
        actualizarUIInventario();
        actualizarUICrafteo();
        return;
    }
    // Casilla vacía: si hay selección de transfer o material de barra, poner 1
    var tipo = obtenerTipoSeleccionadoTransfer();
    if (!tipo) {
        var tb = barraSlots[materialSeleccionadoIndex];
        if (tb && inventarioRecursos[tb] > 0) tipo = tb;
    }
    if (!tipo || !inventarioRecursos[tipo] || inventarioRecursos[tipo] <= 0) return;
    inventarioRecursos[tipo]--;
    if (inventarioRecursos[tipo] <= 0) {
        for (var a = 0; a < BARRA_SIZE; a++) if (barraSlots[a] === tipo) barraSlots[a] = null;
        for (var b = 0; b < INV_SIZE; b++) if (invSlots[b] === tipo) invSlots[b] = null;
        if (itemTransferSel && itemTransferSel.tipo === tipo) itemTransferSel = null;
    }
    grillaCrafteo[index] = tipo;
    actualizarUIInventario();
    actualizarUICrafteo();
}

function marcarSlotSeleccionado(slotEl, activo) {
    if (!slotEl) return;
    if (activo) {
        slotEl.style.outline = '3px solid #ffeb3b';
        slotEl.style.outlineOffset = '1px';
    } else {
        slotEl.style.outline = '';
        slotEl.style.outlineOffset = '';
    }
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
    if (!tipo || cant === 0) return 0;
    // Crear clave si no existía (drops nuevos, mods, etc.)
    if (inventarioRecursos[tipo] === undefined) {
        inventarioRecursos[tipo] = 0;
    }

    const maxS = (typeof maxStackItem === 'function') ? maxStackItem(tipo) : 64;
    const actual = inventarioRecursos[tipo] | 0;
    const espacio = maxS - actual;
    if (espacio <= 0) {
        // Ya al máximo (herramienta o stack 64)
        limpiarSlotsVacios();
        actualizarUIInventario();
        return 0;
    }
    const aSumar = Math.min(cant, espacio);
    inventarioRecursos[tipo] = actual + aSumar;
    if (inventarioRecursos[tipo] < 0) inventarioRecursos[tipo] = 0;

    // Mate-Quiz: primera vez que consigues ciertos ítems
    if (aSumar > 0 && window.MateQuiz && typeof MateQuiz.onItemObtenido === 'function') {
        try { MateQuiz.onItemObtenido(tipo, aSumar); } catch (e) {}
    }

    limpiarSlotsVacios();

    if (inventarioRecursos[tipo] <= 0) {
        for (let i = 0; i < BARRA_SIZE; i++) if (barraSlots[i] === tipo) barraSlots[i] = null;
        for (let i = 0; i < INV_SIZE; i++) if (invSlots[i] === tipo) invSlots[i] = null;
        actualizarUIInventario();
        return aSumar;
    }

    // Si ya está en barra o inventario, solo actualizar cantidad en UI
    if (barraSlots.includes(tipo) || invSlots.includes(tipo)) {
        actualizarUIInventario();
        return aSumar;
    }

    // Colocar en primer hueco libre (barra prioritaria)
    let bi = barraSlots.findIndex(s => !s);
    if (bi >= 0) {
        barraSlots[bi] = tipo;
        actualizarUIInventario();
        return aSumar;
    }
    let ii = invSlots.findIndex(s => !s);
    if (ii >= 0) {
        invSlots[ii] = tipo;
        actualizarUIInventario();
        return aSumar;
    }

    console.warn('[Inventario] Lleno; ítem en total sin casilla libre:', tipo, 'x' + aSumar);
    actualizarUIInventario();
    return aSumar;
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

var HERRAMIENTAS = new Set(['picm','picp','pich','pico','picd','hachm','hachp','hachh','hacho','hachd','espm','espp','esph','espo','espd','palam','palap','palah','palao','palad','palito']);

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
            ev.dataTransfer.effectAllowed = 'move';
        };
        slot.onclick = (ev) => {
            if (typeof opts.onClickTipo === 'function') {
                opts.onClickTipo(tipo, ev);
            } else {
                seleccionarItemJugador(origen, index);
            }
        };
        if (esSeleccionadoTransfer(origen, index)) {
            slot.style.outline = '3px solid #ffeb3b';
            slot.style.outlineOffset = '1px';
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
            ev.dataTransfer.effectAllowed = 'move';
        };
        slot.ondragover = permitirSoltar;
        slot.ondrop = (ev) => soltarEnSlotBarra(ev, i);
        slot.onclick = (ev) => {
            seleccionarItemJugador('barra', i);
        };
        if (esSeleccionadoTransfer('barra', i)) {
            slot.style.outline = '3px solid #ffeb3b';
            slot.style.outlineOffset = '1px';
        }
        slot.title = 'Clic: seleccionar · En cofre/horno usa la rueda sobre el destino';
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
    limpiarSeleccionTransfer();
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
        slot.onclick = (ev) => clicSlotCofreSimple(i, ev);
        slot.onwheel = (ev) => ruedaSlotCofre(ev, i);
        slot.title = 'Arrastra aquí · Clic · Rueda';
        grid.appendChild(slot);
    }
    renderSlotsJugador(document.getElementById('cofre-inv-grid'), {
        slotClass: 'slot-cofre',
        onClickTipo: meterEnCofre
    });
}

/** Clic en ítem del jugador dentro del cofre: coger al cursor o soltar 1 en el cofre */
/** Clic en ítem del jugador con el cofre abierto: mete 1 (Shift = todo lo posible) */
function meterEnCofre(tipo, ev) {
    if (!cofreActualPos || !tipo) return;
    if (!inventarioRecursos[tipo] || inventarioRecursos[tipo] <= 0) return;
    var datos = asegurarCofre(cofreActualPos.x, cofreActualPos.y, cofreActualPos.z);
    var maxC = (typeof maxStackItem === 'function') ? maxStackItem(tipo) : 64;
    var cuantos = (ev && ev.shiftKey) ? inventarioRecursos[tipo] : 1;
    var movidos = 0;
    while (movidos < cuantos && inventarioRecursos[tipo] > 0) {
        var idx = -1;
        // Preferir stack del mismo tipo
        for (var i = 0; i < COFRE_SLOTS; i++) {
            var s = datos.slots[i];
            if (s && s.tipo === tipo && s.cant > 0 && s.cant < maxC) { idx = i; break; }
        }
        if (idx < 0) {
            for (var j = 0; j < COFRE_SLOTS; j++) {
                var s2 = datos.slots[j];
                if (!s2 || !s2.tipo || s2.cant <= 0) { idx = j; break; }
            }
        }
        if (idx < 0) break; // cofre lleno
        if (!transferirUnoDesdeJugador(tipo)) break;
        var slot = datos.slots[idx];
        if (!slot || !slot.tipo) datos.slots[idx] = { tipo: tipo, cant: 1 };
        else slot.cant++;
        movidos++;
    }
    // Mantener selección del tipo si aún queda
    if (inventarioRecursos[tipo] > 0) {
        var origen = null, ix = -1;
        for (var a = 0; a < BARRA_SIZE; a++) if (barraSlots[a] === tipo) { origen = 'barra'; ix = a; break; }
        if (ix < 0) for (var b = 0; b < INV_SIZE; b++) if (invSlots[b] === tipo) { origen = 'inv'; ix = b; break; }
        if (origen != null) itemTransferSel = { origen: origen, index: ix, tipo: tipo };
    } else {
        itemTransferSel = null;
    }
    actualizarUIInventario();
    actualizarUICofre();
}

function soltarEnCofre(ev, index) {
    ev.preventDefault();
    ev.stopPropagation();
    if (!cofreActualPos) return;
    var raw = '';
    try { raw = ev.dataTransfer.getData('text/plain') || ev.dataTransfer.getData('text') || ''; } catch (e) {}
    var tipo = resolverDragTipo(raw);
    if (!tipo || !inventarioRecursos[tipo] || inventarioRecursos[tipo] <= 0) return;
    var datos = asegurarCofre(cofreActualPos.x, cofreActualPos.y, cofreActualPos.z);
    var s = datos.slots[index];
    var maxC = (typeof maxStackItem === 'function') ? maxStackItem(tipo) : 64;
    var cuantos = ev.shiftKey ? inventarioRecursos[tipo] : 1;
    var movidos = 0;
    while (movidos < cuantos && inventarioRecursos[tipo] > 0) {
        s = datos.slots[index];
        if (s && s.tipo && s.tipo !== tipo) break;
        if (s && s.cant >= maxC) break;
        if (!transferirUnoDesdeJugador(tipo)) break;
        s = datos.slots[index];
        if (!s || !s.tipo) datos.slots[index] = { tipo: tipo, cant: 1 };
        else s.cant++;
        movidos++;
    }
    if (movidos > 0) {
        actualizarUIInventario();
        actualizarUICofre();
    }
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


// ========== MODO CREATIVO ==========
var CREATIVO_BLOQUES = [
    'roca', 'tierra', 'tronco', 'tablon', 'mesacra', 'horno', 'cofre', 'lana',
    'bloqh', 'menah', 'bloqo', 'menao', 'bloqd', 'menad', 'bloqc', 'menac', 'agua', 'hojas'
];
var CREATIVO_ITEMS = [
    'palito', 'carbon', 'hierro', 'oro', 'diamante',
    'picm', 'picp', 'pich', 'pico', 'picd',
    'hachm', 'hachp', 'hachh', 'hacho', 'hachd',
    'espm', 'espp', 'esph', 'espo', 'espd',
    'palam', 'palap', 'palah', 'palao', 'palad',
    'manzana', 'manzanad',
    'carne', 'carnec', 'carne2', 'carnec2', 'carne3', 'carnec3', 'carne4', 'carnec4', 'carnepodrida', 'hilo'
];
var CREATIVO_ANIMALES = [
    { tipo: 'pollo', nombre: 'Pollo' },
    { tipo: 'cerdo', nombre: 'Cerdo' },
    { tipo: 'vaca', nombre: 'Vaca' },
    { tipo: 'oveja', nombre: 'Oveja' }
];
var CREATIVO_MONSTRUOS = [
    { tipo: 'zombi', nombre: 'Zombi' },
    { tipo: 'arana', nombre: 'Araña' },
    { tipo: 'creeper', nombre: 'Creeper' }
];
var creativoTabActual = 'bloques';

function actualizarBadgeCreativo() {
    var el = document.getElementById('badge-creativo');
    if (!el) return;
    el.style.display = modoCreativo ? 'block' : 'none';
    // En creativo ocultar vida / hambre / ahogamiento
    var barras = document.getElementById('barras-jugador');
    if (barras) barras.style.display = modoCreativo ? 'none' : '';
}

function toggleModoCreativo() {
    if (creativoAbierto) {
        cerrarCreativo();
        return;
    }
    modoCreativo = !modoCreativo;
    actualizarBadgeCreativo();
    if (modoCreativo) {
        abrirCreativo();
    } else {
        cerrarCreativo();
    }
}

function enlazarUICreativo() {
    var tabs = document.getElementById('creativo-tabs');
    if (tabs) {
        tabs.querySelectorAll('button').forEach(function (b) {
            b.onclick = function (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                creativoTab(b.getAttribute('data-tab') || 'bloques');
            };
        });
    }
    var tBox = document.getElementById('creativo-tiempo');
    if (tBox) {
        tBox.querySelectorAll('button').forEach(function (b) {
            b.onclick = function (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                creativoSetTiempo(b.getAttribute('data-fase') || 'dia');
            };
        });
    }
    var btnCerrar = document.getElementById('btn-cerrar-creativo');
    if (btnCerrar) {
        btnCerrar.onclick = function (ev) {
            ev.preventDefault();
            cerrarCreativo();
            modoCreativo = false;
            actualizarBadgeCreativo();
        };
    }
}

function abrirCreativo() {
    if (inventarioAbierto) toggleInventario(false);
    if (hornoAbierto) cerrarHorno();
    if (cofreAbierto) cerrarCofre();
    creativoAbierto = true;
    modoCreativo = true;
    actualizarBadgeCreativo();
    var pant = document.getElementById('pantalla-creativo');
    if (pant) pant.style.display = 'flex';
    if (controls && controls.isLocked) controls.unlock();
    var bloqueo = document.getElementById('bloqueo-pantalla');
    if (bloqueo) bloqueo.style.display = 'none';
    enlazarUICreativo();
    if (window.MateQuiz) {
        if (MateQuiz.actualizarBotonQuizUI) MateQuiz.actualizarBotonQuizUI();
        if (MateQuiz.actualizarHUD) MateQuiz.actualizarHUD();
    }
    creativoTab(creativoTabActual || 'bloques');
}

function cerrarCreativo() {
    creativoAbierto = false;
    var pant = document.getElementById('pantalla-creativo');
    if (pant) pant.style.display = 'none';
    var bloqueo = document.getElementById('bloqueo-pantalla');
    if (bloqueo) bloqueo.style.display = 'none';
}

function creativoTab(tab) {
    tab = tab || 'bloques';
    creativoTabActual = tab;
    document.querySelectorAll('#creativo-tabs button').forEach(function (b) {
        b.classList.toggle('activo', b.getAttribute('data-tab') === tab);
    });
    var grid = document.getElementById('creativo-grid');
    var mobs = document.getElementById('creativo-mobs');
    var tiempo = document.getElementById('creativo-tiempo');
    if (grid) { grid.classList.add('oculto'); grid.style.display = 'none'; }
    if (mobs) { mobs.classList.add('oculto'); mobs.style.display = 'none'; mobs.innerHTML = ''; }
    if (tiempo) { tiempo.classList.add('oculto'); tiempo.style.display = 'none'; }

    if (tab === 'animales' || tab === 'monstruos') {
        if (mobs) {
            mobs.classList.remove('oculto');
            mobs.style.display = 'flex';
            var lista = (tab === 'animales') ? (window.CREATIVO_ANIMALES || CREATIVO_ANIMALES) : (window.CREATIVO_MONSTRUOS || CREATIVO_MONSTRUOS);
            if (!lista || !lista.length) {
                mobs.innerHTML = '<p style="color:#f88">No hay criaturas cargadas</p>';
                return;
            }
            lista.forEach(function (m) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.textContent = 'Spawn ' + m.nombre;
                btn.onclick = function (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    creativoSpawnMob(m.tipo);
                };
                mobs.appendChild(btn);
            });
        }
        return;
    }
    if (tab === 'tiempo') {
        if (tiempo) {
            tiempo.classList.remove('oculto');
            tiempo.style.display = 'flex';
        }
        return;
    }
    if (grid) {
        grid.classList.remove('oculto');
        grid.style.display = 'grid';
        renderCreativoGrid(tab === 'items' ? CREATIVO_ITEMS : CREATIVO_BLOQUES);
    }
}

function creativoSetTiempo(fase) {
    if (fase === 'dia') tiempoMundo = 8 / 24;
    else if (fase === 'tarde') tiempoMundo = 18.5 / 24;
    else tiempoMundo = 22 / 24;
    if (typeof actualizarCicloDiaNoche === 'function') actualizarCicloDiaNoche(0);
    var badge = document.getElementById('badge-creativo');
    if (badge) {
        var nom = fase === 'dia' ? 'Dia' : (fase === 'tarde' ? 'Tarde' : 'Noche');
        badge.textContent = 'CREATIVO · Tiempo: ' + nom;
    }
    var elHora = document.getElementById('reloj-hora');
    var elFase = document.getElementById('reloj-fase');
    if (typeof obtenerHoraMundo === 'function') {
        var hm = obtenerHoraMundo();
        if (elHora) elHora.textContent = String(hm.h).padStart(2, '0') + ':' + String(hm.m).padStart(2, '0');
        if (elFase && typeof faseDelDia === 'function') elFase.textContent = faseDelDia(hm.horasFloat);
    }
}

function renderCreativoGrid(lista) {
    var grid = document.getElementById('creativo-grid');
    if (!grid) return;
    grid.innerHTML = '';
    lista.forEach(function (tipo) {
        var slot = document.createElement('div');
        slot.className = 'slot-creativo';
        slot.title = tipo + ' (clic = cantidad elegida)';
        if (texturasIconos[tipo]) {
            slot.style.backgroundImage = "url('texturas/" + texturasIconos[tipo] + "')";
        } else {
            slot.style.background = '#444';
        }
        var nom = document.createElement('span');
        nom.className = 'nom';
        nom.textContent = tipo;
        slot.appendChild(nom);
        slot.onclick = function () { creativoDarItem(tipo); };
        grid.appendChild(slot);
    });
}

function creativoCantidadElegida() {
    var sel = document.getElementById('creativo-cant');
    var n = sel ? parseInt(sel.value, 10) : 64;
    if (isNaN(n) || n < 1) n = 1;
    return n;
}

function creativoDarItem(tipo, cant) {
    var maxS = (typeof maxStackItem === 'function') ? maxStackItem(tipo) : 64;
    if (cant == null) cant = creativoCantidadElegida();
    cant = Math.min(cant | 0, maxS);
    if (cant < 1) cant = 1;
    if (inventarioRecursos[tipo] === undefined) inventarioRecursos[tipo] = 0;
    // Rellenar hasta el máximo de stack si ya tienes algo
    var actual = inventarioRecursos[tipo] | 0;
    var espacio = maxS - actual;
    if (espacio <= 0) {
        var badge0 = document.getElementById('badge-creativo');
        if (badge0) badge0.textContent = 'CREATIVO · Ya tienes el máximo de ' + tipo;
        return;
    }
    cant = Math.min(cant, espacio);
    anadirItem(tipo, cant);
    // Feedback visual mínimo
    var badge = document.getElementById('badge-creativo');
    if (badge) {
        badge.textContent = 'CREATIVO · +' + cant + ' ' + tipo;
        setTimeout(function () {
            if (modoCreativo) badge.textContent = 'MODO CREATIVO · Alt+C para menú / salir';
        }, 800);
    }
}

function creativoSpawnMob(tipo) {
    if (!window.MateCraftMobs) return;
    var dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0;
    if (dir.lengthSq() < 0.01) dir.set(0, 0, -1);
    dir.normalize();
    var base = controls.getObject().position;
    var x = base.x + dir.x * 4;
    var z = base.z + dir.z * 4;
    // true = ignorar tope de población
    var e = MateCraftMobs.spawn(tipo, x, z, true);
    if (!e) {
        for (var i = 0; i < 24 && !e; i++) {
            var ang = Math.random() * Math.PI * 2;
            var r = 2 + Math.random() * 6;
            e = MateCraftMobs.spawn(tipo, base.x + Math.cos(ang) * r, base.z + Math.sin(ang) * r, true);
        }
    }
    if (e) {
        var badge = document.getElementById('badge-creativo');
        if (badge) badge.textContent = 'CREATIVO · Spawn ' + tipo + ' (ok)';
    } else {
        alert('No se pudo spawnear ' + tipo + ' (terreno inválido). Prueba en suelo sólido.');
    }
}


// Funciones del creativo accesibles desde el HTML
window.creativoTab = creativoTab;
window.creativoSetTiempo = creativoSetTiempo;
window.creativoSpawnMob = creativoSpawnMob;
window.creativoDarItem = creativoDarItem;
window.toggleModoCreativo = toggleModoCreativo;
window.abrirCreativo = abrirCreativo;
window.cerrarCreativo = cerrarCreativo;


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
        limpiarSeleccionTransfer();
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

function permitirSoltar(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
}
function iniciarArrastre(ev, tipo) { ev.dataTransfer.setData("text/plain", tipo); }

function tirarABasura(ev) {
    if (ev) ev.preventDefault();
    // Si hay ítem seleccionado, borra 1
    var tipo = obtenerTipoSeleccionadoTransfer();
    if (tipo) {
        transferirUnoDesdeJugador(tipo); // descarta 1
        refrescarUIsTransfer();
        return;
    }
    if (!ev || !ev.dataTransfer) return;
    let data = ev.dataTransfer.getData("text/plain");
    let tipo2 = resolverDragTipo(data);
    if (!tipo2 || !inventarioRecursos[tipo2] || inventarioRecursos[tipo2] <= 0) return;
    inventarioRecursos[tipo2]--;
    if (inventarioRecursos[tipo2] < 0) inventarioRecursos[tipo2] = 0;
    if (inventarioRecursos[tipo2] <= 0) {
        for (let i = 0; i < BARRA_SIZE; i++) if (barraSlots[i] === tipo2) barraSlots[i] = null;
        for (let i = 0; i < INV_SIZE; i++) if (invSlots[i] === tipo2) invSlots[i] = null;
    }
    actualizarUIInventario();
    if (inventarioAbierto) actualizarUICrafteo();
}

function soltarEnCrafteo(ev, indexGrilla) {
    ev.preventDefault();
    ev.stopPropagation();
    var raw = '';
    try { raw = ev.dataTransfer.getData('text/plain') || ev.dataTransfer.getData('text') || ''; } catch (e) {}
    var tipo = resolverDragTipo(raw);
    if (!tipo || !inventarioRecursos[tipo] || inventarioRecursos[tipo] <= 0) return;
    // Si ya hay algo, devolverlo
    if (grillaCrafteo[indexGrilla]) {
        anadirItem(grillaCrafteo[indexGrilla], 1);
        grillaCrafteo[indexGrilla] = null;
    }
    if (!transferirUnoDesdeJugador(tipo)) return;
    grillaCrafteo[indexGrilla] = tipo;
    actualizarUIInventario();
    if (inventarioAbierto) actualizarUICrafteo();
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

        let hierroCount = g.filter(item => item === 'hierro').length;

        // Pico hierro: 3 lingotes + 2 palitos
        if (hierroCount === 3 && palitoCount === 2 && totalOcupados === 5) {
            if (g[0]==='hierro' && g[1]==='hierro' && g[2]==='hierro' && g[4]==='palito' && g[7]==='palito') {
                return { resultado: 'pich', cantidad: 1 };
            }
        }
        // Hacha hierro
        if (hierroCount === 3 && palitoCount === 2 && totalOcupados === 5) {
            if (g[0]==='hierro' && g[1]==='hierro' && g[3]==='hierro' && g[4]==='palito' && g[7]==='palito') {
                return { resultado: 'hachh', cantidad: 1 };
            }
            if (g[1]==='hierro' && g[2]==='hierro' && g[5]==='hierro' && g[4]==='palito' && g[7]==='palito') {
                return { resultado: 'hachh', cantidad: 1 };
            }
        }
        // Espada hierro
        if (hierroCount === 2 && palitoCount === 1 && totalOcupados === 3) {
            if ((g[1]==='hierro' && g[4]==='hierro' && g[7]==='palito') ||
                (g[0]==='hierro' && g[3]==='hierro' && g[6]==='palito') ||
                (g[2]==='hierro' && g[5]==='hierro' && g[8]==='palito')) {
                return { resultado: 'esph', cantidad: 1 };
            }
        }
        // Pala hierro
        if (hierroCount === 1 && palitoCount === 2 && totalOcupados === 3) {
            if ((g[1]==='hierro' && g[4]==='palito' && g[7]==='palito') ||
                (g[0]==='hierro' && g[3]==='palito' && g[6]==='palito') ||
                (g[2]==='hierro' && g[5]==='palito' && g[8]==='palito')) {
                return { resultado: 'palah', cantidad: 1 };
            }
        }
        // Bloque de hierro: 9 lingotes
        if (hierroCount === 9 && totalOcupados === 9) {
            return { resultado: 'bloqh', cantidad: 1 };
        }
        // 1 bloque hierro → 9 lingotes
        if (totalOcupados === 1 && g[4] === 'bloqh') {
            return { resultado: 'hierro', cantidad: 9 };
        }

        let oroCount = g.filter(item => item === 'oro').length;

        // Pico oro
        if (oroCount === 3 && palitoCount === 2 && totalOcupados === 5) {
            if (g[0]==='oro' && g[1]==='oro' && g[2]==='oro' && g[4]==='palito' && g[7]==='palito') {
                return { resultado: 'pico', cantidad: 1 };
            }
        }
        // Hacha oro
        if (oroCount === 3 && palitoCount === 2 && totalOcupados === 5) {
            if (g[0]==='oro' && g[1]==='oro' && g[3]==='oro' && g[4]==='palito' && g[7]==='palito') {
                return { resultado: 'hacho', cantidad: 1 };
            }
            if (g[1]==='oro' && g[2]==='oro' && g[5]==='oro' && g[4]==='palito' && g[7]==='palito') {
                return { resultado: 'hacho', cantidad: 1 };
            }
        }
        // Espada oro
        if (oroCount === 2 && palitoCount === 1 && totalOcupados === 3) {
            if ((g[1]==='oro' && g[4]==='oro' && g[7]==='palito') ||
                (g[0]==='oro' && g[3]==='oro' && g[6]==='palito') ||
                (g[2]==='oro' && g[5]==='oro' && g[8]==='palito')) {
                return { resultado: 'espo', cantidad: 1 };
            }
        }
        // Pala oro
        if (oroCount === 1 && palitoCount === 2 && totalOcupados === 3) {
            if ((g[1]==='oro' && g[4]==='palito' && g[7]==='palito') ||
                (g[0]==='oro' && g[3]==='palito' && g[6]==='palito') ||
                (g[2]==='oro' && g[5]==='palito' && g[8]==='palito')) {
                return { resultado: 'palao', cantidad: 1 };
            }
        }
        // Bloque de oro: 9 lingotes
        if (oroCount === 9 && totalOcupados === 9) {
            return { resultado: 'bloqo', cantidad: 1 };
        }
        // 1 bloque oro → 9 lingotes
        if (totalOcupados === 1 && g[4] === 'bloqo') {
            return { resultado: 'oro', cantidad: 9 };
        }
        if (totalOcupados === 1 && (g[0]==='bloqo' || g[1]==='bloqo' || g[2]==='bloqo' || g[3]==='bloqo' || g[5]==='bloqo' || g[6]==='bloqo' || g[7]==='bloqo' || g[8]==='bloqo')) {
            return { resultado: 'oro', cantidad: 9 };
        }

        let diamCount = g.filter(item => item === 'diamante').length;

        // Pico diamante
        if (diamCount === 3 && palitoCount === 2 && totalOcupados === 5) {
            if (g[0]==='diamante' && g[1]==='diamante' && g[2]==='diamante' && g[4]==='palito' && g[7]==='palito') {
                return { resultado: 'picd', cantidad: 1 };
            }
        }
        // Hacha diamante
        if (diamCount === 3 && palitoCount === 2 && totalOcupados === 5) {
            if (g[0]==='diamante' && g[1]==='diamante' && g[3]==='diamante' && g[4]==='palito' && g[7]==='palito') {
                return { resultado: 'hachd', cantidad: 1 };
            }
            if (g[1]==='diamante' && g[2]==='diamante' && g[5]==='diamante' && g[4]==='palito' && g[7]==='palito') {
                return { resultado: 'hachd', cantidad: 1 };
            }
        }
        // Espada diamante
        if (diamCount === 2 && palitoCount === 1 && totalOcupados === 3) {
            if ((g[1]==='diamante' && g[4]==='diamante' && g[7]==='palito') ||
                (g[0]==='diamante' && g[3]==='diamante' && g[6]==='palito') ||
                (g[2]==='diamante' && g[5]==='diamante' && g[8]==='palito')) {
                return { resultado: 'espd', cantidad: 1 };
            }
        }
        // Pala diamante
        if (diamCount === 1 && palitoCount === 2 && totalOcupados === 3) {
            if ((g[1]==='diamante' && g[4]==='palito' && g[7]==='palito') ||
                (g[0]==='diamante' && g[3]==='palito' && g[6]==='palito') ||
                (g[2]==='diamante' && g[5]==='palito' && g[8]==='palito')) {
                return { resultado: 'palad', cantidad: 1 };
            }
        }
        // Bloque diamante
        if (diamCount === 9 && totalOcupados === 9) {
            return { resultado: 'bloqd', cantidad: 1 };
        }
        if (totalOcupados === 1 && g[4] === 'bloqd') {
            return { resultado: 'diamante', cantidad: 9 };
        }
        if (totalOcupados === 1 && (g[0]==='bloqd' || g[1]==='bloqd' || g[2]==='bloqd' || g[3]==='bloqd' || g[5]==='bloqd' || g[6]==='bloqd' || g[7]==='bloqd' || g[8]==='bloqd')) {
            return { resultado: 'diamante', cantidad: 9 };
        }

        let carbonCount = g.filter(item => item === 'carbon').length;
        // Bloque de carbón: 9 carbón
        if (carbonCount === 9 && totalOcupados === 9) {
            return { resultado: 'bloqc', cantidad: 1 };
        }
        if (totalOcupados === 1 && g[4] === 'bloqc') {
            return { resultado: 'carbon', cantidad: 9 };
        }
        if (totalOcupados === 1 && (g[0]==='bloqc' || g[1]==='bloqc' || g[2]==='bloqc' || g[3]==='bloqc' || g[5]==='bloqc' || g[6]==='bloqc' || g[7]==='bloqc' || g[8]==='bloqc')) {
            return { resultado: 'carbon', cantidad: 9 };
        }
        if (totalOcupados === 1 && (g[0]==='bloqh' || g[1]==='bloqh' || g[2]==='bloqh' ||
            g[3]==='bloqh' || g[5]==='bloqh' || g[6]==='bloqh' || g[7]==='bloqh' || g[8]==='bloqh')) {
            return { resultado: 'hierro', cantidad: 9 };
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

        slotDiv.onclick = () => { clicSlotCrafteoSimple(i); };
        slotDiv.title = 'Clic: poner 1 del seleccionado / quitar';

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
            ev.dataTransfer.effectAllowed = 'move';
        };
        slot.ondragover = permitirSoltar;
        slot.ondrop = (ev) => soltarEnSlotInv(ev, i);
        slot.onclick = (ev) => { seleccionarItemJugador('inv', i); };
        if (esSeleccionadoTransfer('inv', i)) {
            slot.style.outline = '3px solid #ffeb3b';
            slot.style.outlineOffset = '1px';
        }
        slot.ondblclick = () => {
            if (!invSlots[i]) return;
            let bi = barraSlots.findIndex(s => !s);
            if (bi < 0) return;
            barraSlots[bi] = invSlots[i];
            invSlots[i] = null;
            limpiarSeleccionTransfer();
            actualizarUIInventario();
            actualizarUICrafteo();
        };
        slot.title = 'Clic: seleccionar · Doble clic → barra';
        gridUsuario.appendChild(slot);
    }
    actualizarUIBarraEnInventario();
}

/** Entrega ítem; si es hito con quiz pendiente, lo retiene hasta acertar (y no entrega si falla). */
function intentarEntregarConQuiz(tipo, cant) {
    cant = cant || 1;
    if (window.MateQuiz && MateQuiz.interceptarCraft(tipo, cant)) {
        // materiales del horno/craft ya se consumieron fuera
        return true; // retenido por quiz
    }
    anadirItem(tipo, cant);
    return false;
}

function reclamarCrafteo() {
    let receta = evaluarRecetaCrafteo();
    if (!receta.resultado) return;

    // Consumir materiales de la grilla ya (éxito o fallo del quiz los pierde)
    for (let i = 0; i < grillaCrafteo.length; i++) {
        if (grillaCrafteo[i] !== null) grillaCrafteo[i] = null;
    }

    // Mate-Quiz: primera vez en hitos importantes
    if (window.MateQuiz && MateQuiz.interceptarCraft(receta.resultado, receta.cantidad)) {
        actualizarUIInventario();
        if (inventarioAbierto) actualizarUICrafteo();
        return; // el quiz entregará el ítem si acierta
    }

    anadirItem(receta.resultado, receta.cantidad);
    actualizarUIInventario();
    if (inventarioAbierto) actualizarUICrafteo();
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
    limpiarSeleccionTransfer();
    document.getElementById('pantalla-horno').style.display = 'none';
    controls.lock();
    actualizarUIInventario();
}

function soltarEnHorno(ev, slot) {
    ev.preventDefault();
    ev.stopPropagation();
    if (!hornoActualPos) return;
    var raw = '';
    try { raw = ev.dataTransfer.getData('text/plain') || ev.dataTransfer.getData('text') || ''; } catch (e) {}
    var tipo = resolverDragTipo(raw);
    if (!tipo || !inventarioRecursos[tipo] || inventarioRecursos[tipo] <= 0) return;

    var datos = obtenerDatosHorno(hornoActualPos.x, hornoActualPos.y, hornoActualPos.z);
    var maxS = (typeof maxStackItem === 'function') ? maxStackItem(tipo) : 64;
    var cuantos = (ev.shiftKey) ? inventarioRecursos[tipo] : 1;
    var movidos = 0;

    while (movidos < cuantos && inventarioRecursos[tipo] > 0) {
        if (slot === 'input') {
            if (!RECETAS_HORNO[tipo]) break;
            if (datos.input && datos.input.tipo !== tipo) break;
            if (datos.input && datos.input.cant >= maxS) break;
            if (!transferirUnoDesdeJugador(tipo)) break;
            if (!datos.input) { datos.input = { tipo: tipo, cant: 1 }; datos.progress = 0; }
            else datos.input.cant++;
            movidos++;
        } else if (slot === 'fuel') {
            if (!COMBUSTIBLES[tipo]) break;
            if (datos.fuel && datos.fuel.tipo !== tipo) break;
            if (datos.fuel && datos.fuel.cant >= maxS) break;
            if (!transferirUnoDesdeJugador(tipo)) break;
            if (!datos.fuel) datos.fuel = { tipo: tipo, cant: 1 };
            else datos.fuel.cant++;
            movidos++;
        } else {
            break;
        }
    }
    if (movidos > 0) {
        actualizarUIHorno();
        actualizarUIInventario();
    }
}

/** Clic desde inventario del panel del horno → meter 1 en entrada o fuel */
function meterEnHornoDesdeInv(tipo, ev) {
    if (!hornoActualPos || !tipo) return;
    if (!inventarioRecursos[tipo] || inventarioRecursos[tipo] <= 0) return;
    var datos = obtenerDatosHorno(hornoActualPos.x, hornoActualPos.y, hornoActualPos.z);
    var shift = ev && ev.shiftKey;
    var cuantos = shift ? inventarioRecursos[tipo] : 1;
    var movidos = 0;
    while (movidos < cuantos && inventarioRecursos[tipo] > 0) {
        if (RECETAS_HORNO[tipo]) {
            if (datos.input && datos.input.tipo !== tipo) break;
            var maxI = (typeof maxStackItem === 'function') ? maxStackItem(tipo) : 64;
            if (datos.input && datos.input.cant >= maxI) break;
            if (!transferirUnoDesdeJugador(tipo)) break;
            if (!datos.input) { datos.input = { tipo: tipo, cant: 1 }; datos.progress = 0; }
            else datos.input.cant++;
            movidos++;
        } else if (COMBUSTIBLES[tipo]) {
            if (datos.fuel && datos.fuel.tipo !== tipo) break;
            var maxF = (typeof maxStackItem === 'function') ? maxStackItem(tipo) : 64;
            if (datos.fuel && datos.fuel.cant >= maxF) break;
            if (!transferirUnoDesdeJugador(tipo)) break;
            if (!datos.fuel) datos.fuel = { tipo: tipo, cant: 1 };
            else datos.fuel.cant++;
            movidos++;
        } else {
            break;
        }
    }
    if (inventarioRecursos[tipo] > 0) {
        var origen = null, ix = -1;
        for (var a = 0; a < BARRA_SIZE; a++) if (barraSlots[a] === tipo) { origen = 'barra'; ix = a; break; }
        if (ix < 0) for (var b = 0; b < INV_SIZE; b++) if (invSlots[b] === tipo) { origen = 'inv'; ix = b; break; }
        if (origen != null) itemTransferSel = { origen: origen, index: ix, tipo: tipo };
    } else itemTransferSel = null;
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

    // Reasegurar drag & drop en slots del horno
    ['horno-input', 'horno-fuel'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.ondragover = permitirSoltar;
        el.ondrop = function (ev) {
            soltarEnHorno(ev, id === 'horno-input' ? 'input' : 'fuel');
        };
    });

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
    // Soportar TODOS los materiales (hierro, oro, diamante, etc.)
    const numMats = (materialesMundo && materialesMundo.length) ? materialesMundo.length : 26;
    let posPorMaterial = {};
    let uvPorMaterial = {};
    let indicesPorMaterial = {};
    let indicesOffset = {};
    for (let mi = 0; mi < numMats; mi++) {
        posPorMaterial[mi] = [];
        uvPorMaterial[mi] = [];
        indicesPorMaterial[mi] = [];
        indicesOffset[mi] = 0;
    }

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
        else if (id === 26) matSubId = 20; // Mena hierro
        else if (id === 27) matSubId = 21; // Bloque hierro
        else if (id === 28) matSubId = 22; // Mena oro
        else if (id === 29) matSubId = 23; // Bloque oro
        else if (id === 30) matSubId = 24; // Mena diamante
        else if (id === 31) matSubId = 25; // Bloque diamante
        else if (id === 32) matSubId = 26; // Mena carbón
        else if (id === 33) matSubId = 27; // Bloque carbón
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

        if (posPorMaterial[matSubId] === undefined) matSubId = 0; // fallback textura piedra
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
    let gruposMateriales = [];
    for (let mi = 0; mi < numMats; mi++) gruposMateriales.push(mi);

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
    if (modoCreativo) return;
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
        zombi: 'Un zombi te ha matado',
        arana: 'Una araña te ha matado',
        creeper: 'Un creeper te ha explotado',
        muerte: 'Has muerto'
    };
    const elMotivo = document.getElementById('motivo-muerte');
    if (elMotivo) elMotivo.textContent = textos[motivo] || ('Has muerto (' + motivo + ')');

    var btnR = document.querySelector('#pantalla-muerte .btn-respawn');
    if (btnR) {
        if (typeof modoVidasActivo !== 'undefined' && modoVidasActivo) {
            if ((vidasRestantes | 0) <= 0) {
                btnR.style.display = 'none';
                if (elMotivo) elMotivo.textContent += ' · Sin vidas. Solo puedes salir al menú.';
            } else {
                btnR.style.display = '';
                btnR.textContent = 'Reaparecer (' + vidasRestantes + ' vida' + (vidasRestantes === 1 ? '' : 's') + ')';
            }
        } else {
            btnR.style.display = '';
            btnR.textContent = 'Reaparecer';
        }
    }
    document.getElementById('pantalla-muerte').style.display = 'flex';
    try { controls.unlock(); } catch (e) {}
    document.getElementById('bloqueo-pantalla').style.display = 'none';
}

function elegirRespawn() {
    if (typeof modoVidasActivo !== 'undefined' && modoVidasActivo) {
        if ((vidasRestantes | 0) <= 0) {
            alert('No te quedan vidas. Sal al menú o desactiva el modo 3 vidas en creativo (Alt+C).');
            return;
        }
        vidasRestantes = (vidasRestantes | 0) - 1;
        if (window.MateQuiz && MateQuiz.actualizarHUD) MateQuiz.actualizarHUD();
        if (vidasRestantes <= 0) {
            // Última vida consumida al reaparecer: la siguiente muerte no podrá
        }
    }
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
    // En Three r128 getObject() === camera
    var obj = getPlayerObject();
    x = Math.floor(x);
    z = Math.floor(z);
    // Buscar el bloque sólido más alto con 2 espacios de aire encima
    for (let y = tamMundoY - 3; y >= 1; y--) {
        let id = obtenerIdVoxel(x, y, z);
        if (id === 0 || id === 7 || id === 4) continue; // aire, agua, hojas
        let a1 = obtenerIdVoxel(x, y + 1, z);
        let a2 = obtenerIdVoxel(x, y + 2, z);
        if ((a1 === 0 || a1 === 7) && (a2 === 0 || a2 === 7)) {
            obj.position.set(x + 0.0, y + 0.5 + ojosJugador, z + 0.0);
            velocityY = 0;
            distanciaCaida = 0;
            enSuelo = true;
            return true;
        }
    }
    // Fallback: bajar desde arriba hasta encontrar suelo (NO quedarse en el cielo)
    for (let y = tamMundoY - 2; y >= 2; y--) {
        let id = obtenerIdVoxel(x, y, z);
        if (id !== 0 && id !== 7) {
            obj.position.set(x, y + 0.5 + ojosJugador, z);
            velocityY = 0;
            distanciaCaida = 0;
            enSuelo = true;
            return true;
        }
    }
    obj.position.set(x, 20, z);
    velocityY = 0;
    distanciaCaida = 0;
    enSuelo = true;
    return false;
}

function encontrarSpawnSeguro() {
    var obj = getPlayerObject();
    const offsets = [[0,0],[3,3],[-3,3],[3,-3],[-3,-3],[6,0],[-6,0],[0,6],[0,-6],[10,10],[-10,8],[8,-10]];
    for (const [ox, oz] of offsets) {
        if (colocarJugadorEnSuelo(ox, oz)) {
            // Empujar hacia arriba por si quedó rozando un bloque
            let safety = 0;
            while (colisionaConCajaJugadorPuro(obj.position.x, obj.position.y, obj.position.z) && safety < 40) {
                obj.position.y += 0.5;
                safety++;
            }
            velocityY = 0;
            enSuelo = true;
            return;
        }
    }
    colocarJugadorEnSuelo(0, 0);
    let safety = 0;
    while (colisionaConCajaJugadorPuro(obj.position.x, obj.position.y, obj.position.z) && safety < 80) {
        obj.position.y += 0.5;
        safety++;
    }
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

