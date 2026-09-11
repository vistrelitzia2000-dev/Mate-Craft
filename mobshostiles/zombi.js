/**
 * Zombi hostil — ataca al jugador, se quema al sol, dropea carne podrida
 */
(function () {
    'use strict';
    if (!window.MateCraftMobs) return;

    function createMesh(THREE) {
        const g = new THREE.Group();
        const verde = 0x3d6b3d;
        const ropa = 0x2a4a6a;
        const cuerpo = new THREE.Mesh(
            new THREE.BoxGeometry(0.55, 0.85, 0.3),
            new THREE.MeshBasicMaterial({ color: ropa })
        );
        cuerpo.position.y = 0.9;
        g.add(cuerpo);
        const cabeza = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 0.4, 0.4),
            new THREE.MeshBasicMaterial({ color: verde })
        );
        cabeza.position.y = 1.5;
        g.add(cabeza);
        const brazoL = new THREE.Mesh(
            new THREE.BoxGeometry(0.18, 0.7, 0.18),
            new THREE.MeshBasicMaterial({ color: verde })
        );
        brazoL.position.set(-0.38, 0.95, 0.15);
        brazoL.rotation.x = -0.9;
        g.add(brazoL);
        const brazoR = new THREE.Mesh(
            new THREE.BoxGeometry(0.18, 0.7, 0.18),
            new THREE.MeshBasicMaterial({ color: verde })
        );
        brazoR.position.set(0.38, 0.95, 0.15);
        brazoR.rotation.x = -0.9;
        g.add(brazoR);
        const piernaL = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.55, 0.2),
            new THREE.MeshBasicMaterial({ color: 0x2a2a4a })
        );
        piernaL.position.set(-0.14, 0.28, 0);
        g.add(piernaL);
        const piernaR = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.55, 0.2),
            new THREE.MeshBasicMaterial({ color: 0x2a2a4a })
        );
        piernaR.position.set(0.14, 0.28, 0);
        g.add(piernaR);
        g.userData.brazos = [brazoL, brazoR];
        return g;
    }

    function expuestoAlSol(h, x, y, z) {
        // ¿Hay cielo abierto encima?
        if (!h.ctx || !h.ctx.obtenerIdVoxel) return true;
        const ox = Math.floor(x);
        const oz = Math.floor(z);
        const y0 = Math.floor(y) + 2;
        for (let yy = y0; yy < (h.ctx.tamMundoY || 64); yy++) {
            const id = h.ctx.obtenerIdVoxel(ox, yy, oz);
            if (id !== 0 && id !== 4 && id !== 7) return false; // techo sólido
        }
        return true;
    }

    function onUpdate(e, delta, h) {
        const pos = e.mesh.position;
        const player = h.getPlayerPos && h.getPlayerPos();
        e.attackCd = (e.attackCd || 0) - delta;

        // Quemarse al sol
        const noche = h.esNoche ? h.esNoche() : false;
        if (!noche && expuestoAlSol(h, pos.x, pos.y, pos.z)) {
            e.burnAcc = (e.burnAcc || 0) + delta;
            // Tint fuego
            if (e.mesh) {
                e.mesh.traverse(function (c) {
                    if (c.material && c.material.color && e.flashRojo <= 0) {
                        c.material.color.setHex(0xff5522);
                    }
                });
            }
            if (e.burnAcc >= 0.4) {
                e.burnAcc = 0;
                if (h.danar) h.danar(e, 1);
                else e.vida = (e.vida || 1) - 1;
                if (e.vida <= 0) {
                    if (h.matar) h.matar(e);
                    return;
                }
            }
        } else {
            e.burnAcc = 0;
        }

        // Siempre perseguir y atacar al jugador si está cerca
        if (player) {
            const dx = player.x - pos.x;
            const dz = player.z - pos.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            // Alcance de detección amplio
            if (dist < 24) {
                e.estado = 'chase';
                e.targetDir = Math.atan2(dx, dz);
                e.dir = e.targetDir;
                e.targetSpeed = 1.55;
                e.speed = 1.55;

                // Ataque por distancia horizontal (no depende de altura de ojos)
                if (dist < 2.1 && e.attackCd <= 0) {
                    h.aplicarDanio(2, 'zombi');
                    e.attackCd = 1.0;
                }

                const step = e.speed * delta;
                let nx = pos.x + Math.sin(e.dir) * step;
                let nz = pos.z + Math.cos(e.dir) * step;
                // Intentar paso; si choca, probar desvíos
                if (h.esCaminoValido(nx, nz, 0.35, 2)) {
                    pos.x = nx;
                    pos.z = nz;
                } else {
                    const alt = e.dir + (Math.random() < 0.5 ? 0.7 : -0.7);
                    nx = pos.x + Math.sin(alt) * step;
                    nz = pos.z + Math.cos(alt) * step;
                    if (h.esCaminoValido(nx, nz, 0.35, 2)) {
                        pos.x = nx;
                        pos.z = nz;
                        e.dir = alt;
                    }
                }
                const yS = h.alturaSueloEn(pos.x, pos.z);
                if (yS != null) pos.y = yS;
                e.mesh.rotation.y = e.dir;
                if (e.mesh.userData.brazos) {
                    const t = performance.now() / 180;
                    e.mesh.userData.brazos[0].rotation.x = -0.9 + Math.sin(t) * 0.2;
                    e.mesh.userData.brazos[1].rotation.x = -0.9 + Math.cos(t) * 0.2;
                }
                return;
            }
        }

        // Vagar si no hay jugador cerca
        e.timer = (e.timer || 0) - delta;
        if (e.timer <= 0) {
            if (Math.random() < 0.4) {
                e.targetSpeed = 0;
                e.timer = 1 + Math.random() * 2;
            } else {
                e.targetDir = Math.random() * Math.PI * 2;
                e.targetSpeed = 0.5 + Math.random() * 0.3;
                e.timer = 2 + Math.random() * 3;
            }
        }
        let diff = e.targetDir - e.dir;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        e.dir += diff * Math.min(1, delta * 3);
        e.speed += ((e.targetSpeed || 0) - e.speed) * Math.min(1, delta * 4);
        if (Math.abs(e.speed) > 0.05) {
            const step = e.speed * delta;
            const nx = pos.x + Math.sin(e.dir) * step;
            const nz = pos.z + Math.cos(e.dir) * step;
            if (h.esCaminoValido(nx, nz, 0.35, 2)) {
                pos.x = nx;
                pos.z = nz;
            } else {
                e.targetDir += Math.PI * 0.7;
            }
        }
        const yS = h.alturaSueloEn(pos.x, pos.z);
        if (yS != null) pos.y = yS;
        e.mesh.rotation.y = e.dir;
    }

    MateCraftMobs.register('zombi', {
        vida: 22,
        hostil: true,
        popNoche: 10,
        drop: { item: 'carnepodrida', cant: 1 },
        createMesh,
        onUpdate
    });
})();
