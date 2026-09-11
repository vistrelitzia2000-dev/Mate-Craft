/** Mate-Craft: bucle animate + arranque */
function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    const delta = Math.min((time - prevTime) / 1000, 0.1);

    acumuladorTiempoAgua += delta;
    if (acumuladorTiempoAgua >= intervaloPropagacionAgua) {
        acumuladorTiempoAgua = 0;
        simularPropagacionAgua();
    }

    // Ciclo día / noche
    actualizarCicloDiaNoche(delta);

    // Progreso de comer
    actualizarComer(delta);

    // Mobs
    if (window.MateCraftMobs) MateCraftMobs.update(delta);



    // Actualizar hornos (cocción) siempre
    actualizarHornos(delta);

    if (controls.isLocked === true && !jugadorMuerto) {
        if (estaRompiendo && objetivoRompiendoPos) {
            let sigueApuntando = false;
            raycaster.setFromCamera(mouse, camera);
            let intersects = raycaster.intersectObject(meshMundo);
            if (intersects.length > 0 && intersects[0].distance < 6) {
                let hit = intersects[0];
                let normal = hit.face.normal.clone();
                let pImp = hit.point.clone().add(normal.clone().multiplyScalar(-0.01));
                let vx = Math.floor(pImp.x + 0.5), vy = Math.floor(pImp.y + 0.5), vz = Math.floor(pImp.z + 0.5);
                if (vx === objetivoRompiendoPos.x && vy === objetivoRompiendoPos.y && vz === objetivoRompiendoPos.z) sigueApuntando = true;
            }

            if (sigueApuntando) {
                tiempoRompiendo += delta;
                document.getElementById('barra-romper').style.width = Math.min((tiempoRompiendo / tiempoRequeridoRomper) * 100, 100) + '%';
                if (tiempoRompiendo >= tiempoRequeridoRomper) {
                    let idRoto = obtenerIdVoxel(objetivoRompiendoPos.x, objetivoRompiendoPos.y, objetivoRompiendoPos.z);
                    let tipoRotoStr = ID_A_TIPO[idRoto]; 
                    
                    establecerIdVoxel(objetivoRompiendoPos.x, objetivoRompiendoPos.y, objetivoRompiendoPos.z, 0);
                    reconstruirMallaMundo();

                    // Piedra y menas: requieren pico adecuado
                    let puedeDropear = true;
                    let itemActual = itemBarraActual();
                    if (tipoRotoStr === 'roca') {
                        if (itemActual !== 'picm' && itemActual !== 'picp' && itemActual !== 'pich' && itemActual !== 'pico' && itemActual !== 'picd' && itemActual !== 'picd' && itemActual !== 'picd') {
                            puedeDropear = false;
                        }
                    }
                    // Mena de hierro: pico de piedra o superior
                    if (tipoRotoStr === 'menah') {
                        if (itemActual !== 'picp' && itemActual !== 'pich' && itemActual !== 'pico' && itemActual !== 'picd' && itemActual !== 'picd') {
                            puedeDropear = false;
                        }
                    }
                    // Bloque de hierro: cualquier pico
                    if (tipoRotoStr === 'bloqh') {
                        if (itemActual !== 'picm' && itemActual !== 'picp' && itemActual !== 'pich' && itemActual !== 'pico' && itemActual !== 'picd' && itemActual !== 'picd' && itemActual !== 'picd') {
                            puedeDropear = false;
                        }
                    }
                    // Mena de oro: pico de hierro o oro
                    if (tipoRotoStr === 'menao') {
                        if (itemActual !== 'pich' && itemActual !== 'pico' && itemActual !== 'picd') {
                            puedeDropear = false;
                        }
                    }
                    // Bloque de oro: cualquier pico
                    if (tipoRotoStr === 'bloqo') {
                        if (itemActual !== 'picm' && itemActual !== 'picp' && itemActual !== 'pich' && itemActual !== 'pico' && itemActual !== 'picd' && itemActual !== 'picd' && itemActual !== 'picd') {
                            puedeDropear = false;
                        }
                    }

                    
                    // Mena de diamante: solo hierro+ y suelta diamante directo
                    if (idRoto === 30) {
                        puedeDropear = false; // no dropea el bloque
                        if (itemActual === 'pich' || itemActual === 'pico' || itemActual === 'picd') {
                            anadirItem('diamante', 1);
                        }
                    }

                    
                    // Mena de carbón: cualquier pico suelta carbón (ítem)
                    if (idRoto === 32) {
                        puedeDropear = false;
                        if (itemActual === 'picm' || itemActual === 'picp' || itemActual === 'pich' || itemActual === 'pico' || itemActual === 'picd') {
                            anadirItem('carbon', 1);
                        }
                    }
                    // Bloque de carbón
                    if (tipoRotoStr === 'bloqc') {
                        // se dropea normal si puedeDropear
                    }

                    if (puedeDropear && tipoRotoStr && inventarioRecursos[tipoRotoStr] !== undefined) {
                        anadirItem(tipoRotoStr, 1);
                    }
                    // Cofre: devolver todo el contenido al inventario
                    if (idRoto >= 22 && idRoto <= 25) {
                        let ck = objetivoRompiendoPos.x + ',' + objetivoRompiendoPos.y + ',' + objetivoRompiendoPos.z;
                        let cd = cofresData[ck];
                        if (cd && cd.slots) {
                            cd.slots.forEach(s => {
                                if (s && s.tipo && s.cant > 0 && inventarioRecursos[s.tipo] !== undefined) {
                                    inventarioRecursos[s.tipo] += s.cant;
                                }
                            });
                        }
                        delete cofresData[ck];
                        if (cofreAbierto && cofreActualPos &&
                            cofreActualPos.x === objetivoRompiendoPos.x &&
                            cofreActualPos.y === objetivoRompiendoPos.y &&
                            cofreActualPos.z === objetivoRompiendoPos.z) {
                            cerrarCofre();
                        }
                        actualizarUIInventario();
                    }
                    // Horno: devolver entrada, combustible y resultado
                    if (idRoto >= 13 && idRoto <= 20) {
                        let hk = objetivoRompiendoPos.x + ',' + objetivoRompiendoPos.y + ',' + objetivoRompiendoPos.z;
                        let hd = hornosData[hk];
                        if (hd) {
                            ['input', 'fuel', 'output'].forEach(campo => {
                                let s = hd[campo];
                                if (s && typeof s === 'string') s = { tipo: s, cant: 1 };
                                if (s && s.tipo && s.cant > 0 && inventarioRecursos[s.tipo] !== undefined) {
                                    inventarioRecursos[s.tipo] += s.cant;
                                }
                            });
                        }
                        delete hornosData[hk];
                        if (hornoAbierto && hornoActualPos &&
                            hornoActualPos.x === objetivoRompiendoPos.x &&
                            hornoActualPos.y === objetivoRompiendoPos.y &&
                            hornoActualPos.z === objetivoRompiendoPos.z) {
                            cerrarHorno();
                        }
                        actualizarUIInventario();
                    }
                    // Hojas
                    if (idRoto === 4) {
                        if (Math.random() < 0.5) anadirItem('manzana', 1);
                        if (Math.random() < 0.01) anadirItem('manzanad', 1);
                    }
                    cancelarRuptura();
                }
            } else { cancelarRuptura(); }
        }

        let camObj = controls.getObject();
        let enElAgua = estaEnAgua(camObj.position.x, camObj.position.y, camObj.position.z);

        let velocidadActual = (enElAgua ? velocidadMovimiento * 0.7 : velocidadMovimiento) * delta;
        let dirX = 0, dirZ = 0;
        let vAdelante = new THREE.Vector3(); camera.getWorldDirection(vAdelante); vAdelante.y = 0; vAdelante.normalize();
        let vDerecha = new THREE.Vector3(); vDerecha.crossVectors(vAdelante, new THREE.Vector3(0, 1, 0));

        if (moveForward) { dirX += vAdelante.x; dirZ += vAdelante.z; }
        if (moveBackward) { dirX -= vAdelante.x; dirZ -= vAdelante.z; }
        if (moveLeft) { dirX -= vDerecha.x; dirZ -= vDerecha.z; }
        if (moveRight) { dirX += vDerecha.x; dirZ += vDerecha.z; }

        let seMovio = false;
        if (dirX !== 0 || dirZ !== 0) {
            let len = Math.sqrt(dirX * dirX + dirZ * dirZ);
            dirX = (dirX / len) * velocidadActual; dirZ = (dirZ / len) * velocidadActual;
            camObj.position.x += dirX;
            if (colisionaConCajaJugadorPuro(camObj.position.x, camObj.position.y, camObj.position.z)) camObj.position.x -= dirX;
            else seMovio = true;
            camObj.position.z += dirZ;
            if (colisionaConCajaJugadorPuro(camObj.position.x, camObj.position.y, camObj.position.z)) camObj.position.z -= dirZ;
            else seMovio = true;
        }
        actualizarHambre(delta, seMovio);

        // Invulnerabilidad
        if (invulnerabilidad > 0) invulnerabilidad -= delta;

        const bajoAgua = cabezaEnAgua(camObj.position.x, camObj.position.y, camObj.position.z);

        // Aire / ahogamiento
        if (bajoAgua) {
            aireJugador -= delta;
            if (aireJugador < 0) aireJugador = 0;
            actualizarUIAire(true);
            if (aireJugador <= 0) {
                acumuladorDanioAhogo += delta;
                if (acumuladorDanioAhogo >= 1.0) {
                    acumuladorDanioAhogo = 0;
                    aplicarDanio(2, 'ahogamiento'); // 1 corazón por segundo
                }
            } else {
                acumuladorDanioAhogo = 0;
            }
        } else {
            if (aireJugador < AIRE_MAX) {
                aireJugador = Math.min(AIRE_MAX, aireJugador + delta * 2);
            }
            if (aireJugador >= AIRE_MAX) actualizarUIAire(false);
            else actualizarUIAire(true);
            acumuladorDanioAhogo = 0;
        }

        if (enElAgua) {
            distanciaCaida = 0; // el agua cancela caída
            if (spacePressed) {
                velocityY = 5.5; 
            } else {
                velocityY = Math.max(velocityY - (gravedad * 0.15) * delta, -1.5); 
            }
        } else {
            velocityY -= gravedad * delta;
            // Acumular distancia de caída
            if (!enSuelo && velocityY < 0) {
                distanciaCaida += -velocityY * delta;
            }
        }

        camObj.position.y += velocityY * delta;
        if (colisionaConCajaJugadorPuro(camObj.position.x, camObj.position.y, camObj.position.z)) {
            camObj.position.y -= velocityY * delta;
            if (velocityY < 0 && !enElAgua) {
                // Daño por caída (como Minecraft: bloques - 3)
                if (distanciaCaida > 3) {
                    let dmg = Math.floor(distanciaCaida - 3);
                    if (dmg > 0) aplicarDanio(dmg, 'caida');
                }
                distanciaCaida = 0;
                enSuelo = true;
            }
            velocityY = 0;
        } else { 
            if (!enElAgua) enSuelo = false; 
        }
    }
    // Muro invisible en los bordes del mundo
    if (controls && controls.getObject) {
        var po = controls.getObject().position;
        aplicarMuroInvisible(po);
        // Evitar NaN
        if (!isFinite(po.x) || !isFinite(po.y) || !isFinite(po.z)) {
            console.warn('[Mate-Craft] Posición inválida');
            po.x = isFinite(po.x) ? po.x : 0;
            po.y = isFinite(po.y) ? po.y : 40;
            po.z = isFinite(po.z) ? po.z : 0;
        }
    }

    prevTime = time;
    renderer.render(scene, camera);
}

init();
    