import Escena from '../Escena.js';
import Baralla from '../Baralla.js';
import Boton from '../utiles/Boton.js';
import AnimacionDesprazamento from '../utiles/animacions/AnimacionDesprazamento.js';

// ── DISPLAY CONSTANTS ──────────────────────────
const CW = 48;          // Card width (original sprite size)
const CH = 76;          // Card height (original sprite size)
const GAP = 8;
const CANVAS_W = 380;
const CANVAS_H = 600;
const COLS_MESA = 5;

// AI compact bar height
const AI_BAR_H = 28;

// Bottom layout (fixed from canvas bottom)
const Y_PLAYER_INFO = CANVAS_H - 18;
const Y_PLAYER_HAND = Y_PLAYER_INFO - CH - 6;
const Y_BUTTONS = Y_PLAYER_HAND - 42;

// Game states
const ESTADO = {
    TURNO_XOGADOR: 0,
    TURNO_IA: 1,
    FIN_RONDA: 2,
    FIN_XOGO: 3,
};

export default class Xogo extends Escena {
    constructor(director, config = {}) {
        super(director);
        this.assets = director.assets;
        this.puntosMeta = 21;

        const numOponentes = config.numOponentes || 1;
        const dificultades = config.dificultades || ['medio'];
        this.config = config;

        // Player persistent state
        this.puntosXogador = 0;
        this.ronda = 0;

        // Player per-round state
        this.manXogador = [];
        this.capturadasXogador = [];
        this.escobasXogador = 0;

        // AI players
        this.ias = [];
        for (let i = 0; i < numOponentes; i++) {
            this.ias.push({
                man: [],
                capturadas: [],
                escobas: 0,
                puntos: 0,
                dificultade: dificultades[i] || 'medio',
                nome: `IA ${i + 1}`
            });
        }

        this.numXogadores = 1 + numOponentes;

        // Play area bounds (between AI bars and buttons)
        this.aiBottom = this.ias.length * AI_BAR_H;
        this.playAreaCenter = this.aiBottom + (Y_BUTTONS - this.aiBottom) / 2;

        // UI interaction state
        this.estado = ESTADO.TURNO_XOGADOR;
        this.turnoActual = 0; // 0 = player, 1+ = IA index
        this.cartaSel = -1;
        this.mesaSel = new Set();
        this.mensaxe = '';
        this.tempMsg = 0;
        this.cartaHover = -1;
        this.mesaHover = -1;

        // AI timing
        this.tempIA = 0;
        this.RETARDO_IA = 1000;

        // Scoring display
        this.detallesPuntos = null;
        this.ultimoCapturador = null;

        // Animation state
        this.animacions = [];
        this.estaAnimando = false;
        this.tremerTempo = 0;
        this.tremerDesvio = 0;

        // Buttons
        const bw = 80, bh = 28;
        this.btnCapturar = new Boton(
            CANVAS_W / 2 - bw - 4, Y_BUTTONS, bw, bh,
            ['#2a7a2a', '#3a9a3a', '#1a5a1a', '#444'],
            [], 'Capturar',
            () => this.executarCaptura()
        );
        this.btnCapturar.deshabilitado = true;

        this.btnSoltar = new Boton(
            CANVAS_W / 2 + 4, Y_BUTTONS, bw, bh,
            ['#7a4a2a', '#9a5a3a', '#5a3a1a', '#444'],
            [], 'Soltar',
            () => this.executarSoltar()
        );
        this.btnSoltar.deshabilitado = true;

        this.btnContinuar = new Boton(
            CANVAS_W / 2 - 55, CANVAS_H / 2 + 130, 110, 32,
            ['#2a2a7a', '#3a3a9a', '#1a1a5a'],
            [], 'Continuar',
            () => this.iniciarRonda()
        );

        this.btnMenu = new Boton(
            CANVAS_W / 2 - 55, CANVAS_H / 2 + 130, 110, 32,
            ['#2a2a7a', '#3a3a9a', '#1a1a5a'],
            [], 'Menu',
            () => {
                import('./Menu.js').then(m => {
                    this.director.cambiarEscena(new m.default(this.director));
                });
            }
        );

        this.iniciarRonda();
    }

    // ═══════════════════════════════════════════
    //  GAME FLOW
    // ═══════════════════════════════════════════

    iniciarRonda() {
        this.ronda++;
        this.baralla = new Baralla();
        this.manXogador = [];
        this.capturadasXogador = [];
        this.escobasXogador = 0;
        for (const ia of this.ias) {
            ia.man = [];
            ia.capturadas = [];
            ia.escobas = 0;
        }
        this.ultimoCapturador = null;
        this.cartaSel = -1;
        this.mesaSel.clear();
        this.detallesPuntos = null;
        this.turnoActual = 0;

        // Deal: 4 to table, 3 to each player
        this.mesa = this.baralla.repartir(4);
        this.manXogador = this.baralla.repartir(3);
        for (const ia of this.ias) {
            ia.man = this.baralla.repartir(3);
        }

        this.estado = ESTADO.TURNO_XOGADOR;
        this.reproducirSon('son_barallar');
        this.mostrarMsg('Tu turno');
    }

