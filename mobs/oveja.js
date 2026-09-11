/**
 * Mate-Craft — Mob: Oveja (más grande, sin atravesar bloques)
 */
(function () {
    'use strict';
    if (!window.MateCraftMobs) {
        console.error('[oveja.js] Carga mobs/mobs.js antes');
        return;
    }

    const RADIO = 0.45;
    const ALTURA_BLOQUES = 1;

    function createMesh(THREE) {
        const g = new THREE.Group();
        const lana = new THREE.MeshBasicMaterial({ color: 0xf5f5f5 });
        const piel = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
        const cara = new THREE.MeshBasicMaterial({ color: 0x424242 });
        const pataC = new THREE.MeshBasicMaterial({ color: 0x616161 });

        const body = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.8, 1.3), lana);
        body.position.y = 0.85;
        g.add(body);

        // Extra volumen lanudo
        const fluff = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.35, 1.15), lana);
        fluff.position.y = 1.15;
        g.add(fluff);

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.5), piel);
        head.position.set(0, 1.05, 0.85);
        g.add(head);

        const face = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.32, 0.12), cara);
        face.position.set(0, 0.98, 1.12);
        g.add(face);

        const oL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.08), piel);
        oL.position.set(-0.32, 1.2, 0.75);
        g.add(oL);
        const oR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.08), piel);
        oR.position.set(0.32, 1.2, 0.75);
        g.add(oR);

        [[-0.32, 0.3, 0.4], [0.32, 0.3, 0.4], [-0.32, 0.3, -0.4], [0.32, 0.3, -0.4]].forEach(pos => {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), pataC);
            leg.position.set(pos[0], pos[1], pos[2]);
            g.add(leg);
        });

        return g;
    }

    function onUpdate(e, delta, helpers) {
        const { moverConColision } = helpers;
        e.timer -= delta;
        if (e.timer <= 0) {
            const r = Math.random();
            if (e.estado === 'panic') {
                e.estado = 'walk';
                e.targetSpeed = 0.4 + Math.random() * 0.2;
                e.timer = 1.5 + Math.random() * 2;
            } else if (r < 0.5) {
                e.estado = 'idle';
                e.targetSpeed = 0;
                e.timer = 2 + Math.random() * 4;
            } else {
                e.estado = 'walk';
                e.targetDir += (Math.random() - 0.5) * 1.5;
                e.targetSpeed = 0.32 + Math.random() * 0.28;
                e.timer = 2.5 + Math.random() * 3;
            }
        }

        let diff = e.targetDir - e.dir;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        e.dir += diff * Math.min(1, delta * 2.5);
        e.speed += (e.targetSpeed - e.speed) * Math.min(1, delta * 3.2);

        if (e.estado === 'panic') e.targetSpeed = 2.3;

        moverConColision(e, delta, RADIO, ALTURA_BLOQUES);
        e.mesh.rotation.y = e.dir;
    }

    MateCraftMobs.register('oveja', {
        vida: 5,
        drop: [ { item: 'carne4', cant: 1 }, { item: 'lana', cant: 1 } ],
        createMesh,
        onUpdate
    });
})();
