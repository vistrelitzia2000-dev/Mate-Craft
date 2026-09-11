/**
 * Creeper — se acerca, ofrece pregunta para desactivar la explosión o pelear
 */
(function () {
    'use strict';
    if (!window.MateCraftMobs) return;

    var retoActivo = false; // evita varios diálogos a la vez

    function createMesh(THREE) {
        var g = new THREE.Group();
        var verde = 0x3d8f3d;
        var oscuro = 0x1a3d1a;
        // cuerpo alto
        var cuerpo = new THREE.Mesh(
            new THREE.BoxGeometry(0.55, 1.1, 0.4),
            new THREE.MeshBasicMaterial({ color: verde })
        );
        cuerpo.position.y = 0.85;
        g.add(cuerpo);
        // cabeza
        var cabeza = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.45, 0.45),
            new THREE.MeshBasicMaterial({ color: verde })
        );
        cabeza.position.y = 1.55;
        g.add(cabeza);
        // cara oscura
        var cara = new THREE.Mesh(
            new THREE.BoxGeometry(0.36, 0.28, 0.06),
            new THREE.MeshBasicMaterial({ color: oscuro })
        );
        cara.position.set(0, 1.55, 0.22);
        g.add(cara);
        // pies
        var p1 = new THREE.Mesh(
            new THREE.BoxGeometry(0.22, 0.35, 0.22),
            new THREE.MeshBasicMaterial({ color: oscuro })
        );
        p1.position.set(-0.14, 0.18, 0);
        g.add(p1);
        var p2 = p1.clone();
        p2.position.x = 0.14;
        g.add(p2);
        g.userData.cabeza = cabeza;
        return g;
    }

    function abrirRetoCreeper(entity, h) {
        if (retoActivo || entity._retoHecho) return;
        if (typeof modoCreativo !== 'undefined' && modoCreativo) return;
        if (typeof jugadorMuerto !== 'undefined' && jugadorMuerto) return;
        retoActivo = true;
        entity._retoHecho = true;
        entity.estado = 'fuse';
        entity.targetSpeed = 0;
        entity.speed = 0;

        try { if (controls && controls.isLocked) controls.unlock(); } catch (e) {}

        var pant = document.getElementById('pantalla-creeper');
        if (!pant) {
            retoActivo = false;
            return;
        }
        pant.style.display = 'flex';
        var fb = document.getElementById('creeper-feedback');
        if (fb) { fb.textContent = ''; fb.className = 'matequiz-feedback'; }
        var inp = document.getElementById('creeper-respuesta');
        if (inp) inp.value = '';
        var preg = document.getElementById('creeper-pregunta');
        var quizBox = document.getElementById('creeper-quiz-box');
        var choiceBox = document.getElementById('creeper-choice-box');
        if (quizBox) quizBox.style.display = 'none';
        if (choiceBox) choiceBox.style.display = 'block';

        // Guardar ref
        window.__creeperReto = { entity: entity, h: h, pregunta: null };

        document.getElementById('creeper-btn-quiz').onclick = function () {
            if (choiceBox) choiceBox.style.display = 'none';
            if (quizBox) quizBox.style.display = 'block';
            // pregunta nivel 3-4
            var p = null;
            if (window.MateQuiz && typeof MateQuiz !== 'undefined') {
                // generar con bank interno simple
            }
            p = generarPreguntaCreeper();
            window.__creeperReto.pregunta = p;
            if (preg) preg.textContent = p.q;
            if (inp) setTimeout(function () { inp.focus(); }, 50);
        };
        document.getElementById('creeper-btn-pelear').onclick = function () {
            cerrarRetoCreeper(false);
            // Pelear: creeper se enfada y explota si sigue cerca
            entity.estado = 'pelea';
            entity.fuse = 2.8;
            entity.targetSpeed = 1.6;
            retoActivo = false;
        };
        document.getElementById('creeper-btn-responder').onclick = function () {
            var val = inp ? inp.value : '';
            var ok = respuestasCreeper(val, window.__creeperReto.pregunta && window.__creeperReto.pregunta.a);
            if (ok) {
                if (fb) { fb.textContent = '¡Desactivado! El creeper huye.'; fb.className = 'matequiz-feedback ok'; }
                setTimeout(function () {
                    cerrarRetoCreeper(true);
                    // matar creeper sin drop de explosión
                    if (h && h.matar) h.matar(entity);
                    else if (window.MateCraftMobs && MateCraftMobs.kill) MateCraftMobs.kill(entity);
                    retoActivo = false;
                }, 600);
            } else {
                if (fb) { fb.textContent = 'Fallaste... ¡BOOM!'; fb.className = 'matequiz-feedback bad'; }
                setTimeout(function () {
                    cerrarRetoCreeper(true);
                    retoActivo = false;
                    if (typeof aplicarDanio === 'function') aplicarDanio(999, 'creeper');
                    else if (typeof morirJugador === 'function') morirJugador('creeper');
                }, 700);
            }
        };
    }

    function cerrarRetoCreeper() {
        var pant = document.getElementById('pantalla-creeper');
        if (pant) pant.style.display = 'none';
        window.__creeperReto = null;
        }

    function generarPreguntaCreeper() {
        function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
        var ops = [
            function () { var a = rnd(10, 30), b = rnd(5, 15); return { q: a + ' × ' + b + ' − ' + rnd(2, 9) + ' = ?', a: null, _a: a, _b: b }; },
        ];
        var a = rnd(8, 25), b = rnd(6, 18), c = rnd(2, 9);
        return { q: 'Calcula: ' + a + ' × ' + b + ' − ' + c, a: String(a * b - c) };
    }

    function respuestasCreeper(user, correcta) {
        if (correcta == null) return false;
        var u = String(user || '').trim().replace(',', '.');
        var n = Number(u), c = Number(correcta);
        if (isFinite(n) && isFinite(c) && Math.abs(n - c) < 1e-6) return true;
        return String(u) === String(correcta);
    }

    function onUpdate(e, delta, h) {
        var pos = e.mesh.position;
        var player = h.getPlayerPos && h.getPlayerPos();
        e.fuse = (e.fuse != null ? e.fuse : -1);

        // Parpadeo si fuse
        if (e.estado === 'pelea' || e.estado === 'fuse') {
            if (e.mesh) {
                var flash = (Math.floor(performance.now() / 120) % 2) === 0;
                e.mesh.traverse(function (c) {
                    if (c.material && c.material.color && e.flashRojo <= 0) {
                        c.material.color.setHex(flash ? 0x88ff88 : 0x3d8f3d);
                    }
                });
            }
        }

        if (e.estado === 'pelea' && e.fuse >= 0) {
            e.fuse -= delta;
            if (player) {
                var dx = player.x - pos.x, dz = player.z - pos.z;
                var dist = Math.sqrt(dx * dx + dz * dz);
                e.targetDir = Math.atan2(dx, dz);
                e.dir = e.targetDir;
                e.speed = 1.5;
                if (dist < 2.2 && e.fuse <= 0) {
                    // Explota
                    if (typeof aplicarDanio === 'function') aplicarDanio(999, 'creeper');
                    if (h.matar) h.matar(e);
                    return;
                }
                if (e.fuse <= 0 && dist >= 2.2) {
                    // Jugador escapó: explota en el sitio sin matar si lejos... aún daño si < 4
                    if (dist < 4 && typeof aplicarDanio === 'function') aplicarDanio(8, 'creeper');
                    if (h.matar) h.matar(e);
                    return;
                }
            }
        }

        if (player && !retoActivo && e.estado !== 'pelea') {
            var dx = player.x - pos.x;
            var dz = player.z - pos.z;
            var dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 22) {
                e.estado = 'chase';
                e.targetDir = Math.atan2(dx, dz);
                e.dir = e.targetDir;
                e.targetSpeed = 1.25;
                e.speed = 1.25;
                if (dist < 2.6 && !e._retoHecho) {
                    abrirRetoCreeper(e, h);
                    return;
                }
                var step = e.speed * delta;
                var nx = pos.x + Math.sin(e.dir) * step;
                var nz = pos.z + Math.cos(e.dir) * step;
                if (h.esCaminoValido(nx, nz, 0.35, 2)) {
                    pos.x = nx; pos.z = nz;
                }
                var yS = h.alturaSueloEn(pos.x, pos.z);
                if (yS != null) pos.y = yS;
                e.mesh.rotation.y = e.dir;
                return;
            }
        }

        // Vagar / pelea movimiento
        if (e.estado === 'pelea' && player) {
            var dx2 = player.x - pos.x, dz2 = player.z - pos.z;
            e.dir = Math.atan2(dx2, dz2);
            var step2 = 1.5 * delta;
            var nx2 = pos.x + Math.sin(e.dir) * step2;
            var nz2 = pos.z + Math.cos(e.dir) * step2;
            if (h.esCaminoValido(nx2, nz2, 0.35, 2)) { pos.x = nx2; pos.z = nz2; }
            var y2 = h.alturaSueloEn(pos.x, pos.z);
            if (y2 != null) pos.y = y2;
            e.mesh.rotation.y = e.dir;
            return;
        }

        e.timer = (e.timer || 0) - delta;
        if (e.timer <= 0) {
            e.targetDir = Math.random() * Math.PI * 2;
            e.targetSpeed = Math.random() < 0.4 ? 0 : 0.5;
            e.timer = 2 + Math.random() * 2;
        }
        e.dir += (e.targetDir - e.dir) * Math.min(1, delta * 3);
        e.speed += ((e.targetSpeed || 0) - e.speed) * Math.min(1, delta * 4);
        if (Math.abs(e.speed) > 0.05) {
            var st = e.speed * delta;
            var nx3 = pos.x + Math.sin(e.dir) * st;
            var nz3 = pos.z + Math.cos(e.dir) * st;
            if (h.esCaminoValido(nx3, nz3, 0.35, 2)) { pos.x = nx3; pos.z = nz3; }
            else e.targetDir += 1;
        }
        var y3 = h.alturaSueloEn(pos.x, pos.z);
        if (y3 != null) pos.y = y3;
        e.mesh.rotation.y = e.dir;
    }

    MateCraftMobs.register('creeper', {
        vida: 28,
        hostil: true,
        popNoche: 12,
        drop: { item: 'polvora', cant: 1 },
        createMesh: createMesh,
        onUpdate: onUpdate
    });
})();