    repartirMais() {
        this.manXogador = this.baralla.repartir(3);
        for (const ia of this.ias) {
            ia.man = this.baralla.repartir(3);
        }
        this.reproducirSon('son_barallar');
    }

    pasarTurno() {
        this.btnCapturar.deshabilitado = true;
        this.btnSoltar.deshabilitado = true;
        this.btnCapturar.resetar();
        this.btnSoltar.resetar();

        // Check if all hands are empty
        const todasVacias = this.manXogador.length === 0 &&
            this.ias.every(ia => ia.man.length === 0);

        if (todasVacias) {
            if (this.baralla.restantes() > 0) {
                this.repartirMais();
                this.turnoActual = 0;
                this.estado = ESTADO.TURNO_XOGADOR;
                this.mostrarMsg('Tu turno');
            } else {
                this.finalizarRonda();
            }
            return;
        }

        // Advance to next player
        this.turnoActual = (this.turnoActual + 1) % this.numXogadores;

        if (this.turnoActual === 0) {
            this.estado = ESTADO.TURNO_XOGADOR;
            this.mostrarMsg('Tu turno');
        } else {
            this.estado = ESTADO.TURNO_IA;
            this.tempIA = 0;
        }
    }

    finalizarRonda() {
        // Last capturer gets remaining table cards
        if (this.ultimoCapturador === 'xogador') {
            this.capturadasXogador.push(...this.mesa);
        } else if (this.ultimoCapturador) {
            const ia = this.ias.find(a => a.nome === this.ultimoCapturador);
            if (ia) ia.capturadas.push(...this.mesa);
        } else {
            this.capturadasXogador.push(...this.mesa);
        }
        this.mesa = [];

        this.detallesPuntos = this.calcularPuntuacion();
        this.puntosXogador += this.detallesPuntos.detalles[0].total;
        for (let i = 0; i < this.ias.length; i++) {
            this.ias[i].puntos += this.detallesPuntos.detalles[i + 1].total;
        }

        const maxPuntos = Math.max(this.puntosXogador, ...this.ias.map(ia => ia.puntos));
        if (maxPuntos >= this.puntosMeta) {
            this.estado = ESTADO.FIN_XOGO;
        } else {
            this.estado = ESTADO.FIN_RONDA;
        }
    }

    calcularPuntuacion() {
        const xogadores = [
            { nome: 'Ti', capturadas: this.capturadasXogador, escobas: this.escobasXogador },
            ...this.ias.map(ia => ({ nome: ia.nome, capturadas: ia.capturadas, escobas: ia.escobas }))
        ];

        const d = {
            detalles: xogadores.map(x => ({ nome: x.nome, lineas: [], total: 0 }))
        };

        // 1. Escobas (+1 each)
        for (let i = 0; i < xogadores.length; i++) {
            if (xogadores[i].escobas > 0) {
                d.detalles[i].lineas.push(`Escobas: +${xogadores[i].escobas}`);
                d.detalles[i].total += xogadores[i].escobas;
            }
        }

        // 2. Most captured cards (+1, tie = nobody)
        const cardCounts = xogadores.map(x => x.capturadas.length);
        const maxCards = Math.max(...cardCounts);
        const maxCardCount = cardCounts.filter(c => c === maxCards).length;
        if (maxCardCount === 1 && maxCards > 0) {
            const idx = cardCounts.indexOf(maxCards);
            d.detalles[idx].lineas.push(`Mais cartas (${maxCards}): +1`);
            d.detalles[idx].total += 1;
        }

        // 3. Gold cards: +2 for all 10, +1 for most (tie = nobody)
        const orosCounts = xogadores.map(x => x.capturadas.filter(c => c.esPaloOro()).length);
        const maxOros = Math.max(...orosCounts);
        const maxOrosCount = orosCounts.filter(c => c === maxOros).length;
        if (maxOros === 10 && maxOrosCount === 1) {
            const idx = orosCounts.indexOf(10);
            d.detalles[idx].lineas.push('Todos os ouros: +2');
            d.detalles[idx].total += 2;
        } else if (maxOrosCount === 1 && maxOros > 0) {
            const idx = orosCounts.indexOf(maxOros);
            d.detalles[idx].lineas.push(`Mais ouros (${maxOros}): +1`);
            d.detalles[idx].total += 1;
        }

        // 4. Sevens: +3 for all four, or +1 for 7 de ouros
        const setesCounts = xogadores.map(x => x.capturadas.filter(c => c.esSete()).length);
        const maxSetes = Math.max(...setesCounts);
        if (maxSetes === 4) {
            const idx = setesCounts.indexOf(4);
            d.detalles[idx].lineas.push('Todos os setes: +3');
            d.detalles[idx].total += 3;
        } else {
            for (let i = 0; i < xogadores.length; i++) {
                if (xogadores[i].capturadas.some(c => c.valor === 7)) {
                    d.detalles[i].lineas.push('Sete de ouros: +1');
                    d.detalles[i].total += 1;
                    break;
                }
            }
        }

        // 5. Rival < 10 cards (only in 1v1)
        if (this.ias.length === 1) {
            if (xogadores[1].capturadas.length < 10) {
                d.detalles[0].lineas.push('Rival < 10 cartas: +2');
                d.detalles[0].total += 2;
            }
            if (xogadores[0].capturadas.length < 10) {
                d.detalles[1].lineas.push('Rival < 10 cartas: +2');
                d.detalles[1].total += 2;
            }
        }

        return d;
    }

