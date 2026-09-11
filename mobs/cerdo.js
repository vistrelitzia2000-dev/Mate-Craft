/**
 * Mate-Craft — Mob: Cerdo (más grande, sin atravesar bloques)
 */
(function () {
    'use strict';
    if (!window.MateCraftMobs) {
        console.error('[cerdo.js] Carga mobs/mobs.js antes');
        return;
    }

    const RADIO = 0.45;
    const ALTURA_BLOQUES = 1;

    function createMesh(THREE) {
        const g = new THREE.Group();
        const rosa = new THREE.MeshBasicMaterial({ color: 0xf5a9c5 });
        const rosaOsc = new THREE.MeshBasicMaterial({ color: 0xe891b0 });

        // Cuerpo más grande
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.7, 1.35), rosa);
        body.position.y = 0.7;
        g.add(body);

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.5), rosa);
        head.position.set(0, 0.85, 0.85);
        g.add(head);

        const hocico = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.18), rosaOsc);
        hocico.position.set(0, 0.78, 1.15);
        g.add(hocico);

        const orejaL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.08), rosaOsc);
        orejaL.position.set(-0.28, 1.12, 0.75);
        g.add(orejaL);
        const orejaR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.08), rosaOsc);
        orejaR.position.set(0.28, 1.12, 0.75);
        g.add(orejaR);

        const pata = new THREE.MeshBasicMaterial({ color: 0xe891b0 });
        [[-0.35, 0.28, 0.4], [0.35, 0.28, 0.4], [-0.35, 0.28, -0.4], [0.35, 0.28, -0.4]].forEach(pos => {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.55, 0.22), pata);
            leg.position.set(pos[0], pos[1], pos[2]);
            g.add(leg);
        });

        const cola = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.18), rosaOsc);
        cola.position.set(0, 0.75, -0.75);
        g.add(cola);

        return g;
    }

    function onUpdate(e, delta, helpers) {
        const { moverConColision } = helpers;
        e.timer -= delta;
        if (e.timer <= 0) {
            const r = Math.random();
            if (e.estado === 'panic') {
                e.estado = 'walk';
                e.targetSpeed = 0.45 + Math.random() * 0.25;
                e.timer = 1.5 + Math.random() * 2;
            } else if (r < 0.42) {
                e.estado = 'idle';
                e.targetSpeed = 0;
                e.timer = 1.8 + Math.random() * 3;
            } else {
                e.estado = 'walk';
                e.targetDir += (Math.random() - 0.5) * 1.8;
                e.targetSpeed = 0.4 + Math.random() * 0.35;
                e.timer = 2.2 + Math.random() * 2.5;
            }
        }

        let diff = e.targetDir - e.dir;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        e.dir += diff * Math.min(1, delta * 2.6);
        e.speed += (e.targetSpeed - e.speed) * Math.min(1, delta * 3.2);

        if (e.estado === 'panic') {
            e.targetSpeed = 2.4;
        }

        moverConColision(e, delta, RADIO, ALTURA_BLOQUES);
        e.mesh.rotation.y = e.dir;
    }

    MateCraftMobs.register('cerdo', {
        vida: 6,
        drop: { item: 'carne2', cant: 1 },
        createMesh,
        onUpdate
    });
})();
