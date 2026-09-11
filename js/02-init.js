/** Mate-Craft: inicialización del juego */
function init() {
    if (window.__matecraftIniciado) {
        console.warn('[Mate-Craft] init() ignorado: ya estaba iniciado');
        return;
    }
    window.__matecraftIniciado = true;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.FogExp2(0x87CEEB, 0.012);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    /* camera pos = player pos en r128 */

    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const textureLoader = new THREE.TextureLoader();
    function cargarTex(archivo) {
        let tex = textureLoader.load('texturas/' + archivo);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        return tex;
    }

    // Material 12: Cobblestone | 13: Horno frente
    materialesMundo = [
        new THREE.MeshBasicMaterial({ map: cargarTex('p.png') }),   // 0: Piedra lisa
        new THREE.MeshBasicMaterial({ map: cargarTex('t.png') }),   // 1: Tierra
        new THREE.MeshBasicMaterial({ map: cargarTex('c.png') }),   // 2: Costado pasto
        new THREE.MeshBasicMaterial({ map: cargarTex('ta.png') }),  // 3: Tapa pasto
        new THREE.MeshBasicMaterial({ map: cargarTex('h.png') }),   // 4: Hojas
        new THREE.MeshBasicMaterial({ map: cargarTex('b.png') }),   // 5: Bedrock
        new THREE.MeshBasicMaterial({ map: cargarTex('tr.png') }),  // 6: Tronco lado
        new THREE.MeshBasicMaterial({ map: cargarTex('tra.png') }), // 7: Tronco tapa
        new THREE.MeshBasicMaterial({ map: cargarTex('ag.png'), transparent: true, opacity: 0.8, depthWrite: false }), // 8: Agua
        new THREE.MeshBasicMaterial({ map: cargarTex('tab.png') }), // 9: Tablón
        new THREE.MeshBasicMaterial({ map: cargarTex('crafta.png') }), // 10: Mesa arriba
        new THREE.MeshBasicMaterial({ map: cargarTex('crafl.png') }),  // 11: Mesa lado
        new THREE.MeshBasicMaterial({ map: cargarTex('roc.png') }),  // 12: Cobblestone / top-bottom horno
        new THREE.MeshBasicMaterial({ map: cargarTex('hora.png') }), // 13: Horno frente (apagado)
        new THREE.MeshBasicMaterial({ map: cargarTex('horl.png') }), // 14: Horno lados
        new THREE.MeshBasicMaterial({ map: cargarTex('hore.png') }), // 15: Horno frente (prendido)
        new THREE.MeshBasicMaterial({ map: cargarTex('lan.png') }), // 16: Lana
        new THREE.MeshBasicMaterial({ map: cargarTex('cof.png') }),  // 17: Cofre frente
        new THREE.MeshBasicMaterial({ map: cargarTex('cofl.png') }), // 18: Cofre lados
        new THREE.MeshBasicMaterial({ map: cargarTex('cofa.png') }),  // 19: Cofre arriba
        new THREE.MeshBasicMaterial({ map: cargarTex('menah.png') }), // 20: Mena de hierro
        new THREE.MeshBasicMaterial({ map: cargarTex('bloqh.png') }), // 21: Bloque de hierro
        new THREE.MeshBasicMaterial({ map: cargarTex('menao.png') }), // 22: Mena de oro
        new THREE.MeshBasicMaterial({ map: cargarTex('bloqo.png') }), // 23: Bloque de oro
        new THREE.MeshBasicMaterial({ map: cargarTex('menad.png') }), // 24: Mena diamante
        new THREE.MeshBasicMaterial({ map: cargarTex('bloqd.png') }), // 25: Bloque diamante
        new THREE.MeshBasicMaterial({ map: cargarTex('menac.png') }), // 26: Mena carbón
        new THREE.MeshBasicMaterial({ map: cargarTex('bloqc.png') })  // 27: Bloque carbón
    ];

    controls = new THREE.PointerLockControls(camera, document.body);

    const pantallaBloqueo = document.getElementById('bloqueo-pantalla');
        var pausaAbierta = false;
    var ignorarEscHasta = 0; // evita que el mismo Esc cierre la pausa que acaba de abrir

    function puedeBloquearCursor() {
        return !inventarioAbierto && !hornoAbierto && !cofreAbierto && !creativoAbierto && !jugadorMuerto
            && !(document.getElementById('pantalla-matequiz') && document.getElementById('pantalla-matequiz').style.display === 'flex')
            && !(document.getElementById('pantalla-creeper') && document.getElementById('pantalla-creeper').style.display === 'flex')
            && !(document.getElementById('pantalla-stats') && document.getElementById('pantalla-stats').style.display === 'flex');
    }
    function mostrarPausa() {
        pausaAbierta = true;
        if (pantallaBloqueo) pantallaBloqueo.style.display = 'flex';
            try { if (controls && controls.isLocked) controls.unlock(); } catch (e) {}
    }
    function ocultarPausa() {
        pausaAbierta = false;
        if (pantallaBloqueo) pantallaBloqueo.style.display = 'none';
        }
    function mostrarHintSuave() {
        if (pausaAbierta) return;
        if (pantallaBloqueo) pantallaBloqueo.style.display = 'none';
        }
    window.mostrarPausaMate = mostrarPausa;
    window.ocultarPausaMate = ocultarPausa;

    function continuarJuego() {
        pausaAbierta = false;
        ocultarPausa();
        if (puedeBloquearCursor()) {
            try { controls.lock(); } catch (e) {}
        }
    }

    var btnCont = document.getElementById('btn-continuar');
    if (btnCont) {
        btnCont.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            continuarJuego();
        });
    }
    var btnSalir = document.getElementById('btn-salir-menu');
    if (btnSalir) {
        btnSalir.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            window.location.href = 'index.html';
        });
    }
    var btnGuardar = document.getElementById('btn-guardar');
    if (btnGuardar) {
        btnGuardar.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            if (typeof guardarMundo === 'function') {
                Promise.resolve(guardarMundo(true));
            }
        });
    }
    var btnStats = document.getElementById('btn-estadisticas');
    if (btnStats) {
        btnStats.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            if (window.MateQuiz && MateQuiz.abrirEstadisticas) MateQuiz.abrirEstadisticas();
        });
    }

    // Clic en canvas: continuar solo si NO hay menú de pausa
    document.body.addEventListener('click', function (ev) {
        if (pausaAbierta) return;
        if (!puedeBloquearCursor()) return;
        if (controls.isLocked) return;
        if (pantallaBloqueo && pantallaBloqueo.style.display === 'flex') return;
        var t = ev.target;
        if (t && (t.tagName === 'BUTTON' || t.tagName === 'INPUT' || t.tagName === 'SELECT')) return;
        if (t && (t.closest && (t.closest('.creativo-panel') || t.closest('#pantalla-inventario') || t.closest('#pantalla-horno') || t.closest('#pantalla-cofre') || t.closest('.matequiz-panel') || t.closest('.stats-panel') || t.closest('.pausa-caja')))) return;
        try { controls.lock(); } catch (e) {}
    });

    controls.addEventListener('lock', function () {
        pausaAbierta = false;
        ocultarPausa();
    });
    controls.addEventListener('unlock', function () {
        cancelarRuptura();
        // Si hay otra UI abierta (inventario, creativo, quiz...), no forzar pausa
        if (typeof inventarioAbierto !== 'undefined' && inventarioAbierto) return;
        if (typeof hornoAbierto !== 'undefined' && hornoAbierto) return;
        if (typeof cofreAbierto !== 'undefined' && cofreAbierto) return;
        if (typeof creativoAbierto !== 'undefined' && creativoAbierto) return;
        if (typeof jugadorMuerto !== 'undefined' && jugadorMuerto) return;
        var mq = document.getElementById('pantalla-matequiz');
        if (mq && mq.style.display === 'flex') return;
        var cr = document.getElementById('pantalla-creeper');
        if (cr && cr.style.display === 'flex') return;
        var st = document.getElementById('pantalla-stats');
        if (st && st.style.display === 'flex') return;
        // Esc (o pérdida de lock): menú de pausa a la PRIMERA vez
        mostrarPausa();
        ignorarEscHasta = performance.now() + 400;
    });

    // Esc abre SIEMPRE el menú de pausa (aunque el navegador ya haya soltado el pointer lock)
    window.addEventListener('keydown', function (e) {
        if (e.code !== 'Escape' && e.key !== 'Escape') return;

        // El Esc que soltó el pointer lock no debe cerrar la pausa en el mismo instante
        if (performance.now() < ignorarEscHasta) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        // Cerrar capas superiores primero
        var stats = document.getElementById('pantalla-stats');
        if (stats && stats.style.display === 'flex') {
            e.preventDefault();
            stats.style.display = 'none';
            mostrarPausa();
            return;
        }
        if (typeof creativoAbierto !== 'undefined' && creativoAbierto) {
            e.preventDefault();
            if (typeof cerrarCreativo === 'function') cerrarCreativo();
            mostrarPausa();
            return;
        }
        if (typeof inventarioAbierto !== 'undefined' && inventarioAbierto) {
            e.preventDefault();
            if (typeof toggleInventario === 'function') toggleInventario(false);
            mostrarPausa();
            return;
        }
        if (typeof hornoAbierto !== 'undefined' && hornoAbierto) {
            e.preventDefault();
            if (typeof cerrarHorno === 'function') cerrarHorno();
            mostrarPausa();
            return;
        }
        if (typeof cofreAbierto !== 'undefined' && cofreAbierto) {
            e.preventDefault();
            if (typeof cerrarCofre === 'function') cerrarCofre();
            mostrarPausa();
            return;
        }
        // Si ya está la pausa, Esc cierra y continúa
        if (pausaAbierta || (pantallaBloqueo && pantallaBloqueo.style.display === 'flex')) {
            e.preventDefault();
            continuarJuego();
            return;
        }
        // Abrir pausa
        e.preventDefault();
        mostrarPausa();
    }, true);

    scene.add(controls.getObject());
    // Posición mundial va en getObject(), no en camera (PointerLock anida la cámara)
    controls.getObject().position.set(0, 40, 0);
    /* camera pos = player pos en r128 */


    // ===== Cargar o generar mundo =====
    const params = obtenerParamsURL();
    let datosCargados = null;
    esMundoNuevo = true;
    nombreMundoActual = null;

    // 1) Datos enviados por el menú (sessionStorage)
    try {
        const rawCargar = sessionStorage.getItem('matecraft_cargar');
        if (rawCargar) {
            const obj = JSON.parse(rawCargar);
            if (obj && obj.data && obj.data.voxel) {
                nombreMundoActual = obj.nombre || params.mundo || 'mundo';
                datosCargados = obj.data;
                esMundoNuevo = false;
            }
            sessionStorage.removeItem('matecraft_cargar');
        }
    } catch (e) {
        console.warn('Error leyendo mundo a cargar:', e);
        sessionStorage.removeItem('matecraft_cargar');
    }

    // 2) Fallback: localStorage (sobrevive actualizaciones del código)
    if (!datosCargados && params.mundo) {
        try {
            const rawLS = localStorage.getItem('matecraft_mundo_' + params.mundo);
            if (rawLS) {
                const dataLS = JSON.parse(rawLS);
                if (dataLS && dataLS.voxel) {
                    nombreMundoActual = params.mundo;
                    datosCargados = dataLS;
                    esMundoNuevo = false;
                    console.log('[Mate-Craft] Mundo cargado desde localStorage');
                }
            }
        } catch (e) {
            console.warn('Error localStorage load:', e);
        }
    }

    // 3) Si aún no hay datos, mirar la URL
    if (!datosCargados) {
        if (params.nuevo) {
            nombreMundoActual = params.nuevo;
            esMundoNuevo = true;
        } else if (params.mundo) {
            nombreMundoActual = params.mundo;
            esMundoNuevo = true;
        } else {
            window.location.replace('index.html');
            return;
        }
    }

    sessionStorage.removeItem('matecraft_nuevo');

    if (datosCargados) {
        try {
            aplicarDatosMundo(datosCargados);
            if (datosCargados.player) {
                // Solo recordar XZ; la Y se corrige DESPUÉS al suelo (no usar Y guardada ni 45)
                var px = Number(datosCargados.player.x) || 0;
                var pz = Number(datosCargados.player.z) || 0;
                controls.getObject().position.set(px, 25, pz);
            }
        } catch (e) {
            console.error('Error aplicando mundo, se genera uno nuevo:', e);
            datosCargados = null;
            esMundoNuevo = true;
            mundoVoxel = new Uint8Array(tamMundoXZ * tamMundoY * tamMundoXZ);
        }
    }

    if (!datosCargados) {
        // Generar terreno nuevo
        let semillaX = Math.random() * 1000;
        let semillaZ = Math.random() * 1000;
        let desplazamiento = tamMundoXZ / 2;
        let nivelDelMar = 4;

        for (let x = 0; x < tamMundoXZ; x++) {
            for (let z = 0; z < tamMundoXZ; z++) {
                let alturaColina = Math.floor(
                    Math.sin((x + semillaX) * 0.08) * Math.cos((z + semillaZ) * 0.08) * 10 + 
                    Math.sin((x + semillaX) * 0.03) * Math.cos((z + semillaZ) * 0.03) * 8 + 14
                );
                if (alturaColina < 4) alturaColina = 4;
                if (alturaColina >= tamMundoY - 6) alturaColina = tamMundoY - 7;

                let esLago = alturaColina <= nivelDelMar;
                let alturaTerrenoReal = esLago ? 3 : alturaColina;

                for (let y = 0; y <= alturaTerrenoReal; y++) {
                    let idMat = 1; 
                    if (y === 0) idMat = 5; 
                    else if (y === alturaTerrenoReal) idMat = 3; 
                    else if (y >= alturaTerrenoReal - 3) idMat = 2; 

                    let posX = x - desplazamiento;
                    let posZ = z - desplazamiento;

                    // Menas en piedra (carbón más superficial y común)
                    if (idMat === 1 && y >= 2 && y <= alturaTerrenoReal - 2) {
                        let n = Math.sin((x + semillaX) * 19.19 + y * 7.7 + (z + semillaZ) * 31.31) * 43758.5453;
                        n = n - Math.floor(n);
                        let n2 = Math.sin((x + semillaX) * 27.27 + y * 11.1 + (z + semillaZ) * 43.43) * 43758.5453;
                        n2 = n2 - Math.floor(n2);
                        let n3 = Math.sin((x + semillaX) * 41.41 + y * 13.3 + (z + semillaZ) * 17.17) * 43758.5453;
                        n3 = n3 - Math.floor(n3);
                        let n4 = Math.sin((x + semillaX) * 13.13 + y * 5.5 + (z + semillaZ) * 29.29) * 43758.5453;
                        n4 = n4 - Math.floor(n4);
                        if (y <= alturaTerrenoReal - 4 && n3 < 0.006) idMat = 30; // diamante
                        else if (y <= alturaTerrenoReal - 4 && n2 < 0.012) idMat = 28; // oro
                        else if (y <= alturaTerrenoReal - 4 && n < 0.035) idMat = 26; // hierro
                        else if (n4 < 0.06) idMat = 32; // carbón (común)
                    }

                    establecerIdVoxel(posX, y, posZ, idMat);
                }

                if (esLago) {
                    for (let yWaters = 3; yWaters <= nivelDelMar; yWaters++) {
                        establecerIdVoxel(x - desplazamiento, yWaters, z - desplazamiento, 7);
                    }
                }

                let probabilidadArbol = Math.sin((x + semillaX) * 12.9898 + (z + semillaZ) * 78.233) * 43758.5453;
                let valorAleatorio = probabilidadArbol - Math.floor(probabilidadArbol);

                if (valorAleatorio < 0.012 && alturaColina > 5 && !esLago) {
                    let baseArbolY = alturaColina + 1;
                    let posX = x - desplazamiento;
                    let posZ = z - desplazamiento;

                    for (let t = 0; t < 5; t++) {
                        establecerIdVoxel(posX, baseArbolY + t, posZ, 6);
                    }

                    let alturaCopa = baseArbolY + 4;
                    for (let hx = -2; hx <= 2; hx++) {
                        for (let hz = -2; hz <= 2; hz++) {
                            for (let hy = 0; hy <= 2; hy++) {
                                if (Math.abs(hx) === 2 && Math.abs(hz) === 2 && hy === 2) continue;
                                let hX = posX + hx;
                                let hY = alturaCopa + hy;
                                let hZ = posZ + hz;
                                if (obtenerIdVoxel(hX, hY, hZ) === 0) {
                                    establecerIdVoxel(hX, hY, hZ, 4);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    reconstruirMallaMundo();

    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyW') moveForward = true;
        if (e.code === 'KeyS') moveBackward = true;
        if (e.code === 'KeyA') moveLeft = true;
        if (e.code === 'KeyD') moveRight = true;
        if (e.code === 'Space') {
            spacePressed = true;
            if (enSuelo) { velocityY = fuerzaSalto; enSuelo = false; }
        }

        if (e.code === 'KeyE') {
            if (creativoAbierto) {
                cerrarCreativo();
            } else if (hornoAbierto) {
                cerrarHorno();
            } else if (cofreAbierto) {
                cerrarCofre();
            } else {
                toggleInventario(false); 
            }
        }

        // Alt+C = modo creativo (menú de ítems / mobs)
        if (e.code === 'KeyC' && e.altKey) {
            e.preventDefault();
            toggleModoCreativo();
        }

        // M = Guardar y volver al menú (único momento de guardado)
        if (e.code === 'KeyM') {
            if (nombreMundoActual) {
                Promise.resolve(guardarMundo(true)).finally(() => {
                    window.location.href = 'index.html';
                });
            } else {
                window.location.href = 'index.html';
            }
        }
        
        if (!inventarioAbierto && !hornoAbierto && !cofreAbierto && !creativoAbierto) {
            if (e.key >= '1' && e.key <= '9') {
                materialSeleccionadoIndex = parseInt(e.key, 10) - 1;
                actualizarUIInventario();
            } else if (e.key === '0') {
                materialSeleccionadoIndex = 9;
                actualizarUIInventario();
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'KeyW') moveForward = false;
        if (e.code === 'KeyS') moveBackward = false;
        if (e.code === 'KeyA') moveLeft = false;
        if (e.code === 'KeyD') moveRight = false;
        if (e.code === 'Space') spacePressed = false;
    });

    window.addEventListener('wheel', (e) => {
        if (inventarioAbierto || hornoAbierto || cofreAbierto || creativoAbierto || !controls.isLocked) return;
        if (e.deltaY > 0) materialSeleccionadoIndex = (materialSeleccionadoIndex + 1) % BARRA_SIZE;
        else materialSeleccionadoIndex = (materialSeleccionadoIndex - 1 + BARRA_SIZE) % BARRA_SIZE;
        actualizarUIInventario();
    });

    window.addEventListener('mousedown', (e) => {
        if (inventarioAbierto || hornoAbierto || cofreAbierto || creativoAbierto || !controls.isLocked || jugadorMuerto) return;
        raycaster.setFromCamera(mouse, camera);

        // Golpear mobs con clic izquierdo
        if (e.button === 0 && window.MateCraftMobs) {
            const mobHit = MateCraftMobs.raycastHit(raycaster, camera, mouse, 5);
            if (mobHit) {
                let arma = itemBarraActual();
                let golpes = 1;
                if (arma === 'espd') golpes = 6;
                else if (arma === 'espo') golpes = 5;
                else if (arma === 'esph') golpes = 4;
                else if (arma === 'espp') golpes = 3;
                else if (arma === 'espm') golpes = 2;
                for (let gi = 0; gi < golpes; gi++) {
                    if (!mobHit || mobHit.vida <= 0) break;
                    MateCraftMobs.hit(mobHit);
                }
                cancelarRuptura();
                return;
            }
        }

        let intersects = raycaster.intersectObject(meshMundo);

        if (intersects.length > 0 && intersects[0].distance < 6) {
            let hit = intersects[0];
            let normal = hit.face.normal.clone();
            let pImp = hit.point.clone().add(normal.clone().multiplyScalar(-0.01));
            let vx = Math.floor(pImp.x + 0.5), vy = Math.floor(pImp.y + 0.5), vz = Math.floor(pImp.z + 0.5);

            if (e.button === 0) {
                let idB = obtenerIdVoxel(vx, vy, vz);
                if (idB === 7 || idB === 5) { cancelarRuptura(); return; } 
                
                cancelarComer();
                objetivoRompiendoPos = { x: vx, y: vy, z: vz };
                estaRompiendo = true;
                tiempoRompiendo = 0;

                let itemActual = itemBarraActual();
                let esPiedra = (idB === 1 || idB === 12 || idB === 26 || idB === 27 || idB === 28 || idB === 29 || idB === 30 || idB === 31 || idB === 32 || idB === 33);
                let esTierra = (idB === 2 || idB === 3);
                let esMadera = (idB === 6 || idB === 8 || idB === 10);
                let esHojas = (idB === 4);
                let esMenaHierro = (idB === 26);
                let esMenaOro = (idB === 28);
                let esMenaDiamante = (idB === 30);
                let esMenaCarbon = (idB === 32);
                let conHerramienta = itemActual && HERRAMIENTAS.has(itemActual);
                let picoOk = (itemActual === 'picp' || itemActual === 'pich' || itemActual === 'pico' || itemActual === 'picd');
                let picoHierro = (itemActual === 'pich' || itemActual === 'pico' || itemActual === 'picd');
                let picoOro = (itemActual === 'pico' || itemActual === 'picd');
                let picoDiamante = (itemActual === 'picd');

                if (!itemActual || (!conHerramienta && !esComida(itemActual))) {
                    if (esPiedra) tiempoRequeridoRomper = 2.4;
                    else if (esMadera) tiempoRequeridoRomper = 1.5;
                    else if (esTierra) tiempoRequeridoRomper = 0.9;
                    else if (esHojas) tiempoRequeridoRomper = 0.45;
                    else tiempoRequeridoRomper = 1.0;
                } else if (esMenaCarbon && picoOk) {
                    tiempoRequeridoRomper = 0.3;
                } else if (esMenaCarbon && itemActual === 'picm') {
                    tiempoRequeridoRomper = 0.4;
                } else if (esMenaCarbon) {
                    tiempoRequeridoRomper = 1.8;
                } else if (esMenaDiamante && (picoDiamante || itemActual === 'pich' || itemActual === 'pico')) {
                    tiempoRequeridoRomper = picoDiamante ? 0.25 : 0.4;
                } else if (esMenaDiamante) {
                    tiempoRequeridoRomper = 3.5; // solo hierro+
                } else if (esMenaOro && picoOro) {
                    tiempoRequeridoRomper = 0.28;
                } else if (esMenaOro && itemActual === 'pich') {
                    tiempoRequeridoRomper = 0.45;
                } else if (esMenaOro) {
                    tiempoRequeridoRomper = 3.0; // necesita pico de hierro+
                } else if (esMenaHierro && picoOro) {
                    tiempoRequeridoRomper = 0.28;
                } else if (esMenaHierro && itemActual === 'pich') {
                    tiempoRequeridoRomper = 0.35;
                } else if (esMenaHierro && itemActual === 'picp') {
                    tiempoRequeridoRomper = 0.55;
                } else if (esMenaHierro) {
                    tiempoRequeridoRomper = 2.5; // sin pico de piedra+ no conviene
                } else if (esPiedra && picoDiamante) {
                    tiempoRequeridoRomper = 0.07;
                } else if (esPiedra && picoOro) {
                    tiempoRequeridoRomper = 0.09;
                } else if (esPiedra && itemActual === 'pich') {
                    tiempoRequeridoRomper = 0.12;
                } else if (esPiedra && itemActual === 'picp') {
                    tiempoRequeridoRomper = 0.2;
                } else if (esPiedra && itemActual === 'picm') {
                    tiempoRequeridoRomper = 0.35;
                } else if (esPiedra) {
                    tiempoRequeridoRomper = 2.0;
                } else if (esMadera && itemActual === 'hachd') {
                    tiempoRequeridoRomper = 0.07;
                } else if (esMadera && itemActual === 'hacho') {
                    tiempoRequeridoRomper = 0.09;
                } else if (esMadera && itemActual === 'hachh') {
                    tiempoRequeridoRomper = 0.12;
                } else if (esMadera && itemActual === 'hachp') {
                    tiempoRequeridoRomper = 0.18;
                } else if (esMadera && itemActual === 'hachm') {
                    tiempoRequeridoRomper = 0.28;
                } else if (esHojas && (itemActual === 'hachm' || itemActual === 'hachp' || itemActual === 'hachh' || itemActual === 'hacho' || itemActual === 'hachd')) {
                    tiempoRequeridoRomper = 0.1;
                } else if (esTierra && itemActual === 'palad') {
                    tiempoRequeridoRomper = 0.05;
                } else if (esTierra && itemActual === 'palao') {
                    tiempoRequeridoRomper = 0.06;
                } else if (esTierra && itemActual === 'palah') {
                    tiempoRequeridoRomper = 0.08;
                } else if (esTierra && itemActual === 'palap') {
                    tiempoRequeridoRomper = 0.12;
                } else if (esTierra && itemActual === 'palam') {
                    tiempoRequeridoRomper = 0.2;
                } else if (esHojas) {
                    tiempoRequeridoRomper = 0.2;
                } else {
                    tiempoRequeridoRomper = 0.45;
                }

                document.getElementById('barra-romper-container').style.display = 'block';
            } else if (e.button === 2) {
                let idBajoClic = obtenerIdVoxel(vx, vy, vz);
                
                if (idBajoClic === 10) {
                    toggleInventario(true);
                    return;
                }

                // Abrir horno (apagado 13-16 o prendido 17-20)
                if (idBajoClic >= 13 && idBajoClic <= 20) {
                    abrirHorno(vx, vy, vz);
                    return;
                }

                // Abrir cofre (cualquier orientación 22-25)
                if (idBajoClic >= 22 && idBajoClic <= 25) {
                    abrirCofre(vx, vy, vz);
                    return;
                }

                let tipoMatStr = itemBarraActual();
                // Comida u objetos no colocables
                if (tipoMatStr && (esComida(tipoMatStr) || HERRAMIENTAS.has(tipoMatStr) || tipoMatStr === 'carbon' || tipoMatStr === 'hierro' || tipoMatStr === 'oro' || tipoMatStr === 'diamante' || tipoMatStr === 'carbon' || tipoMatStr === 'carne' || tipoMatStr === 'carnec' || tipoMatStr === 'carne2' || tipoMatStr === 'carnec2' || tipoMatStr === 'carne3' || tipoMatStr === 'carnec3' || tipoMatStr === 'carne4' || tipoMatStr === 'carnec4')) {
                    if (esComida(tipoMatStr)) comerAlimento(tipoMatStr);
                    return;
                }
                if (!tipoMatStr) return;

                let cx, cy, cz;
                if (idBajoClic === 7) {
                    cx = vx; cy = vy; cz = vz;
                } else {
                    let pConsOffset = hit.point.clone().add(normal.clone().multiplyScalar(0.01));
                    cx = Math.floor(pConsOffset.x + 0.5); 
                    cy = Math.floor(pConsOffset.y + 0.5); 
                    cz = Math.floor(pConsOffset.z + 0.5);
                }

                if (inventarioRecursos[tipoMatStr] > 0) {
                    let camPos = controls.getObject().position;
                    if (!colisionaConCajaJugador(cx, cy, cz, camPos.x, camPos.y, camPos.z)) {
                        let idAsignar = 1; 
                        if (tipoMatStr === 'tierra') idAsignar = 2; 
                        else if (tipoMatStr === 'tronco') idAsignar = 6;
                        else if (tipoMatStr === 'tablon') idAsignar = 8;
                        else if (tipoMatStr === 'mesacra') idAsignar = 10;
                        else if (tipoMatStr === 'roca') idAsignar = 12;
                        else if (tipoMatStr === 'lana') idAsignar = 21;
                        else if (tipoMatStr === 'menah') idAsignar = 26;
                        else if (tipoMatStr === 'bloqh') idAsignar = 27;
                        else if (tipoMatStr === 'menao') idAsignar = 28;
                        else if (tipoMatStr === 'bloqo') idAsignar = 29;
                        else if (tipoMatStr === 'menad') idAsignar = 30;
                        else if (tipoMatStr === 'bloqd') idAsignar = 31;
                        else if (tipoMatStr === 'menac') idAsignar = 32;
                        else if (tipoMatStr === 'bloqc') idAsignar = 33;
                        else if (tipoMatStr === 'agua') idAsignar = 7;
                        else if (tipoMatStr === 'hojas') idAsignar = 4;
                        else if (tipoMatStr === 'cofre') {
                            // Frente en la dirección a la que mira el jugador
                            let dir = new THREE.Vector3();
                            camera.getWorldDirection(dir);
                            dir.y = 0;
                            dir.normalize();
                            if (Math.abs(dir.x) > Math.abs(dir.z)) {
                                // Mira en X → frente en +X o -X
                                idAsignar = (dir.x > 0) ? 24 : 25; // 24=+X | 25=-X
                            } else {
                                // Mira en Z → frente en +Z o -Z
                                idAsignar = (dir.z > 0) ? 22 : 23; // 22=+Z | 23=-Z
                            }
                        }
                        else if (tipoMatStr === 'horno') {
                            // Orientar el frente del horno hacia el jugador
                            let dir = new THREE.Vector3();
                            camera.getWorldDirection(dir);
                            dir.y = 0;
                            dir.normalize();

                            // Elegir el eje dominante
                            if (Math.abs(dir.x) > Math.abs(dir.z)) {
                                // Mira más en X
                                idAsignar = (dir.x > 0) ? 16 : 15; // 16 = frente -X | 15 = frente +X
                            } else {
                                // Mira más en Z
                                idAsignar = (dir.z > 0) ? 14 : 13; // 14 = frente -Z | 13 = frente +Z
                            }
                        }

                        establecerIdVoxel(cx, cy, cz, idAsignar);
                        if (tipoMatStr === 'cofre') {
                            asegurarCofre(cx, cy, cz);
                        }
                        if (tipoMatStr === 'horno') {
                            obtenerDatosHorno(cx, cy, cz);
                        }
                        reconstruirMallaMundo();
                        if (!modoCreativo) {
                            inventarioRecursos[tipoMatStr]--;
                            limpiarSlotSiVacio(tipoMatStr);
                        }
                        actualizarUIInventario();
                    }
                }
            }
        }
    });

    window.addEventListener('mouseup', (e) => { if (e.button === 0) cancelarRuptura(); });
    window.addEventListener('contextmenu', e => e.preventDefault());

    // SIEMPRE asentar en el suelo al iniciar (nuevo o cargado)
    (function asentarJugadorAlIniciar() {
        var obj = controls.getObject();
        var ix = Math.floor(obj.position.x + 0.0001);
        var iz = Math.floor(obj.position.z + 0.0001);
        // Buscar superficie sólida y colocar ojos encima
        var colocado = false;
        if (typeof colocarJugadorEnSuelo === 'function') {
            colocado = colocarJugadorEnSuelo(ix, iz);
            if (!colocado) {
                // probar alrededores
                var offs = [[0,0],[1,0],[-1,0],[0,1],[0,-1],[2,2],[-2,2],[3,0],[-3,0]];
                for (var oi = 0; oi < offs.length && !colocado; oi++) {
                    colocado = colocarJugadorEnSuelo(ix + offs[oi][0], iz + offs[oi][1]);
                }
            }
        }
        if (!colocado && typeof encontrarSpawnSeguro === 'function') {
            encontrarSpawnSeguro();
        }
        // Empujar fuera de bloques si hace falta
        var safety = 0;
        while (typeof colisionaConCajaJugadorPuro === 'function' &&
               colisionaConCajaJugadorPuro(obj.position.x, obj.position.y, obj.position.z) &&
               safety < 100) {
            obj.position.y += 0.5;
            safety++;
        }
        velocityY = 0;
        distanciaCaida = 0;
        enSuelo = true;
        console.log('[Mate-Craft] Jugador asentado en', obj.position.x.toFixed(1), obj.position.y.toFixed(1), obj.position.z.toFixed(1));
    })();

    actualizarUIInventario();
    actualizarUIVida();
    actualizarUIHambre();
    actualizarUIAire(false);
    actualizarCicloDiaNoche(0); // aplicar cielo inicial
    // Sistema de mobs
    if (window.MateCraftMobs) {
        MateCraftMobs.init({
            scene,
            THREE,
            obtenerIdVoxel,
            tamMundoY,
            inventarioRecursos,
            actualizarUIInventario,
            anadirItem,
            getPlayerPos: function () {
                if (!controls) return null;
                return controls.getObject().position;
            },
            aplicarDanio: function (n, motivo) {
                if (typeof aplicarDanio === 'function') aplicarDanio(n, motivo);
            },
            esNoche: function () {
                var h = (typeof tiempoMundo === 'number' ? tiempoMundo : 0) * 24;
                return h < 6 || h >= 19;
            }
        });
        if (datosCargados && Array.isArray(datosCargados.mobs) && datosCargados.mobs.length > 0) {
            MateCraftMobs.load(datosCargados.mobs);
        }
        MateCraftMobs.setPoblacion(
            { pollo: 6, cerdo: 5, vaca: 4, oveja: 5, zombi: 0, arana: 0, creeper: 0 },
            { pollo: 20, cerdo: 18, vaca: 16, oveja: 18, zombi: 40, arana: 35, creeper: 30 },
            55
        );
        MateCraftMobs.asegurarMinimos({ pollo: 6, cerdo: 5, vaca: 4, oveja: 5 }, 55);
    }

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
    // Listo para guardar
    mundoListoParaGuardar = true;
    ultimoGuardado = performance.now() / 1000;

    // Al cerrar/recargar la pestaña: guardar en el navegador
    // Sin auto-guardado: solo se guarda con la tecla M
    if (pantallaBloqueo) pantallaBloqueo.style.display = 'none';
    if (window.MateQuiz && MateQuiz.actualizarHUD) MateQuiz.actualizarHUD();
    animate();
}