    // ═══════════════════════════════════════════
    //  PLAYER ACTIONS
    // ═══════════════════════════════════════════

    procesarEntrada(entrada) {
        if (!entrada.clicado) return;
        const mx = entrada.x, my = entrada.y;

        // Shake feedback: click on disabled Capturar button (wrong sum)
        if (this.cartaSel >= 0 && this.mesaSel.size > 0 && this.btnCapturar.deshabilitado) {
            const b = this.btnCapturar;
            if (mx >= b.x && mx < b.x + b.ancho && my >= b.y && my < b.y + b.alto) {
                this.tremerTempo = 300;
                this.reproducirSon('son_rompeMascara');
                return;
            }
        }

        // Click on player hand cards
        const hp = this.posicionsMan(this.manXogador.length, Y_PLAYER_HAND);
        for (let i = 0; i < this.manXogador.length; i++) {
            const p = hp[i];
            const yo = (i === this.cartaSel) ? -12 : 0;
            if (mx >= p.x && mx < p.x + CW && my >= p.y + yo && my < p.y + yo + CH) {
                this.cartaSel = (this.cartaSel === i) ? -1 : i;
                this.mesaSel.clear();
                this.actualizarBotns();
                return;
            }
        }

        // Click on table cards
        if (this.cartaSel >= 0) {
            const tp = this.posicionsMesa();
            for (let i = 0; i < this.mesa.length; i++) {
                const p = tp[i];
                if (mx >= p.x && mx < p.x + CW && my >= p.y && my < p.y + CH) {
                    if (this.mesaSel.has(i)) this.mesaSel.delete(i);
                    else this.mesaSel.add(i);
                    this.actualizarBotns();
                    return;
                }
            }
        }
    }

    actualizarBotns() {
        this.btnSoltar.deshabilitado = this.cartaSel < 0;
        if (this.cartaSel >= 0 && this.mesaSel.size > 0) {
            const sum = this.sumaSeleccion();
            this.btnCapturar.deshabilitado = (sum !== 15);
        } else {
            this.btnCapturar.deshabilitado = true;
        }
    }

    sumaSeleccion() {
        let s = this.manXogador[this.cartaSel].puntos();
        for (const i of this.mesaSel) s += this.mesa[i].puntos();
        return s;
    }

    executarCaptura() {
        if (this.cartaSel < 0 || this.mesaSel.size === 0) return;
        if (this.sumaSeleccion() !== 15) return;

        // Get positions before modifying arrays
        const hp = this.posicionsMan(this.manXogador.length, Y_PLAYER_HAND);
        const tp = this.posicionsMesa();
        const handPos = hp[this.cartaSel];
        const destX = CANVAS_W / 2 - CW / 2;
        const destY = Y_PLAYER_INFO;

        const cartaMan = this.manXogador[this.cartaSel];
        const indices = Array.from(this.mesaSel).sort((a, b) => b - a);

        // Collect card positions and values before removal
        const cardAnims = indices.map(idx => ({
            valor: this.mesa[idx].valor, x: tp[idx].x, y: tp[idx].y
        }));

        // Modify game state
        const capturadas = [cartaMan];
        for (const idx of indices) {
            capturadas.push(this.mesa[idx]);
            this.mesa.splice(idx, 1);
        }
        this.manXogador.splice(this.cartaSel, 1);
        this.capturadasXogador.push(...capturadas);
        this.ultimoCapturador = 'xogador';

        const isEscoba = this.mesa.length === 0;
        if (isEscoba) {
            this.escobasXogador++;
            this.mostrarMsg('¡ESCOBA!', 2500);
            this.reproducirSon('son_axitaMascara');
        }

        // Create animations: hand card + table cards fly to capture zone
        this.animacions.push(new AnimacionDesprazamento(
            this.assets, CW, CH, cartaMan.valor,
            handPos.x, handPos.y - 12, destX, destY, null
        ));
        const lastIdx = cardAnims.length - 1;
        for (let i = 0; i < cardAnims.length; i++) {
            const ca = cardAnims[i];
            this.animacions.push(new AnimacionDesprazamento(
                this.assets, CW, CH, ca.valor,
                ca.x, ca.y, destX, destY,
                (i === lastIdx) ? () => this.pasarTurno() : null
            ));
        }

        this.reproducirSon(`son_dar${1 + Math.floor(Math.random() * 6)}`);
        this.cartaSel = -1;
        this.mesaSel.clear();
        this.actualizarBotns();
    }

