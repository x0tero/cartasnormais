import Escena from '../Escena.js';
import Baralla from '../Baralla.js';
import Boton from '../utiles/Boton.js';

// ── DISPLAY CONSTANTS ──────────────────────────
const CW = 56;          // Card width
const CH = 88;          // Card height
const GAP = 8;           // Gap between cards
const CANVAS_W = 380;
const CANVAS_H = 600;
const COLS_MESA = 5;     // Max cards per table row

// Layout Y positions
const Y_AI_INFO = 0;
const Y_AI_HAND = 18;
const Y_MESA = 115;
const Y_BUTTONS = 410;
const Y_PLAYER_HAND = 460;
const Y_PLAYER_INFO = 558;

// Game states
const ESTADO = {
    TURNO_XOGADOR: 0,
    TURNO_IA: 1,
    FIN_RONDA: 2,
    FIN_XOGO: 3,
};

export default class Xogo extends Escena {
    constructor(director) {
        super(director);
        this.assets = director.assets;
        this.puntosMeta = 21;

        // Persistent scores across rounds
        this.puntosXogador = 0;
        this.puntosIA = 0;
        this.ronda = 0;

        // Per-round state (initialized in iniciarRonda)
        this.baralla = null;
        this.manXogador = [];
        this.manIA = [];
        this.mesa = [];
        this.capturadasXogador = [];
        this.capturadasIA = [];
        this.escobasXogador = 0;
        this.escobasIA = 0;
        this.ultimoCapturador = null;

        // UI interaction state
        this.estado = ESTADO.TURNO_XOGADOR;
        this.cartaSel = -1;            // Selected hand card index
        this.mesaSel = new Set();       // Selected table card indices
        this.mensaxe = '';
        this.tempMsg = 0;
        this.cartaHover = -1;
        this.mesaHover = -1;

        // AI timing
        this.tempIA = 0;
        this.RETARDO_IA = 1000;

        // Scoring display
        this.detallesPuntos = null;

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
                // Lazy import to avoid circular dependency
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
        this.manIA = [];
        this.mesa = [];
        this.capturadasXogador = [];
        this.capturadasIA = [];
        this.escobasXogador = 0;
        this.escobasIA = 0;
        this.ultimoCapturador = null;
        this.cartaSel = -1;
        this.mesaSel.clear();
        this.detallesPuntos = null;

        // Deal: 4 to table, 3 to each player
        this.mesa = this.baralla.repartir(4);
        this.manXogador = this.baralla.repartir(3);
        this.manIA = this.baralla.repartir(3);

        this.estado = ESTADO.TURNO_XOGADOR;
        this.reproducirSon('son_barallar');
        this.mostrarMsg('Tu turno');
    }

    repartirMais() {
        this.manXogador = this.baralla.repartir(3);
        this.manIA = this.baralla.repartir(3);
        this.reproducirSon('son_barallar');
    }

    pasarTurno() {
        // Reset button state
        this.btnCapturar.deshabilitado = true;
        this.btnSoltar.deshabilitado = true;
        this.btnCapturar.resetar();
        this.btnSoltar.resetar();

        // Both hands empty → deal more or end round
        if (this.manXogador.length === 0 && this.manIA.length === 0) {
            if (this.baralla.restantes() > 0) {
                this.repartirMais();
                this.estado = ESTADO.TURNO_XOGADOR;
                this.mostrarMsg('Tu turno');
            } else {
                this.finalizarRonda();
            }
            return;
        }

        // Alternate turns
        if (this.estado === ESTADO.TURNO_XOGADOR) {
            this.estado = ESTADO.TURNO_IA;
            this.tempIA = 0;
        } else {
            this.estado = ESTADO.TURNO_XOGADOR;
            this.mostrarMsg('Tu turno');
        }
    }

    finalizarRonda() {
        // Last capturer gets remaining table cards (no escoba for this)
        if (this.ultimoCapturador === 'xogador') {
            this.capturadasXogador.push(...this.mesa);
        } else if (this.ultimoCapturador === 'ia') {
            this.capturadasIA.push(...this.mesa);
        } else {
            // Edge case: nobody captured anything
            this.capturadasXogador.push(...this.mesa);
        }
        this.mesa = [];

        this.detallesPuntos = this.calcularPuntuacion();
        this.puntosXogador += this.detallesPuntos.totalX;
        this.puntosIA += this.detallesPuntos.totalIA;

        if (this.puntosXogador >= this.puntosMeta || this.puntosIA >= this.puntosMeta) {
            this.estado = ESTADO.FIN_XOGO;
        } else {
            this.estado = ESTADO.FIN_RONDA;
        }
    }

