import Escena from '../Escena.js';
import Baralla from '../Baralla.js';
import Boton from '../utiles/Boton.js';

const CW = 48, CH = 76, GAP = 6;
const CANVAS_W = 380, CANVAS_H = 600;
const Y_PLAYER_INFO = CANVAS_H - 24;
const Y_PLAYER_HAND = Y_PLAYER_INFO - CH - 6;
const Y_BUTTONS = Y_PLAYER_HAND - 40;

const CORES_EQUIPO = ['#4488ff', '#ff6644'];

// Card effective rank: 3→King, 2→Ace
// puntos(): As=1, 2=2, 3=3, 4=4, 5=5, 6=6, 7=7, Sota=8, Caballo=9, Rey=10
function efRango(carta) {
    const p = carta.puntos();
    if (p === 3) return 10; // 3 acts as King
    if (p === 2) return 1;  // 2 acts as Ace
    return p;
}
function efValor(carta) {
    // Point value for Juego counting
    const r = efRango(carta);
    if (r >= 8) return 10; // Sota, Caballo, Rey (and 3 as King)
    if (r === 1) return 1; // Ace (and 2 as Ace)
    return r;
}

// Compare two hands for Grande (highest wins) or Chica (lowest wins)
// Returns -1 if a < b, 0 if equal, 1 if a > b
function compararMans(a, b, grande) {
    const ra = a.map(efRango).sort((x, y) => grande ? y - x : x - y);
    const rb = b.map(efRango).sort((x, y) => grande ? y - x : x - y);
    for (let i = 0; i < 4; i++) {
        if (ra[i] !== rb[i]) return grande ? (ra[i] > rb[i] ? 1 : -1) : (ra[i] < rb[i] ? 1 : -1);
    }
    return 0;
}

// Analyze pairs in a hand
function analizarPares(man) {
    const ranks = man.map(efRango);
    const counts = {};
    for (const r of ranks) counts[r] = (counts[r] || 0) + 1;
    const pairs = Object.entries(counts).filter(([, c]) => c >= 2).map(([r, c]) => ({ rank: parseInt(r), count: c }));

    if (pairs.length === 0) return { tipo: 0, label: 'Nada' };

    const totalPaired = pairs.reduce((s, p) => s + (p.count >= 2 ? 1 : 0), 0);
    const hasThree = pairs.some(p => p.count >= 3);
    const hasFour = pairs.some(p => p.count >= 4);
    const hasTwoPairs = totalPaired >= 2;

    if (hasFour || hasTwoPairs) return { tipo: 3, label: 'Duples', pairs };
    if (hasThree) return { tipo: 2, label: 'Medias', pairs };
    return { tipo: 1, label: 'Par', pairs };
}

// Juego score
function calcularJuego(man) {
    return man.reduce((s, c) => s + efValor(c), 0);
}

// Juego hierarchy: 31 best, then 32, 40, 39, ..., 33
const JUEGO_ORDEN = [31, 32, 40, 39, 38, 37, 36, 35, 34, 33];

const ESTADO = {
    MUS_FASE: 0,
    DESCARTE: 1,
    LANCE_GRANDE: 2,
    LANCE_CHICA: 3,
    LANCE_PARES: 4,
    LANCE_JUEGO: 5,
    REVELAR: 6,
    FIN_RONDA: 7,
    FIN_XOGO: 8,
};

const LANCE_NOMES = ['', '', 'Grande', 'Chica', 'Pares', 'Juego/Punto'];