    executarSoltar() {
        if (this.cartaSel < 0) return;

        // Get hand position before removal
        const hp = this.posicionsMan(this.manXogador.length, Y_PLAYER_HAND);
        const fromPos = hp[this.cartaSel];
        const carta = this.manXogador.splice(this.cartaSel, 1)[0];

        // Compute destination on table (temporarily add to get position)
        this.mesa.push(carta);
        const tp = this.posicionsMesa();
        const toPos = { x: tp[tp.length - 1].x, y: tp[tp.length - 1].y };
        this.mesa.pop();

        // Animate card from hand to table, then commit
        this.animacions.push(new AnimacionDesprazamento(
            this.assets, CW, CH, carta.valor,
            fromPos.x, fromPos.y - 12, toPos.x, toPos.y,
            () => {
                this.mesa.push(carta);
                this.pasarTurno();
            }
        ));

        this.reproducirSon(`son_dar${1 + Math.floor(Math.random() * 6)}`);
        this.cartaSel = -1;
        this.mesaSel.clear();
        this.actualizarBotns();
    }

    // ═══════════════════════════════════════════
    //  AI LOGIC
    // ═══════════════════════════════════════════

    executarIA(dt) {
        this.tempIA += dt;
        if (this.tempIA < this.RETARDO_IA) return;

        const ia = this.ias[this.turnoActual - 1];
        const iaIdx = this.turnoActual - 1;
        const iaBarX = CANVAS_W - 20;
        const iaBarY = iaIdx * AI_BAR_H + 4;
        const xogada = this.mellorXogadaIA(ia);

        if (xogada) {
            // Get table positions before removal
            const tp = this.posicionsMesa();
            const indices = xogada.iMesa.sort((a, b) => b - a);
            const cardAnims = indices.map(idx => ({
                valor: this.mesa[idx].valor, x: tp[idx].x, y: tp[idx].y
            }));

            // Modify game state
            const carta = ia.man[xogada.iCarta];
            const capturadas = [carta];
            for (const idx of indices) {
                capturadas.push(this.mesa[idx]);
                this.mesa.splice(idx, 1);
            }
            ia.man.splice(xogada.iCarta, 1);
            ia.capturadas.push(...capturadas);
            this.ultimoCapturador = ia.nome;

            if (this.mesa.length === 0) {
                ia.escobas++;
                this.mostrarMsg(`${ia.nome}: ¡ESCOBA!`, 2500);
                this.reproducirSon('son_axitaMascara');
            } else {
                this.mostrarMsg(`${ia.nome} capturou cartas`);
            }

            // Animate captured cards flying to AI bar
            const lastIdx = cardAnims.length - 1;
            for (let i = 0; i < cardAnims.length; i++) {
                const ca = cardAnims[i];
                this.animacions.push(new AnimacionDesprazamento(
                    this.assets, CW, CH, ca.valor,
                    ca.x, ca.y, iaBarX, iaBarY,
                    (i === lastIdx) ? () => this.pasarTurno() : null
                ));
            }
        } else {
            const idx = this.cartaIAParaSoltar(ia);
            const carta = ia.man.splice(idx, 1)[0];

            // Compute table destination
            this.mesa.push(carta);
            const tp = this.posicionsMesa();
            const toPos = { x: tp[tp.length - 1].x, y: tp[tp.length - 1].y };
            this.mesa.pop();

            // Animate card from AI bar to table
            this.animacions.push(new AnimacionDesprazamento(
                this.assets, CW, CH, carta.valor,
                iaBarX, iaBarY, toPos.x, toPos.y,
                () => {
                    this.mesa.push(carta);
                    this.pasarTurno();
                }
            ));

            this.mostrarMsg(`${ia.nome} soltou carta`);
        }

        this.reproducirSon(`son_dar${1 + Math.floor(Math.random() * 6)}`);
    }

