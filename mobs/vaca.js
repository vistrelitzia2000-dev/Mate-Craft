/**
 * Mate-Craft — Mob: Vaca (más grande, sin atravesar bloques)
 */
(function () {
    'use strict';
    if (!window.MateCraftMobs) {
        console.error('[vaca.js] Carga mobs/mobs.js antes');
        return;
    }

    const RADIO = 0.55;
    const ALTURA_BLOQUES = 2;

    function createMesh(THREE) {
        const g = new THREE.Group();
        const cuerpo = new THREE.MeshBasicMaterial({ color: 0x8d6e63 });
        const mancha = new THREE.MeshBasicMaterial({ color: 0xefebe9 });
        const hocicoC = new THREE.MeshBasicMaterial({ color: 0xffccbc });
        const pata = new THREE.MeshBasicMaterial({ color: 0x5d4037 });
        const cuerno = new THREE.MeshBasicMaterial({ color: 0xfff8e1 });

        const body = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.85, 1.7), cuerpo);
        body.position.y = 0.95;
        g.add(body);

        const m1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.45), mancha);
        m1.position.set(0.4, 1.1, 0.25);
        g.add(m1);
        const m2 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.4), mancha);
        m2.position.set(-0.38, 0.9, -0.35);
        g.add(m2);

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.55), cuerpo);
        head.position.set(0, 1.25, 1.05);
        g.add(head);

        const hocico = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.22), hocicoC);
        hocico.position.set(0, 1.1, 1.38);
        g.add(hocico);

        const cL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.1), cuerno);
        cL.position.set(-0.28, 1.58, 0.95);
        g.add(cL);
        const cR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.1), cuerno);
        cR.position.set(0.28, 1.58, 0.95);
        g.add(cR);

        const orejaL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.08), cuerpo);
        orejaL.position.set(-0.4, 1.4, 0.95);
        g.add(orejaL);
        const orejaR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.08), cuerpo);
        orejaR.position.set(0.4, 1.4, 0.95);
        g.add(orejaR);

        [[-0.4, 0.35, 0.5], [0.4, 0.35, 0.5], [-0.4, 0.35, -0.5], [0.4, 0.35, -0.5]].forEach(pos => {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.24), pata);
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
                e.targetSpeed = 0.35 + Math.random() * 0.2;
                e.timer = 1.5 + Math.random() * 2;
            } else if (r < 0.45) {
                e.estado = 'idle';
                e.targetSpeed = 0;
                e.timer = 2.2 + Math.random() * 4;
            } else {
                e.estado = 'walk';
                e.targetDir += (Math.random() - 0.5) * 1.5;
                e.targetSpeed = 0.3 + Math.random() * 0.28;
                e.timer = 2.5 + Math.random() * 3;
            }
        }

        let diff = e.targetDir - e.dir;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        e.dir += diff * Math.min(1, delta * 2.4);
        e.speed += (e.targetSpeed - e.speed) * Math.min(1, delta * 3);

        if (e.estado === 'panic') e.targetSpeed = 2.2;

        moverConColision(e, delta, RADIO, ALTURA_BLOQUES);
        e.mesh.rotation.y = e.dir;
    }

    MateCraftMobs.register('vaca', {
        vida: 8,
        drop: { item: 'carne3', cant: 1 },
        createMesh,
        onUpdate
    });
})();
