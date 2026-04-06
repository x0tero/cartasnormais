import Escena from '../Escena.js';
import Baralla from '../Baralla.js';
import Boton from '../utiles/Boton.js';
import AnimacionDesprazamento from '../utiles/animacions/AnimacionDesprazamento.js';

// ── DISPLAY CONSTANTS ──
const CW = 48, CH = 76, GAP = 8;
const CANVAS_W = 380, CANVAS_H = 600;
const AI_BAR_H = 28;

// Bottom layout
const Y_PLAYER_INFO = CANVAS_H - 24;
const Y_PLAYER_HAND = Y_PLAYER_INFO - CH - 6;

// Brisca card rank (higher = better). Index = puntos() value (1-10)
// puntos(): As=1, 2=2, 3=3, 4=4, 5=5, 6=6, 7=7, Sota=8, Caballo=9, Rey=10
const RANGO = [0, 14, 1, 13, 2, 3, 4, 5, 6, 7, 8]; // index 0 unused
// Brisca point values
const PUNTOS_BRISCA = [0, 11, 0, 10, 0, 0, 0, 0, 2, 3, 4]; // index 0 unused

const ESTADO = {
    DADO: -1,
    TURNO_XOGADOR: 0,
    TURNO_IA: 1,
    FIN_RONDA: 2,
};

// Suit names for display
const NOMES_PALO = ['Ouros', 'Copas', 'Espadas', 'Bastos'];

