import Escena from '../Escena.js';
import Baralla from '../Baralla.js';
import Boton from '../utiles/Boton.js';
import AnimacionDesprazamento from '../utiles/animacions/AnimacionDesprazamento.js';

// ── DISPLAY CONSTANTS ──
const CW = 48, CH = 76, GAP = 10;
const CANVAS_W = 380, CANVAS_H = 600;
const AI_BAR_H = 38;
const MINI_W = 18, MINI_H = 28;

const CENTRO_TOTAL = 4 * CW + 3 * GAP;
const CENTRO_X0 = (CANVAS_W - CENTRO_TOTAL) / 2;
const CENTER_Y = 144;

const Y_LOG = 230;
const Y_TEXT = 300;
const Y_BTN1 = 316;
const Y_BTN2 = 346;
const Y_PLAYER_HAND = 386;
const Y_SCORE = Y_PLAYER_HAND + CH + 8;

const INACTIVIDADE_MS = 15000;
const SINAIS = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];

const EQUIPO_A = [0, 2]; // Human + AI partner
const EQUIPO_B = [1, 3]; // AI opponents
const COR_EQUIPO_A = '#4488cc';
const COR_EQUIPO_B = '#cc5544';

const ESTADO = { NEGOCIACION: 0, XOGANDO: 1, RESOLUCION: 2, FIN_RONDA: 3, FIN_PARTIDA: 4 };

export default class Cadrado extends Escena {
    constructor(director, config = {}) {
        super(director);
        this.assets = director.assets;
        this.config = config;
        this.numXogadores = 4;
        this.nomes = ['Ti', 'IA 1', 'IA 2', 'IA 3'];
        this.victoriasMeta = config.victoriasMeta || 5;

        // Scores per team
        this.puntosA = 0;
        this.puntosB = 0;
        this.ronda = 0;

        // Signals
        this.sinalA = null; // [slot1, slot2]
        this.sinalB = null;
        this.sinalAnteriorA = null; // last round's signal (AI rejects reuse)

        // Per-round state
        this.mans = [[], [], [], []];
        this.centro = [];
        this.baralla = null;
        this.descartes = [];
        this.pasaron = [false, false, false, false];
        this.inactividadT = INACTIVIDADE_MS;

        // Selection
        this.seleccion = -1; // selected hand card index
        this.centroHover = -1;
        this.slotHover = -1;

        // Swap tracking
        this.swapLog = [];        // [{xogador, s1, s2}] last 8 entries
        this.swapHighlights = []; // [{xogador, s1, s2, tempo}] visual
        this.pendingCalls = [];   // [{caller, tipo, target, delay}]

        // AI state
        this.iaTimers = [0, 0, 0, 0];
        this.iaIntervalos = [3000, 3500, 4000, 3200];
        this.iaSignalDone = [false, false, false, false]; // has AI performed signal this round

        // UI state
        this.estado = ESTADO.NEGOCIACION;
        this.mensaxe = '';
        this.tempMsg = 0;
        this.msgEnRemate = null;
        this.animacions = [];
        this.pausado = false;
        this._voltandoDePausa = false;
        this.resultadoRonda = null;

        // Negotiation state
        this.negHover = -1; // hovered signal option index

        // ── Buttons ──
        const bw = 80, bh = 26;
        this.btnPasar = new Boton(
            CANVAS_W / 2 - bw - 5, Y_BTN1, bw, bh,
            ['#555', '#777', '#333', '#333'], [], 'Pasar',
            () => this.togglePasar(0), { corTexto: '#fff', tamanhoTexto: 10 });
        this.btnCuadrado = new Boton(
            CANVAS_W / 2 + 5, Y_BTN1, bw, bh,
            ['#2a7a2a', '#3a9a3a', '#1a5a1a', '#333'], [], 'Cuadrado!',
            () => this.chamarCuadrado(0), { corTexto: '#fff', tamanhoTexto: 10 });
        this.btnCorteIA1 = new Boton(
            CANVAS_W / 2 - bw - 5, Y_BTN2, bw, bh,
            ['#7a2a2a', '#9a3a3a', '#5a1a1a', '#333'], [], 'Corte IA 1',
            () => this.chamarCorte(0, 1), { corTexto: '#fff', tamanhoTexto: 10 });
        this.btnCorteIA3 = new Boton(
            CANVAS_W / 2 + 5, Y_BTN2, bw, bh,
            ['#7a2a2a', '#9a3a3a', '#5a1a1a', '#333'], [], 'Corte IA 3',
            () => this.chamarCorte(0, 3), { corTexto: '#fff', tamanhoTexto: 10 });

        // Pause
        this.btnCog = new Boton(6, 2 + 3 * (AI_BAR_H + 2) + 4, 24, 24,
            ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.6)'],
            [], '\u2699', () => { this.pausado = true; },
            { corTexto: '#fff', tamanhoTexto: 10 });
        const popupW = 180, popupH = 120;
        const popupX = CANVAS_W / 2 - popupW / 2, popupY = CANVAS_H / 2 - popupH / 2;
        this.popupPausa = { x: popupX, y: popupY, w: popupW, h: popupH };
        const pbw = 140, pbh = 28, pbx = popupX + (popupW - pbw) / 2;
        this.btnResumir = new Boton(pbx, popupY + 45, pbw, pbh,
            ['#2a7a2a', '#3a9a3a', '#1a5a1a'], [], 'Continuar',
            () => { this.pausado = false; this._voltandoDePausa = true; },
            { corTexto: '#fff', tamanhoTexto: 10 });
        this.btnVolverMenu = new Boton(pbx, popupY + 82, pbw, pbh,
            ['#7a2a2a', '#9a3a3a', '#5a1a1a'], [], 'Volver ao menu',
            () => { import('./Menu.js').then(m => this.director.cambiarEscena(new m.default(this.director))); },
            { corTexto: '#fff', tamanhoTexto: 10 });