    calcularPuntuacion() {
        const d = { xogador: [], ia: [], totalX: 0, totalIA: 0 };
        const cX = this.capturadasXogador;
        const cIA = this.capturadasIA;

        // 1. Escobas (+1 each)
        if (this.escobasXogador > 0) {
            d.xogador.push(`Escobas: +${this.escobasXogador}`);
            d.totalX += this.escobasXogador;
        }
        if (this.escobasIA > 0) {
            d.ia.push(`Escobas: +${this.escobasIA}`);
            d.totalIA += this.escobasIA;
        }

        // 2. Most captured cards (+1, tie = nobody)
        if (cX.length > cIA.length) {
            d.xogador.push(`Mais cartas (${cX.length}): +1`);
            d.totalX += 1;
        } else if (cIA.length > cX.length) {
            d.ia.push(`Mais cartas (${cIA.length}): +1`);
            d.totalIA += 1;
        }

        // 3/4. Gold cards: +1 for most, or +2 for ALL 10 oros
        const oX = cX.filter(c => c.esPaloOro()).length;
        const oIA = cIA.filter(c => c.esPaloOro()).length;
        if (oX === 10) {
            d.xogador.push('Todos os ouros: +2');
            d.totalX += 2;
        } else if (oIA === 10) {
            d.ia.push('Todos os ouros: +2');
            d.totalIA += 2;
        } else if (oX > oIA) {
            d.xogador.push(`Mais ouros (${oX}): +1`);
            d.totalX += 1;
        } else if (oIA > oX) {
            d.ia.push(`Mais ouros (${oIA}): +1`);
            d.totalIA += 1;
        }

        // 5/6. Sevens: +3 for all four 7s, or +1 for 7 of Oros (ID=7)
        const s7X = cX.filter(c => c.esSete()).length;
        const s7IA = cIA.filter(c => c.esSete()).length;
        const has7oroX = cX.some(c => c.valor === 7);
        const has7oroIA = cIA.some(c => c.valor === 7);

        if (s7X === 4) {
            d.xogador.push('Todos os setes: +3');
            d.totalX += 3;
        } else if (s7IA === 4) {
            d.ia.push('Todos os setes: +3');
            d.totalIA += 3;
        } else {
            if (has7oroX) {
                d.xogador.push('Sete de ouros: +1');
                d.totalX += 1;
            } else if (has7oroIA) {
                d.ia.push('Sete de ouros: +1');
                d.totalIA += 1;
            }
        }

        // 7. Opponent has fewer than 10 cards (+2)
        if (cIA.length < 10) {
            d.xogador.push('Rival < 10 cartas: +2');
            d.totalX += 2;
        }
        if (cX.length < 10) {
            d.ia.push('Rival < 10 cartas: +2');
            d.totalIA += 2;
        }

        return d;
    }

    // ═══════════════════════════════════════════
    //  PLAYER ACTIONS
    // ═══════════════════════════════════════════

    procesarEntrada(entrada) {
        if (!entrada.clicado) return;
        const mx = entrada.x, my = entrada.y;

        // Click on player's hand cards
        const hp = this.posicionsMan(this.manXogador.length, Y_PLAYER_HAND);
        for (let i = 0; i < this.manXogador.length; i++) {
            const p = hp[i];
            const yo = (i === this.cartaSel) ? -12 : 0;
            if (mx >= p.x && mx < p.x + CW && my >= p.y + yo && my < p.y + yo + CH) {
                // Toggle or switch selection
                this.cartaSel = (this.cartaSel === i) ? -1 : i;
                this.mesaSel.clear();
                this.actualizarBotns();
                return;
            }
        }

        // Click on table cards (only when a hand card is selected)
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

        const cartaMan = this.manXogador[this.cartaSel];
        const indices = Array.from(this.mesaSel).sort((a, b) => b - a); // descending for safe splice
        const capturadas = [cartaMan];
        for (const idx of indices) {
            capturadas.push(this.mesa[idx]);
            this.mesa.splice(idx, 1);
        }
        this.manXogador.splice(this.cartaSel, 1);
        this.capturadasXogador.push(...capturadas);
        this.ultimoCapturador = 'xogador';

        // Check escoba (swept the table)
        if (this.mesa.length === 0) {
            this.escobasXogador++;
            this.mostrarMsg('¡ESCOBA!', 2500);
            this.reproducirSon('son_axitaMascara');
        }

        this.reproducirSon(`son_dar${1 + Math.floor(Math.random() * 6)}`);
        this.cartaSel = -1;
        this.mesaSel.clear();
        this.actualizarBotns();
        this.pasarTurno();
    }