    mellorXogadaIA(ia) {
        // Easy: 50% chance to skip capture entirely
        if (ia.dificultade === 'facil' && Math.random() < 0.5) return null;

        let mellor = null, mellorPunt = -1;

        for (let i = 0; i < ia.man.length; i++) {
            const c = ia.man[i];
            const obxectivo = 15 - c.puntos();
            const subs = this.subconxuntos(this.mesa, obxectivo);

            for (const sub of subs) {
                let p = sub.length * 2;

                // Huge bonus for escoba
                if (sub.length === this.mesa.length) p += 100;

                // Value special cards on table
                for (const idx of sub) {
                    if (this.mesa[idx].valor === 7) p += 10;
                    else if (this.mesa[idx].esPaloOro()) p += 5;
                    else if (this.mesa[idx].esSete()) p += 3;
                }

                // Value the hand card being captured
                if (c.valor === 7) p += 8;
                else if (c.esPaloOro()) p += 3;
                else if (c.esSete()) p += 2;

                // Hard: extra bonuses for strategic captures
                if (ia.dificultade === 'dificil') {
                    for (const idx of sub) {
                        if (this.mesa[idx].esPaloOro()) p += 3;
                        if (this.mesa[idx].esSete()) p += 2;
                    }
                }

                if (p > mellorPunt) {
                    mellorPunt = p;
                    mellor = { iCarta: i, iMesa: [...sub] };
                }
            }
        }

        // Easy: 30% chance to pick random valid move instead of best
        if (ia.dificultade === 'facil' && mellor && Math.random() < 0.3) {
            const allMoves = [];
            for (let i = 0; i < ia.man.length; i++) {
                const c = ia.man[i];
                const obxectivo = 15 - c.puntos();
                const subs = this.subconxuntos(this.mesa, obxectivo);
                for (const sub of subs) {
                    allMoves.push({ iCarta: i, iMesa: [...sub] });
                }
            }
            if (allMoves.length > 1) {
                mellor = allMoves[Math.floor(Math.random() * allMoves.length)];
            }
        }

        return mellor;
    }

    cartaIAParaSoltar(ia) {
        if (ia.dificultade === 'facil') {
            return Math.floor(Math.random() * ia.man.length);
        }

        let best = 0, minVal = Infinity;
        for (let i = 0; i < ia.man.length; i++) {
            const c = ia.man[i];
            let v = c.puntos();
            if (c.esPaloOro()) v += 15;
            if (c.esSete()) v += 20;

            // Hard: penalize drops that give opponents easy captures
            if (ia.dificultade === 'dificil') {
                const target = 15 - c.puntos();
                if (target > 0) {
                    const subs = this.subconxuntos(this.mesa, target);
                    if (subs.length > 0) v -= 8;
                }
            }

            if (v < minVal) { minVal = v; best = i; }
        }
        return best;
    }

    subconxuntos(cartas, obxectivo) {
        if (obxectivo <= 0) return [];
        const res = [];
        const n = cartas.length;
        for (let mask = 1; mask < (1 << n); mask++) {
            let s = 0;
            const sub = [];
            for (let i = 0; i < n; i++) {
                if (mask & (1 << i)) {
                    s += cartas[i].puntos();
                    sub.push(i);
                    if (s > obxectivo) break;
                }
            }
            if (s === obxectivo) res.push(sub);
        }
        return res;
    }

    // ═══════════════════════════════════════════
    //  UTILITY
    // ═══════════════════════════════════════════