export default class Mus extends Escena {
    constructor(director, config = {}) {
        super(director);
        this.assets = director.assets;
        this.victoriasMeta = config.victoriasMeta || 5;

        this.numXogadores = 4;
        this.nomes = ['Ti', 'IA 1', 'IA 2', 'IA 3'];
        const difs = config.dificultades || ['medio', 'medio', 'medio'];
        this.dificultades = ['humano', ...difs];

        // Teams: 0+2 vs 1+3 (sitting opposite)
        this.equipos = [0, 1, 0, 1];
        this.puntos = [0, 0]; // game points per team
        this.vitoriasEquipo = [0, 0];
        this.ronda = 0;

        // Per-round
        this.mans = [];
        this.apuestas = []; // [{lance, equipo, pts}]
        this.lanceActual = ESTADO.LANCE_GRANDE;
        this.mao = 0; // dealer index

        // Bidding state
        this.envite = 0;
        this.enviteEquipo = -1;
        this.enviteAberto = false;

        // Discard state
        this.descarteSel = new Set();

        // UI
        this.estado = ESTADO.MUS_FASE;
        this.mensaxe = '';
        this.tempMsg = 0;
        this.msgEnRemate = null;
        this.animacions = [];
        this.estaAnimando = false;
        this.pausado = false;
        this._voltandoDePausa = false;
        this.cartaHover = -1;
        this.tempIA = 0;

        // Buttons
        const bw = 68, bh = 24;
        this.btnMus = new Boton(
            CANVAS_W / 2 - bw - 4, Y_BUTTONS, bw, bh,
            ['#2a7a2a', '#3a9a3a', '#1a5a1a'], [], 'Mus',
            () => this.xogadorMus(),
            { tamanhoTexto: 10, corTexto: 'white' }
        );
        this.btnNoMus = new Boton(
            CANVAS_W / 2 + 4, Y_BUTTONS, bw, bh,
            ['#7a2a2a', '#9a3a3a', '#5a1a1a'], [], 'No Mus',
            () => this.xogadorNoMus(),
            { tamanhoTexto: 10, corTexto: 'white' }
        );
        this.btnDescartar = new Boton(
            CANVAS_W / 2 - 40, Y_BUTTONS, 80, bh,
            ['#2a7a2a', '#3a9a3a', '#1a5a1a'], [], 'Descartar',
            () => this.xogadorDescartar(),
            { tamanhoTexto: 9, corTexto: 'white' }
        );

        // Bidding buttons
        this.btnPaso = new Boton(
            CANVAS_W / 2 - 100, Y_BUTTONS, 60, bh,
            ['#555', '#777', '#333'], [], 'Paso',
            () => this.xogadorPaso(),
            { tamanhoTexto: 9, corTexto: 'white' }
        );
        this.btnEnvido = new Boton(
            CANVAS_W / 2 - 30, Y_BUTTONS, 60, bh,
            ['#2a7a2a', '#3a9a3a', '#1a5a1a'], [], 'Envido',
            () => this.xogadorEnvido(2),
            { tamanhoTexto: 9, corTexto: 'white' }
        );
        this.btnOrdago = new Boton(
            CANVAS_W / 2 + 40, Y_BUTTONS, 60, bh,
            ['#7a2a2a', '#9a3a3a', '#5a1a1a'], [], 'Ordago',
            () => this.xogadorOrdago(),
            { tamanhoTexto: 9, corTexto: 'white' }
        );
        this.btnVer = new Boton(
            CANVAS_W / 2 - 65, Y_BUTTONS, 60, bh,
            ['#2a7a2a', '#3a9a3a', '#1a5a1a'], [], 'Ver',
            () => this.xogadorVer(),
            { tamanhoTexto: 9, corTexto: 'white' }
        );
        this.btnNoQuero = new Boton(
            CANVAS_W / 2 + 5, Y_BUTTONS, 60, bh,
            ['#7a2a2a', '#9a3a3a', '#5a1a1a'], [], 'No quero',
            () => this.xogadorNoQuero(),
            { tamanhoTexto: 8, corTexto: 'white' }
        );

        // Cog / pause
        const cogSize = 24;
        this.btnCog = new Boton(
            6, 4, cogSize, cogSize,
            ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.6)'],
            [], '\u2699', () => { this.pausado = true; },
            { corTexto: '#fff', tamanhoTexto: 16 }
        );
        const popupW = 180, popupH = 120;
        const popupX = CANVAS_W / 2 - popupW / 2;
        const popupY = CANVAS_H / 2 - popupH / 2;
        this.popupPausa = { x: popupX, y: popupY, w: popupW, h: popupH };
        const pbw = 140, pbh2 = 28, pbx = popupX + (popupW - pbw) / 2;
        this.btnResumir = new Boton(
            pbx, popupY + 45, pbw, pbh2,
            ['#2a7a2a', '#3a9a3a', '#1a5a1a'], [], 'Continuar',
            () => { this.pausado = false; this._voltandoDePausa = true; },
            { corTexto: '#fff', tamanhoTexto: 12 }
        );
        this.btnVolverMenu = new Boton(
            pbx, popupY + 82, pbw, pbh2,
            ['#7a2a2a', '#9a3a3a', '#5a1a1a'], [], 'Volver ao menu',
            () => { import('./Menu.js').then(m => this.director.cambiarEscena(new m.default(this.director))); },
            { corTexto: '#fff', tamanhoTexto: 10 }
        );
        this.btnContinuar = new Boton(
            CANVAS_W / 2 - 55, CANVAS_H / 2 + 100, 110, 32,
            ['#2a2a7a', '#3a3a9a', '#1a1a5a'], [], 'Continuar',
            () => this.iniciarRonda()
        );
        this.btnMenuFin = new Boton(
            CANVAS_W / 2 - 55, CANVAS_H / 2 + 100, 110, 32,
            ['#2a2a7a', '#3a3a9a', '#1a1a5a'], [], 'Menu',
            () => { import('./Menu.js').then(m => this.director.cambiarEscena(new m.default(this.director))); }
        );