export default class Brisca extends Escena {
    constructor(director, config = {}) {
        super(director);
        this.assets = director.assets;

        const numOponentes = config.numOponentes || 1;
        const dificultades = config.dificultades || ['medio'];
        this.config = config;
        this.puntosMeta = config.puntosMeta || 10;

        // Players
        this.puntosXogador = 0;
        this.ronda = 0;
        this.ias = [];
        for (let i = 0; i < numOponentes; i++) {
            this.ias.push({
                man: [], bazas: [], puntos: 0,
                dificultade: dificultades[i] || 'medio',
                nome: `IA ${i + 1}`
            });
        }
        this.numXogadores = 1 + numOponentes;

        // Layout
        this.aiBottom = this.ias.length * (AI_BAR_H + 2);
        this.playAreaCenter = this.aiBottom + (Y_PLAYER_HAND - 50 - this.aiBottom) / 2;

        // Game state
        this.manXogador = [];
        this.bazasXogador = []; // won tricks
        this.mesa = [];         // cards played in current trick
        this.triunfo = null;    // trump card (face-up)
        this.paloTriunfo = -1;
        this.turnoActual = 0;
        this.xogadorInicio = 0;
        this.liderBaza = 0;     // who led the current trick
        this.estado = ESTADO.DADO;

        // UI
        this.cartaSel = -1;
        this.cartaHover = -1;
        this.mensaxe = '';
        this.tempMsg = 0;
        this.msgEnRemate = null;
        this.animacions = [];
        this.estaAnimando = false;
        this.mazoVisual = null;
        this.pausado = false;
        this._voltandoDePausa = false;

        // Dice state
        this.dado = {
            fase: 'tirando', caraActual: 1, resultado: 0,
            tempo: 0, intervalo: 80, duracion: 2000,
            spinnerIdx: 0, spinnerPasos: 0, spinnerFeitos: 0,
            spinnerTempo: 0, spinnerIntervalo: 150, pausaTempo: 0,
        };

        // Buttons
        const cogSize = 24;
        this.btnCog = new Boton(
            6, this.aiBottom + 4, cogSize, cogSize,
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

        this.btnContinuar = new Boton(
            CANVAS_W / 2 - 55, CANVAS_H / 2 + 100, 110, 32,
            ['#2a2a7a', '#3a3a9a', '#1a1a5a'], [], 'Continuar',
            () => this.iniciarRonda()
        );
        this.btnMenu = new Boton(
            CANVAS_W / 2 - 55, CANVAS_H / 2 + 100, 110, 32,
            ['#2a2a7a', '#3a3a9a', '#1a1a5a'], [], 'Menu',
            () => { import('./Menu.js').then(m => this.director.cambiarEscena(new m.default(this.director))); }
        );

        this.iniciarRonda();
    }

    // ═══════════════════════════════════════════
    //  BRISCA CARD HELPERS
    // ═══════════════════════════════════════════

    briscaPuntos(carta) {
        return PUNTOS_BRISCA[carta.puntos()] || 0;
    }

    briscaRango(carta) {
        return RANGO[carta.puntos()] || 0;
    }

    // Determine trick winner. mesa = [{carta, xogador}]
    ganadorBaza() {
        const cartaLider = this.mesa[0];
        const paloLider = cartaLider.carta.palo();
        let mellor = 0;
        for (let i = 1; i < this.mesa.length; i++) {
            const c = this.mesa[i].carta;
            const m = this.mesa[mellor].carta;
            const cTriunfo = c.palo() === this.paloTriunfo;
            const mTriunfo = m.palo() === this.paloTriunfo;

            if (cTriunfo && !mTriunfo) {
                mellor = i;
            } else if (cTriunfo && mTriunfo) {
                if (this.briscaRango(c) > this.briscaRango(m)) mellor = i;
            } else if (!cTriunfo && !mTriunfo) {
                if (c.palo() === paloLider && m.palo() !== paloLider) {
                    mellor = i;
                } else if (c.palo() === paloLider && m.palo() === paloLider) {
                    if (this.briscaRango(c) > this.briscaRango(m)) mellor = i;
                }
            }
        }
        return this.mesa[mellor].xogador;
    }

    contarPuntosBaza(cartas) {
        let total = 0;
        for (const c of cartas) total += this.briscaPuntos(c);
        return total;
    }

    // ═══════════════════════════════════════════
    //  GAME FLOW
    // ═══════════════════════════════════════════

    iniciarRonda() {
        this.ronda++;
        this.baralla = new Baralla();
        this.manXogador = [];
        this.bazasXogador = [];
        for (const ia of this.ias) {
            ia.man = [];
            ia.bazas = [];
        }
        this.mesa = [];

        // Deal 3 to each
        this.manXogador = this.baralla.repartir(3);
        for (const ia of this.ias) {
            ia.man = this.baralla.repartir(3);
        }

        // Turn up trump card
        this.triunfo = this.baralla.roubar();
        this.paloTriunfo = this.triunfo.palo();

        this.reproducirSon('son_barallar');

        if (this.estado === ESTADO.DADO) {
            // First round: dice decides
        } else {
            this.xogadorInicio = (this.xogadorInicio + 1) % this.numXogadores;
            this.turnoActual = this.xogadorInicio;
            this.liderBaza = this.turnoActual;
            this.iniciarTurno();
        }
    }

    iniciarTurno() {
        const nomes = ['Ti', ...this.ias.map(ia => ia.nome)];
        if (this.turnoActual === 0) {
            this.estado = ESTADO.TURNO_XOGADOR;
            this.mostrarMsg('O teu turno');
        } else {
            this.estado = ESTADO.TURNO_IA;
            this.tempIA = 0;
            this.mostrarMsg(`Turno de ${nomes[this.turnoActual]}`);
        }
    }

    xogarCarta(xogadorIdx, carta) {
        this.mesa.push({ carta, xogador: xogadorIdx });
    }

    // After all players have played, resolve the trick
    resolverBaza() {
        const ganador = this.ganadorBaza();
        const nomes = ['Ti', ...this.ias.map(ia => ia.nome)];
        const cartasGanadas = this.mesa.map(m => m.carta);

        // Add to winner's pile
        if (ganador === 0) {
            this.bazasXogador.push(...cartasGanadas);
        } else {
            this.ias[ganador - 1].bazas.push(...cartasGanadas);
        }

        const pts = this.contarPuntosBaza(cartasGanadas);
        const msg = ganador === 0
            ? `Ganou a baza! (+${pts})`
            : `${nomes[ganador]} ganou a baza (+${pts})`;

        this.mostrarMsg(msg, 1800, () => {
            this.mesa = [];

            // Draw cards if deck remains
            if (this.baralla.restantes() > 0 || this.triunfo) {
                this.roubarCartas(ganador, () => {
                    this.liderBaza = ganador;
                    this.turnoActual = ganador;
                    this.iniciarTurno();
                });
            } else if (this.manXogador.length > 0 || this.ias.some(ia => ia.man.length > 0)) {
                // No deck left, play remaining cards
                this.liderBaza = ganador;
                this.turnoActual = ganador;
                this.iniciarTurno();
            } else {
                this.finalizarRonda();
            }
        });
    }

    // Draw cards: winner draws first, then others in order
    roubarCartas(ganador, enRemate) {
        const orde = [];
        for (let i = 0; i < this.numXogadores; i++) {
            orde.push((ganador + i) % this.numXogadores);
        }

        this.mazoVisual = this.baralla.restantes() + (this.triunfo ? 1 : 0);
        const deckX = 15, deckY = this.playAreaCenter;

        const roubarSeguinte = (idx) => {
            if (idx >= orde.length) {
                this.mazoVisual = null;
                if (enRemate) enRemate();
                return;
            }

            const xIdx = orde[idx];
            let carta;
            if (this.baralla.restantes() > 0) {
                carta = this.baralla.roubar();
            } else if (this.triunfo) {
                carta = this.triunfo;
                this.triunfo = null;
            } else {
                roubarSeguinte(idx + 1);
                return;
            }

            let toX, toY, cardId;
            if (xIdx === 0) {
                const futureLen = this.manXogador.length + 1;
                const pPos = this.posicionsMan(futureLen, Y_PLAYER_HAND);
                toX = pPos[futureLen - 1].x;
                toY = pPos[futureLen - 1].y;
                cardId = carta.valor;
            } else {
                const ia = this.ias[xIdx - 1];
                const futureLen = ia.man.length + 1;
                const startX = CANVAS_W - 8 - futureLen * (16 + 2);
                toX = startX + (futureLen - 1) * (16 + 2);
                toY = (xIdx - 1) * (AI_BAR_H + 2) + 2;
                cardId = 'dorso';
            }

            this.animacions.push(new AnimacionDesprazamento(
                this.assets, CW, CH, cardId,
                deckX, deckY, toX, toY,
                () => {
                    if (xIdx === 0) {
                        this.manXogador.push(carta);
                    } else {
                        this.ias[xIdx - 1].man.push(carta);
                    }
                    this.mazoVisual--;
                    this.reproducirSon(`son_dar${1 + Math.floor(Math.random() * 6)}`);
                    roubarSeguinte(idx + 1);
                },
                0.15
            ));
        };

        roubarSeguinte(0);
    }

    finalizarRonda() {
        // Count points
        const pXog = this.contarPuntosBaza(this.bazasXogador);
        const pIAs = this.ias.map(ia => this.contarPuntosBaza(ia.bazas));

        this.detallesPuntos = { xogador: pXog, ias: pIAs };

        // Award game points: winner of round gets 1 point, ties get 0
        const allScores = [pXog, ...pIAs];
        const maxScore = Math.max(...allScores);
        if (allScores.filter(s => s === maxScore).length === 1) {
            const winIdx = allScores.indexOf(maxScore);
            if (winIdx === 0) this.puntosXogador++;
            else this.ias[winIdx - 1].puntos++;
        }

        const maxPuntos = Math.max(this.puntosXogador, ...this.ias.map(ia => ia.puntos));
        if (maxPuntos >= this.puntosMeta) {
            this.estado = ESTADO.FIN_RONDA;
            this.finXogo = true;
        } else {
            this.estado = ESTADO.FIN_RONDA;
            this.finXogo = false;
        }
    }

    // ═══════════════════════════════════════════
    //  PLAYER INPUT
    // ═══════════════════════════════════════════

    procesarEntrada(entrada) {
        if (!entrada.clicado) return;
        if (this.manXogador.length === 0) return;

        const hp = this.posicionsMan(this.manXogador.length, Y_PLAYER_HAND);
        for (let i = 0; i < this.manXogador.length; i++) {
            const p = hp[i];
            if (entrada.x >= p.x && entrada.x < p.x + CW &&
                entrada.y >= p.y && entrada.y < p.y + CH) {
                this.executarXogada(i);
                return;
            }
        }
    }

    executarXogada(idx) {
        const carta = this.manXogador.splice(idx, 1)[0];
        const hp = this.posicionsMan(this.manXogador.length + 1, Y_PLAYER_HAND);
        const fromPos = hp[idx];

        // Target: center play area
        const toPos = this.posicionMesaCarta(this.mesa.length);

        this.animacions.push(new AnimacionDesprazamento(
            this.assets, CW, CH, carta.valor,
            fromPos.x, fromPos.y, toPos.x, toPos.y,
            () => {
                this.xogarCarta(0, carta);
                this.reproducirSon(`son_dar${1 + Math.floor(Math.random() * 6)}`);
                this.avanzarTurno();
            }
        ));
    }

    // ═══════════════════════════════════════════
    //  AI LOGIC
    // ═══════════════════════════════════════════

    executarIA(dt) {
        this.tempIA = (this.tempIA || 0) + dt;
        if (this.tempIA < 800) return;

        const iaIdx = this.turnoActual - 1;
        const ia = this.ias[iaIdx];
        if (!ia || ia.man.length === 0) return;

        const idx = this.escollerCartaIA(ia);
        const carta = ia.man.splice(idx, 1)[0];

        const iaBarX = CANVAS_W - 20;
        const iaBarY = iaIdx * (AI_BAR_H + 2) + 4;
        const toPos = this.posicionMesaCarta(this.mesa.length);

        this.animacions.push(new AnimacionDesprazamento(
            this.assets, CW, CH, carta.valor,
            iaBarX, iaBarY, toPos.x, toPos.y,
            () => {
                this.xogarCarta(this.turnoActual, carta);
                this.reproducirSon(`son_dar${1 + Math.floor(Math.random() * 6)}`);
                this.avanzarTurno();
            }
        ));
    }

    escollerCartaIA(ia) {
        if (ia.dificultade === 'facil') {
            return Math.floor(Math.random() * ia.man.length);
        }

        // Medium/Hard: basic strategy
        const paloLider = this.mesa.length > 0 ? this.mesa[0].carta.palo() : -1;
        let bestIdx = 0, bestScore = -Infinity;

        for (let i = 0; i < ia.man.length; i++) {
            const c = ia.man[i];
            let score = 0;
            const isTriunfo = c.palo() === this.paloTriunfo;
            const isPaloLider = c.palo() === paloLider;

            if (this.mesa.length === 0) {
                // Leading: prefer low-value non-trump cards
                score = -this.briscaPuntos(c) * 2;
                if (isTriunfo) score -= 20;
            } else {
                // Would this card win?
                const tempMesa = [...this.mesa, { carta: c, xogador: this.turnoActual }];
                const ganaria = this.ganadorBazaTemp(tempMesa) === tempMesa.length - 1;
                const bazaPts = this.mesa.reduce((s, m) => s + this.briscaPuntos(m.carta), 0) + this.briscaPuntos(c);

                if (ganaria && bazaPts > 0) {
                    score = bazaPts * 3;
                    if (isTriunfo) score -= 10; // prefer not wasting trump
                } else if (!ganaria) {
                    // Throw lowest value
                    score = -this.briscaPuntos(c);
                    if (isTriunfo) score -= 30;
                }

                if (ia.dificultade === 'dificil') {
                    if (ganaria && bazaPts >= 10) score += 20;
                    if (!ganaria && this.briscaPuntos(c) === 0 && !isTriunfo) score += 5;
                }
            }
            if (score > bestScore) { bestScore = score; bestIdx = i; }
        }
        return bestIdx;
    }

    // Trick winner for temp mesa (returns index into the array)
    ganadorBazaTemp(mesa) {
        const paloLider = mesa[0].carta.palo();
        let mellor = 0;
        for (let i = 1; i < mesa.length; i++) {
            const c = mesa[i].carta;
            const m = mesa[mellor].carta;
            const cT = c.palo() === this.paloTriunfo;
            const mT = m.palo() === this.paloTriunfo;
            if (cT && !mT) mellor = i;
            else if (cT && mT && this.briscaRango(c) > this.briscaRango(m)) mellor = i;
            else if (!cT && !mT) {
                if (c.palo() === paloLider && m.palo() !== paloLider) mellor = i;
                else if (c.palo() === paloLider && m.palo() === paloLider &&
                         this.briscaRango(c) > this.briscaRango(m)) mellor = i;
            }
        }
        return mellor;
    }

    avanzarTurno() {
        if (this.mesa.length >= this.numXogadores) {
            // All played → resolve trick
            this.resolverBaza();
            return;
        }
        // Next player in trick
        this.turnoActual = (this.turnoActual + 1) % this.numXogadores;
        this.iniciarTurno();
    }

    // ═══════════════════════════════════════════
    //  POSITIONS
    // ═══════════════════════════════════════════

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

    posicionMesaCarta(idx) {
        const totalW = this.numXogadores * CW + (this.numXogadores - 1) * (GAP + 4);
        const sx = (CANVAS_W - totalW) / 2 + 10;
        return {
            x: sx + idx * (CW + GAP + 4),
            y: this.playAreaCenter - CH / 2
        };
    }

    // ═══════════════════════════════════════════
    //  DICE ROLL (reused from Escoba)
    // ═══════════════════════════════════════════

    actualizarDado(dt) {
        const d = this.dado;
        const nomes = ['Ti', ...this.ias.map(ia => ia.nome)];
        if (d.fase === 'tirando') {
            d.tempo += dt;
            const progress = Math.min(d.tempo / d.duracion, 1);
            d.intervalo -= dt;
            if (d.intervalo <= 0) {
                d.caraActual = 1 + Math.floor(Math.random() * 6);
                d.intervalo = 80 + progress * 200;
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
                d.spinnerIdx = (d.spinnerIdx + 1) % nomes.length;
                const remaining = d.spinnerPasos - d.spinnerFeitos;
                if (remaining <= 2) d.spinnerIntervalo = 400;
                else if (remaining <= 4) d.spinnerIntervalo = 300;
                if (d.spinnerFeitos >= d.spinnerPasos) { d.fase = 'fin'; d.pausaTempo = 1500; }
            }
        } else if (d.fase === 'fin') {
            d.pausaTempo -= dt;
            if (d.pausaTempo <= 0) {
                this.xogadorInicio = d.spinnerIdx;
                this.turnoActual = d.spinnerIdx;
                this.liderBaza = d.spinnerIdx;
                this.iniciarTurno();
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

        if (this.estado === ESTADO.TURNO_XOGADOR || this.estado === ESTADO.TURNO_IA) {
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
                this.actualizarHover(entrada);
                this.procesarEntrada(entrada);
                break;
            case ESTADO.TURNO_IA:
                this.director.canvas.style.cursor = 'default';
                this.executarIA(dt);
                break;
            case ESTADO.FIN_RONDA:
                this.director.canvas.style.cursor = 'default';
                if (this.finXogo) this.btnMenu.actualizar(entrada, dt);
                else this.btnContinuar.actualizar(entrada, dt);
                break;
        }
    }

    actualizarHover(entrada) {
        this.cartaHover = -1;
        const hp = this.posicionsMan(this.manXogador.length, Y_PLAYER_HAND);
        for (let i = 0; i < this.manXogador.length; i++) {
            const p = hp[i];
            if (entrada.x >= p.x && entrada.x < p.x + CW &&
                entrada.y >= p.y && entrada.y < p.y + CH) {
                this.cartaHover = i;
                break;
            }
        }
        this.director.canvas.style.cursor = this.cartaHover >= 0 ? 'pointer' : 'default';
    }

    // ═══════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════

    debuxar(ctx) {
        // Background
        ctx.fillStyle = '#1a3a2a';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        this.debuxarInfoIAs(ctx);
        this.debuxarMazo(ctx);
        this.debuxarMesaCartas(ctx);
        this.debuxarManXogador(ctx);
        this.debuxarInfoXogador(ctx);

        // Animations
        for (const anim of this.animacions) anim.debuxar(ctx);

        // Message
        if (this.tempMsg > 0) this.debuxarMsg(ctx);

        if (this.estado === ESTADO.DADO) this.debuxarDado(ctx);
        if (this.estado === ESTADO.FIN_RONDA) this.debuxarFinRonda(ctx);

        if (!this.pausado && (this.estado === ESTADO.TURNO_XOGADOR || this.estado === ESTADO.TURNO_IA)) {
            this.btnCog.debuxar(ctx);
        }

        if (this.pausado) this.debuxarPausa(ctx);
    }

    debuxarInfoIAs(ctx) {
        const SMALL_CW = 16, SMALL_CH = 25;
        const CORES_IA = ['#e03030', '#3070e0', '#30b040'];
        for (let i = 0; i < this.ias.length; i++) {
            const ia = this.ias[i];
            const y = i * (AI_BAR_H + 2);
            const isActive = this.estado === ESTADO.TURNO_IA && this.turnoActual - 1 === i;
            ctx.fillStyle = isActive ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)';
            ctx.fillRect(0, y, CANVAS_W, AI_BAR_H);
            ctx.strokeStyle = isActive ? '#FFD700' : CORES_IA[i];
            ctx.lineWidth = isActive ? 2 : 1;
            ctx.strokeRect(0, y, CANVAS_W, AI_BAR_H);

            ctx.fillStyle = '#e0e0e0';
            ctx.font = '9px Minipixel';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(
                `${ia.nome}: ${ia.puntos} pts | Bazas: ${ia.bazas.length}`,
                8, y + 17
            );

            const dorso = this.assets['dorso'];
            if (dorso) {
                const startX = CANVAS_W - 8 - ia.man.length * (SMALL_CW + 2);
                for (let j = 0; j < ia.man.length; j++) {
                    ctx.drawImage(dorso, startX + j * (SMALL_CW + 2), y + 2, SMALL_CW, SMALL_CH);
                }
            }
        }
    }

    debuxarMazo(ctx) {
        const r = this.mazoVisual != null ? this.mazoVisual : (this.baralla ? this.baralla.restantes() + (this.triunfo ? 1 : 0) : 0);
        const deckY = this.playAreaCenter - CH / 2;
        const deckX = 10;

        // Draw trump card face-up (rotated hint)
        if (this.triunfo) {
            const tImg = this.assets[this.triunfo.valor.toString()];
            if (tImg) {
                ctx.save();
                ctx.translate(deckX + CW / 2 + 20, deckY + CH / 2);
                ctx.rotate(Math.PI / 2);
                ctx.drawImage(tImg, -CW / 2, -CH / 2, CW, CH);
                ctx.restore();
            }
        }

        // Draw deck on top
        if (r > (this.triunfo ? 1 : 0)) {
            const dorso = this.assets['dorso'];
            if (dorso) {
                const stackCount = Math.min(r, 3);
                for (let i = 0; i < stackCount; i++) {
                    ctx.drawImage(dorso, deckX, deckY - i * 2, CW, CH);
                }
            }
        }

        // Count + Trump suit label
        ctx.fillStyle = 'white';
        ctx.font = '9px Minipixel';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        if (r > 0) ctx.fillText(`${r}`, deckX + CW / 2, deckY + CH + 12);
        ctx.fillStyle = '#ffd700';
        ctx.fillText(`${NOMES_PALO[this.paloTriunfo]}`, deckX + CW / 2, deckY + CH + 24);
    }

    debuxarMesaCartas(ctx) {
        for (let i = 0; i < this.mesa.length; i++) {
            const p = this.posicionMesaCarta(i);
            const c = this.mesa[i].carta;
            const img = this.assets[c.valor.toString()];
            if (img) ctx.drawImage(img, p.x, p.y, CW, CH);

            // Small label showing who played
            const nomes = ['Ti', ...this.ias.map(ia => ia.nome)];
            ctx.fillStyle = '#ccc';
            ctx.font = '8px Minipixel';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(nomes[this.mesa[i].xogador], p.x + CW / 2, p.y - 4);
        }
    }

    debuxarManXogador(ctx) {
        const pos = this.posicionsMan(this.manXogador.length, Y_PLAYER_HAND);
        for (let i = 0; i < this.manXogador.length; i++) {
            const p = pos[i];
            const yo = (i === this.cartaHover && this.estado === ESTADO.TURNO_XOGADOR) ? -8 : 0;

            if (i === this.cartaHover && this.estado === ESTADO.TURNO_XOGADOR) {
                ctx.fillStyle = 'rgba(255,255,255,0.15)';
                ctx.fillRect(p.x - 2, p.y + yo - 2, CW + 4, CH + 4);
            }

            const img = this.assets[this.manXogador[i].valor.toString()];
            if (img) ctx.drawImage(img, p.x, p.y + yo, CW, CH);
        }
    }

    debuxarInfoXogador(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, Y_PLAYER_INFO, CANVAS_W, 24);
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '9px Minipixel';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(
            `Ti: ${this.puntosXogador} pts | Bazas: ${this.bazasXogador.length} | Ronda ${this.ronda}`,
            8, Y_PLAYER_INFO + 13
        );
    }

    debuxarMsg(ctx) {
        ctx.font = '12px Minipixel';
        const textW = ctx.measureText(this.mensaxe).width;
        const w = Math.max(220, textW + 40), h = 34;
        const x = (CANVAS_W - w) / 2;
        const y = this.playAreaCenter - h / 2 + CH / 2 + 20;

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
        const nomes = ['Ti', ...this.ias.map(ia => ia.nome)];

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
        ctx.fillText('Quen empeza?', popX + popW / 2, popY + 10);

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
            for (let i = 0; i < nomes.length; i++) {
                const ny = listY + i * lineH;
                if (i === d.spinnerIdx) {
                    ctx.fillStyle = '#ffd700';
                    ctx.fillRect(popX + 20, ny - 1, popW - 40, lineH);
                    ctx.fillStyle = '#222';
                } else {
                    ctx.fillStyle = '#aaa';
                }
                ctx.fillText(nomes[i], popX + popW / 2, ny + 1);
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
        ctx.fillText(this.finXogo ? 'Fin do xogo' : 'Fin da ronda', CANVAS_W / 2, CANVAS_H / 2 - 60);

        ctx.font = '11px Minipixel';
        const d = this.detallesPuntos;
        const nomes = ['Ti', ...this.ias.map(ia => ia.nome)];
        const scores = [d.xogador, ...d.ias];
        let y = CANVAS_H / 2 - 30;
        for (let i = 0; i < scores.length; i++) {
            ctx.fillStyle = 'white';
            ctx.fillText(`${nomes[i]}: ${scores[i]} / 120`, CANVAS_W / 2, y);
            y += 20;
        }

        ctx.fillStyle = '#ffd700';
        ctx.font = '12px Minipixel';
        y += 10;
        let scoreText = `Ti ${this.puntosXogador}`;
        for (const ia of this.ias) scoreText += ` - ${ia.nome} ${ia.puntos}`;
        ctx.fillText(scoreText, CANVAS_W / 2, y);

        if (this.finXogo) this.btnMenu.debuxar(ctx);
        else this.btnContinuar.debuxar(ctx);
    }
}
