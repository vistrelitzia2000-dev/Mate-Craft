/**
 * Mate-Craft — Sistema de mobs
 * Carpeta: mobs/
 *
 * Control de población:
 *   - Mínimos / máximos por tipo
 *   - Si muere uno y hay hueco bajo el máximo, se programa un respawn
 *   - No se acumulan por encima del máximo
 */
(function (global) {
    'use strict';

    const types = Object.create(null);
    let instances = [];
    let ctx = null;

    /** Objetivos de población (día y noche igual) */
    let popMin = { pollo: 6, cerdo: 5, vaca: 4, oveja: 5, zombi: 0, arana: 0, creeper: 0 };
    let popMax = { pollo: 20, cerdo: 18, vaca: 16, oveja: 18, zombi: 40, arana: 35, creeper: 30 };
    let radioSpawn = 55;
    /** Cola de respawns: { tipo, tRestante } */
    let respawnCola = [];
    let timerChequeo = 0;

    function requireCtx() {
        if (!ctx) throw new Error('[Mobs] Llama a MateCraftMobs.init(ctx) primero');
        return ctx;
    }

    function esBloqueSolido(id) {
        // Aire, agua y hojas no bloquean el cuerpo
        return id !== 0 && id !== 7 && id !== 4;
    }

    function alturaSueloEn(x, z) {
        const { obtenerIdVoxel, tamMundoY } = requireCtx();
        const xi = Math.floor(x);
        const zi = Math.floor(z);
        for (let y = tamMundoY - 2; y >= 1; y--) {
            const id = obtenerIdVoxel(xi, y, zi);
            if (esBloqueSolido(id)) {
                const arriba = obtenerIdVoxel(xi, y + 1, zi);
                if (!esBloqueSolido(arriba)) return y + 0.5;
            }
        }
        return null;
    }

    /**
     * Comprueba si un mob de cierto radio cabe en (x,z).
     * radio: mitad del ancho del cuerpo
     * alturaBloques: cuántos bloques de aire necesita el cuerpo (1 o 2)
     */
    function esCaminoValido(x, z, radio, alturaBloques) {
        radio = radio != null ? radio : 0.35;
        alturaBloques = alturaBloques != null ? alturaBloques : 1;
        const { obtenerIdVoxel } = requireCtx();

        const offsets = [
            [0, 0],
            [radio, 0], [-radio, 0], [0, radio], [0, -radio],
            [radio * 0.7, radio * 0.7], [radio * 0.7, -radio * 0.7],
            [-radio * 0.7, radio * 0.7], [-radio * 0.7, -radio * 0.7]
        ];

        let yRef = null;
        for (let i = 0; i < offsets.length; i++) {
            const sx = x + offsets[i][0];
            const sz = z + offsets[i][1];
            const ySuelo = alturaSueloEn(sx, sz);
            if (ySuelo === null) return false;

            if (yRef === null) yRef = ySuelo;
            // No subir/bajar acantilados de más de ~1 bloque
            if (Math.abs(ySuelo - yRef) > 1.05) return false;

            const xi = Math.floor(sx);
            const zi = Math.floor(sz);
            const yBloqueSuelo = Math.floor(ySuelo); // top of solid is ySuelo = blockY + 0.5 → floor = blockY

            // Agua en los pies
            const idPie = obtenerIdVoxel(xi, yBloqueSuelo, zi);
            // el bloque de soporte ya es sólido; el de encima de los pies
            const idSobreSuelo = obtenerIdVoxel(xi, yBloqueSuelo + 1, zi);
            if (idSobreSuelo === 7) return false; // no caminar con el cuerpo en agua profunda

            // Cuerpo: debe haber espacio libre encima del suelo
            for (let h = 1; h <= alturaBloques; h++) {
                const id = obtenerIdVoxel(xi, yBloqueSuelo + h, zi);
                if (esBloqueSolido(id)) return false;
            }
        }
        return true;
    }

    /** Movimiento con colisión y deslizamiento en paredes */
    function moverConColision(e, delta, radio, alturaBloques) {
        radio = radio != null ? radio : 0.4;
        alturaBloques = alturaBloques != null ? alturaBloques : 1;

        if (Math.abs(e.speed) <= 0.04) {
            const ySuelo = alturaSueloEn(e.mesh.position.x, e.mesh.position.z);
            if (ySuelo !== null) e.mesh.position.y = ySuelo;
            return;
        }

        const step = e.speed * delta;
        const dx = Math.sin(e.dir) * step;
        const dz = Math.cos(e.dir) * step;
        const x0 = e.mesh.position.x;
        const z0 = e.mesh.position.z;

        let nx = x0 + dx;
        let nz = z0 + dz;
        let movio = false;

        if (esCaminoValido(nx, nz, radio, alturaBloques)) {
            e.mesh.position.x = nx;
            e.mesh.position.z = nz;
            movio = true;
        } else if (esCaminoValido(nx, z0, radio, alturaBloques)) {
            e.mesh.position.x = nx;
            movio = true;
        } else if (esCaminoValido(x0, nz, radio, alturaBloques)) {
            e.mesh.position.z = nz;
            movio = true;
        } else {
            // Chocó: girar
            e.targetDir += Math.PI * (0.55 + Math.random() * 0.7);
            e.timer = 0.35 + Math.random() * 0.4;
            e.speed *= 0.3;
        }

        if (movio) e.bob += delta * (5 + e.speed * 2);

        const ySuelo = alturaSueloEn(e.mesh.position.x, e.mesh.position.z);
        if (ySuelo !== null) {
            const bob = (Math.abs(e.speed) > 0.12) ? Math.abs(Math.sin(e.bob)) * 0.02 : 0;
            e.mesh.position.y = ySuelo + bob;
        }
    }

    function restaurarColor(entity) {
        entity.mesh.traverse(c => {
            if (c.material && c.material.color && c.userData.colorOrig !== undefined) {
                c.material.color.setHex(c.userData.colorOrig);
            }
        });
    }

    function countByType(tipo) {
        return instances.filter(e => e.tipo === tipo).length;
    }

    function programarRespawn(tipo) {
        if (!types[tipo]) return;
        const max = popMax[tipo] != null ? popMax[tipo] : 8;
        const vivos = countByType(tipo);
        const enCola = respawnCola.filter(r => r.tipo === tipo).length;
        if (vivos + enCola >= max) return;
        respawnCola.push({ tipo, tRestante: 12 + Math.random() * 13 });
    }

    function intentarSpawnAleatorio(tipo) {
        const max = popMax[tipo] != null ? popMax[tipo] : 8;
        if (countByType(tipo) >= max) return false;
        for (let i = 0; i < 40; i++) {
            const x = (Math.random() - 0.5) * radioSpawn * 2;
            const z = (Math.random() - 0.5) * radioSpawn * 2;
            if (!esCaminoValido(x, z, 0.5, 2)) continue;
            if (API.spawn(tipo, x, z)) return true;
        }
        return false;
    }

    function eliminar(entity, dropear) {
        const c = requireCtx();
        const tipo = entity.tipo;
        if (dropear && tipo && types[tipo] && types[tipo].drop) {
            const drops = Array.isArray(types[tipo].drop) ? types[tipo].drop : [types[tipo].drop];
            drops.forEach(d => {
                if (!d || !d.item) return;
                const item = d.item;
                const cant = d.cant || 1;
                try {
                    if (typeof c.anadirItem === 'function') {
                        c.anadirItem(item, cant);
                    } else if (c.inventarioRecursos) {
                        if (c.inventarioRecursos[item] === undefined) c.inventarioRecursos[item] = 0;
                        c.inventarioRecursos[item] += cant;
                        if (c.actualizarUIInventario) c.actualizarUIInventario();
                    }
                } catch (err) {
                    console.error('[Mobs] Error al dar drop', item, err);
                }
            });
        }
        c.scene.remove(entity.mesh);
        entity.mesh.traverse(ch => {
            if (ch.geometry) ch.geometry.dispose();
            if (ch.material) {
                if (Array.isArray(ch.material)) ch.material.forEach(m => m.dispose && m.dispose());
                else if (ch.material.dispose) ch.material.dispose();
            }
        });
        const idx = instances.indexOf(entity);
        if (idx >= 0) instances.splice(idx, 1);
        if (dropear && tipo) programarRespawn(tipo);
    }

    const API = {
        init(c) {
            ctx = c;
            instances = [];
            respawnCola = [];
            timerChequeo = 0;
        },

        setPoblacion(minMap, maxMap, radio) {
            if (minMap) popMin = Object.assign({}, popMin, minMap);
            if (maxMap) popMax = Object.assign({}, popMax, maxMap);
            if (radio) radioSpawn = radio;
        },

        register(tipo, def) {
            types[tipo] = def;
            if (popMin[tipo] == null) popMin[tipo] = 4;
            if (popMax[tipo] == null) popMax[tipo] = 24;
        },

        getTypes() {
            return Object.keys(types);
        },

        spawn(tipo, x, z, forzar) {
            const c = requireCtx();
            const def = types[tipo];
            if (!def) {
                console.warn('[Mobs] Tipo no registrado:', tipo);
                return null;
            }
            if (!forzar) {
                const max = popMax[tipo] != null ? popMax[tipo] : 99;
                if (countByType(tipo) >= max) return null;
            }

            let ySuelo = alturaSueloEn(x, z);
            if (ySuelo === null) {
                if (!forzar) return null;
                // Creativo: forzar cerca del jugador aunque el rayo de suelo falle
                const pp = c.getPlayerPos ? c.getPlayerPos() : null;
                ySuelo = pp && isFinite(pp.y) ? (pp.y - 1.4) : 20;
            }

            const mesh = def.createMesh(c.THREE);
            mesh.position.set(x, ySuelo, z);
            mesh.userData.mobTipo = tipo;
            c.scene.add(mesh);

            mesh.traverse(ch => {
                if (ch.material && ch.material.color) {
                    ch.userData.colorOrig = ch.material.color.getHex();
                }
            });

            const entity = {
                tipo,
                mesh,
                vida: def.vida || 4,
                dir: Math.random() * Math.PI * 2,
                targetDir: Math.random() * Math.PI * 2,
                speed: 0,
                targetSpeed: 0.5 + Math.random() * 0.4,
                timer: 0.5 + Math.random() * 2,
                bob: Math.random() * Math.PI * 2,
                flashRojo: 0,
                estado: 'idle'
            };

            if (def.onSpawn) def.onSpawn(entity, c);
            instances.push(entity);
            return entity;
        },

        spawnVarios(tipo, n, radio) {
            radio = radio || radioSpawn;
            let intentos = 0;
            let creados = 0;
            const maxIntentos = Math.max(n * 80, 200);
            while (creados < n && intentos < maxIntentos) {
                intentos++;
                const x = (Math.random() - 0.5) * radio * 2;
                const z = (Math.random() - 0.5) * radio * 2;
                if (!esCaminoValido(x, z, 0.5, 2)) continue;
                if (this.spawn(tipo, x, z)) creados++;
            }
            if (creados < n) {
                console.warn('[Mobs] Solo se crearon', creados, 'de', n, 'para', tipo);
            }
            return creados;
        },

        countByType,

        asegurarMinimos(mapa, radio) {
            if (mapa) {
                Object.keys(mapa).forEach(t => {
                    if (popMin[t] == null || mapa[t] > popMin[t]) popMin[t] = mapa[t];
                    if (popMax[t] == null) popMax[t] = mapa[t] + 2;
                });
            }
            radio = radio || radioSpawn;
            const objetivos = mapa || popMin;
            Object.keys(objetivos).forEach(tipo => {
                const falta = objetivos[tipo] - countByType(tipo);
                if (falta > 0) this.spawnVarios(tipo, falta, radio);
            });
        },

        update(delta) {
            if (!ctx) return;

            for (let i = respawnCola.length - 1; i >= 0; i--) {
                respawnCola[i].tRestante -= delta;
                if (respawnCola[i].tRestante <= 0) {
                    const tipo = respawnCola[i].tipo;
                    respawnCola.splice(i, 1);
                    const max = popMax[tipo] != null ? popMax[tipo] : 8;
                    if (countByType(tipo) < max) {
                        if (!intentarSpawnAleatorio(tipo)) {
                            respawnCola.push({ tipo, tRestante: 8 + Math.random() * 8 });
                        }
                    }
                }
            }

            timerChequeo += delta;
            if (timerChequeo >= 20) {
                timerChequeo = 0;
                const noche = ctx.esNoche ? !!ctx.esNoche() : false;
                Object.keys(popMin).forEach(tipo => {
                    if (!types[tipo]) return;
                    const def = types[tipo];
                    // Hostiles: solo mantener población de noche
                    if (def.hostil && !noche) return;
                    let objetivo = popMin[tipo];
                    if (def.hostil && noche) {
                        objetivo = Math.max(objetivo, def.popNoche != null ? def.popNoche : 3);
                    }
                    const falta = objetivo - countByType(tipo);
                    if (falta > 0) {
                        for (let k = 0; k < falta; k++) intentarSpawnAleatorio(tipo);
                    }
                });
            }

            for (let i = instances.length - 1; i >= 0; i--) {
                const e = instances[i];
                const def = types[e.tipo];
                if (!def) continue;

                if (e.flashRojo > 0) {
                    e.flashRojo -= delta;
                    if (e.flashRojo <= 0) {
                        e.flashRojo = 0;
                        restaurarColor(e);
                    }
                }

                if (def.onUpdate) {
                    def.onUpdate(e, delta, {
                        alturaSueloEn,
                        esCaminoValido,
                        moverConColision,
                        ctx,
                        getPlayerPos: function () {
                            return ctx.getPlayerPos ? ctx.getPlayerPos() : null;
                        },
                        aplicarDanio: function (n, motivo) {
                            if (ctx.aplicarDanio) ctx.aplicarDanio(n, motivo);
                        },
                        esNoche: function () {
                            return ctx.esNoche ? !!ctx.esNoche() : false;
                        },
                        matar: function (ent) {
                            if (!ent) return;
                            const d2 = types[ent.tipo];
                            if (d2 && d2.onDeath) { try { d2.onDeath(ent, requireCtx()); } catch (err) {} }
                            eliminar(ent, true);
                        },
                        danar: function (ent, n) {
                            if (!ent) return;
                            ent.vida = (ent.vida || 1) - (n || 1);
                            ent.flashRojo = 0.15;
                            if (ent.mesh) {
                                ent.mesh.traverse(function (c) {
                                    if (c.material && c.material.color) c.material.color.setHex(0xff6600);
                                });
                            }
                            if (ent.vida <= 0) {
                                const d2 = types[ent.tipo];
                                if (d2 && d2.onDeath) { try { d2.onDeath(ent, requireCtx()); } catch (err) {} }
                                eliminar(ent, true);
                            }
                        }
                    });
                }
            }
        },

        hit(entity) {
            if (!entity || entity.vida <= 0) return;
            const def = types[entity.tipo];
            if (!def) return;
            if (!entity.mesh) return;

            entity.vida--;
            entity.flashRojo = 0.08;
            if (def.hostil) {
                entity.estado = 'chase';
                entity.timer = 0.3;
            } else {
                entity.estado = 'panic';
                entity.targetDir = Math.random() * Math.PI * 2;
                entity.dir = entity.targetDir;
                entity.targetSpeed = 2.8;
                entity.speed = 2.8;
                entity.timer = 0.9 + Math.random() * 0.4;
            }
            entity.mesh.traverse(c => {
                if (c.material && c.material.color) c.material.color.setHex(0xff5252);
            });

            if (def.onHit) def.onHit(entity, requireCtx());

            if (entity.vida <= 0) {
                if (def.onDeath) def.onDeath(entity, requireCtx());
                eliminar(entity, true);
            }
        },

        kill(entity) {
            if (!entity || !entity.mesh) return;
            const def = types[entity.tipo];
            if (def && def.onDeath) {
                try { def.onDeath(entity, requireCtx()); } catch (err) {}
            }
            eliminar(entity, true);
        },

        raycastHit(raycaster, camera, mouse, maxDist) {
            if (!instances.length) return null;
            maxDist = maxDist || 5;
            raycaster.setFromCamera(mouse, camera);
            const meshes = instances.map(e => e.mesh);
            const hits = raycaster.intersectObjects(meshes, true);
            if (!hits.length || hits[0].distance > maxDist) return null;
            let obj = hits[0].object;
            while (obj) {
                const found = instances.find(e => e.mesh === obj);
                if (found) return found;
                obj = obj.parent;
            }
            return null;
        },

        clear() {
            respawnCola = [];
            while (instances.length) {
                eliminar(instances[0], false);
            }
        },

        serialize() {
            return instances.map(e => ({
                tipo: e.tipo,
                x: e.mesh.position.x,
                y: e.mesh.position.y,
                z: e.mesh.position.z,
                vida: e.vida
            }));
        },

        load(lista) {
            this.clear();
            if (!lista || !lista.length) return;
            lista.forEach(d => {
                const e = this.spawn(d.tipo, d.x, d.z);
                if (e && typeof d.vida === 'number') e.vida = d.vida;
            });
        },

        count() {
            return instances.length;
        }
    };

    global.MateCraftMobs = API;
})(typeof window !== 'undefined' ? window : globalThis);