    mostrarMsg(txt, duracion = 1500) {
        this.mensaxe = txt;
        this.tempMsg = duracion;
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

    posicionsMan(n, y) {
        if (n === 0) return [];
        const totalW = n * CW + (n - 1) * GAP;
        const sx = (CANVAS_W - totalW) / 2;
        const pos = [];
        for (let i = 0; i < n; i++) {
            pos.push({ x: sx + i * (CW + GAP), y });
        }
        return pos;
    }

    posicionsMesa() {
        const pos = [];
        const n = this.mesa.length;
        if (n === 0) return pos;

        const numRows = Math.ceil(n / COLS_MESA);
        const tableH = numRows * CH + (numRows - 1) * GAP;

        // Center table vertically in the play area
        const yStart = this.playAreaCenter - tableH / 2;

        for (let i = 0; i < n; i++) {
            const row = Math.floor(i / COLS_MESA);
            const col = i % COLS_MESA;
            const rowStart = row * COLS_MESA;
            const inRow = Math.min(COLS_MESA, n - rowStart);
            const rw = inRow * CW + (inRow - 1) * GAP;
            const sx = (CANVAS_W - rw) / 2;
            pos.push({
                x: sx + col * (CW + GAP),
                y: yStart + row * (CH + GAP)
            });
        }
        return pos;
    }

    // ═══════════════════════════════════════════
    //  UPDATE
    // ═══════════════════════════════════════════

    actualizar(entrada, dt) {
        if (this.tempMsg > 0) this.tempMsg -= dt;

        // Process shake timer
        if (this.tremerTempo > 0) {
            this.tremerTempo -= dt;
            const progress = 1 - Math.max(0, this.tremerTempo) / 300;
            this.tremerDesvio = Math.sin(progress * Math.PI * 5) * 4 * (1 - progress);
            if (this.tremerTempo <= 0) {
                this.tremerDesvio = 0;
                this.tremerTempo = 0;
            }
        }

        // Process animations (block input while animating)
        if (this.animacions.length > 0) {
            this.estaAnimando = true;
            for (let i = this.animacions.length - 1; i >= 0; i--) {
                this.animacions[i].actualizar(null, dt);
                if (this.animacions[i].completada) this.animacions.splice(i, 1);
            }
            return;
        }
        this.estaAnimando = false;

        switch (this.estado) {
            case ESTADO.TURNO_XOGADOR:
                this.actualizarHover(entrada);
                this.btnCapturar.actualizar(entrada, dt);
                this.btnSoltar.actualizar(entrada, dt);
                this.procesarEntrada(entrada);
                break;

            case ESTADO.TURNO_IA:
                this.director.canvas.style.cursor = 'default';
                this.executarIA(dt);
                break;

            case ESTADO.FIN_RONDA:
                this.director.canvas.style.cursor = 'default';
                this.btnContinuar.actualizar(entrada, dt);
                break;

            case ESTADO.FIN_XOGO:
                this.director.canvas.style.cursor = 'default';
                this.btnMenu.actualizar(entrada, dt);
                break;
        }
    }

    actualizarHover(entrada) {
        this.cartaHover = -1;
        this.mesaHover = -1;
        const mx = entrada.x, my = entrada.y;

        const hp = this.posicionsMan(this.manXogador.length, Y_PLAYER_HAND);
        for (let i = 0; i < this.manXogador.length; i++) {
            const p = hp[i];
            const yo = (i === this.cartaSel) ? -12 : 0;
            if (mx >= p.x && mx < p.x + CW && my >= p.y + yo && my < p.y + yo + CH) {
                this.cartaHover = i;
                break;
            }
        }

        if (this.cartaSel >= 0) {
            const tp = this.posicionsMesa();
            for (let i = 0; i < this.mesa.length; i++) {
                const p = tp[i];
                if (mx >= p.x && mx < p.x + CW && my >= p.y && my < p.y + CH) {
                    this.mesaHover = i;
                    break;
                }
            }
        }

        const onBtn = (!this.btnCapturar.deshabilitado && this.btnCapturar.estado === 'peneirar') ||
                       (!this.btnSoltar.deshabilitado && this.btnSoltar.estado === 'peneirar');
        this.director.canvas.style.cursor =
            (this.cartaHover >= 0 || this.mesaHover >= 0 || onBtn) ? 'pointer' : 'default';
    }

    // ═══════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════

    debuxar(ctx) {
        this.debuxarFondo(ctx);
        this.debuxarInfoIAs(ctx);
        this.debuxarMesa(ctx);
        this.debuxarManXogador(ctx);
        this.debuxarInfoXogador(ctx);
        this.debuxarMazo(ctx);

        if (this.estado === ESTADO.TURNO_XOGADOR) {
            this.btnCapturar.debuxar(ctx);
            this.btnSoltar.debuxar(ctx);
            if (this.cartaSel >= 0 && this.mesaSel.size > 0) {
                this.debuxarSuma(ctx);
            }
        }

        if (this.tempMsg > 0) this.debuxarMsg(ctx);

        // Draw animations on top of everything
        for (const anim of this.animacions) {
            anim.debuxar(ctx);
        }

        if (this.estado === ESTADO.FIN_RONDA) this.debuxarFinRonda(ctx);
        if (this.estado === ESTADO.FIN_XOGO) this.debuxarFinXogo(ctx);
    }

    // ── Background ──
    debuxarFondo(ctx) {
        ctx.fillStyle = '#1a472a';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    // ── Single card ──
    debuxarCarta(ctx, carta, x, y, bocaArriba) {
        const img = bocaArriba
            ? this.assets[carta.valor.toString()]
            : this.assets['dorso'];
        if (img) {
            ctx.drawImage(img, x, y, CW, CH);
        } else {
            ctx.fillStyle = bocaArriba ? '#eee' : '#8B0000';
            ctx.fillRect(x, y, CW, CH);
            if (bocaArriba) {
                ctx.fillStyle = '#000';
                ctx.font = '10px Minipixel';
                ctx.textAlign = 'center';
                ctx.fillText(carta.puntos(), x + CW / 2, y + CH / 2);
            }
        }
    }

    // ── AI info bars (compact) ──
    debuxarInfoIAs(ctx) {
        const SMALL_CW = 16, SMALL_CH = 25;

        for (let i = 0; i < this.ias.length; i++) {
            const ia = this.ias[i];
            const y = i * AI_BAR_H;

            // Bar background (highlight current AI's turn)
            const isActive = this.estado === ESTADO.TURNO_IA && this.turnoActual - 1 === i;
            ctx.fillStyle = isActive ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)';
            ctx.fillRect(0, y, CANVAS_W, AI_BAR_H);

            if (isActive) {
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 1;
                ctx.strokeRect(0, y, CANVAS_W, AI_BAR_H);
            }

            // Difficulty label
            const difLabel = { facil: 'F', medio: 'M', dificil: 'D' }[ia.dificultade];

            // Info text
            ctx.fillStyle = '#e0e0e0';
            ctx.font = '10px Minipixel';
            ctx.textAlign = 'left';
            ctx.fillText(
                `${ia.nome} (${difLabel}): ${ia.puntos} pts | Cap: ${ia.capturadas.length} | Esc: ${ia.escobas}`,
                8, y + 17
            );

            // Small face-down cards on the right
            const dorso = this.assets['dorso'];
            if (dorso) {
                const startX = CANVAS_W - 8 - ia.man.length * (SMALL_CW + 2);
                for (let j = 0; j < ia.man.length; j++) {
                    ctx.drawImage(dorso, startX + j * (SMALL_CW + 2), y + 2, SMALL_CW, SMALL_CH);
                }
            }
        }
    }

    // ── Table cards ──
    debuxarMesa(ctx) {
        const pos = this.posicionsMesa();
        for (let i = 0; i < this.mesa.length; i++) {
            const p = pos[i];
            const sel = this.mesaSel.has(i);
            const hov = (i === this.mesaHover && this.cartaSel >= 0);

            // Shake offset for selected cards
            const xOff = sel ? this.tremerDesvio : 0;
            const cx = p.x + xOff;

            // Shadow beneath selected cards
            if (sel) {
                ctx.save();
                ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
                ctx.shadowBlur = 14;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 6;
                ctx.fillStyle = 'black';
                ctx.fillRect(cx, p.y, CW, CH);
                ctx.restore();
            } else if (hov) {
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.fillRect(cx - 2, p.y - 2, CW + 4, CH + 4);
            }

            this.debuxarCarta(ctx, this.mesa[i], cx, p.y, true);

            if (sel) {
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 2;
                ctx.strokeRect(cx - 1, p.y - 1, CW + 2, CH + 2);
            }
        }
    }

    // ── Player hand (face up) ──
    debuxarManXogador(ctx) {
        const pos = this.posicionsMan(this.manXogador.length, Y_PLAYER_HAND);
        for (let i = 0; i < this.manXogador.length; i++) {
            const p = pos[i];
            const sel = (i === this.cartaSel);
            const hov = (i === this.cartaHover && !sel);
            const yo = sel ? -12 : 0;

            // Shake offset for selected hand card
            const xOff = sel ? this.tremerDesvio : 0;
            const cx = p.x + xOff;

            // Shadow beneath selected card
            if (sel) {
                ctx.save();
                ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
                ctx.shadowBlur = 14;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 6;
                ctx.fillStyle = 'black';
                ctx.fillRect(cx, p.y + yo, CW, CH);
                ctx.restore();
            } else if (hov) {
                ctx.fillStyle = 'rgba(255,255,255,0.15)';
                ctx.fillRect(cx - 2, p.y + yo - 2, CW + 4, CH + 4);
            }

            this.debuxarCarta(ctx, this.manXogador[i], cx, p.y + yo, true);

            if (sel) {
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 2;
                ctx.strokeRect(cx - 1, p.y + yo - 1, CW + 2, CH + 2);
            }
        }
    }

    // ── Player info bar ──
    debuxarInfoXogador(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, Y_PLAYER_INFO, CANVAS_W, 18);
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '10px Minipixel';
        ctx.textAlign = 'left';
        ctx.fillText(
            `Ti: ${this.puntosXogador} pts | Cartas: ${this.capturadasXogador.length} | Escobas: ${this.escobasXogador}`,
            8, Y_PLAYER_INFO + 13
        );
    }

