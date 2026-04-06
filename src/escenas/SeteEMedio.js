import Escena from '../Escena.js';
import Baralla from '../Baralla.js';
import Boton from '../utiles/Boton.js';
import AnimacionDesprazamento from '../utiles/animacions/AnimacionDesprazamento.js';

// ── DISPLAY CONSTANTS ──
const CW = 48, CH = 76, GAP = 8;
const CANVAS_W = 380, CANVAS_H = 600;

// Layout
const Y_PLAYER_INFO = CANVAS_H - 24;
const Y_PLAYER_HAND = Y_PLAYER_INFO - CH - 6;
const Y_BUTTONS = Y_PLAYER_HAND - 42;
const Y_BANCA = 40;
const Y_PUNTOS_AREA = 150; // IA puntos cards area

const ESTADO = {
    DADO: -1,
    REPARTIR: 0,
    TURNO_XOGADOR: 1,
    TURNO_IA_PUNTO: 2,
    TURNO_BANCA: 3,
    FIN_RONDA: 4,
};

export default class SeteEMedio extends Escena {
    constructor(director, config = {}) {
        super(director);
        this.assets = director.assets;
        this.config = config;

        const numOponentes = config.numOponentes || 1;
        const dificultades = config.dificultades || ['medio'];

        // All players including human. Index 0 = human player.
        // One of them is the banker (banca).
        this.numXogadores = 1 + numOponentes;
        this.nomes = ['Ti'];
        this.dificultades = ['humano'];
        this.fichas = [100]; // starting chips

        for (let i = 0; i < numOponentes; i++) {
            this.nomes.push(`IA ${i + 1}`);
            this.dificultades.push(dificultades[i] || 'medio');
            this.fichas.push(100);
        }

        this.bancaIdx = this.numXogadores - 1; // last player is banker initially
        this.ronda = 0;

        // Per-round state
        this.mans = [];         // mans[i] = [{carta, bocaArriba}]
        this.apostas = [];      // bet per player
        this.pasouse = [];      // busted?
        this.plantouse = [];    // standing?
        this.turnoActual = -1;
        this.iaPuntoActual = -1;

        // UI state
        this.estado = ESTADO.DADO;
        this.mensaxe = '';
        this.tempMsg = 0;
        this.msgEnRemate = null;
        this.animacions = [];
        this.estaAnimando = false;
        this.pausado = false;
        this._voltandoDePausa = false;

        // Dice
        this.dado = {
            fase: 'tirando', caraActual: 1, resultado: 0,
            tempo: 0, intervalo: 80, duracion: 2000,
            spinnerIdx: 0, spinnerPasos: 0, spinnerFeitos: 0,
            spinnerTempo: 0, spinnerIntervalo: 150, pausaTempo: 0,
        };

        // Buttons
        const bw = 80, bh = 28;
        this.btnPedir = new Boton(
            CANVAS_W / 2 - bw - 4, Y_BUTTONS, bw, bh,
            ['#2a7a2a', '#3a9a3a', '#1a5a1a'],
            [], 'Carta',
            () => this.xogadorPedirCarta(),
            { tamanhoTexto: 10 }
        );
        this.btnPlantar = new Boton(
            CANVAS_W / 2 + 4, Y_BUTTONS, bw, bh,
            ['#7a4a2a', '#9a5a3a', '#5a3a1a'],
            [], 'Plantarse',
            () => this.xogadorPlantarse(),
            { tamanhoTexto: 10 }
        );

        const cogSize = 24;
        this.btnCog = new Boton(
            6, 6, cogSize, cogSize,
            ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.6)'],
            [], '\u2699',
            () => { this.pausado = true; },
            { corTexto: '#fff', tamanhoTexto: 16 }
        );
        const popupW = 180, popupH = 120;
        const popupX = CANVAS_W / 2 - popupW / 2;
        const popupY = CANVAS_H / 2 - popupH / 2;
        this.popupPausa = { x: popupX, y: popupY, w: popupW, h: popupH };
        const pbw = 140, pbh = 28, pbx = popupX + (popupW - pbw) / 2;
        this.btnResumir = new Boton(
            pbx, popupY + 45, pbw, pbh,
            ['#2a7a2a', '#3a9a3a', '#1a5a1a'], [], 'Continuar',
            () => { this.pausado = false; this._voltandoDePausa = true; },
            { corTexto: '#fff', tamanhoTexto: 12 }
        );
        this.btnVolverMenu = new Boton(
            pbx, popupY + 82, pbw, pbh,
            ['#7a2a2a', '#9a3a3a', '#5a1a1a'], [], 'Volver ao menu',
            () => { import('./Menu.js').then(m => this.director.cambiarEscena(new m.default(this.director))); },
            { corTexto: '#fff', tamanhoTexto: 10 }
        );
        this.btnContinuarRonda = new Boton(
            CANVAS_W / 2 - 55, CANVAS_H / 2 + 120, 110, 32,
            ['#2a2a7a', '#3a3a9a', '#1a1a5a'], [], 'Continuar',
            () => this.iniciarRonda()
        );