    executarSoltar() {
        if (this.cartaSel < 0) return;
        const carta = this.manXogador.splice(this.cartaSel, 1)[0];
        this.mesa.push(carta);
        this.reproducirSon(`son_dar${1 + Math.floor(Math.random() * 6)}`);
        this.cartaSel = -1;
        this.mesaSel.clear();
        this.actualizarBotns();
        this.pasarTurno();
    }

    // ═══════════════════════════════════════════
    //  AI LOGIC
    // ═══════════════════════════════════════════

    executarIA(dt) {
        this.tempIA += dt;
        if (this.tempIA < this.RETARDO_IA) return;

        const xogada = this.mellorXogadaIA();
        if (xogada) {
            // Perform capture
            const carta = this.manIA[xogada.iCarta];
            const indices = xogada.iMesa.sort((a, b) => b - a);
            const capturadas = [carta];
            for (const idx of indices) {
                capturadas.push(this.mesa[idx]);
                this.mesa.splice(idx, 1);
            }
            this.manIA.splice(xogada.iCarta, 1);
            this.capturadasIA.push(...capturadas);
            this.ultimoCapturador = 'ia';

            if (this.mesa.length === 0) {
                this.escobasIA++;
                this.mostrarMsg('IA: ¡ESCOBA!', 2500);
                this.reproducirSon('son_axitaMascara');
            } else {
                this.mostrarMsg('IA capturou cartas');
            }
        } else {
            // Drop least valuable card
            const idx = this.cartaIAParaSoltar();
            this.mesa.push(this.manIA.splice(idx, 1)[0]);
            this.mostrarMsg('IA soltou carta');
        }

        this.reproducirSon(`son_dar${1 + Math.floor(Math.random() * 6)}`);
        this.pasarTurno();
    }

    mellorXogadaIA() {
        let mellor = null, mellorPunt = -1;

        for (let i = 0; i < this.manIA.length; i++) {
            const c = this.manIA[i];
            const obxectivo = 15 - c.puntos();
            const subs = this.subconxuntos(this.mesa, obxectivo);

            for (const sub of subs) {
                let p = sub.length * 2; // Prefer capturing more cards

                // Huge bonus for escoba
                if (sub.length === this.mesa.length) p += 100;

                // Value special cards on table
                for (const idx of sub) {
                    if (this.mesa[idx].valor === 7) p += 10; // 7 de oros
                    else if (this.mesa[idx].esPaloOro()) p += 5;
                    else if (this.mesa[idx].esSete()) p += 3;
                }

                // Value the hand card being captured too
                if (c.valor === 7) p += 8;
                else if (c.esPaloOro()) p += 3;
                else if (c.esSete()) p += 2;

                if (p > mellorPunt) {
                    mellorPunt = p;
                    mellor = { iCarta: i, iMesa: [...sub] };
                }
            }
        }

        return mellor;
    }

