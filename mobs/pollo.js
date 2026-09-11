/**
 * Mate-Craft — Mob: Pollo
 * Depende de: mobs/mobs.js (MateCraftMobs) y THREE
 */
(function () {
    'use strict';

    if (!window.MateCraftMobs) {
        console.error('[pollo.js] Carga mobs/mobs.js antes');
        return;
    }

    function createMesh(THREE) {
        const g = new THREE.Group();
        const bodyMat = new THREE.MeshBasicMaterial({ color: 0xf0f0f0 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.38, 0.55), bodyMat);
        body.position.y = 0.38;
        g.add(body);

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), bodyMat);
        head.position.set(0, 0.62, 0.28);
        g.add(head);

        const pico = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.14), new THREE.MeshBasicMaterial({ color: 0xff9800 }));
        pico.position.set(0, 0.58, 0.46);
        g.add(pico);

        const cresta = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.18), new THREE.MeshBasicMaterial({ color: 0xe53935 }));
        cresta.position.set(0, 0.78, 0.28);
        g.add(cresta);

        const barba = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.08), new THREE.MeshBasicMaterial({ color: 0xe53935 }));
        barba.position.set(0, 0.48, 0.42);
        g.add(barba);

        const alaMat = new THREE.MeshBasicMaterial({ color: 0xe8e8e8 });
        const alaL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.35), alaMat);
        alaL.position.set(-0.28, 0.4, 0);
        g.add(alaL);
        const alaR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.35), alaMat);
        alaR.position.set(0.28, 0.4, 0);
        g.add(alaR);

        const pataMat = new THREE.MeshBasicMaterial({ color: 0xffb300 });
        const pataL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.08), pataMat);
        pataL.position.set(-0.12, 0.12, 0.05);
        g.add(pataL);
        const pataR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.08), pataMat);
        pataR.position.set(0.12, 0.12, 0.05);
        g.add(pataR);

        return g;
    }

    function onUpdate(e, delta, helpers) {
        const { alturaSueloEn, esCaminoValido } = helpers;

        e.timer -= delta;
        if (e.timer <= 0) {
            const r = Math.random();
            if (e.estado === 'panic') {
                e.estado = 'walk';
                e.targetSpeed = 0.55 + Math.random() * 0.35;
                e.timer = 1.2 + Math.random() * 2;
            } else if (r < 0.35) {
                e.estado = 'idle';
                e.targetSpeed = 0;
                e.timer = 1.0 + Math.random() * 2.5;
            } else {
                e.estado = 'walk';
                e.targetDir += (Math.random() - 0.5) * 2.2;
                e.targetSpeed = 0.45 + Math.random() * 0.55;
                e.timer = 1.5 + Math.random() * 3.5;
            }
        }

        let diff = e.targetDir - e.dir;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        e.dir += diff * Math.min(1, delta * 4);
        e.speed += (e.targetSpeed - e.speed) * Math.min(1, delta * 5);

        if (Math.abs(e.speed) > 0.05) {
            const step = e.speed * delta;
            const nx = e.mesh.position.x + Math.sin(e.dir) * step;
            const nz = e.mesh.position.z + Math.cos(e.dir) * step;
            if (esCaminoValido(nx, nz)) {
                e.mesh.position.x = nx;
                e.mesh.position.z = nz;
                e.bob += delta * (8 + e.speed * 3);
            } else {
                e.targetDir += Math.PI * (0.6 + Math.random() * 0.8);
                e.timer = 0.4;
            }
        }

        const ySuelo = alturaSueloEn(e.mesh.position.x, e.mesh.position.z);
        if (ySuelo !== null) {
            const bob = (Math.abs(e.speed) > 0.1) ? Math.abs(Math.sin(e.bob)) * 0.04 : 0;
            e.mesh.position.y = ySuelo + bob;
        }
        e.mesh.rotation.y = e.dir;
    }

    MateCraftMobs.register('pollo', {
        vida: 4,
        drop: { item: 'carne', cant: 1 },
        createMesh,
        onUpdate
    });
})();