        this.iniciarRonda();
    }

    // ═══════════════════════════════════════════
    //  CARD VALUE HELPERS
    // ═══════════════════════════════════════════

    valorCarta(carta) {
        const p = carta.puntos();
        return p <= 7 ? p : 0.5;
    }

    totalMan(idx) {
        let total = 0;
        for (const entry of this.mans[idx]) {
            total += this.valorCarta(entry.carta);
        }
        return total;
    }

    // ═══════════════════════════════════════════
    //  GAME FLOW
    // ═══════════════════════════════════════════

    iniciarRonda() {
        this.ronda++;
        this.baralla = new Baralla();
        this.mans = [];
        this.apostas = [];
        this.pasouse = [];
        this.plantouse = [];
        this.resultados = null;

        for (let i = 0; i < this.numXogadores; i++) {
            this.mans.push([]);
            // Eliminated players don't bet and are auto-standing
            const eliminado = this.fichas[i] <= 0;
            this.apostas.push(eliminado || i === this.bancaIdx ? 0 : 10);
            this.pasouse.push(eliminado);
            this.plantouse.push(eliminado);
        }

        // Deal one card face-down to each player
        this.reproducirSon('son_barallar');

        if (this.estado === ESTADO.DADO) {
            // Dice decides first banker
            this.repartirInicial(() => {});
        } else {
            this.repartirInicial(() => {
                this.empezarTurnos();
            });
        }
    }

    repartirInicial(enRemate) {
        const deckX = 15, deckY = 80;
        const deals = [];

        for (let i = 0; i < this.numXogadores; i++) {
            if (this.fichas[i] <= 0) continue; // skip eliminated
            const carta = this.baralla.roubar();
            deals.push({ carta, playerIdx: i });
        }

        const repartirSeguinte = (idx) => {
            if (idx >= deals.length) {
                if (enRemate) enRemate();
                return;
            }

            const d = deals[idx];
            const pos = this.posicionCarta(d.playerIdx, 0);
            // Player sees own card, others face-down
            const cardId = d.playerIdx === 0 ? d.carta.valor : 'dorso';

            this.animacions.push(new AnimacionDesprazamento(
                this.assets, CW, CH, cardId,
                deckX, deckY, pos.x, pos.y,
                () => {
                    this.mans[d.playerIdx].push({ carta: d.carta, bocaArriba: false });
                    this.reproducirSon(`son_dar${1 + Math.floor(Math.random() * 6)}`);
                    repartirSeguinte(idx + 1);
                },
                0.12
            ));
        };

        repartirSeguinte(0);
    }

    empezarTurnos() {
        // Find first non-banker player (start from player to right of banker)
        this.turnoActual = this.seguintePunto(-1);
        if (this.turnoActual === -1) {
            // No puntos, go straight to banker
            this.iniciarTurnoBanca();
        } else if (this.turnoActual === 0) {
            this.estado = ESTADO.TURNO_XOGADOR;
            this.mostrarMsg('O teu turno');
        } else {
            this.estado = ESTADO.TURNO_IA_PUNTO;
            this.tempIA = 0;
            this.iaPuntoActual = this.turnoActual;
            this.mostrarMsg(`Turno de ${this.nomes[this.turnoActual]}`);
        }
    }

    // Find next punto player after current (skip banker, busted, standing, eliminated)
    seguintePunto(despois) {
        for (let i = 1; i <= this.numXogadores; i++) {
            const idx = (despois + i) % this.numXogadores;
            if (idx < 0) continue;
            if (idx === this.bancaIdx) continue;
            if (this.fichas[idx] <= 0) continue;
            if (this.pasouse[idx] || this.plantouse[idx]) continue;
            return idx;
        }
        return -1;
    }

    avanzarDespoisDeTurno() {
        const next = this.seguintePunto(this.turnoActual);
        if (next === -1) {
            // All puntos done, banker's turn
            this.iniciarTurnoBanca();
        } else if (next === 0) {
            this.turnoActual = 0;
            this.estado = ESTADO.TURNO_XOGADOR;
            this.mostrarMsg('O teu turno');
        } else {
            this.turnoActual = next;
            this.iaPuntoActual = next;
            this.estado = ESTADO.TURNO_IA_PUNTO;
            this.tempIA = 0;
            this.mostrarMsg(`Turno de ${this.nomes[next]}`);
        }
    }

    iniciarTurnoBanca() {
        this.turnoActual = this.bancaIdx;
        this.estado = ESTADO.TURNO_BANCA;

        // Reveal banker's face-down card
        if (this.mans[this.bancaIdx].length > 0) {
            this.mans[this.bancaIdx][0].bocaArriba = true;
        }

        // If all puntos busted, banker wins automatically
        const todosPassaron = this.pasouse.every((p, i) => i === this.bancaIdx || p);
        if (todosPassaron) {
            this.mostrarMsg('Todos pasaron! Banca gana', 1800, () => this.finalizarRonda());
            return;
        }

        if (this.bancaIdx === 0) {
            this.mostrarMsg('O teu turno (Banca)');
        } else {
            this.tempIA = 0;
            this.mostrarMsg(`Turno da banca (${this.nomes[this.bancaIdx]})`);
        }
    }

    darCarta(playerIdx, bocaArriba, enRemate) {
        const carta = this.baralla.roubar();
        const cardIdx = this.mans[playerIdx].length;
        const pos = this.posicionCarta(playerIdx, cardIdx);
        const deckX = 15, deckY = 80;

        const showFace = bocaArriba || playerIdx === 0;
        const cardId = showFace ? carta.valor : 'dorso';

        this.animacions.push(new AnimacionDesprazamento(
            this.assets, CW, CH, cardId,
            deckX, deckY, pos.x, pos.y,
            () => {
                this.mans[playerIdx].push({ carta, bocaArriba });
                this.reproducirSon(`son_dar${1 + Math.floor(Math.random() * 6)}`);
                if (enRemate) enRemate();
            },
            0.08
        ));
    }

    // ═══════════════════════════════════════════
    //  PLAYER ACTIONS
    // ═══════════════════════════════════════════

    xogadorPedirCarta() {
        if (this.estado !== ESTADO.TURNO_XOGADOR && !(this.estado === ESTADO.TURNO_BANCA && this.bancaIdx === 0)) return;

        const idx = this.turnoActual;
        this.darCarta(idx, true, () => {
            const total = this.totalMan(idx);
            if (total > 7.5) {
                this.pasouse[idx] = true;
                this.mans[idx][0].bocaArriba = true;
                this.mostrarMsg(`Pasouse! (${total})`, 1500, () => {
                    if (this.estado === ESTADO.TURNO_BANCA) {
                        this.finalizarRonda();
                    } else {
                        this.avanzarDespoisDeTurno();
                    }
                });
            }
        });
    }

    xogadorPlantarse() {
        if (this.estado !== ESTADO.TURNO_XOGADOR && !(this.estado === ESTADO.TURNO_BANCA && this.bancaIdx === 0)) return;

        const idx = this.turnoActual;
        this.plantouse[idx] = true;

        if (this.estado === ESTADO.TURNO_BANCA) {
            this.finalizarRonda();
        } else {
            this.avanzarDespoisDeTurno();
        }
    }

    // ═══════════════════════════════════════════
    //  AI LOGIC
    // ═══════════════════════════════════════════

    executarIAPunto(dt) {
        this.tempIA = (this.tempIA || 0) + dt;
        if (this.tempIA < 1000) return;

        const idx = this.turnoActual;
        const total = this.totalMan(idx);
        const threshold = this.dificultades[idx] === 'facil' ? 5 :
                          this.dificultades[idx] === 'dificil' ? 6 : 5.5;

        if (total < threshold) {
            this.tempIA = 0;
            this.darCarta(idx, true, () => {
                const newTotal = this.totalMan(idx);
                if (newTotal > 7.5) {
                    this.pasouse[idx] = true;
                    this.mans[idx][0].bocaArriba = true;
                    this.mostrarMsg(`${this.nomes[idx]} pasouse! (${newTotal})`, 1500, () => {
                        this.avanzarDespoisDeTurno();
                    });
                } else {
                    this.tempIA = 0; // will decide again next frame cycle
                }
            });
        } else {
            this.plantouse[idx] = true;
            this.mostrarMsg(`${this.nomes[idx]} plantouse`, 1200, () => {
                this.avanzarDespoisDeTurno();
            });
        }
    }

    executarBancaIA(dt) {
        this.tempIA = (this.tempIA || 0) + dt;
        if (this.tempIA < 1000) return;

        const idx = this.bancaIdx;
        const total = this.totalMan(idx);

        // Banker strategy: must beat the best standing punto
        let maxPunto = 0;
        for (let i = 0; i < this.numXogadores; i++) {
            if (i === this.bancaIdx || this.pasouse[i]) continue;
            if (this.plantouse[i]) maxPunto = Math.max(maxPunto, this.totalMan(i));
        }

        // Banker hits if below the best punto score (ties win for banker)
        if (total < maxPunto) {
            this.tempIA = 0;
            this.darCarta(idx, true, () => {
                const newTotal = this.totalMan(idx);
                if (newTotal > 7.5) {
                    this.pasouse[idx] = true;
                    this.mostrarMsg(`Banca pasouse! (${newTotal})`, 1800, () => {
                        this.finalizarRonda();
                    });
                } else {
                    this.tempIA = 0;
                }
            });
        } else {
            this.plantouse[idx] = true;
            this.mostrarMsg(`Banca plantouse (${total})`, 1500, () => {
                this.finalizarRonda();
            });
        }
    }

    // ═══════════════════════════════════════════
    //  ROUND END
    // ═══════════════════════════════════════════

    finalizarRonda() {
        // Reveal all face-down cards
        for (const man of this.mans) {
            for (const entry of man) entry.bocaArriba = true;
        }

        const bancaTotal = this.totalMan(this.bancaIdx);
        const bancaPasou = this.pasouse[this.bancaIdx];
        this.resultados = [];
        let novaBanca = -1;

        for (let i = 0; i < this.numXogadores; i++) {
            if (i === this.bancaIdx) {
                this.resultados.push({ nome: this.nomes[i] + ' (Banca)', total: bancaTotal, resultado: '-', cambio: 0 });
                continue;
            }

            const total = this.totalMan(i);
            let resultado, cambio;

            if (this.pasouse[i]) {
                resultado = 'Pasouse';
                cambio = -this.apostas[i];
            } else if (bancaPasou) {
                resultado = 'Gana';
                cambio = this.apostas[i];
            } else if (total > bancaTotal) {
                resultado = 'Gana';
                cambio = this.apostas[i];
            } else {
                // Tie or less: banker wins
                resultado = total === bancaTotal ? 'Empate (Banca gana)' : 'Perde';
                cambio = -this.apostas[i];
            }

            // Check for exactly 7.5 → becomes new banker
            if (total === 7.5 && !this.pasouse[i] && bancaTotal !== 7.5) {
                novaBanca = i;
            }

            this.fichas[i] += cambio;
            this.fichas[this.bancaIdx] -= cambio;
            this.resultados.push({ nome: this.nomes[i], total, resultado, cambio });
        }

        if (novaBanca >= 0) {
            this.bancaIdx = novaBanca;
        }

        // Eliminate players with 0 or fewer chips
        this.eliminados = [];
        for (let i = 0; i < this.numXogadores; i++) {
            if (this.fichas[i] <= 0) {
                this.fichas[i] = 0;
                this.eliminados.push(i);
            }
        }

        // Check if game is over (human eliminated or only 1 player left)
        const xogadoresVivos = [];
        for (let i = 0; i < this.numXogadores; i++) {
            if (this.fichas[i] > 0) xogadoresVivos.push(i);
        }
        this.finXogo = xogadoresVivos.length <= 1 || this.fichas[0] <= 0;

        // If banker was eliminated, assign to first surviving player
        if (this.fichas[this.bancaIdx] <= 0 && xogadoresVivos.length > 0) {
            this.bancaIdx = xogadoresVivos[0];
        }

        this.estado = ESTADO.FIN_RONDA;
    }

    // ═══════════════════════════════════════════
    //  POSITIONS
    // ═══════════════════════════════════════════

    posicionCarta(playerIdx, cardIdx) {
        if (playerIdx === 0) {
            // Human player: always at bottom
            const sx = 60 + cardIdx * (CW + 4);
            return { x: sx, y: Y_PLAYER_HAND };
        } else {
            // IA players: fixed slot based on their index (1, 2, 3)
            // Banker goes to top area, non-banker IAs to middle area
            if (playerIdx === this.bancaIdx) {
                const sx = 80 + cardIdx * (CW + 4);
                return { x: sx, y: Y_BANCA };
            } else {
                // Count which middle slot this IA occupies (skip the banker)
                let slot = 0;
                for (let i = 1; i < playerIdx; i++) {
                    if (i !== this.bancaIdx) slot++;
                }
                const sx = 60 + cardIdx * (CW + 4);
                return { x: sx, y: Y_PUNTOS_AREA + slot * (CH + 24) };
            }
        }
    }

    // ═══════════════════════════════════════════
    //  DICE
    // ═══════════════════════════════════════════

    actualizarDado(dt) {
        const d = this.dado;
        if (d.fase === 'tirando') {
            d.tempo += dt;
            d.intervalo -= dt;
            if (d.intervalo <= 0) {
                d.caraActual = 1 + Math.floor(Math.random() * 6);
                d.intervalo = 80 + Math.min(d.tempo / d.duracion, 1) * 200;
            }
            if (d.tempo >= d.duracion) {
                d.resultado = 1 + Math.floor(Math.random() * 6);
                d.caraActual = d.resultado;
                d.fase = 'resultado';
                d.pausaTempo = 1200;
                d.spinnerPasos = d.resultado;
                d.spinnerFeitos = 0;
                d.spinnerIdx = -1;
            }
        } else if (d.fase === 'resultado') {
            d.pausaTempo -= dt;
            if (d.pausaTempo <= 0) { d.fase = 'spinner'; d.spinnerTempo = 0; }
        } else if (d.fase === 'spinner') {
            d.spinnerTempo += dt;
            if (d.spinnerTempo >= d.spinnerIntervalo) {
                d.spinnerTempo = 0;
                d.spinnerFeitos++;
                d.spinnerIdx = (d.spinnerIdx + 1) % this.numXogadores;
                const remaining = d.spinnerPasos - d.spinnerFeitos;
                if (remaining <= 2) d.spinnerIntervalo = 400;
                else if (remaining <= 4) d.spinnerIntervalo = 300;
                if (d.spinnerFeitos >= d.spinnerPasos) { d.fase = 'fin'; d.pausaTempo = 1500; }
            }
        } else if (d.fase === 'fin') {
            d.pausaTempo -= dt;
            if (d.pausaTempo <= 0) {
                this.bancaIdx = d.spinnerIdx;
                this.empezarTurnos();
            }
        }
    }

    // ═══════════════════════════════════════════
    //  UTILITY
    // ═══════════════════════════════════════════

    mostrarMsg(txt, duracion = 1500, enRemate = null) {
        this.mensaxe = txt;
        this.tempMsg = duracion;
        this.msgEnRemate = enRemate;
    }

    reproducirSon(nome) {
        const buf = this.assets[nome];
        const ctx = this.assets['_audioContext'];
        if (!buf || !ctx) return;
        if (ctx.state === 'suspended') ctx.resume();
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
    }

    // ═══════════════════════════════════════════
    //  UPDATE
    // ═══════════════════════════════════════════

    actualizar(entrada, dt) {
        if (this.pausado) {
            this.btnResumir.actualizar(entrada, dt);
            this.btnVolverMenu.actualizar(entrada, dt);
            this.director.canvas.style.cursor =
                (this.btnResumir.estado === 'peneirar' || this.btnVolverMenu.estado === 'peneirar') ? 'pointer' : 'default';
            return;
        }
        if (this._voltandoDePausa) { this._voltandoDePausa = false; return; }

        if (this.estado !== ESTADO.FIN_RONDA && this.estado !== ESTADO.DADO) {
            if (this.btnCog.actualizar(entrada, dt)) return;
        }

        if (this.tempMsg > 0) {
            this.tempMsg -= dt;
            if (this.tempMsg <= 0) {
                this.tempMsg = 0;
                if (this.msgEnRemate) {
                    const cb = this.msgEnRemate;
                    this.msgEnRemate = null;
                    cb();
                    return;
                }
            }
        }

        if (this.animacions.length > 0) {
            this.estaAnimando = true;
            for (let i = this.animacions.length - 1; i >= 0; i--) {
                this.animacions[i].actualizar(null, dt);
                if (this.animacions[i].completada) this.animacions.splice(i, 1);
            }
            return;
        }
        this.estaAnimando = false;

        if (this.msgEnRemate) return;

        switch (this.estado) {
            case ESTADO.DADO:
                this.director.canvas.style.cursor = 'default';
                this.actualizarDado(dt);
                break;

            case ESTADO.TURNO_XOGADOR:
                this.btnPedir.actualizar(entrada, dt);
                this.btnPlantar.actualizar(entrada, dt);
                this.director.canvas.style.cursor =
                    (this.btnPedir.estado === 'peneirar' || this.btnPlantar.estado === 'peneirar') ? 'pointer' : 'default';
                break;

            case ESTADO.TURNO_IA_PUNTO:
                this.director.canvas.style.cursor = 'default';
                this.executarIAPunto(dt);
                break;

            case ESTADO.TURNO_BANCA:
                if (this.bancaIdx === 0) {
                    // Human is banker
                    this.btnPedir.actualizar(entrada, dt);
                    this.btnPlantar.actualizar(entrada, dt);
                    this.director.canvas.style.cursor =
                        (this.btnPedir.estado === 'peneirar' || this.btnPlantar.estado === 'peneirar') ? 'pointer' : 'default';
                } else {
                    this.director.canvas.style.cursor = 'default';
                    this.executarBancaIA(dt);
                }
                break;

            case ESTADO.FIN_RONDA:
                this.director.canvas.style.cursor = 'default';
                if (this.finXogo) this.btnVolverMenu.actualizar(entrada, dt);
                else this.btnContinuarRonda.actualizar(entrada, dt);
                break;
        }
    }

    // ═══════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════

    debuxar(ctx) {
        // Background
        ctx.fillStyle = '#2a1a1a';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        this.debuxarMazo(ctx);
        this.debuxarTodosMan(ctx);
        this.debuxarInfoXogadores(ctx);

        if (this.estado === ESTADO.TURNO_XOGADOR ||
            (this.estado === ESTADO.TURNO_BANCA && this.bancaIdx === 0)) {
            this.btnPedir.debuxar(ctx);
            this.btnPlantar.debuxar(ctx);
        }

        for (const anim of this.animacions) anim.debuxar(ctx);

        if (this.tempMsg > 0) this.debuxarMsg(ctx);

        if (this.estado === ESTADO.DADO) this.debuxarDado(ctx);
        if (this.estado === ESTADO.FIN_RONDA) this.debuxarFinRonda(ctx);

        if (!this.pausado && this.estado !== ESTADO.FIN_RONDA && this.estado !== ESTADO.DADO) {
            this.btnCog.debuxar(ctx);
        }

        if (this.pausado) this.debuxarPausa(ctx);
    }

    debuxarMazo(ctx) {
        const r = this.baralla ? this.baralla.restantes() : 0;
        const deckX = 15, deckY = 80;
        if (r > 0) {
            const dorso = this.assets['dorso'];
            if (dorso) {
                const stack = Math.min(r, 3);
                for (let i = 0; i < stack; i++) {
                    ctx.drawImage(dorso, deckX, deckY - i * 2, CW, CH);
                }
            }
            ctx.fillStyle = 'white';
            ctx.font = '9px Minipixel';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(`${r}`, deckX + CW / 2, deckY + CH + 12);
        }
    }

    debuxarTodosMan(ctx) {
        for (let p = 0; p < this.numXogadores; p++) {
            const man = this.mans[p];
            for (let c = 0; c < man.length; c++) {
                const pos = this.posicionCarta(p, c);
                const entry = man[c];
                const showFace = entry.bocaArriba || p === 0;
                if (showFace) {
                    const img = this.assets[entry.carta.valor.toString()];
                    if (img) ctx.drawImage(img, pos.x, pos.y, CW, CH);
                } else {
                    const dorso = this.assets['dorso'];
                    if (dorso) ctx.drawImage(dorso, pos.x, pos.y, CW, CH);
                }
            }

            // Show total for player and revealed hands
            if (man.length > 0) {
                const allRevealed = man.every(e => e.bocaArriba || p === 0);
                if (allRevealed) {
                    const total = this.totalMan(p);
                    const lastPos = this.posicionCarta(p, man.length - 1);
                    ctx.fillStyle = total > 7.5 ? '#ff4444' : '#ffd700';
                    ctx.font = '10px Minipixel';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'alphabetic';
                    ctx.fillText(`${total}`, lastPos.x + CW + 6, lastPos.y + CH / 2 + 4);
                }
            }
        }
    }

    debuxarInfoXogadores(ctx) {
        // Player info bar
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, Y_PLAYER_INFO, CANVAS_W, 24);
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '9px Minipixel';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        const bancaLabel = this.bancaIdx === 0 ? ' (Banca)' : '';
        ctx.fillText(
            `Ti${bancaLabel}: ${this.fichas[0]} fichas | Ronda ${this.ronda}`,
            8, Y_PLAYER_INFO + 13
        );

        // Banker label at top
        ctx.fillStyle = '#ffd700';
        ctx.font = '9px Minipixel';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(
            `Banca: ${this.nomes[this.bancaIdx]} - ${this.fichas[this.bancaIdx]}`,
            80, Y_BANCA - 6
        );

        // Labels for each non-human, non-banker IA
        for (let i = 1; i < this.numXogadores; i++) {
            if (i === this.bancaIdx) continue;
            const pos = this.posicionCarta(i, 0);
            ctx.fillStyle = '#ccc';
            ctx.font = '9px Minipixel';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(
                `${this.nomes[i]} - ${this.fichas[i]}`,
                pos.x, pos.y - 6
            );
        }
    }

    debuxarMsg(ctx) {
        ctx.font = '12px Minipixel';
        const textW = ctx.measureText(this.mensaxe).width;
        const w = Math.max(220, textW + 40), h = 34;
        const x = (CANVAS_W - w) / 2;
        const y = CANVAS_H / 2 - h / 2;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(x + 3, y + 3, w, h);
        ctx.fillStyle = '#222';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);

        ctx.fillStyle = '#ffd700';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.mensaxe, CANVAS_W / 2, y + h / 2);
        ctx.textBaseline = 'alphabetic';
    }

    debuxarDado(ctx) {
        const d = this.dado;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        const popW = 200, popH = 160;
        const popX = CANVAS_W / 2 - popW / 2;
        const popY = CANVAS_H / 2 - popH / 2 - 20;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(popX + 3, popY + 3, popW, popH);
        ctx.fillStyle = '#222';
        ctx.fillRect(popX, popY, popW, popH);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.strokeRect(popX, popY, popW, popH);

        ctx.fillStyle = '#ffd700';
        ctx.font = '12px Minipixel';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('Quen e a banca?', popX + popW / 2, popY + 10);

        const diceSize = 50;
        const diceX = CANVAS_W / 2 - diceSize / 2;
        const diceY = popY + 32;
        this.debuxarCaraDado(ctx, d.caraActual, diceX, diceY, diceSize);

        if (d.fase === 'spinner' || d.fase === 'fin') {
            const listY = diceY + diceSize + 14;
            const lineH = 16;
            ctx.font = '10px Minipixel';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            for (let i = 0; i < this.numXogadores; i++) {
                const ny = listY + i * lineH;
                if (i === d.spinnerIdx) {
                    ctx.fillStyle = '#ffd700';
                    ctx.fillRect(popX + 20, ny - 1, popW - 40, lineH);
                    ctx.fillStyle = '#222';
                } else {
                    ctx.fillStyle = '#aaa';
                }
                ctx.fillText(this.nomes[i], popX + popW / 2, ny + 1);
            }
        }
        ctx.textBaseline = 'alphabetic';
    }

    debuxarCaraDado(ctx, cara, x, y, size) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(x, y, size, size);
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, size, size);
        const dots = {
            1: [[0.5, 0.5]],
            2: [[0.25, 0.25], [0.75, 0.75]],
            3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
            4: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]],
            5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
            6: [[0.25, 0.2], [0.75, 0.2], [0.25, 0.5], [0.75, 0.5], [0.25, 0.8], [0.75, 0.8]],
        };
        const r = size * 0.07;
        ctx.fillStyle = '#222';
        for (const [dx, dy] of dots[cara] || dots[1]) {
            ctx.beginPath();
            ctx.arc(x + dx * size, y + dy * size, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    debuxarPausa(ctx) {
        const p = this.popupPausa;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(p.x + 3, p.y + 3, p.w, p.h);
        ctx.fillStyle = '#222';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = '#ffd700';
        ctx.font = '14px Minipixel';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('Pausa', p.x + p.w / 2, p.y + 12);
        this.btnResumir.debuxar(ctx);
        this.btnVolverMenu.debuxar(ctx);
    }

    debuxarFinRonda(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        ctx.fillStyle = '#ffd700';
        ctx.font = '18px Minipixel';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('Resultado', CANVAS_W / 2, CANVAS_H / 2 - 80);

        if (this.resultados) {
            ctx.font = '10px Minipixel';
            let y = CANVAS_H / 2 - 50;
            for (const r of this.resultados) {
                const color = r.cambio > 0 ? '#44ff44' : r.cambio < 0 ? '#ff4444' : '#ccc';
                ctx.fillStyle = color;
                const sign = r.cambio > 0 ? '+' : '';
                const txt = r.resultado === '-'
                    ? `${r.nome}: ${r.total}`
                    : `${r.nome}: ${r.total} - ${r.resultado} (${sign}${r.cambio})`;
                ctx.fillText(txt, CANVAS_W / 2, y);
                y += 18;
            }

            // Show eliminations
            if (this.eliminados && this.eliminados.length > 0) {
                y += 6;
                ctx.fillStyle = '#ff4444';
                for (const idx of this.eliminados) {
                    ctx.fillText(`${this.nomes[idx]} eliminado!`, CANVAS_W / 2, y);
                    y += 16;
                }
            }

            if (this.finXogo) {
                ctx.fillStyle = '#ffd700';
                ctx.font = '14px Minipixel';
                y += 10;
                ctx.fillText('Fin do xogo', CANVAS_W / 2, y);
            } else {
                ctx.fillStyle = '#ffd700';
                ctx.font = '11px Minipixel';
                y += 10;
                ctx.fillText(`Nova banca: ${this.nomes[this.bancaIdx]}`, CANVAS_W / 2, y);
            }
        }

        if (this.finXogo) {
            // Reposition menu button
            this.btnVolverMenu.y = CANVAS_H / 2 + 120;
            this.btnVolverMenu.debuxar(ctx);
        } else {
            this.btnContinuarRonda.debuxar(ctx);
        }
    }
}
