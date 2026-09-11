/**
 * Araña hostil
 */
(function () {
    'use strict';
    if (!window.MateCraftMobs) return;

    function createMesh(THREE) {
        const g = new THREE.Group();
        const negro = 0x1a1a1a;
        const rojo = 0x8b0000;
        // abdomen
        const cuerpo = new THREE.Mesh(
            new THREE.BoxGeometry(0.7, 0.4, 0.9),
            new THREE.MeshBasicMaterial({ color: negro })
        );
        cuerpo.position.y = 0.45;
        g.add(cuerpo);
        // cabeza
        const cabeza = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 0.35, 0.4),
            new THREE.MeshBasicMaterial({ color: 0x222222 })
        );
        cabeza.position.set(0, 0.45, 0.55);
        g.add(cabeza);
        // ojos rojos
        const ojoL = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.08, 0.05),
            new THREE.MeshBasicMaterial({ color: rojo })
        );
        ojoL.position.set(-0.1, 0.5, 0.76);
        g.add(ojoL);
        const ojoR = ojoL.clone();
        ojoR.position.x = 0.1;
        g.add(ojoR);
        // patas
        for (let i = 0; i < 4; i++) {
            const side = i < 2 ? -1 : 1;
            const z = (i % 2 === 0) ? 0.2 : -0.2;
            const pata = new THREE.Mesh(
                new THREE.BoxGeometry(0.5, 0.08, 0.08),
                new THREE.MeshBasicMaterial({ color: negro })
            );
            pata.position.set(side * 0.45, 0.25, z);
            pata.rotation.z = side * 0.4;
            g.add(pata);
        }
        return g;
    }

    function onUpdate(e, delta, h) {
        const pos = e.mesh.position;
        const player = h.getPlayerPos && h.getPlayerPos();
        e.attackCd = (e.attackCd || 0) - delta;

        if (player) {
            const dx = player.x - pos.x;
            const dz = player.z - pos.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            const dy = Math.abs((player.y || 0) - pos.y);

            if (dist < 14 && dy < 5) {
                e.estado = 'chase';
                e.targetDir = Math.atan2(dx, dz);
                e.targetSpeed = 1.9;
                e.dir = e.targetDir;
                e.speed = e.targetSpeed;

                if (dist < 1.25 && e.attackCd <= 0) {
                    h.aplicarDanio(2, 'arana');
                    e.attackCd = 0.9;
                }

                const step = e.speed * delta;
                const nx = pos.x + Math.sin(e.dir) * step;
                const nz = pos.z + Math.cos(e.dir) * step;
                if (h.esCaminoValido(nx, nz, 0.45, 1)) {
                    pos.x = nx;
                    pos.z = nz;
                } else {
                    e.targetDir += (Math.random() - 0.5) * 1.5;
                }
                const yS = h.alturaSueloEn(pos.x, pos.z);
                if (yS != null) pos.y = yS;
                e.mesh.rotation.y = e.dir;
                return;
            }
        }

        e.timer = (e.timer || 0) - delta;
        if (e.timer <= 0) {
            e.targetDir = Math.random() * Math.PI * 2;
            e.targetSpeed = Math.random() < 0.3 ? 0 : (0.7 + Math.random() * 0.5);
            e.timer = 1.5 + Math.random() * 2.5;
        }
        let diff = e.targetDir - e.dir;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        e.dir += diff * Math.min(1, delta * 5);
        e.speed += (e.targetSpeed - e.speed) * Math.min(1, delta * 6);
        if (Math.abs(e.speed) > 0.05) {
            const step = e.speed * delta;
            const nx = pos.x + Math.sin(e.dir) * step;
            const nz = pos.z + Math.cos(e.dir) * step;
            if (h.esCaminoValido(nx, nz, 0.45, 1)) {
                pos.x = nx; pos.z = nz;
            } else e.targetDir += Math.PI * 0.6;
        }
        const yS = h.alturaSueloEn(pos.x, pos.z);
        if (yS != null) pos.y = yS;
        e.mesh.rotation.y = e.dir;
    }

    MateCraftMobs.register('arana', {
        vida: 18,
        hostil: true,
        popNoche: 8,
        drop: { item: 'hilo', cant: 1 },
        createMesh,
        onUpdate
    });
})();