        this.btnSeguinte = new Boton(CANVAS_W / 2 - 55, CANVAS_H / 2 + 60, 110, 32,
            ['#2a2a7a', '#3a3a9a', '#1a1a5a'], [], 'Seguinte ronda',
            () => this.iniciarNegociacion(), { corTexto: '#fff', tamanhoTexto: 10 });
        this.btnMenuFin = new Boton(CANVAS_W / 2 - 55, CANVAS_H / 2 + 100, 110, 32,
            ['#7a2a2a', '#9a3a3a', '#5a1a1a'], [], 'Menu',
            () => { import('./Menu.js').then(m => this.director.cambiarEscena(new m.default(this.director))); },
            { corTexto: '#fff', tamanhoTexto: 10 });

        this.iniciarNegociacion();
    }

    // ═══════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════

    equipo(xogador) { return EQUIPO_A.includes(xogador) ? 'A' : 'B'; }
    equipoCompaneiro(xogador) {
        return this.equipo(xogador) === 'A'
            ? EQUIPO_A.find(p => p !== xogador)
            : EQUIPO_B.find(p => p !== xogador);
    }
    sinalDeEquipo(xogador) {
        return this.equipo(xogador) === 'A' ? this.sinalA : this.sinalB;
    }

    tenCuadrado(xogador) {
        const man = this.mans[xogador];
        if (man.length !== 4) return false;
        return man.every(c => c.puntos() === man[0].puntos());
    }

    centroPos(i) { return { x: CENTRO_X0 + i * (CW + GAP), y: CENTER_Y }; }
    manPos(i) { return { x: CENTRO_X0 + i * (CW + GAP), y: Y_PLAYER_HAND }; }

    nomeCartaBreve(carta) {
        const n = ['', 'As', '2', '3', '4', '5', '6', '7', 'Sota', 'Caballo', 'Rey'];
        return n[carta.puntos()];
    }

    // ═══════════════════════════════════════════
    //  SIGNAL NEGOTIATION
    // ═══════════════════════════════════════════

    iniciarNegociacion() {
        this.ronda++;
        this.estado = ESTADO.NEGOCIACION;
        this.sinalA = null;
        // Team B auto-picks a random signal (different from last round if possible)
        let choices = SINAIS.filter(s => !this.sinalB || s[0] !== this.sinalB[0] || s[1] !== this.sinalB[1]);
        if (choices.length === 0) choices = SINAIS;
        this.sinalB = choices[Math.floor(Math.random() * choices.length)];
        this.negHover = -1;
    }

    procesarPropostaSinal(idx) {
        const sinal = SINAIS[idx];
        // AI partner auto-accepts (rejects if same as last round)
        if (this.sinalAnteriorA && sinal[0] === this.sinalAnteriorA[0] && sinal[1] === this.sinalAnteriorA[1]) {
            this.mostrarMsg('IA 2 rexeitou: mesmo sinal ca antes!', 1200);
            return;
        }
        this.sinalA = sinal;
        this.sinalAnteriorA = sinal;
        this.mostrarMsg(`Sinal acordado: ${sinal[0]+1}\u2194${sinal[1]+1}`, 1500, () => {
            this.iniciarRonda();
        });
    }

    // ═══════════════════════════════════════════
    //  ROUND SETUP
    // ═══════════════════════════════════════════

    iniciarRonda() {
        this.baralla = new Baralla();
        this.descartes = [];
        this.mans = [[], [], [], []];
        this.centro = [];
        this.pasaron = [false, false, false, false];
        this.inactividadT = INACTIVIDADE_MS;
        this.seleccion = -1;
        this.swapLog = [];
        this.swapHighlights = [];
        this.pendingCalls = [];
        this.animacions = [];
        this.iaSignalDone = [false, false, false, false];
        this.resultadoRonda = null;

        // Deal 4 to each player
        for (let c = 0; c < 4; c++) {
            for (let p = 0; p < 4; p++) {
                this.mans[p].push(this.baralla.roubar());
            }
        }
        // 4 to center
        for (let c = 0; c < 4; c++) {
            this.centro.push(this.baralla.roubar());
        }

        // Randomize AI action intervals
        for (let i = 0; i < 4; i++) {
            this.iaTimers[i] = 0;
            this.iaIntervalos[i] = 2000 + Math.random() * 3000;
        }

        this.reproducirSon('son_barallar');
        this.estado = ESTADO.XOGANDO;
    }

    // ═══════════════════════════════════════════
    //  CARD MECHANICS
    // ═══════════════════════════════════════════

    trocarManMan(xogador, s1, s2) {
        if (s1 === s2) return;
        const man = this.mans[xogador];
        [man[s1], man[s2]] = [man[s2], man[s1]];

        // Log the swap (visible to all)
        this.swapLog.unshift({ xogador, s1, s2 });
        if (this.swapLog.length > 8) this.swapLog.pop();
        this.swapHighlights.push({ xogador, s1, s2, tempo: 1500 });
        this.reproducirSon(`son_dar${1 + Math.floor(Math.random() * 6)}`);

        // Check if this triggers signal detection
        this._onSwapDetected(xogador, s1, s2);
    }

    trocarManCentro(xogador, manSlot, centroSlot) {
        const oldHand = this.mans[xogador][manSlot];
        const oldCenter = this.centro[centroSlot];
        this.mans[xogador][manSlot] = oldCenter;
        this.centro[centroSlot] = oldHand;

        // Reset all Pasar flags (board changed)
        this.pasaron = [false, false, false, false];
        this.inactividadT = INACTIVIDADE_MS;

        this.reproducirSon(`son_dar${1 + Math.floor(Math.random() * 6)}`);

        // Animate: center card to hand, hand card to center (simultaneous)
        const cp = this.centroPos(centroSlot);
        const mp = this.manPos(manSlot);

        if (xogador === 0) {
            this.animacions.push(new AnimacionDesprazamento(
                this.assets, CW, CH, oldCenter.valor,
                cp.x, cp.y, mp.x, mp.y, null, 0.07));
            this.animacions.push(new AnimacionDesprazamento(
                this.assets, CW, CH, oldHand.valor,
                mp.x, mp.y, cp.x, cp.y, null, 0.07));
        }
    }

    // ═══════════════════════════════════════════
    //  PASS SYSTEM
    // ═══════════════════════════════════════════

    togglePasar(xogador) {
        this.pasaron[xogador] = !this.pasaron[xogador];
        this.inactividadT = INACTIVIDADE_MS;
        if (this.pasaron.every(p => p)) {
            this.renovarCentro();
        }
    }

    renovarCentro() {
        // Discard old center cards
        for (const c of this.centro) this.descartes.push(c);
        this.centro = [];

        // Reshuffle if needed
        if (this.baralla.restantes() < 4) {
            while (this.descartes.length > 0) this.baralla.cartas.push(this.descartes.pop());
            this.baralla.barallar();
            this.reproducirSon('son_barallar');
        }

        for (let i = 0; i < 4 && this.baralla.restantes() > 0; i++) {
            this.centro.push(this.baralla.roubar());
        }

        this.pasaron = [false, false, false, false];
        this.inactividadT = INACTIVIDADE_MS;
        this.reproducirSon(`son_dar${1 + Math.floor(Math.random() * 6)}`);
    }

    // ═══════════════════════════════════════════
    //  CUADRADO / CORTE
    // ═══════════════════════════════════════════

    chamarCuadrado(caller) {
        if (this.estado !== ESTADO.XOGANDO) return;
        const partner = this.equipoCompaneiro(caller);
        const success = this.tenCuadrado(partner);
        this._resolverChamada(caller, 'cuadrado', partner, success);
    }

    chamarCorte(caller, target) {
        if (this.estado !== ESTADO.XOGANDO) return;
        if (this.equipo(caller) === this.equipo(target)) return; // can't Corte own team
        const success = this.tenCuadrado(target);
        this._resolverChamada(caller, 'corte', target, success);
    }

    _resolverChamada(caller, tipo, target, success) {
        this.estado = ESTADO.RESOLUCION;
        const callerTeam = this.equipo(caller);

        // Reveal target's hand
        this.resultadoRonda = {
            caller, tipo, target, success,
            targetCards: [...this.mans[target]],
        };

        if (success) {
            if (callerTeam === 'A') this.puntosA++;
            else this.puntosB++;
        } else {
            // Penalty: opposing team gets the point
            if (callerTeam === 'A') this.puntosB++;
            else this.puntosA++;
        }

        const tipoTxt = tipo === 'cuadrado' ? 'Cuadrado' : 'Corte';
        const resultTxt = success ? 'Correcto!' : 'Incorrecto!';
        this.mostrarMsg(`${this.nomes[caller]}: ${tipoTxt}! ${resultTxt}`, 2500, () => {
            if (this.puntosA >= this.victoriasMeta || this.puntosB >= this.victoriasMeta) {
                this.ganadorEquipo = this.puntosA >= this.victoriasMeta ? 'A' : 'B';
                this.estado = ESTADO.FIN_PARTIDA;
            } else {
                this.estado = ESTADO.FIN_RONDA;
            }
        });
    }

    // ═══════════════════════════════════════════
    //  SIGNAL DETECTION
    // ═══════════════════════════════════════════

    _onSwapDetected(xogador, s1, s2) {
        // Normalize swap order
        const lo = Math.min(s1, s2), hi = Math.max(s1, s2);

        // Check if partner sees the team signal
        const teamSignal = this.sinalDeEquipo(xogador);
        if (teamSignal && lo === teamSignal[0] && hi === teamSignal[1]) {
            const partner = this.equipoCompaneiro(xogador);
            // Partner will call Cuadrado after a delay (only AI partners)
            if (partner > 0 && !this.pendingCalls.some(c => c.caller === partner)) {
                this.pendingCalls.push({
                    caller: partner, tipo: 'cuadrado', target: xogador,
                    delay: 1000 + Math.random() * 1500
                });
            }
        }

        // Opponents try to detect signals (AI only)
        if (xogador <= 0) return; // only track AI watching human — handled below
        // For AI opponents watching human team:
        this._iaCheckCorteOnSwap(xogador, lo, hi);
    }

    _iaCheckCorteOnSwap(swapper, lo, hi) {
        // Each opponent AI checks if a human-team member's swap looks like a signal
        const swapperTeam = this.equipo(swapper);

        for (let ai = 0; ai < 4; ai++) {
            if (ai === 0) continue; // human doesn't auto-Corte
            if (this.equipo(ai) === swapperTeam) continue; // same team

            // Count how often this swap appears in recent log for this player
            let count = 0;
            for (const entry of this.swapLog) {
                if (entry.xogador === swapper) {
                    const elo = Math.min(entry.s1, entry.s2);
                    const ehi = Math.max(entry.s1, entry.s2);
                    if (elo === lo && ehi === hi) count++;
                }
            }

            if (count >= 3 && Math.random() < 0.4) {
                if (!this.pendingCalls.some(c => c.caller === ai && c.tipo === 'corte')) {
                    this.pendingCalls.push({
                        caller: ai, tipo: 'corte', target: swapper,
                        delay: 500 + Math.random() * 2000
                    });
                }
            }
        }
    }

    // ═══════════════════════════════════════════
    //  AI LOGIC
    // ═══════════════════════════════════════════

    iaUpdate(iaIdx, dt) {
        this.iaTimers[iaIdx] += dt;
        if (this.iaTimers[iaIdx] < this.iaIntervalos[iaIdx]) return;
        this.iaTimers[iaIdx] = 0;
        this.iaIntervalos[iaIdx] = 2000 + Math.random() * 3000;

        const man = this.mans[iaIdx];

        // Count ranks
        const rankCount = {};
        for (const c of man) {
            const r = c.puntos();
            rankCount[r] = (rankCount[r] || 0) + 1;
        }
        let bestRank = -1, bestCount = 0;
        for (const [r, cnt] of Object.entries(rankCount)) {
            if (cnt > bestCount) { bestCount = cnt; bestRank = parseInt(r); }
        }

        // If has Cuadrado → perform signal
        if (bestCount >= 4 && !this.iaSignalDone[iaIdx]) {
            const sig = this.sinalDeEquipo(iaIdx);
            if (sig) {
                this.trocarManMan(iaIdx, sig[0], sig[1]);
                this.iaSignalDone[iaIdx] = true;
            }
            return;
        }

        // Try to swap with center
        let didExchange = false;
        for (let c = 0; c < this.centro.length; c++) {
            if (this.centro[c].puntos() === bestRank) {
                // Find a card in hand that's NOT the target rank
                let worstSlot = -1;
                for (let s = 0; s < man.length; s++) {
                    if (man[s].puntos() !== bestRank) { worstSlot = s; break; }
                }
                if (worstSlot >= 0) {
                    this.trocarManCentro(iaIdx, worstSlot, c);
                    didExchange = true;
                    break;
                }
            }
        }

        if (!didExchange) {
            // Fake hand rearrangement (bluff) ~25% chance
            if (Math.random() < 0.25) {
                const s1 = Math.floor(Math.random() * 4);
                let s2 = Math.floor(Math.random() * 3);
                if (s2 >= s1) s2++;
                this.trocarManMan(iaIdx, s1, s2);
            }

            // Toggle Pasar if no useful center cards
            if (!this.pasaron[iaIdx] && Math.random() < 0.4) {
                this.togglePasar(iaIdx);
            }
        }
    }

    // ═══════════════════════════════════════════
    //  PLAYER INPUT
    // ═══════════════════════════════════════════

    procesarClick(entrada) {
        if (this.tempMsg > 0 || this.animacions.length > 0) return;

        if (this.estado === ESTADO.NEGOCIACION) {
            this._procesarClickNegociacion(entrada);
            return;
        }
        if (this.estado !== ESTADO.XOGANDO) return;

        // Click on own hand cards
        for (let i = 3; i >= 0; i--) {
            const p = this.manPos(i);
            if (entrada.x >= p.x && entrada.x < p.x + CW &&
                entrada.y >= Y_PLAYER_HAND && entrada.y < Y_PLAYER_HAND + CH) {
                if (this.seleccion >= 0 && this.seleccion !== i) {
                    // Swap two hand cards
                    this.trocarManMan(0, this.seleccion, i);
                    this.seleccion = -1;
                } else if (this.seleccion === i) {
                    this.seleccion = -1; // deselect
                } else {
                    this.seleccion = i; // select
                }
                return;
            }
        }

        // Click on center cards (exchange with selected hand card)
        if (this.seleccion >= 0) {
            for (let i = 3; i >= 0; i--) {
                const p = this.centroPos(i);
                if (entrada.x >= p.x && entrada.x < p.x + CW &&
                    entrada.y >= CENTER_Y && entrada.y < CENTER_Y + CH) {
                    this.trocarManCentro(0, this.seleccion, i);
                    this.seleccion = -1;
                    return;
                }
            }
        }
    }

    _procesarClickNegociacion(entrada) {
        // Signal selection grid
        const gridW = 3 * 70 + 2 * 8;
        const gridX = (CANVAS_W - gridW) / 2;
        const gridY = CANVAS_H / 2 - 30;

        for (let i = 0; i < 6; i++) {
            const row = Math.floor(i / 3), col = i % 3;
            const bx = gridX + col * 78;
            const by = gridY + row * 36;
            if (entrada.x >= bx && entrada.x < bx + 70 &&
                entrada.y >= by && entrada.y < by + 28) {
                this.procesarPropostaSinal(i);
                return;
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
                (this.btnResumir.estado === 'peneirar' || this.btnVolverMenu.estado === 'peneirar')
                    ? 'pointer' : 'default';
            return;
        }
        if (this._voltandoDePausa) { this._voltandoDePausa = false; return; }

        if (this.estado === ESTADO.XOGANDO || this.estado === ESTADO.NEGOCIACION) {
            if (this.btnCog.actualizar(entrada, dt)) return;
        }

        // Messages
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

        // Animations
        if (this.animacions.length > 0) {
            for (let i = this.animacions.length - 1; i >= 0; i--) {
                this.animacions[i].actualizar(null, dt);
                if (this.animacions[i].completada) this.animacions.splice(i, 1);
            }
        }

        // Swap highlights
        for (let i = this.swapHighlights.length - 1; i >= 0; i--) {
            this.swapHighlights[i].tempo -= dt;
            if (this.swapHighlights[i].tempo <= 0) this.swapHighlights.splice(i, 1);
        }

        if (this.msgEnRemate) return;

        switch (this.estado) {
            case ESTADO.NEGOCIACION:
                this._actualizarNegociacion(entrada, dt);
                break;
            case ESTADO.XOGANDO:
                this._actualizarXogo(entrada, dt);
                break;
            case ESTADO.FIN_RONDA:
                this.btnSeguinte.actualizar(entrada, dt);
                this.btnMenuFin.actualizar(entrada, dt);
                this.director.canvas.style.cursor =
                    (this.btnSeguinte.estado === 'peneirar' || this.btnMenuFin.estado === 'peneirar')
                        ? 'pointer' : 'default';
                break;
            case ESTADO.FIN_PARTIDA:
                this.btnMenuFin.actualizar(entrada, dt);
                this.director.canvas.style.cursor =
                    this.btnMenuFin.estado === 'peneirar' ? 'pointer' : 'default';
                break;
        }
    }

    _actualizarNegociacion(entrada, dt) {
        // Hover detection for signal grid
        this.negHover = -1;
        const gridW = 3 * 70 + 2 * 8;
        const gridX = (CANVAS_W - gridW) / 2;
        const gridY = CANVAS_H / 2 - 30;
        for (let i = 0; i < 6; i++) {
            const row = Math.floor(i / 3), col = i % 3;
            const bx = gridX + col * 78;
            const by = gridY + row * 36;
            if (entrada.x >= bx && entrada.x < bx + 70 &&
                entrada.y >= by && entrada.y < by + 28) {
                this.negHover = i;
                break;
            }
        }
        if (entrada.clicado) this.procesarClick(entrada);
        this.director.canvas.style.cursor = this.negHover >= 0 ? 'pointer' : 'default';
    }

    _actualizarXogo(entrada, dt) {
        // Pending calls (AI auto-calls after delay)
        for (let i = this.pendingCalls.length - 1; i >= 0; i--) {
            this.pendingCalls[i].delay -= dt;
            if (this.pendingCalls[i].delay <= 0) {
                const call = this.pendingCalls.splice(i, 1)[0];
                if (this.estado === ESTADO.XOGANDO) {
                    if (call.tipo === 'cuadrado') this.chamarCuadrado(call.caller);
                    else this.chamarCorte(call.caller, call.target);
                }
                return;
            }
        }

        // Inactivity timer
        this.inactividadT -= dt;
        if (this.inactividadT <= 0) {
            this.renovarCentro();
        }

        // AI updates
        for (let ia = 1; ia < 4; ia++) {
            this.iaUpdate(ia, dt);
        }

        // Human input
        this.slotHover = -1;
        this.centroHover = -1;
        for (let i = 0; i < 4; i++) {
            const p = this.manPos(i);
            if (entrada.x >= p.x && entrada.x < p.x + CW &&
                entrada.y >= Y_PLAYER_HAND && entrada.y < Y_PLAYER_HAND + CH) {
                this.slotHover = i;
                break;
            }
        }
        if (this.seleccion >= 0) {
            for (let i = 0; i < 4; i++) {
                const p = this.centroPos(i);
                if (entrada.x >= p.x && entrada.x < p.x + CW &&
                    entrada.y >= CENTER_Y && entrada.y < CENTER_Y + CH) {
                    this.centroHover = i;
                    break;
                }
            }
        }

        this.btnPasar.actualizar(entrada, dt);
        this.btnCuadrado.actualizar(entrada, dt);
        this.btnCorteIA1.actualizar(entrada, dt);
        this.btnCorteIA3.actualizar(entrada, dt);

        if (entrada.clicado) this.procesarClick(entrada);

        const anyHover = this.slotHover >= 0 || this.centroHover >= 0 || this.negHover >= 0 ||
            this.btnPasar.estado === 'peneirar' || this.btnCuadrado.estado === 'peneirar' ||
            this.btnCorteIA1.estado === 'peneirar' || this.btnCorteIA3.estado === 'peneirar';
        this.director.canvas.style.cursor = anyHover ? 'pointer' : 'default';
    }

    // ═══════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════

    debuxar(ctx) {
        ctx.fillStyle = '#1a3a1a';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        if (this.estado === ESTADO.NEGOCIACION) {
            this.debuxarNegociacion(ctx);
        } else {
            this.debuxarInfoIA(ctx);
            this.debuxarCentro(ctx);
            this.debuxarManXogador(ctx);
            this.debuxarBotonsXogo(ctx);
            this.debuxarSwapLog(ctx);
            this.debuxarTimer(ctx);
            this.debuxarScore(ctx);
        }

        for (const anim of this.animacions) anim.debuxar(ctx);
        if (this.tempMsg > 0) this.debuxarMsg(ctx);

        if (this.estado === ESTADO.RESOLUCION) this.debuxarResolucion(ctx);
        if (this.estado === ESTADO.FIN_RONDA) this.debuxarFinRonda(ctx);
        if (this.estado === ESTADO.FIN_PARTIDA) this.debuxarFinPartida(ctx);

        if (this.estado === ESTADO.XOGANDO || this.estado === ESTADO.NEGOCIACION) this.btnCog.debuxar(ctx);
        if (this.pausado) this.debuxarPausa(ctx);
    }

    debuxarNegociacion(ctx) {
        ctx.fillStyle = '#ffd700';
        ctx.font = '10px Minipixel';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(`Ronda ${this.ronda}`, CANVAS_W / 2, CANVAS_H / 2 - 80);
        ctx.fillText('Elixe o sinal secreto co teu companeiro:', CANVAS_W / 2, CANVAS_H / 2 - 55);

        const gridW = 3 * 70 + 2 * 8;
        const gridX = (CANVAS_W - gridW) / 2;
        const gridY = CANVAS_H / 2 - 30;

        for (let i = 0; i < 6; i++) {
            const row = Math.floor(i / 3), col = i % 3;
            const bx = gridX + col * 78;
            const by = gridY + row * 36;
            const sig = SINAIS[i];
            const isHover = this.negHover === i;

            ctx.fillStyle = isHover ? '#3a6a3a' : '#2a4a2a';
            ctx.fillRect(bx, by, 70, 28);
            if (isHover) {
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = 2;
                ctx.strokeRect(bx, by, 70, 28);
            }

            ctx.fillStyle = '#fff';
            ctx.font = '10px Minipixel';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${sig[0]+1} \u2194 ${sig[1]+1}`, bx + 35, by + 14);
        }

        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#aaa';
        ctx.fillText('Equipos: Ti + IA 2 vs IA 1 + IA 3', CANVAS_W / 2, gridY + 90);
    }

    debuxarInfoIA(ctx) {
        for (let i = 0; i < 3; i++) {
            const iaIdx = i + 1;
            const y = 2 + i * (AI_BAR_H + 2);
            const barX = 6, barW = CANVAS_W - 12;
            const isTeamA = EQUIPO_A.includes(iaIdx);
            const teamColor = isTeamA ? COR_EQUIPO_A : COR_EQUIPO_B;

            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(barX, y, barW, AI_BAR_H);

            // Team color bar on left
            ctx.fillStyle = teamColor;
            ctx.fillRect(barX, y, 4, AI_BAR_H);

            // Name
            ctx.fillStyle = '#e0e0e0';
            ctx.font = '10px Minipixel';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(this.nomes[iaIdx], barX + 10, y + 3);

            // Team label
            ctx.fillStyle = teamColor;
            ctx.fillText(isTeamA ? '(Equipo)' : '(Rival)', barX + 10, y + 15);

            // Pass indicator
            if (this.pasaron[iaIdx]) {
                ctx.fillStyle = '#ffd700';
                ctx.textAlign = 'right';
                ctx.fillText('PASA', barX + barW - 80, y + 3);
            }

            // 4 mini card back slots with slot numbers
            const dorso = this.assets['dorso'];
            const slotsX = barX + barW - 6 - 4 * (MINI_W + 3);
            for (let j = 0; j < 4; j++) {
                const sx = slotsX + j * (MINI_W + 3);
                const sy = y + 4;

                if (dorso) ctx.drawImage(dorso, sx, sy, MINI_W, MINI_H);

                // Slot number
                ctx.fillStyle = '#888';
                ctx.font = '10px Minipixel';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(`${j+1}`, sx + MINI_W / 2, sy + MINI_H + 1);

                // Swap highlight
                const hl = this.swapHighlights.find(h =>
                    h.xogador === iaIdx && (h.s1 === j || h.s2 === j));
                if (hl) {
                    ctx.strokeStyle = '#ffd700';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(sx - 1, sy - 1, MINI_W + 2, MINI_H + 2);
                }
            }
        }
    }

    debuxarCentro(ctx) {
        ctx.fillStyle = '#888';
        ctx.font = '10px Minipixel';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('Centro', CANVAS_W / 2, CENTER_Y - 8);

        for (let i = 0; i < this.centro.length; i++) {
            const p = this.centroPos(i);
            const img = this.assets[this.centro[i].valor.toString()];
            if (img) ctx.drawImage(img, p.x, CENTER_Y, CW, CH);

            // Hover highlight when player has a card selected
            if (this.centroHover === i) {
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = 2;
                ctx.strokeRect(p.x - 1, CENTER_Y - 1, CW + 2, CH + 2);
            }
        }
    }

    debuxarManXogador(ctx) {
        // Team color indicator
        ctx.fillStyle = COR_EQUIPO_A;
        ctx.fillRect(CENTRO_X0 - 10, Y_PLAYER_HAND, 4, CH);

        for (let i = 0; i < 4; i++) {
            const p = this.manPos(i);
            const carta = this.mans[0][i];
            if (!carta) continue;

            const img = this.assets[carta.valor.toString()];
            if (img) ctx.drawImage(img, p.x, Y_PLAYER_HAND, CW, CH);

            // Slot number
            ctx.fillStyle = '#888';
            ctx.font = '10px Minipixel';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(`${i+1}`, p.x + CW / 2, Y_PLAYER_HAND + CH + 2);

            // Selected highlight
            if (this.seleccion === i) {
                ctx.strokeStyle = '#66ff66';
                ctx.lineWidth = 2;
                ctx.strokeRect(p.x - 2, Y_PLAYER_HAND - 2, CW + 4, CH + 4);
            } else if (this.slotHover === i) {
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = 1;
                ctx.strokeRect(p.x - 1, Y_PLAYER_HAND - 1, CW + 2, CH + 2);
            }

            // Own swap highlight
            const hl = this.swapHighlights.find(h =>
                h.xogador === 0 && (h.s1 === i || h.s2 === i));
            if (hl) {
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = 2;
                ctx.strokeRect(p.x - 2, Y_PLAYER_HAND - 2, CW + 4, CH + 4);
            }
        }
    }

    debuxarBotonsXogo(ctx) {
        if (this.estado !== ESTADO.XOGANDO || this.tempMsg > 0) return;

        // Update Pasar button text based on toggle
        this.btnPasar.texto = this.pasaron[0] ? 'Pasando...' : 'Pasar';
        this.btnPasar.debuxar(ctx);
        this.btnCuadrado.debuxar(ctx);
        this.btnCorteIA1.debuxar(ctx);
        this.btnCorteIA3.debuxar(ctx);

        // Phase text
        ctx.fillStyle = '#ccc';
        ctx.font = '10px Minipixel';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        if (this.seleccion >= 0) {
            ctx.fillText('Toca outra carta ou o centro', CANVAS_W / 2, Y_TEXT);
        }
    }

    debuxarSwapLog(ctx) {
        ctx.fillStyle = '#888';
        ctx.font = '10px Minipixel';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('Movementos:', 10, Y_LOG);

        for (let i = 0; i < Math.min(this.swapLog.length, 5); i++) {
            const entry = this.swapLog[i];
            const isTeamA = EQUIPO_A.includes(entry.xogador);
            ctx.fillStyle = isTeamA ? COR_EQUIPO_A : COR_EQUIPO_B;
            ctx.fillText(
                `${this.nomes[entry.xogador]}: ${entry.s1+1}\u2194${entry.s2+1}`,
                10, Y_LOG + 14 + i * 12
            );
        }
    }

    debuxarTimer(ctx) {
        // Inactivity timer bar
        const fraction = Math.max(0, this.inactividadT / INACTIVIDADE_MS);
        const barW = CANVAS_W - 24, barH = 6;
        const barX = 12, barY = 2 + 3 * (AI_BAR_H + 2) + 2;

        ctx.fillStyle = '#222';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = fraction > 0.33 ? '#4a4' : '#a44';
        ctx.fillRect(barX, barY, barW * fraction, barH);
    }

    debuxarScore(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, Y_SCORE, CANVAS_W, 24);

        ctx.font = '10px Minipixel';
        ctx.textBaseline = 'alphabetic';

        ctx.fillStyle = COR_EQUIPO_A;
        ctx.textAlign = 'left';
        ctx.fillText(`Equipo A: ${this.puntosA}`, 8, Y_SCORE + 15);

        ctx.fillStyle = COR_EQUIPO_B;
        ctx.textAlign = 'right';
        ctx.fillText(`Equipo B: ${this.puntosB}`, CANVAS_W - 8, Y_SCORE + 15);

        ctx.fillStyle = '#888';
        ctx.textAlign = 'center';
        ctx.fillText(`Meta: ${this.victoriasMeta}`, CANVAS_W / 2, Y_SCORE + 15);
    }

    debuxarResolucion(ctx) {
        if (!this.resultadoRonda) return;
        const r = this.resultadoRonda;

        // Show target's cards
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, CENTER_Y - 30, CANVAS_W, CH + 60);

        ctx.fillStyle = '#ffd700';
        ctx.font = '10px Minipixel';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(`Cartas de ${this.nomes[r.target]}:`, CANVAS_W / 2, CENTER_Y - 10);

        for (let i = 0; i < r.targetCards.length; i++) {
            const x = CENTRO_X0 + i * (CW + GAP);
            const img = this.assets[r.targetCards[i].valor.toString()];
            if (img) ctx.drawImage(img, x, CENTER_Y, CW, CH);
        }
    }

    debuxarMsg(ctx) {
        ctx.font = '10px Minipixel';
        const textW = ctx.measureText(this.mensaxe).width;
        const w = Math.max(220, textW + 40), h = 34;
        const x = (CANVAS_W - w) / 2;
        const y = CANVAS_H / 2 - 40;

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
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

    debuxarFinRonda(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        const popW = 260, popH = 160;
        const popX = CANVAS_W / 2 - popW / 2;
        const popY = CANVAS_H / 2 - popH / 2 - 20;

        ctx.fillStyle = '#222';
        ctx.fillRect(popX, popY, popW, popH);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.strokeRect(popX, popY, popW, popH);

        ctx.fillStyle = '#ffd700';
        ctx.font = '10px Minipixel';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('Fin da ronda', popX + popW / 2, popY + 10);

        ctx.fillStyle = COR_EQUIPO_A;
        ctx.fillText(`Equipo A (Ti + IA 2): ${this.puntosA} pts`, popX + popW / 2, popY + 40);
        ctx.fillStyle = COR_EQUIPO_B;
        ctx.fillText(`Equipo B (IA 1 + IA 3): ${this.puntosB} pts`, popX + popW / 2, popY + 60);

        ctx.fillStyle = '#888';
        ctx.fillText(`Meta: ${this.victoriasMeta}`, popX + popW / 2, popY + 85);

        this.btnSeguinte.y = popY + popH - 52;
        this.btnMenuFin.y = popY + popH - 18;
        this.btnSeguinte.debuxar(ctx);
        this.btnMenuFin.debuxar(ctx);
    }

    debuxarFinPartida(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        const popW = 260, popH = 160;
        const popX = CANVAS_W / 2 - popW / 2;
        const popY = CANVAS_H / 2 - popH / 2 - 20;

        ctx.fillStyle = '#222';
        ctx.fillRect(popX, popY, popW, popH);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.strokeRect(popX, popY, popW, popH);

        ctx.fillStyle = '#ffd700';
        ctx.font = '10px Minipixel';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const won = this.ganadorEquipo === 'A';
        ctx.fillText(won ? 'O teu equipo ganou!' : 'O equipo rival ganou!', popX + popW / 2, popY + 12);

        ctx.fillStyle = COR_EQUIPO_A;
        ctx.fillText(`Equipo A: ${this.puntosA} pts`, popX + popW / 2, popY + 45);
        ctx.fillStyle = COR_EQUIPO_B;
        ctx.fillText(`Equipo B: ${this.puntosB} pts`, popX + popW / 2, popY + 65);

        ctx.fillStyle = '#888';
        ctx.fillText(`${this.ronda} rondas xogadas`, popX + popW / 2, popY + 90);

        this.btnMenuFin.y = popY + popH - 36;
        this.btnMenuFin.debuxar(ctx);
    }

    debuxarPausa(ctx) {
        const p = this.popupPausa;
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.fillStyle = '#222';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = '#ffd700';
        ctx.font = '10px Minipixel';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('Pausa', p.x + p.w / 2, p.y + 12);
        this.btnResumir.debuxar(ctx);
        this.btnVolverMenu.debuxar(ctx);
    }
}