    cartaIAParaSoltar() {
        // Drop the least strategically valuable card
        let best = 0, minVal = Infinity;
        for (let i = 0; i < this.manIA.length; i++) {
            const c = this.manIA[i];
            let v = c.puntos(); // Base value from card number
            if (c.esPaloOro()) v += 15;
            if (c.esSete()) v += 20;
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
                    if (s > obxectivo) break; // Early exit
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
        for (let i = 0; i < n; i++) {
            const row = Math.floor(i / COLS_MESA);
            const col = i % COLS_MESA;
            const rowStart = row * COLS_MESA;
            const inRow = Math.min(COLS_MESA, n - rowStart);
            const rw = inRow * CW + (inRow - 1) * GAP;
            const sx = (CANVAS_W - rw) / 2;
            pos.push({
                x: sx + col * (CW + GAP),
                y: Y_MESA + row * (CH + GAP)
            });
        }
        return pos;
    }

    // ═══════════════════════════════════════════
    //  UPDATE
    // ═══════════════════════════════════════════

    actualizar(entrada, dt) {
        if (this.tempMsg > 0) this.tempMsg -= dt;

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

        // Hover on player hand
        const hp = this.posicionsMan(this.manXogador.length, Y_PLAYER_HAND);
        for (let i = 0; i < this.manXogador.length; i++) {
            const p = hp[i];
            const yo = (i === this.cartaSel) ? -12 : 0;
            if (mx >= p.x && mx < p.x + CW && my >= p.y + yo && my < p.y + yo + CH) {
                this.cartaHover = i;
                break;
            }
        }

        // Hover on table (only if hand card selected)
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
        this.debuxarInfoIA(ctx);
        this.debuxarManIA(ctx);
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
        if (this.estado === ESTADO.FIN_RONDA) this.debuxarFinRonda(ctx);
        if (this.estado === ESTADO.FIN_XOGO) this.debuxarFinXogo(ctx);
    }

    // ── Background ──
    debuxarFondo(ctx) {
        const bg = this.assets['taboleiro'] || this.assets['taboleiro_d'];
        if (bg) {
            ctx.drawImage(bg, 0, 0, CANVAS_W, CANVAS_H);
        } else {
            ctx.fillStyle = '#1a472a';
            ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        }
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

    // ── AI hand (face down) ──
    debuxarManIA(ctx) {
        const pos = this.posicionsMan(this.manIA.length, Y_AI_HAND);
        for (let i = 0; i < this.manIA.length; i++) {
            this.debuxarCarta(ctx, this.manIA[i], pos[i].x, pos[i].y, false);
        }
    }

    // ── Table cards ──
    debuxarMesa(ctx) {
        const pos = this.posicionsMesa();
        for (let i = 0; i < this.mesa.length; i++) {
            const p = pos[i];
            const sel = this.mesaSel.has(i);
            const hov = (i === this.mesaHover && this.cartaSel >= 0);

            // Selection/hover highlight behind the card
            if (sel) {
                ctx.fillStyle = 'rgba(255,215,0,0.35)';
                ctx.fillRect(p.x - 3, p.y - 3, CW + 6, CH + 6);
            } else if (hov) {
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.fillRect(p.x - 2, p.y - 2, CW + 4, CH + 4);
            }

            this.debuxarCarta(ctx, this.mesa[i], p.x, p.y, true);

            // Selection border on top of card
            if (sel) {
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 2;
                ctx.strokeRect(p.x - 1, p.y - 1, CW + 2, CH + 2);
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

            if (hov) {
                ctx.fillStyle = 'rgba(255,255,255,0.15)';
                ctx.fillRect(p.x - 2, p.y + yo - 2, CW + 4, CH + 4);
            }

            this.debuxarCarta(ctx, this.manXogador[i], p.x, p.y + yo, true);

            if (sel) {
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 2;
                ctx.strokeRect(p.x - 1, p.y + yo - 1, CW + 2, CH + 2);
            }
        }
    }

    // ── Info bars ──
    debuxarInfoIA(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, Y_AI_INFO, CANVAS_W, 16);
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '11px Minipixel';
        ctx.textAlign = 'left';
        ctx.fillText(
            `IA: ${this.puntosIA} pts | Cartas: ${this.capturadasIA.length} | Escobas: ${this.escobasIA}`,
            8, Y_AI_INFO + 12
        );
    }

    debuxarInfoXogador(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, Y_PLAYER_INFO, CANVAS_W, 16);
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '11px Minipixel';
        ctx.textAlign = 'left';
        ctx.fillText(
            `Ti: ${this.puntosXogador} pts | Cartas: ${this.capturadasXogador.length} | Escobas: ${this.escobasXogador}`,
            8, Y_PLAYER_INFO + 12
        );
    }

    // ── Deck & round indicator ──
    debuxarMazo(ctx) {
        const r = this.baralla ? this.baralla.restantes() : 0;
        // Small card back as deck indicator
        if (r > 0) {
            const dorso = this.assets['dorso'];
            if (dorso) ctx.drawImage(dorso, 10, Y_BUTTONS + 1, 18, 28);
        }
        ctx.fillStyle = 'white';
        ctx.font = '10px Minipixel';
        ctx.textAlign = 'left';
        ctx.fillText(`${r}`, 32, Y_BUTTONS + 20);

        ctx.textAlign = 'right';
        ctx.fillText(`Ronda ${this.ronda}`, CANVAS_W - 10, Y_BUTTONS + 20);
    }

    // ── Sum display ──
    debuxarSuma(ctx) {
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
            CANVAS_W / 2, Y_BUTTONS + 38
        );
    }