    // ── Deck (stacked cards) & round indicator ──
    debuxarMazo(ctx) {
        const r = this.baralla ? this.baralla.restantes() : 0;

        // Center deck vertically in play area
        const deckY = this.playAreaCenter - CH / 2;
        const deckX = 3;

        if (r > 0) {
            const dorso = this.assets['dorso'];
            if (dorso) {
                // Draw stacked cards: each offset up and right for depth
                const stackCount = Math.min(r, 3);
                for (let i = 0; i < stackCount; i++) {
                    ctx.drawImage(dorso, deckX + i, deckY - i * 3, CW, CH);
                }
            }

            // Card count below deck
            ctx.fillStyle = 'white';
            ctx.font = '10px Minipixel';
            ctx.textAlign = 'center';
            ctx.fillText(`${r}`, deckX + CW / 2, deckY + CH + 12);
        }

        // Round indicator (top-right of play area)
        ctx.fillStyle = 'white';
        ctx.font = '10px Minipixel';
        ctx.textAlign = 'right';
        ctx.fillText(`Ronda ${this.ronda}`, CANVAS_W - 8, this.aiBottom + 16);
    }

    // ── Sum display (below table cards) ──
    debuxarSuma(ctx) {
        // Find bottom of table cards
        const pos = this.posicionsMesa();
        let tableBottom = this.playAreaCenter;
        for (const p of pos) {
            if (p.y + CH > tableBottom) tableBottom = p.y + CH;
        }

        const vMan = this.manXogador[this.cartaSel].puntos();
        let sMesa = 0;
        for (const i of this.mesaSel) sMesa += this.mesa[i].puntos();
        const total = vMan + sMesa;
        const ok = (total === 15);

        ctx.fillStyle = ok ? '#00ff00' : '#ffaa00';
        ctx.font = '11px Minipixel';
        ctx.textAlign = 'center';
        ctx.fillText(
            `${vMan} + ${sMesa} = ${total} ${ok ? '\u2713' : ''}`,
            CANVAS_W / 2, tableBottom + 16
        );
    }

