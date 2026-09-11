/**
 * Mate-Craft — Quiz + niveles XP + guía de hitos
 */
(function (global) {
    'use strict';

    /** Hitos en orden de guía (meta final: bloqd) */
    var GUIA_ORDEN = [
        // Base
        'tablon', 'palito', 'mesacra',
        // Madera
        'picm', 'hachm', 'espm', 'palam',
        // Piedra / cocina
        'picp', 'horno', 'carbon',
        // Comida básica
        'manzana', 'carne', 'carnec',
        // Animales
        'lana', 'carne2', 'carnec2', 'carne3', 'carnec3', 'carne4', 'carnec4',
        // Hostiles
        'carnepodrida', 'hilo', 'polvora',
        // Hierro
        'hierro', 'pich', 'bloqh',
        // Oro
        'oro', 'pico', 'bloqo',
        // Diamante
        'diamante', 'picd', 'bloqd',
        // Meta final
        'manzanad'
    ];

    var HITOS = {
        tablon:   { nivel: 1, titulo: 'Tablones', xp: 10 },
        palito:   { nivel: 1, titulo: 'Palos', xp: 10 },
        mesacra:  { nivel: 2, titulo: 'Mesa de crafteo', xp: 25 },
        picm:     { nivel: 2, titulo: 'Pico de madera', xp: 20 },
        hachm:    { nivel: 2, titulo: 'Hacha de madera', xp: 15 },
        espm:     { nivel: 2, titulo: 'Espada de madera', xp: 15 },
        palam:    { nivel: 2, titulo: 'Pala de madera', xp: 15 },
        picp:     { nivel: 3, titulo: 'Pico de piedra', xp: 30 },
        hachp:    { nivel: 3, titulo: 'Hacha de piedra', xp: 25 },
        espp:     { nivel: 3, titulo: 'Espada de piedra', xp: 25 },
        palap:    { nivel: 3, titulo: 'Pala de piedra', xp: 25 },
        horno:    { nivel: 3, titulo: 'Horno', xp: 35 },
        carbon:   { nivel: 3, titulo: 'Carbón', xp: 20 },
        manzana:  { nivel: 2, titulo: 'Manzana', xp: 20 },
        carne:    { nivel: 2, titulo: 'Carne cruda (pollo)', xp: 15 },
        carnec:   { nivel: 3, titulo: 'Carne cocinada (pollo)', xp: 25 },
        carne2:   { nivel: 2, titulo: 'Carne cruda (cerdo)', xp: 15 },
        carnec2:  { nivel: 3, titulo: 'Carne cocinada (cerdo)', xp: 25 },
        carne3:   { nivel: 2, titulo: 'Carne cruda (vaca)', xp: 15 },
        carnec3:  { nivel: 3, titulo: 'Carne cocinada (vaca)', xp: 25 },
        carne4:   { nivel: 2, titulo: 'Carne cruda (oveja)', xp: 15 },
        carnec4:  { nivel: 3, titulo: 'Carne cocinada (oveja)', xp: 25 },
        lana:     { nivel: 2, titulo: 'Lana', xp: 20 },
        carnepodrida: { nivel: 3, titulo: 'Carne de zombi', xp: 30 },
        hilo:     { nivel: 3, titulo: 'Hilo (araña)', xp: 25 },
        polvora:  { nivel: 4, titulo: 'Pólvora (creeper)', xp: 40 },
        hierro:   { nivel: 4, titulo: 'Lingote de hierro', xp: 40 },
        pich:     { nivel: 4, titulo: 'Pico de hierro', xp: 45 },
        hachh:    { nivel: 4, titulo: 'Hacha de hierro', xp: 40 },
        esph:     { nivel: 4, titulo: 'Espada de hierro', xp: 40 },
        palah:    { nivel: 4, titulo: 'Pala de hierro', xp: 40 },
        bloqh:    { nivel: 4, titulo: 'Bloque de hierro', xp: 50 },
        oro:      { nivel: 5, titulo: 'Lingote de oro', xp: 50 },
        pico:     { nivel: 5, titulo: 'Pico de oro', xp: 55 },
        hacho:    { nivel: 5, titulo: 'Hacha de oro', xp: 50 },
        espo:     { nivel: 5, titulo: 'Espada de oro', xp: 50 },
        bloqo:    { nivel: 5, titulo: 'Bloque de oro', xp: 60 },
        diamante: { nivel: 5, titulo: 'Diamante', xp: 70 },
        picd:     { nivel: 5, titulo: 'Pico de diamante', xp: 80 },
        hachd:    { nivel: 5, titulo: 'Hacha de diamante', xp: 75 },
        espd:     { nivel: 5, titulo: 'Espada de diamante', xp: 75 },
        bloqd:    { nivel: 5, titulo: 'Bloque de diamante', xp: 100 },
        manzanad: { nivel: 5, titulo: 'Manzana dorada (META)', xp: 120 }
    };

    var pendiente = null;
    var preguntaActual = null;
    /** Evita re-disparar quiz al entregar el premio */
    var mateQuizEntregando = false;
    /** Ítems que se obtienen por drop/horno (no crafteo): se quitan si fallas */
    var HITOS_OBTENER = {
        manzana: 1, carne: 1, carnec: 1, carne2: 1, carnec2: 1, carne3: 1, carnec3: 1,
        carne4: 1, carnec4: 1, lana: 1, carnepodrida: 1, hilo: 1, polvora: 1,
        hierro: 1, oro: 1, diamante: 1, carbon: 1, manzanad: 1
    };

    function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

    /** XP necesaria para pasar del nivel n al n+1 */
    function xpParaNivel(n) {
        return 40 + (n - 1) * 35;
    }

    function recalcularNivel() {
        if (typeof mateXP === 'undefined') return;
        var niv = 1;
        var xp = mateXP | 0;
        var need = xpParaNivel(niv);
        while (xp >= need && niv < 50) {
            xp -= need;
            niv++;
            need = xpParaNivel(niv);
        }
        mateNivel = niv;
        return { nivel: niv, xpEnNivel: xp, xpNecesaria: need };
    }

    function sumarXP(cant) {
        if (typeof mateXP === 'undefined') return;
        mateXP = (mateXP | 0) + (cant | 0);
        recalcularNivel();
        actualizarHUD();
    }

    function actualizarHUD() {
        var info = recalcularNivel();
        var nEl = document.getElementById('hud-nivel-num');
        var xEl = document.getElementById('hud-xp');
        var vEl = document.getElementById('hud-vidas');
        if (nEl) nEl.textContent = String(info.nivel);
        if (xEl) xEl.textContent = String(mateXP | 0);
        if (vEl) {
            if (typeof modoVidasActivo !== 'undefined' && modoVidasActivo) {
                vEl.textContent = ' · Vidas ' + (vidasRestantes | 0) + '/' + (VIDAS_MAX || 3);
            } else {
                vEl.textContent = '';
            }
        }
        var fill = document.getElementById('stats-barra-xp-fill');
        if (fill && info.xpNecesaria > 0) {
            fill.style.width = Math.min(100, (info.xpEnNivel / info.xpNecesaria) * 100) + '%';
        }
    }

    function generarPregunta(nivel) {
        nivel = Math.max(1, Math.min(5, nivel | 0));
        var bank = [];

        // --- Nivel 1 ---
        bank.push(function () {
            var a = rnd(12, 48), b = rnd(8, 36);
            return { q: 'Calcula: ' + a + ' + ' + b + ' × 2 (jerarquía de operaciones)', a: String(a + b * 2) };
        });
        bank.push(function () {
            var a = rnd(20, 50), b = rnd(3, 9);
            return { q: '¿Cuánto es ' + a + ' − ' + b + '²?', a: String(a - b * b) };
        });
        bank.push(function () {
            var p = rnd(2, 9) * 10, t = rnd(40, 120);
            return { q: '¿Cuánto es el ' + p + '% de ' + t + '?', a: String(Math.round(t * p / 100)) };
        });
        bank.push(function () {
            var a = rnd(15, 40), b = rnd(2, 8), c = rnd(3, 9);
            return { q: 'Calcula: (' + a + ' + ' + b + ') × ' + c, a: String((a + b) * c) };
        });
        bank.push(function () {
            var a = rnd(48, 120), b = rnd(4, 12);
            return { q: 'División exacta: ' + a + ' ÷ ' + b + ' (solo el cociente)', a: String(Math.floor(a / b) === a / b ? a / b : Math.round(a / b)) };
        });
        // force exact division
        bank.push(function () {
            var b = rnd(4, 12), q = rnd(5, 15);
            return { q: '¿Cuánto es ' + (b * q) + ' ÷ ' + b + '?', a: String(q) };
        });

        if (nivel >= 2) {
            bank.push(function () {
                var x = rnd(3, 12), c = rnd(2, 8);
                var b = rnd(-5, 8);
                var d = c * x + b;
                return { q: 'Resuelve para x: ' + c + 'x + (' + b + ') = ' + d, a: String(x) };
            });
            bank.push(function () {
                var a = rnd(2, 6), x = rnd(4, 15);
                return { q: 'Si ' + a + 'x = ' + (a * x) + ', ¿cuánto vale x?', a: String(x) };
            });
            bank.push(function () {
                var a = rnd(2, 5), b = rnd(3, 7), x = rnd(4, 10);
                return { q: 'Proporción: ' + a + '/' + b + ' = ' + (a * x) + '/?. ¿El ?', a: String(b * x) };
            });
            bank.push(function () {
                var a = rnd(5, 15), b = rnd(2, 6);
                return { q: 'Despeja x: x/ ' + b + ' = ' + a + '. ¿x?', a: String(a * b) };
            });
            bank.push(function () {
                var f1 = rnd(2, 5), f2 = rnd(2, 5), d = rnd(2, 4);
                return { q: 'Suma de fracciones con mismo denominador: ' + f1 + '/' + d + ' + ' + f2 + '/' + d + ' = ? (solo numerador, denom. ' + d + ')', a: String(f1 + f2) };
            });
        }

        if (nivel >= 3) {
            bank.push(function () {
                var x = rnd(2, 8), y = rnd(2, 8);
                return { q: 'Sistema: x+y=' + (x + y) + ' ; x−y=' + (x - y) + '. ¿x?', a: String(x) };
            });
            bank.push(function () {
                var a = rnd(2, 5), n = rnd(2, 4);
                return { q: 'Calcula: (' + a + ')³ − ' + n + '²', a: String(a * a * a - n * n) };
            });
            bank.push(function () {
                var b = rnd(3, 9), c = rnd(2, 6);
                return { q: '(x+' + b + ')(x+' + c + ')=x²+□x+' + (b * c) + '. ¿□?', a: String(b + c) };
            });
            bank.push(function () {
                var a = rnd(3, 9), b = rnd(2, 7);
                return { q: 'Media aritmética de ' + a + ' y ' + b + ' (entero si cabe, o truncado)', a: String(Math.floor((a + b) / 2) === (a + b) / 2 ? (a + b) / 2 : (a + b) / 2) };
            });
            bank.push(function () {
                var a = rnd(3, 9), b = rnd(2, 7);
                var s = a + b;
                if (s % 2 === 1) b++;
                return { q: 'Media aritmética de ' + a + ' y ' + b, a: String((a + b) / 2) };
            });
            bank.push(function () {
                var l = rnd(4, 12), an = rnd(3, 10);
                return { q: 'Área de un rectángulo ' + l + ' × ' + an, a: String(l * an) };
            });
        }

        if (nivel >= 4) {
            bank.push(function () {
                var r = rnd(3, 9);
                return { q: 'Resuelve: x² = ' + (r * r) + ' (solución positiva)', a: String(r) };
            });
            bank.push(function () {
                var a = rnd(2, 5), b = rnd(1, 4), x = rnd(3, 8);
                return { q: 'Resuelve: ' + a + '(x+' + b + ') = ' + (a * (x + b)) + '. ¿x?', a: String(x) };
            });
            bank.push(function () {
                var n = rnd(4, 12);
                return { q: '¿√' + (n * n) + ' ?', a: String(n) };
            });
            bank.push(function () {
                var a = rnd(5, 12);
                return { q: 'Evalúa 3x² · 2x con x=' + a, a: String(6 * a * a * a) };
            });
            bank.push(function () {
                var a = rnd(-5, -1), b = rnd(2, 8);
                return { q: 'Producto de enteros: (' + a + ')×(' + b + ')', a: String(a * b) };
            });
            bank.push(function () {
                var m = rnd(2, 6), n = rnd(2, 5);
                return { q: 'Potencia: ' + m + '² × ' + n, a: String(m * m * n) };
            });
        }

        if (nivel >= 5) {
            bank.push(function () {
                var x = rnd(2, 6), y = rnd(2, 6);
                return { q: '2x+3y=' + (2 * x + 3 * y) + ' y x=' + x + '. ¿y?', a: String(y) };
            });
            bank.push(function () {
                var a = rnd(2, 4), b = rnd(3, 7);
                return { q: 'Discriminante de x²−' + (a + b) + 'x+' + (a * b) + '=0', a: String((a - b) * (a - b)) };
            });
            bank.push(function () {
                var n = rnd(5, 15);
                return { q: 'Suma de raíces de x² − ' + n + 'x = 0', a: String(n) };
            });
            bank.push(function () {
                var a = rnd(10, 25), r = rnd(10, 40);
                return { q: 'Precio $' + a + ' sube ' + r + '%. ¿Precio final (entero)?', a: String(Math.round(a * (1 + r / 100))) };
            });
            bank.push(function () {
                var a = rnd(2, 5), b = rnd(3, 8), c = rnd(1, 4);
                // (a+b)² = a²+2ab+b²
                return { q: 'Expande y evalúa (x+' + b + ')² con x=' + a + ' (valor numérico)', a: String((a + b) * (a + b)) };
            });
            bank.push(function () {
                var a = rnd(4, 10), b = rnd(2, 5);
                return { q: '¿Cuánto es ' + a + '! / ' + b + '! solo si cabe… mejor: ' + a + '×(' + a + '-1)', a: String(a * (a - 1)) };
            });
        }

        var gen = bank[rnd(0, bank.length - 1)];
        return gen();
    }

    function normalizar(s) {
        s = String(s == null ? '' : s).trim().replace(',', '.');
        s = s.replace(/\s+/g, '');
        if (/^-?\d+\/\d+$/.test(s)) {
            var p = s.split('/');
            var v = Number(p[0]) / Number(p[1]);
            if (isFinite(v)) return String(v);
        }
        var n = Number(s);
        if (isFinite(n)) {
            if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
            return String(n);
        }
        return s.toLowerCase();
    }

    function respuestasIguales(user, correcta) {
        var u = normalizar(user), c = normalizar(correcta);
        if (u === c) return true;
        var nu = Number(u), nc = Number(c);
        return isFinite(nu) && isFinite(nc) && Math.abs(nu - nc) < 1e-6;
    }

    function pausarJuego() {
        try { if (controls && controls.isLocked) controls.unlock(); } catch (e) {}
        var bloqueo = document.getElementById('bloqueo-pantalla');
        if (bloqueo) bloqueo.style.display = 'none';
        }

    function mostrarQuiz(hitoKey, tipo, cantidad) {
        var info = HITOS[hitoKey] || { nivel: 2, titulo: 'Progreso', xp: 15 };
        pendiente = { tipo: tipo, cantidad: cantidad, hito: hitoKey, nivel: info.nivel, titulo: info.titulo, xp: info.xp || 15 };
        preguntaActual = generarPregunta(info.nivel);
        var pant = document.getElementById('pantalla-matequiz');
        if (!pant) return false;
        document.getElementById('matequiz-hito').textContent = info.titulo + ' · Nivel pregunta ' + info.nivel + '/5 · +' + (info.xp || 15) + ' XP';
        document.getElementById('matequiz-enunciado').textContent = preguntaActual.q;
        document.getElementById('matequiz-respuesta').value = '';
        document.getElementById('matequiz-feedback').textContent = '';
        document.getElementById('matequiz-feedback').className = 'matequiz-feedback';
        pant.style.display = 'flex';
        pausarJuego();
        setTimeout(function () {
            var inp = document.getElementById('matequiz-respuesta');
            if (inp) inp.focus();
        }, 80);
        return true;
    }

    function cerrarQuiz() {
        var pant = document.getElementById('pantalla-matequiz');
        if (pant) pant.style.display = 'none';
        pendiente = null;
        preguntaActual = null;
        }

    function entregarCraft() {
        if (!pendiente) return;
        var t = pendiente.tipo, c = pendiente.cantidad, h = pendiente.hito, xp = pendiente.xp || 15;
        // En modo obtener el ítem ya está en el inventario
        if (pendiente.modo !== 'obtener') {
            mateQuizEntregando = true;
            try {
                if (typeof anadirItem === 'function') anadirItem(t, c);
            } finally {
                mateQuizEntregando = false;
            }
        }
        if (typeof mateHitosSuperados !== 'undefined') mateHitosSuperados[h] = true;
        sumarXP(xp);
        if (typeof actualizarUIInventario === 'function') actualizarUIInventario();
        if (typeof inventarioAbierto !== 'undefined' && inventarioAbierto && typeof actualizarUICrafteo === 'function') {
            actualizarUICrafteo();
        }
    }

    function enviarRespuesta() {
        if (!pendiente || !preguntaActual) return;
        var inp = document.getElementById('matequiz-respuesta');
        var fb = document.getElementById('matequiz-feedback');
        var val = inp ? inp.value : '';
        if (respuestasIguales(val, preguntaActual.a)) {
            fb.textContent = '¡Correcto! +' + (pendiente.xp || 15) + ' XP';
            fb.className = 'matequiz-feedback ok';
            entregarCraft();
            setTimeout(cerrarQuiz, 750);
        } else {
            fb.textContent = 'Incorrecto. Pierdes el progreso de este hito. (Era: ' + preguntaActual.a + ')';
            fb.className = 'matequiz-feedback bad';
            // Si era obtención (drop), quitar el ítem ganado
            if (pendiente && pendiente.modo === 'obtener' && typeof inventarioRecursos !== 'undefined') {
                var tt = pendiente.tipo;
                var qq = pendiente.cantidad | 0;
                inventarioRecursos[tt] = Math.max(0, (inventarioRecursos[tt] | 0) - qq);
            }
            if (typeof actualizarUIInventario === 'function') actualizarUIInventario();
            setTimeout(cerrarQuiz, 1400);
        }
    }

    function interceptarCraft(tipo, cantidad) {
        if (typeof mateQuizActivo !== 'undefined' && !mateQuizActivo) return false;
        if (typeof modoCreativo !== 'undefined' && modoCreativo) return false;
        if (mateQuizEntregando) return false;
        if (!HITOS[tipo]) return false;
        if (typeof mateHitosSuperados !== 'undefined' && mateHitosSuperados[tipo]) return false;
        return mostrarQuiz(tipo, tipo, cantidad || 1);
    }

    /**
     * Tras obtener un ítem (drop, horno, etc.). Si es hito nuevo, lanza quiz.
     * Si falla, se quita la cantidad obtenida.
     */
    function onItemObtenido(tipo, cantidad) {
        if (mateQuizEntregando) return false;
        if (typeof mateQuizActivo !== 'undefined' && !mateQuizActivo) return false;
        if (typeof modoCreativo !== 'undefined' && modoCreativo) return false;
        if (!HITOS[tipo] || !HITOS_OBTENER[tipo]) return false;
        if (typeof mateHitosSuperados !== 'undefined' && mateHitosSuperados[tipo]) return false;
        // Mostrar quiz; el ítem ya está en inventario (se quita si falla)
        var ok = mostrarQuiz(tipo, tipo, cantidad || 1);
        if (ok && pendiente) pendiente.modo = 'obtener';
        return ok;
    }

    function iconoHito(tipo) {
        if (typeof texturasIconos !== 'undefined' && texturasIconos[tipo]) {
            return 'texturas/' + texturasIconos[tipo];
        }
        return '';
    }

    function abrirEstadisticas() {
        var pant = document.getElementById('pantalla-stats');
        if (!pant) return;
        var info = recalcularNivel();
        var linea = document.getElementById('stats-nivel-linea');
        if (linea) linea.textContent = 'Nivel ' + info.nivel + ' · ' + (mateXP | 0) + ' XP total · ' + info.xpEnNivel + '/' + info.xpNecesaria + ' al siguiente';
        var vl = document.getElementById('stats-vidas-linea');
        if (vl) {
            if (modoVidasActivo) vl.textContent = 'Modo 3 vidas: ' + (vidasRestantes | 0) + ' restantes';
            else vl.textContent = 'Modo 3 vidas: desactivado';
        }
        actualizarHUD();
        var cont = document.getElementById('stats-hitos');
        if (cont) {
            cont.innerHTML = '';
            GUIA_ORDEN.forEach(function (tipo) {
                var h = HITOS[tipo];
                if (!h) return;
                var div = document.createElement('div');
                var hecho = mateHitosSuperados && mateHitosSuperados[tipo];
                div.className = 'stats-hito' + (hecho ? ' hecho' : '');
                var src = iconoHito(tipo);
                var ico = src
                    ? '<div class="ico" style="background-image:url(\'' + src + '\')"></div>'
                    : '<div class="ico"></div>';
                div.innerHTML = ico + '<div class="nom">' + (hecho ? '✓ ' : '') + h.titulo + '</div>';
                cont.appendChild(div);
            });
        }
        pant.style.display = 'flex';
        pausarJuego();
        var bloqueo = document.getElementById('bloqueo-pantalla');
        if (bloqueo) bloqueo.style.display = 'none';
    }

    function cerrarEstadisticas() {
        var pant = document.getElementById('pantalla-stats');
        if (pant) pant.style.display = 'none';
        var bloqueo = document.getElementById('bloqueo-pantalla');
        if (bloqueo) bloqueo.style.display = 'flex';
    }

    function actualizarBotonQuizUI() {
        var btn = document.getElementById('btn-creativo-quiz');
        if (!btn) return;
        var on = typeof mateQuizActivo === 'undefined' ? true : !!mateQuizActivo;
        btn.textContent = on ? 'Mate-Quiz: ON' : 'Mate-Quiz: OFF';
        btn.classList.toggle('quiz-off', !on);
        var bv = document.getElementById('btn-creativo-vidas');
        if (bv) {
            var von = typeof modoVidasActivo === 'undefined' ? true : !!modoVidasActivo;
            bv.textContent = von ? 'Modo 3 vidas: ON' : 'Modo 3 vidas: OFF';
            bv.classList.toggle('quiz-off', !von);
        }
    }

    function toggleQuiz() {
        mateQuizActivo = !mateQuizActivo;
        actualizarBotonQuizUI();
    }

    function toggleVidas() {
        modoVidasActivo = !modoVidasActivo;
        if (modoVidasActivo && (vidasRestantes | 0) <= 0) vidasRestantes = VIDAS_MAX || 3;
        actualizarBotonQuizUI();
        actualizarHUD();
    }

    function limpiarInventarioCreativo() {
        if (!confirm('¿Vaciar TODO el inventario?')) return;
        for (var k in inventarioRecursos) {
            if (Object.prototype.hasOwnProperty.call(inventarioRecursos, k)) inventarioRecursos[k] = 0;
        }
        if (typeof barraSlots !== 'undefined') for (var i = 0; i < barraSlots.length; i++) barraSlots[i] = null;
        if (typeof invSlots !== 'undefined') for (var j = 0; j < invSlots.length; j++) invSlots[j] = null;
        if (typeof actualizarUIInventario === 'function') actualizarUIInventario();
    }

    function enlazarUI() {
        var btn = document.getElementById('matequiz-enviar');
        if (btn) btn.onclick = function (e) { e.preventDefault(); enviarRespuesta(); };
        var inp = document.getElementById('matequiz-respuesta');
        if (inp) inp.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); enviarRespuesta(); }
        });
        var bQuiz = document.getElementById('btn-creativo-quiz');
        if (bQuiz) bQuiz.onclick = function (e) { e.preventDefault(); toggleQuiz(); };
        var bVidas = document.getElementById('btn-creativo-vidas');
        if (bVidas) bVidas.onclick = function (e) { e.preventDefault(); toggleVidas(); };
        var bLimpiar = document.getElementById('btn-creativo-limpiar');
        if (bLimpiar) bLimpiar.onclick = function (e) { e.preventDefault(); limpiarInventarioCreativo(); };
        var bStats = document.getElementById('btn-estadisticas');
        if (bStats) bStats.onclick = function (e) { e.preventDefault(); e.stopPropagation(); abrirEstadisticas(); };
        var bCerrarStats = document.getElementById('btn-cerrar-stats');
        if (bCerrarStats) bCerrarStats.onclick = function (e) { e.preventDefault(); cerrarEstadisticas(); };
        var bGuardar = document.getElementById('btn-guardar');
        if (bGuardar) bGuardar.onclick = function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof guardarMundo === 'function') {
                Promise.resolve(guardarMundo(true)).then(function () {
                    var fb = document.getElementById('estado-guardado');
                    // ya muestra estado
                });
            }
        };
        actualizarBotonQuizUI();
        actualizarHUD();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enlazarUI);
    else enlazarUI();

    global.MateQuiz = {
        interceptarCraft: interceptarCraft,
        onItemObtenido: onItemObtenido,
        HITOS: HITOS,
        GUIA_ORDEN: GUIA_ORDEN,
        actualizarBotonQuizUI: actualizarBotonQuizUI,
        actualizarHUD: actualizarHUD,
        toggleQuiz: toggleQuiz,
        toggleVidas: toggleVidas,
        limpiarInventario: limpiarInventarioCreativo,
        abrirEstadisticas: abrirEstadisticas,
        sumarXP: sumarXP,
        recalcularNivel: recalcularNivel
    };
})(window);