    // ── Floating message ──
    debuxarMsg(ctx) {
        const isEscoba = this.mensaxe.includes('ESCOBA');
        const w = 220, h = 34;
        const x = (CANVAS_W - w) / 2;
        const y = (Y_MESA + Y_BUTTONS) / 2 - h / 2;

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
        ctx.fillText(`Fin da Ronda ${this.ronda}`, CANVAS_W / 2, 50);

        let y = 80;
        const d = this.detallesPuntos;

        // Player scoring
        ctx.fillStyle = '#4CAF50';
        ctx.font = '13px Minipixel';
        ctx.fillText('\u2014 Ti \u2014', CANVAS_W / 2, y);
        y += 22;
        ctx.fillStyle = 'white';
        ctx.font = '11px Minipixel';
        if (d.xogador.length === 0) {
            ctx.fillText('Sen puntos', CANVAS_W / 2, y);
            y += 16;
        }
        for (const t of d.xogador) {
            ctx.fillText(t, CANVAS_W / 2, y);
            y += 16;
        }
        ctx.fillStyle = '#4CAF50';
        ctx.fillText(`Total: +${d.totalX}`, CANVAS_W / 2, y + 4);
        y += 28;

        // AI scoring
        ctx.fillStyle = '#f44336';
        ctx.font = '13px Minipixel';
        ctx.fillText('\u2014 IA \u2014', CANVAS_W / 2, y);
        y += 22;
        ctx.fillStyle = 'white';
        ctx.font = '11px Minipixel';
        if (d.ia.length === 0) {
            ctx.fillText('Sen puntos', CANVAS_W / 2, y);
            y += 16;
        }
        for (const t of d.ia) {
            ctx.fillText(t, CANVAS_W / 2, y);
            y += 16;
        }
        ctx.fillStyle = '#f44336';
        ctx.fillText(`Total: +${d.totalIA}`, CANVAS_W / 2, y + 4);
        y += 35;

        // Overall score
        ctx.fillStyle = '#FFD700';
        ctx.font = '14px Minipixel';
        ctx.fillText(`Ti ${this.puntosXogador} \u2014 IA ${this.puntosIA}`, CANVAS_W / 2, y);

        this.btnContinuar.debuxar(ctx);
    }

    // ── Game end overlay ──
    debuxarFinXogo(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.92)';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        const won = this.puntosXogador > this.puntosIA;
        const tie = this.puntosXogador === this.puntosIA;

        ctx.textAlign = 'center';
        ctx.font = '22px Minipixel';
        ctx.fillStyle = won ? '#FFD700' : tie ? '#aaa' : '#f44336';
        ctx.fillText(
            won ? '\u00a1VICTORIA!' : tie ? 'EMPATE' : 'DERROTA',
            CANVAS_W / 2, CANVAS_H / 2 - 50
        );

        ctx.fillStyle = 'white';
        ctx.font = '14px Minipixel';
        ctx.fillText(`Ti: ${this.puntosXogador} pts`, CANVAS_W / 2, CANVAS_H / 2 - 10);
        ctx.fillText(`IA: ${this.puntosIA} pts`, CANVAS_W / 2, CANVAS_H / 2 + 15);
        ctx.font = '11px Minipixel';
        ctx.fillText(`Rondas xogadas: ${this.ronda}`, CANVAS_W / 2, CANVAS_H / 2 + 45);

        this.btnMenu.debuxar(ctx);
    }
}