    // ── Floating message ──
    debuxarMsg(ctx) {
        const isEscoba = this.mensaxe.includes('ESCOBA');
        const w = 220, h = 34;
        const x = (CANVAS_W - w) / 2;
        const y = this.playAreaCenter - h / 2;

        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = isEscoba ? '#FFD700' : '#666';
        ctx.lineWidth = isEscoba ? 2 : 1;
        ctx.strokeRect(x, y, w, h);

        ctx.fillStyle = isEscoba ? '#FFD700' : 'white';
        ctx.font = isEscoba ? '16px Minipixel' : '12px Minipixel';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.mensaxe, CANVAS_W / 2, y + h / 2);
        ctx.textBaseline = 'alphabetic';
    }

    // ── Round end overlay ──
    debuxarFinRonda(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.88)';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFD700';
        ctx.font = '16px Minipixel';
        ctx.fillText(`Fin da Ronda ${this.ronda}`, CANVAS_W / 2, 30);

        let y = 55;
        const d = this.detallesPuntos;

        for (let i = 0; i < d.detalles.length; i++) {
            const det = d.detalles[i];
            const isPlayer = (i === 0);

            ctx.fillStyle = isPlayer ? '#4CAF50' : '#f44336';
            ctx.font = '12px Minipixel';
            ctx.fillText(`\u2014 ${det.nome} \u2014`, CANVAS_W / 2, y);
            y += 18;

            ctx.fillStyle = 'white';
            ctx.font = '10px Minipixel';
            if (det.lineas.length === 0) {
                ctx.fillText('Sen puntos', CANVAS_W / 2, y);
                y += 14;
            }
            for (const t of det.lineas) {
                ctx.fillText(t, CANVAS_W / 2, y);
                y += 14;
            }
            ctx.fillStyle = isPlayer ? '#4CAF50' : '#f44336';
            ctx.fillText(`Total: +${det.total}`, CANVAS_W / 2, y + 2);
            y += 22;
        }

        // Overall scores
        y += 5;
        ctx.fillStyle = '#FFD700';
        ctx.font = '12px Minipixel';
        let scoreText = `Ti ${this.puntosXogador}`;
        for (const ia of this.ias) {
            scoreText += ` \u2014 ${ia.nome} ${ia.puntos}`;
        }
        ctx.fillText(scoreText, CANVAS_W / 2, y);

        // Place continue button below scores
        this.btnContinuar.y = Math.max(y + 25, CANVAS_H / 2 + 130);
        this.btnContinuar.debuxar(ctx);
    }

    // ── Game end overlay ──
    debuxarFinXogo(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.92)';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Determine winner
        const allScores = [
            { nome: 'Ti', puntos: this.puntosXogador },
            ...this.ias.map(ia => ({ nome: ia.nome, puntos: ia.puntos }))
        ];
        allScores.sort((a, b) => b.puntos - a.puntos);
        const won = allScores[0].nome === 'Ti';

        ctx.textAlign = 'center';
        ctx.font = '22px Minipixel';
        ctx.fillStyle = won ? '#FFD700' : '#f44336';
        ctx.fillText(
            won ? '\u00a1VICTORIA!' : 'DERROTA',
            CANVAS_W / 2, CANVAS_H / 2 - 60
        );

        ctx.fillStyle = 'white';
        ctx.font = '13px Minipixel';
        let y = CANVAS_H / 2 - 25;
        for (const s of allScores) {
            ctx.fillText(`${s.nome}: ${s.puntos} pts`, CANVAS_W / 2, y);
            y += 20;
        }

        ctx.font = '11px Minipixel';
        ctx.fillText(`Rondas xogadas: ${this.ronda}`, CANVAS_W / 2, y + 10);

        this.btnMenu.y = Math.max(y + 40, CANVAS_H / 2 + 130);
        this.btnMenu.debuxar(ctx);
    }
}