        this.iniciarRonda();
    }

    // ═══════════════════════════════════════════
    //  GAME FLOW
    // ═══════════════════════════════════════════

    iniciarRonda() {
        this.ronda++;
        this.baralla = new Baralla();
        this.mans = [];
        this.apuestas = [];
        this.lanceActual = ESTADO.LANCE_GRANDE;
        this.envite = 0;
        this.enviteEquipo = -1;
        this.enviteAberto = false;

        for (let i = 0; i < 4; i++) this.mans.push(this.baralla.repartir(4));
        for (const m of this.mans) m.sort((a, b) => efRango(a) - efRango(b));

        this.reproducirSon('son_barallar');
        this.estado = ESTADO.MUS_FASE;
        this.musVotos = [null, null, null, null]; // null=undecided, true=mus, false=no mus
        this.musRondas = 0;
        this.mostrarMsg('Fase de Mus', 1000, () => this.procesarMusFase());
    }

    procesarMusFase() {
        this.estado = ESTADO.MUS_FASE;
        this.musVotos = [null, null, null, null];
        // IAs decide first, then player
        for (let i = 1; i < 4; i++) {
            this.musVotos[i] = this.iaDecideMus(i);
        }
        // Check if any IA said no
        if (this.musVotos.some(v => v === false)) {
            const noIdx = this.musVotos.findIndex(v => v === false);
            this.mostrarMsg(`${this.nomes[noIdx]}: No mus!`, 1200, () => this.empezarLances());
            return;
        }
        // All IAs want mus, ask player
        this.mostrarMsg('Todos queren mus. Ti?', 800);
    }

    xogadorMus() {
        if (this.estado !== ESTADO.MUS_FASE) return;
        this.musRondas++;
        // Everyone discards
        this.estado = ESTADO.DESCARTE;
        this.descarteSel.clear();
        this.mostrarMsg('Selecciona cartas para descartar', 800);
    }

    xogadorNoMus() {
        if (this.estado !== ESTADO.MUS_FASE) return;
        this.empezarLances();
    }

    xogadorDescartar() {
        if (this.estado !== ESTADO.DESCARTE) return;
        // Discard selected cards and draw replacements
        const indices = Array.from(this.descarteSel).sort((a, b) => b - a);
        for (const i of indices) this.mans[0].splice(i, 1);
        const need = 4 - this.mans[0].length;
        if (need > 0) {
            const drawn = this.baralla.repartir(need);
            this.mans[0].push(...drawn);
        }
        this.mans[0].sort((a, b) => efRango(a) - efRango(b));

        // IAs discard too
        for (let i = 1; i < 4; i++) this.iaDescartar(i);

        this.descarteSel.clear();
        this.reproducirSon(`son_dar${1 + Math.floor(Math.random() * 6)}`);

        // Back to mus phase
        this.procesarMusFase();
    }

    iaDecideMus(idx) {
        const man = this.mans[idx];
        const ranks = man.map(efRango);
        // Simple: want mus if hand is weak (few high cards and few low cards)
        const kings = ranks.filter(r => r === 10).length;
        const aces = ranks.filter(r => r === 1).length;
        if (kings >= 3 || aces >= 3) return false; // good hand, no mus
        const pairs = analizarPares(man);
        if (pairs.tipo >= 2) return false;
        return Math.random() > 0.3;
    }

    iaDescartar(idx) {
        const man = this.mans[idx];
        // Simple strategy: keep kings, aces, and pairs; discard middle cards
        const ranks = man.map(efRango);
        const counts = {};
        for (const r of ranks) counts[r] = (counts[r] || 0) + 1;

        const toDiscard = [];
        for (let i = 0; i < man.length && toDiscard.length < 2; i++) {
            const r = efRango(man[i]);
            if (r !== 10 && r !== 1 && counts[r] < 2) {
                toDiscard.push(i);
            }
        }
        for (const i of toDiscard.sort((a, b) => b - a)) this.mans[idx].splice(i, 1);
        const need = 4 - this.mans[idx].length;
        if (need > 0) this.mans[idx].push(...this.baralla.repartir(need));
        this.mans[idx].sort((a, b) => efRango(a) - efRango(b));
    }

    // ═══════════════════════════════════════════
    //  LANCES (BETTING ROUNDS)
    // ═══════════════════════════════════════════

    empezarLances() {
        this.lanceActual = ESTADO.LANCE_GRANDE;
        this.iniciarLance();
    }

    iniciarLance() {
        this.envite = 0;
        this.enviteEquipo = -1;
        this.enviteAberto = false;

        const nome = LANCE_NOMES[this.lanceActual] || '?';

        // For Pares: check if anyone has pairs
        if (this.lanceActual === ESTADO.LANCE_PARES) {
            const eq0Pares = this.mans[0].concat(this.mans[2]).some((_, __, arr) => {
                return analizarPares(this.mans[0]).tipo > 0 || analizarPares(this.mans[2]).tipo > 0;
            });
            const eq1Pares = analizarPares(this.mans[1]).tipo > 0 || analizarPares(this.mans[3]).tipo > 0;
            if (!eq0Pares && !eq1Pares) {
                this.mostrarMsg('Pares: ninguén ten', 1000, () => this.seguinteLance());
                return;
            }
        }

        // For Juego: check if anyone has 31+
        if (this.lanceActual === ESTADO.LANCE_JUEGO) {
            const anyJuego = this.mans.some(m => calcularJuego(m) >= 31);
            if (!anyJuego) {
                // Play Punto instead (closest to 30)
                this.mostrarMsg('Punto (ninguén ten Juego)', 1000, () => {
                    this.resolverPunto();
                    this.seguinteLance();
                });
                return;
            }
        }

        this.mostrarMsg(nome, 1000, () => {
            // IA teams bid first (simplified: team 1 acts, then team 0 responds)
            this.iaLanceBid();
        });
    }

    iaLanceBid() {
        // Simplified bidding: IA team 1 decides to envido or paso
        const strength1 = this.evaluarLance(1, this.lanceActual);
        const strength0 = this.evaluarLance(0, this.lanceActual);

        if (strength1 > 0.6) {
            // IA team bids
            this.envite = 2;
            this.enviteEquipo = 1;
            this.enviteAberto = true;
            this.mostrarMsg(`${this.nomes[1]}: Envido!`, 1000, () => {
                // Player's team responds
                this.estado = this.lanceActual;
                // Show Ver/NoQuero buttons
            });
        } else {
            // IA passes, player's turn to bid
            this.estado = this.lanceActual;
            // Player can Paso or Envido
        }
    }

    evaluarLance(equipo, lance) {
        const m0 = this.mans[equipo === 0 ? 0 : 1];
        const m1 = this.mans[equipo === 0 ? 2 : 3];

        if (lance === ESTADO.LANCE_GRANDE) {
            const best = compararMans(m0, m1, true) >= 0 ? m0 : m1;
            const kings = best.map(efRango).filter(r => r === 10).length;
            return kings / 4;
        }
        if (lance === ESTADO.LANCE_CHICA) {
            const best = compararMans(m0, m1, false) >= 0 ? m0 : m1;
            const aces = best.map(efRango).filter(r => r === 1).length;
            return aces / 4;
        }
        if (lance === ESTADO.LANCE_PARES) {
            const p0 = analizarPares(m0);
            const p1 = analizarPares(m1);
            return Math.max(p0.tipo, p1.tipo) / 3;
        }
        if (lance === ESTADO.LANCE_JUEGO) {
            const j0 = calcularJuego(m0);
            const j1 = calcularJuego(m1);
            const best = Math.max(j0, j1);
            return best >= 31 ? (best === 31 ? 1 : 0.7) : 0;
        }
        return 0.5;
    }

    xogadorPaso() {
        if (!this.isLanceEstado()) return;
        if (this.enviteAberto && this.enviteEquipo !== 0) {
            // Declining opponent's bet
            this.xogadorNoQuero();
            return;
        }
        // Both teams pass: resolve lance with 1 point to winner
        this.apuestas.push({ lance: this.lanceActual, equipo: -1, pts: 1 });
        this.seguinteLance();
    }

    xogadorEnvido(pts) {
        if (!this.isLanceEstado()) return;
        this.envite = pts;
        this.enviteEquipo = 0;
        this.enviteAberto = true;

        // IA responds
        const strength = this.evaluarLance(1, this.lanceActual);
        if (strength > 0.5) {
            this.mostrarMsg(`${this.nomes[1]}: Ver!`, 1000, () => {
                this.apuestas.push({ lance: this.lanceActual, equipo: -1, pts: this.envite });
                this.seguinteLance();
            });
        } else {
            this.mostrarMsg(`${this.nomes[1]}: No quero`, 1000, () => {
                this.puntos[0] += 1;
                this.seguinteLance();
            });
        }
    }

    xogadorOrdago() {
        if (!this.isLanceEstado()) return;
        this.mostrarMsg('Ordago!', 1000, () => {
            const strength = this.evaluarLance(1, this.lanceActual);
            if (strength > 0.7) {
                this.mostrarMsg(`${this.nomes[1]}: Ver ordago!`, 1500, () => {
                    this.resolverOrdago();
                });
            } else {
                this.mostrarMsg(`${this.nomes[1]}: No quero`, 1000, () => {
                    this.puntos[0] += this.envite > 0 ? this.envite : 1;
                    this.seguinteLance();
                });
            }
        });
    }

    xogadorVer() {
        if (!this.isLanceEstado() || !this.enviteAberto) return;
        this.apuestas.push({ lance: this.lanceActual, equipo: -1, pts: this.envite });
        this.seguinteLance();
    }

    xogadorNoQuero() {
        if (!this.isLanceEstado() || !this.enviteAberto) return;
        // Opponent wins 1 point (or previous bet value)
        this.puntos[this.enviteEquipo] += 1;
        this.seguinteLance();
    }

    isLanceEstado() {
        return this.estado >= ESTADO.LANCE_GRANDE && this.estado <= ESTADO.LANCE_JUEGO;
    }

    seguinteLance() {
        if (this.puntos[0] >= 40 || this.puntos[1] >= 40) {
            this.finalizarRonda();
            return;
        }

        if (this.lanceActual < ESTADO.LANCE_JUEGO) {
            this.lanceActual++;
            this.iniciarLance();
        } else {
            // All lances done, reveal and score
            this.resolverTodo();
        }
    }

    resolverOrdago() {
        const ganador = this.resolverLanceGanador(this.lanceActual);
        this.puntos[ganador] = 40; // instant win
        this.finalizarRonda();
    }

    resolverPunto() {
        // Closest to 30 without going over
        let best = [-1, 0]; // [equipo, score]
        for (let eq = 0; eq < 2; eq++) {
            const m0 = this.mans[eq === 0 ? 0 : 1];
            const m1 = this.mans[eq === 0 ? 2 : 3];
            const s = Math.max(calcularJuego(m0), calcularJuego(m1));
            if (s <= 30 && s > best[1]) best = [eq, s];
        }
        if (best[0] >= 0) this.puntos[best[0]] += 1;
    }

    resolverLanceGanador(lance) {
        // Returns team index that wins the lance
        if (lance === ESTADO.LANCE_GRANDE) {
            const a = compararMans(this.mans[0], this.mans[1], true) >= 0 ? this.mans[0] : this.mans[2];
            const b = compararMans(this.mans[1], this.mans[3], true) >= 0 ? this.mans[1] : this.mans[3];
            const bestA = compararMans(this.mans[0], this.mans[2], true) >= 0 ? this.mans[0] : this.mans[2];
            const bestB = compararMans(this.mans[1], this.mans[3], true) >= 0 ? this.mans[1] : this.mans[3];
            return compararMans(bestA, bestB, true) >= 0 ? 0 : 1;
        }
        if (lance === ESTADO.LANCE_CHICA) {
            const bestA = compararMans(this.mans[0], this.mans[2], false) >= 0 ? this.mans[0] : this.mans[2];
            const bestB = compararMans(this.mans[1], this.mans[3], false) >= 0 ? this.mans[1] : this.mans[3];
            return compararMans(bestA, bestB, false) >= 0 ? 0 : 1;
        }
        if (lance === ESTADO.LANCE_PARES) {
            const pA = Math.max(analizarPares(this.mans[0]).tipo, analizarPares(this.mans[2]).tipo);
            const pB = Math.max(analizarPares(this.mans[1]).tipo, analizarPares(this.mans[3]).tipo);
            return pA >= pB ? 0 : 1;
        }
        if (lance === ESTADO.LANCE_JUEGO) {
            const jA = Math.max(calcularJuego(this.mans[0]), calcularJuego(this.mans[2]));
            const jB = Math.max(calcularJuego(this.mans[1]), calcularJuego(this.mans[3]));
            const idxA = JUEGO_ORDEN.indexOf(jA);
            const idxB = JUEGO_ORDEN.indexOf(jB);
            if (idxA >= 0 && idxB >= 0) return idxA <= idxB ? 0 : 1;
            if (idxA >= 0) return 0;
            if (idxB >= 0) return 1;
            return jA >= jB ? 0 : 1;
        }
        return 0;
    }

    resolverTodo() {
        // Award points for each accepted bet
        for (const a of this.apuestas) {
            const ganador = this.resolverLanceGanador(a.lance);
            this.puntos[ganador] += a.pts;
        }

        // Bonus Pares points
        for (let eq = 0; eq < 2; eq++) {
            const i0 = eq === 0 ? 0 : 1;
            const i1 = eq === 0 ? 2 : 3;
            const p0 = analizarPares(this.mans[i0]);
            const p1 = analizarPares(this.mans[i1]);
            if (p0.tipo === 3 || p1.tipo === 3) this.puntos[eq] += 3;
            else if (p0.tipo === 2 || p1.tipo === 2) this.puntos[eq] += 2;
            else if (p0.tipo === 1 || p1.tipo === 1) this.puntos[eq] += 1;
        }

        this.finalizarRonda();
    }

    finalizarRonda() {
        if (this.puntos[0] >= 40) this.vitoriasEquipo[0]++;
        else if (this.puntos[1] >= 40) this.vitoriasEquipo[1]++;
        else {
            // Nobody reached 40 yet in this game — continue
            // Actually in mus, a "game" goes to 40 points across multiple rounds
            // Points persist between rounds within a game
            this.estado = ESTADO.FIN_RONDA;
            return;
        }

        this.detalles = { puntos: [...this.puntos] };
        this.puntos = [0, 0];

        if (this.vitoriasEquipo[0] >= this.victoriasMeta || this.vitoriasEquipo[1] >= this.victoriasMeta) {
            this.estado = ESTADO.FIN_XOGO;
        } else {
            this.estado = ESTADO.FIN_RONDA;
        }
    }

    // ═══════════════════════════════════════════
    //  POSITIONS
    // ═══════════════════════════════════════════

    posicionsMan(n) {
        if (n === 0) return [];
        const totalW = n * CW + (n - 1) * GAP;
        const sx = (CANVAS_W - totalW) / 2;
        const pos = [];
        for (let i = 0; i < n; i++) pos.push({ x: sx + i * (CW + GAP), y: Y_PLAYER_HAND });
        return pos;
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

        if (this.estado !== ESTADO.FIN_RONDA && this.estado !== ESTADO.FIN_XOGO) {
            if (this.btnCog.actualizar(entrada, dt)) return;
        }

        if (this.tempMsg > 0) {
            this.tempMsg -= dt;
            if (this.tempMsg <= 0) {
                this.tempMsg = 0;
                if (this.msgEnRemate) {
                    const cb = this.msgEnRemate; this.msgEnRemate = null; cb(); return;
                }
            }
        }
        if (this.animacions.length > 0) {
            for (let i = this.animacions.length - 1; i >= 0; i--) {
                this.animacions[i].actualizar(null, dt);
                if (this.animacions[i].completada) this.animacions.splice(i, 1);
            }
            return;
        }
        if (this.msgEnRemate) return;

        switch (this.estado) {
            case ESTADO.MUS_FASE:
                this.btnMus.actualizar(entrada, dt);
                this.btnNoMus.actualizar(entrada, dt);
                break;
            case ESTADO.DESCARTE:
                this.btnDescartar.actualizar(entrada, dt);
                this.actualizarSeleccion(entrada);
                break;
            case ESTADO.LANCE_GRANDE:
            case ESTADO.LANCE_CHICA:
            case ESTADO.LANCE_PARES:
            case ESTADO.LANCE_JUEGO:
                if (this.enviteAberto && this.enviteEquipo !== 0) {
                    this.btnVer.actualizar(entrada, dt);
                    this.btnNoQuero.actualizar(entrada, dt);
                } else {
                    this.btnPaso.actualizar(entrada, dt);
                    this.btnEnvido.actualizar(entrada, dt);
                    this.btnOrdago.actualizar(entrada, dt);
                }
                break;
            case ESTADO.FIN_RONDA:
                this.btnContinuar.actualizar(entrada, dt);
                break;
            case ESTADO.FIN_XOGO:
                this.btnMenuFin.actualizar(entrada, dt);
                break;
        }
    }

    actualizarSeleccion(entrada) {
        if (!entrada.clicado) return;
        const hp = this.posicionsMan(this.mans[0].length);
        for (let i = 0; i < this.mans[0].length; i++) {
            const p = hp[i];
            if (entrada.x >= p.x && entrada.x < p.x + CW &&
                entrada.y >= p.y && entrada.y < p.y + CH) {
                if (this.descarteSel.has(i)) this.descarteSel.delete(i);
                else this.descarteSel.add(i);
                return;
            }
        }
    }

    // ═══════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════

    debuxar(ctx) {
        ctx.fillStyle = '#2a2a1a';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        this.debuxarInfoEquipos(ctx);
        this.debuxarManXogador(ctx);
        this.debuxarInfoXogador(ctx);
        this.debuxarControles(ctx);

        if (this.tempMsg > 0) this.debuxarMsg(ctx);
        if (this.estado === ESTADO.FIN_RONDA || this.estado === ESTADO.FIN_XOGO) this.debuxarFin(ctx);

        if (!this.pausado && this.estado !== ESTADO.FIN_RONDA && this.estado !== ESTADO.FIN_XOGO) {
            this.btnCog.debuxar(ctx);
        }
        if (this.pausado) this.debuxarPausa(ctx);
    }

    debuxarInfoEquipos(ctx) {
        ctx.font = '9px Minipixel';
        ctx.textBaseline = 'alphabetic';

        ctx.fillStyle = CORES_EQUIPO[0];
        ctx.textAlign = 'left';
        ctx.fillText(`Eq.A (Ti+${this.nomes[2]}): ${this.puntos[0]}pts [${this.vitoriasEquipo[0]}]`, 36, 14);

        ctx.fillStyle = CORES_EQUIPO[1];
        ctx.textAlign = 'right';
        ctx.fillText(`Eq.B (${this.nomes[1]}+${this.nomes[3]}): ${this.puntos[1]}pts [${this.vitoriasEquipo[1]}]`, CANVAS_W - 8, 14);

        // Lance indicator
        if (this.isLanceEstado()) {
            ctx.fillStyle = '#ffd700';
            ctx.textAlign = 'center';
            ctx.fillText(`Lance: ${LANCE_NOMES[this.lanceActual]}`, CANVAS_W / 2, 30);
        }

        // IA hand sizes
        ctx.font = '8px Minipixel';
        for (let i = 1; i < 4; i++) {
            const eq = this.equipos[i];
            ctx.fillStyle = CORES_EQUIPO[eq];
            const positions = [null, { x: CANVAS_W - 8, a: 'right' }, { x: CANVAS_W / 2, a: 'center' }, { x: 8, a: 'left' }];
            ctx.textAlign = positions[i].a;
            ctx.fillText(`${this.nomes[i]}: ${this.mans[i]?.length || 0}`, positions[i].x, 44);
        }
    }

    debuxarManXogador(ctx) {
        const man = this.mans[0];
        if (!man) return;
        const hp = this.posicionsMan(man.length);

        for (let i = 0; i < man.length; i++) {
            const p = hp[i];
            const sel = this.descarteSel.has(i);
            const yo = sel ? -10 : 0;

            const img = this.assets[man[i].valor.toString()];
            if (img) ctx.drawImage(img, p.x, p.y + yo, CW, CH);

            if (sel) {
                ctx.strokeStyle = '#ff4444';
                ctx.lineWidth = 2;
                ctx.strokeRect(p.x - 1, p.y + yo - 1, CW + 2, CH + 2);
            }
        }

        // Show hand analysis below cards
        if (man.length === 4) {
            const juego = calcularJuego(man);
            const pares = analizarPares(man);
            ctx.fillStyle = '#aaa';
            ctx.font = '8px Minipixel';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            let info = `Valor: ${juego}`;
            if (pares.tipo > 0) info += ` | ${pares.label}`;
            if (juego >= 31) info += ' | Juego!';
            ctx.fillText(info, CANVAS_W / 2, Y_PLAYER_HAND + CH + 12);
        }
    }

    debuxarInfoXogador(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, Y_PLAYER_INFO, CANVAS_W, 24);
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '9px Minipixel';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(`Ti (Eq.A) | Comp: ${this.nomes[2]} | Ronda ${this.ronda}`, 8, Y_PLAYER_INFO + 13);
    }

    debuxarControles(ctx) {
        if (this.estado === ESTADO.MUS_FASE) {
            this.btnMus.debuxar(ctx);
            this.btnNoMus.debuxar(ctx);
        } else if (this.estado === ESTADO.DESCARTE) {
            this.btnDescartar.debuxar(ctx);
            ctx.fillStyle = '#ccc';
            ctx.font = '9px Minipixel';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText('Clic nas cartas para descartar', CANVAS_W / 2, Y_BUTTONS - 8);
        } else if (this.isLanceEstado()) {
            if (this.enviteAberto && this.enviteEquipo !== 0) {
                ctx.fillStyle = '#ccc';
                ctx.font = '9px Minipixel';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'alphabetic';
                ctx.fillText(`Envido de ${this.envite}. Aceptas?`, CANVAS_W / 2, Y_BUTTONS - 8);
                this.btnVer.debuxar(ctx);
                this.btnNoQuero.debuxar(ctx);
            } else {
                this.btnPaso.debuxar(ctx);
                this.btnEnvido.debuxar(ctx);
                this.btnOrdago.debuxar(ctx);
            }
        }
    }

    debuxarMsg(ctx) {
        ctx.font = '12px Minipixel';
        const textW = ctx.measureText(this.mensaxe).width;
        const w = Math.max(220, textW + 40), h = 34;
        const x = (CANVAS_W - w) / 2, y = 160;

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

    debuxarFin(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        const isEnd = this.estado === ESTADO.FIN_XOGO;
        const popW = 240, popH = isEnd ? 130 : 110;
        const popX = CANVAS_W / 2 - popW / 2;
        const popY = CANVAS_H / 2 - popH / 2 - 10;

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(popX + 3, popY + 3, popW, popH);
        ctx.fillStyle = '#222';
        ctx.fillRect(popX, popY, popW, popH);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.strokeRect(popX, popY, popW, popH);

        ctx.fillStyle = '#ffd700';
        ctx.font = '14px Minipixel';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        if (isEnd) {
            const ganador = this.vitoriasEquipo[0] >= this.victoriasMeta ? 0 : 1;
            ctx.fillText(ganador === 0 ? 'Gañaches!' : 'Perdiches!', popX + popW / 2, popY + 12);
        } else {
            ctx.fillText('Fin da ronda', popX + popW / 2, popY + 12);
        }

        ctx.font = '10px Minipixel';
        ctx.fillStyle = '#ccc';
        ctx.fillText(`Eq.A: ${this.puntos[0]} pts | Eq.B: ${this.puntos[1]} pts`, popX + popW / 2, popY + 36);
        ctx.fillText(`Victorias: A=${this.vitoriasEquipo[0]} B=${this.vitoriasEquipo[1]}`, popX + popW / 2, popY + 54);

        ctx.textBaseline = 'alphabetic';

        if (isEnd) {
            this.btnMenuFin.y = popY + popH - 38;
            this.btnMenuFin.debuxar(ctx);
        } else {
            this.btnContinuar.y = popY + popH - 38;
            this.btnContinuar.debuxar(ctx);
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
}
