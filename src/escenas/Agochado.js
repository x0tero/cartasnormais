import Escena from '../Escena.js';
import Baralla from '../Baralla.js';
import Boton from '../utiles/Boton.js';
import AnimacionDesprazamento from '../utiles/animacions/AnimacionDesprazamento.js';

// ── DISPLAY CONSTANTS ──
const CW = 48, CH = 76, GAP = 4;
const CANVAS_W = 380, CANVAS_H = 600;

const BARALLA_X = 80, REVELADA_X = 166, DESCARTE_X = 252, PILE_Y = 200;

// Layout bottom-up: info bar → cards → buttons → instruction text
const Y_PLAYER_INFO = CANVAS_H - 24;          // 576
const Y_PLAYER_SLOTS = Y_PLAYER_INFO - CH - 4; // 496  (cards: 496-572)
const Y_BUTTONS = Y_PLAYER_SLOTS - 32;         // 464  (buttons)
const Y_TEXT = Y_BUTTONS - 14;                  // 450  (instruction text)

const MINI_W = 16, MINI_H = 25;
const AI_BAR_H = 38;

const NOMES_PALO = ['Ouros', 'Copas', 'Espadas', 'Bastos'];
const CORES_IA = ['#e03030', '#3070e0', '#30b040'];

const ESTADO = { ESPIAR: 0, XOGANDO: 1, FIN_RONDA: 2, FIN_PARTIDA: 3 };
const FASE = { REVELAR: 0, HABILIDADE: 1, INTERCAMBIAR: 2, CONTA_ATRAS: 3, PECHAR: 4 };
const SUB = {
    NONE: 0,
    SOTA_SEL: 1,
    CABALLO_SEL_PROPIA: 2, CABALLO_SEL_OPONENTE: 3,
    REY_SEL_1: 4, REY_SEL_2: 5, REY_DECIDIR: 6,
};

const CONTA_ATRAS_MS = 3000;
const MAX_CARTAS = 7;

export default class Agochado extends Escena {
    constructor(director, config = {}) {
        super(director);
        this.assets = director.assets;
        this.config = config;

        const dificultades = config.dificultades || ['medio', 'medio', 'medio'];
        this.numXogadores = (config.numOponentes || 3) + 1;
        this.nomes = ['Ti', 'IA 1', 'IA 2', 'IA 3'].slice(0, this.numXogadores);
        this.dificultades = ['humano', ...dificultades.slice(0, this.numXogadores - 1)];
        while (this.dificultades.length < this.numXogadores) this.dificultades.push('medio');

        // Persistent
        this.puntuacions = new Array(this.numXogadores).fill(0);
        this.ronda = 0;

        // Per-round
        this.slots = [];          // slots[player][i] = { carta, bocaArriba }
        this.baralla = null;
        this.descartes = [];
        this.cartaRevelada = null;
        this.turnoActual = 0;
        this.turnoNum = 0;        // total turns this round
        this.fase = FASE.REVELAR;
        this.subFase = SUB.NONE;
        this.cicloCompleto = false;
        this.alguenPechou = false;
        this.xogadorPechador = -1;
        this.turnosFinaisRestantes = [];

        // Human knowledge of own cards
        this.conocidas = new Set();

        // AI memory: memoriaIA[iaIdx] = Map("player-slot" → Carta)
        this.memoriaIA = [];
        for (let i = 1; i < this.numXogadores; i++) this.memoriaIA.push(new Map());

        // Ability state
        this.habSel1 = null;  // { xogador, slot }
        this.habSel2 = null;

        // Peek display
        this.peeking = [];  // [{ xogador, slot, tempo }]

        // Popup overlay for Rey ability (shows cards enlarged in center)
        this.popupCartas = [];   // [Carta] - cards to show in popup
        this.popupTempo = 0;     // ms remaining
        this.popupCallback = null;

        // Countdown
        this.contaAtrasT = 0;
        this.reclamantes = [];       // [{ xogador, slot }]
        this.iaReclamado = [];       // which AIs have already decided this countdown

        // UI state
        this.estado = ESTADO.ESPIAR;
        this.mensaxe = '';
        this.tempMsg = 0;
        this.msgEnRemate = null;
        this.animacions = [];
        this.pausado = false;
        this._voltandoDePausa = false;
        this.slotHover = -1;         // hovered slot index for player 0
        this.iaSlotHover = null;     // { xogador, slot } for AI mini-slot hover
        this.tempIA = 0;
        this.resultadoRonda = null;

        // ── Buttons ──
        const bx1 = CANVAS_W / 2 - 100, bx2 = CANVAS_W / 2 + 10;
        this.btnDeixar = new Boton(bx1, Y_BUTTONS, 90, 28,
            ['#7a2a2a', '#9a3a3a', '#5a1a1a', '#333'], [], 'Deixar',
            () => this.deixarCarta(), { corTexto: '#fff', tamanhoTexto: 10 });
        this.btnPechar = new Boton(bx1, Y_BUTTONS, 90, 28,
            ['#2a2a7a', '#3a3a9a', '#1a1a5a', '#333'], [], 'Pechar',
            () => this.pecharRonda(), { corTexto: '#fff', tamanhoTexto: 10 });
        this.btnContinuar = new Boton(bx2, Y_BUTTONS, 90, 28,
            ['#2a7a2a', '#3a9a3a', '#1a5a1a', '#333'], [], 'Continuar',
            () => this.continuarTurno(), { corTexto: '#fff', tamanhoTexto: 10 });
        this.btnSwapRey = new Boton(bx1, Y_BUTTONS, 90, 28,
            ['#7a7a2a', '#9a9a3a', '#5a5a1a', '#333'], [], 'Intercambiar',
            () => this.executarSwapRey(true), { corTexto: '#fff', tamanhoTexto: 10 });
        this.btnNoSwapRey = new Boton(bx2, Y_BUTTONS, 90, 28,
            ['#555', '#777', '#333', '#333'], [], 'Non cambiar',
            () => this.executarSwapRey(false), { corTexto: '#fff', tamanhoTexto: 10 });

        // Pause
        const numIA = this.numXogadores - 1;
        const cogY = 2 + numIA * (AI_BAR_H + 2) + 4;
        this.btnCog = new Boton(6, cogY, 24, 24,
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

        // End buttons
        this.btnSeguinte = new Boton(CANVAS_W / 2 - 55, CANVAS_H / 2 + 80, 110, 32,
            ['#2a2a7a', '#3a3a9a', '#1a1a5a'], [], 'Seguinte ronda',
            () => this.iniciarRonda(), { corTexto: '#fff', tamanhoTexto: 10 });
        this.btnMenuFin = new Boton(CANVAS_W / 2 - 55, CANVAS_H / 2 + 120, 110, 32,
            ['#7a2a2a', '#9a3a3a', '#5a1a1a'], [], 'Menu',
            () => { import('./Menu.js').then(m => this.director.cambiarEscena(new m.default(this.director))); },
            { corTexto: '#fff', tamanhoTexto: 10 });

        this.iniciarRonda();
    }

    // ═══════════════════════════════════════════
    //  CARD HELPERS
    // ═══════════════════════════════════════════

    valorAgochado(carta) {
        const p = carta.puntos();
        if (p === 7) return -1;
        if (p <= 6) return p;
        if (p === 8) return 10;
        if (p === 9) return 11;
        if (p === 10) return 12;
        return p;
    }

    nomeCartaBreve(carta) {
        const n = ['', 'As', '2', '3', '4', '5', '6', '7', 'Sota', 'Caballo', 'Rey'];
        return `${n[carta.puntos()]} de ${NOMES_PALO[carta.palo()]}`;
    }

    cartasRestantes(xogador) {
        return this.slots[xogador].filter(s => s.carta !== null).length;
    }

    // ═══════════════════════════════════════════
    //  AI MEMORY
    // ═══════════════════════════════════════════

    memorizar(iaIdx, xogador, slot, carta) {
        this.memoriaIA[iaIdx - 1].set(`${xogador}-${slot}`, carta);
    }

    esquecer(iaIdx, xogador, slot) {
        this.memoriaIA[iaIdx - 1].delete(`${xogador}-${slot}`);
    }

    recordar(iaIdx, xogador, slot) {
        return this.memoriaIA[iaIdx - 1].get(`${xogador}-${slot}`) || null;
    }

    esquecerSlotTodos(xogador, slot) {
        for (let ia = 1; ia < this.numXogadores; ia++) {
            this.esquecer(ia, xogador, slot);
        }
    }

    memorizarPublico(xogador, slot, carta) {
        for (let ia = 1; ia < this.numXogadores; ia++) {
            this.memorizar(ia, xogador, slot, carta);
        }
    }

    // ═══════════════════════════════════════════
    //  ROUND SETUP
    // ═══════════════════════════════════════════

    iniciarRonda() {
        this.ronda++;
        this.baralla = new Baralla();
        this.slots = [];
        for (let i = 0; i < this.numXogadores; i++) this.slots.push([]);
        this.descartes = [];
        this.cartaRevelada = null;
        this.turnoNum = 0;
        this.cicloCompleto = false;
        this.alguenPechou = false;
        this.xogadorPechador = -1;
        this.turnosFinaisRestantes = [];
        this.conocidas = new Set();
        this.memoriaIA = [];
        for (let i = 1; i < this.numXogadores; i++) this.memoriaIA.push(new Map());
        this.animacions = [];
        this.peeking = [];
        this.resultadoRonda = null;
        this.habSel1 = null;
        this.habSel2 = null;

        // Deal 4 cards face-down to each player
        for (let c = 0; c < 4; c++) {
            for (let i = 0; i < this.numXogadores; i++) {
                this.slots[i].push({ carta: this.baralla.roubar(), bocaArriba: false });
            }
        }

        this.reproducirSon('son_barallar');

        // AI peeks at one card each
        for (let ia = 1; ia < this.numXogadores; ia++) {
            const s = Math.floor(Math.random() * 4);
            this.memorizar(ia, ia, s, this.slots[ia][s].carta);
        }

        this.estado = ESTADO.ESPIAR;
        this.mostrarMsg(`Ronda ${this.ronda}: Selecciona unha carta para espiar`, 0);
    }

    // Human selects one card to peek at during setup
    procesarEspiar(slotIdx) {
        const slot = this.slots[0][slotIdx];
        if (!slot.carta) return;
        this.conocidas.add(slotIdx);
        this.reproducirSon('son_dar1');
        this.mostrarPopup([slot.carta], 3000, () => {
            this.estado = ESTADO.XOGANDO;
            this.turnoActual = 0;
            this.iniciarTurno();
        });
    }

    // ═══════════════════════════════════════════
    //  TURN FLOW
    // ═══════════════════════════════════════════

    iniciarTurno() {
        this.fase = FASE.REVELAR;
        this.subFase = SUB.NONE;
        this.slotHover = -1;
        this.iaSlotHover = null;
        this.habSel1 = null;
        this.habSel2 = null;
        this.tempIA = 0;
        this.cartaRevelada = null;
    }

    revelarCarta() {
        if (this.baralla.restantes() === 0) this.reshuffleDiscard();
        if (this.baralla.restantes() === 0) {
            this.finalizarRonda();
            return;
        }
        this.cartaRevelada = this.baralla.roubar();

        // Animate card sliding from deck to revealed position
        this.animacions.push(new AnimacionDesprazamento(
            this.assets, CW, CH, this.cartaRevelada.valor,
            BARALLA_X, PILE_Y, REVELADA_X, PILE_Y,
            () => {
                this.reproducirSon(`son_dar${1 + Math.floor(Math.random() * 6)}`);
                const p = this.cartaRevelada.puntos();
                if (p === 8) {
                    this.fase = FASE.HABILIDADE;
                    this.subFase = SUB.SOTA_SEL;
                } else if (p === 9) {
                    this.fase = FASE.HABILIDADE;
                    this.subFase = SUB.CABALLO_SEL_PROPIA;
                } else if (p === 10) {
                    this.fase = FASE.HABILIDADE;
                    this.subFase = SUB.REY_SEL_1;
                } else {
                    this.fase = FASE.INTERCAMBIAR;
                }
            },
            0.06
        ));
        // Keep fase as REVELAR until animation finishes (animations block updates)
    }

    avanzarTurno() {
        this.turnoNum++;

        // Check if first cycle is complete
        if (this.turnoNum >= this.numXogadores && !this.cicloCompleto) {
            this.cicloCompleto = true;
        }

        // If someone closed, track final turns
        if (this.alguenPechou) {
            if (this.turnosFinaisRestantes.length === 0) {
                this.finalizarRonda();
                return;
            }
            this.turnoActual = this.turnosFinaisRestantes.shift();
        } else {
            this.turnoActual = (this.turnoActual + 1) % this.numXogadores;
        }

        this.iniciarTurno();
    }

    // ═══════════════════════════════════════════
    //  EXCHANGE & LEAVE
    // ═══════════════════════════════════════════

    trocarCarta(xogador, slotIdx) {
        const slot = this.slots[xogador][slotIdx];
        if (!slot.carta || slot.bocaArriba) return;

        const cartaVella = slot.carta;
        const cartaNova = this.cartaRevelada;

        // Calculate slot position BEFORE modifying state
        let slotX, slotY;
        if (xogador === 0) {
            const positions = this.posicionsSlots(this.slots[0].length);
            slotX = positions[slotIdx].x;
            slotY = Y_PLAYER_SLOTS;
        } else {
            const barIdx = xogador - 1;
            const barY = 2 + barIdx * (AI_BAR_H + 2);
            const barX = 6, barW = CANVAS_W - 12;
            const n = this.slots[xogador].length;
            slotX = barX + barW - 6 - (n - slotIdx) * (MINI_W + 2);
            slotY = barY + AI_BAR_H - MINI_H - 2;
        }

        // Update state (discard push deferred to animation callback)
        slot.carta = cartaNova;
        slot.bocaArriba = false;
        if (xogador === 0) this.conocidas.add(slotIdx);
        this.esquecerSlotTodos(xogador, slotIdx);
        if (xogador > 0) this.memorizar(xogador, xogador, slotIdx, cartaNova);
        this.cartaRevelada = null;

        // Animation 1: revealed card (as dorso) slides from Revelada to the slot
        this.animacions.push(new AnimacionDesprazamento(
            this.assets, CW, CH, 'dorso',
            REVELADA_X, PILE_Y, slotX, slotY,
            null, 0.06
        ));

        // Animation 2: old card (face-up) slides from slot to Descarte
        this.animacions.push(new AnimacionDesprazamento(
            this.assets, CW, CH, cartaVella.valor,
            slotX, slotY, DESCARTE_X, PILE_Y,
            () => {
                this.descartes.push(cartaVella);
                this.reproducirSon(`son_dar${1 + Math.floor(Math.random() * 6)}`);
                this.iniciarContaAtras();
            },
            0.06
        ));
    }

    deixarCarta() {
        if (this.fase !== FASE.INTERCAMBIAR || this.turnoActual !== 0) return;
        this._deixar();
    }

    _deixar() {
        const carta = this.cartaRevelada;
        this.cartaRevelada = null;

        this.animacions.push(new AnimacionDesprazamento(
            this.assets, CW, CH, carta.valor,
            REVELADA_X, PILE_Y, DESCARTE_X, PILE_Y,
            () => {
                this.descartes.push(carta);
                this.reproducirSon(`son_dar${1 + Math.floor(Math.random() * 6)}`);
                this.iniciarContaAtras();
            },
            0.06
        ));
    }

    // ═══════════════════════════════════════════
    //  ABILITIES
    // ═══════════════════════════════════════════

    // ── Sota: Peek at one of your own hidden cards ──
    procesarSotaHumano(slotIdx) {
        const slot = this.slots[0][slotIdx];
        if (!slot.carta || slot.bocaArriba) return;
        this.conocidas.add(slotIdx);
        this.mostrarPopup([slot.carta], 3000, () => {
            this.fase = FASE.INTERCAMBIAR;
            this.subFase = SUB.NONE;
        });
    }

    procesarSotaIA(iaIdx) {
        // Pick an unknown hidden slot to peek at
        let target = -1;
        for (let s = 0; s < this.slots[iaIdx].length; s++) {
            const slot = this.slots[iaIdx][s];
            if (slot.carta && !slot.bocaArriba && !this.recordar(iaIdx, iaIdx, s)) {
                target = s;
                break;
            }
        }
        if (target < 0) {
            for (let s = 0; s < this.slots[iaIdx].length; s++) {
                if (this.slots[iaIdx][s].carta && !this.slots[iaIdx][s].bocaArriba) { target = s; break; }
            }
        }
        if (target >= 0) {
            this.memorizar(iaIdx, iaIdx, target, this.slots[iaIdx][target].carta);
            this.peeking.push({ xogador: iaIdx, slot: target, tempo: 1200, soBorde: true });
        }
        this.mostrarMsg(`${this.nomes[iaIdx]} espiou unha carta`, 1200, () => {
            this.fase = FASE.INTERCAMBIAR;
            this.subFase = SUB.NONE;
        });
    }

    // ── Caballo: Blind swap own card with opponent card ──
    procesarCaballoPropia(xogador, slotIdx) {
        const slot = this.slots[xogador][slotIdx];
        if (!slot.carta) return;
        this.habSel1 = { xogador, slot: slotIdx };
        if (xogador === 0) {
            this.subFase = SUB.CABALLO_SEL_OPONENTE;
        }
    }

    procesarCaballoOponente(xogador, oponente, slotIdx) {
        const slot = this.slots[oponente][slotIdx];
        if (!slot.carta) return;
        this.habSel2 = { xogador: oponente, slot: slotIdx };
        this._executarCaballoSwap();
    }

    _executarCaballoSwap() {
        const a = this.habSel1, b = this.habSel2;
        const cartaA = this.slots[a.xogador][a.slot].carta;
        const cartaB = this.slots[b.xogador][b.slot].carta;
        const bocaA = this.slots[a.xogador][a.slot].bocaArriba;
        const bocaB = this.slots[b.xogador][b.slot].bocaArriba;

        // Get positions before modifying state
        const posA = this.posicionSlot(a.xogador, a.slot);
        const posB = this.posicionSlot(b.xogador, b.slot);

        // Update state
        this.slots[a.xogador][a.slot].carta = cartaB;
        this.slots[a.xogador][a.slot].bocaArriba = bocaB;
        this.slots[b.xogador][b.slot].carta = cartaA;
        this.slots[b.xogador][b.slot].bocaArriba = bocaA;

        if (a.xogador === 0) this.conocidas.delete(a.slot);
        if (b.xogador === 0) this.conocidas.delete(b.slot);
        this.esquecerSlotTodos(a.xogador, a.slot);
        this.esquecerSlotTodos(b.xogador, b.slot);

        // Simultaneous blind swap animations (both as dorso)
        this.animacions.push(new AnimacionDesprazamento(
            this.assets, CW, CH, 'dorso',
            posA.x, posA.y, posB.x, posB.y,
            null, 0.05
        ));
        this.animacions.push(new AnimacionDesprazamento(
            this.assets, CW, CH, 'dorso',
            posB.x, posB.y, posA.x, posA.y,
            () => {
                this.reproducirSon(`son_dar${1 + Math.floor(Math.random() * 6)}`);
                this.fase = FASE.INTERCAMBIAR;
                this.subFase = SUB.NONE;
                this.habSel1 = null;
                this.habSel2 = null;
            },
            0.05
        ));
    }

    procesarCaballoIA(iaIdx) {
        const dif = this.dificultades[iaIdx];
        // Pick own card: prefer unknown or known-bad
        let ownSlot = -1;
        let worstVal = -Infinity;
        for (let s = 0; s < this.slots[iaIdx].length; s++) {
            if (!this.slots[iaIdx][s].carta) continue;
            const mem = this.recordar(iaIdx, iaIdx, s);
            if (mem) {
                const v = this.valorAgochado(mem);
                if (v > worstVal) { worstVal = v; ownSlot = s; }
            } else if (ownSlot < 0) {
                ownSlot = s;
            }
        }
        if (ownSlot < 0) ownSlot = 0;

        // Pick opponent card: random opponent, random slot
        const opponents = [];
        for (let p = 0; p < this.numXogadores; p++) {
            if (p === iaIdx) continue;
            for (let s = 0; s < this.slots[p].length; s++) {
                if (this.slots[p][s].carta) opponents.push({ xogador: p, slot: s });
            }
        }
        if (opponents.length === 0) { this.fase = FASE.INTERCAMBIAR; this.subFase = SUB.NONE; return; }

        const target = opponents[Math.floor(Math.random() * opponents.length)];

        // Show message then animate the blind swap
        this.mostrarMsg(`${this.nomes[iaIdx]} intercambia cartas!`, 1000, () => {
            this.habSel1 = { xogador: iaIdx, slot: ownSlot };
            this.habSel2 = target;
            this._executarCaballoSwap();
        });
    }

    // ── Rey: Peek at 2 cards, optionally swap them ──
    procesarReySeleccion(xogador, slotIdx) {
        const slot = this.slots[xogador][slotIdx];
        if (!slot.carta || slot.bocaArriba) return;
        if (this.popupTempo > 0) return; // popup still showing

        if (this.subFase === SUB.REY_SEL_1) {
            this.habSel1 = { xogador, slot: slotIdx };
            if (xogador === 0) this.conocidas.add(slotIdx);
            if (this.turnoActual > 0) {
                this.memorizar(this.turnoActual, xogador, slotIdx, slot.carta);
            }
            // Show card in centered popup for 3 seconds, then move to second selection
            this.mostrarPopup([slot.carta], 3000, () => {
                this.subFase = SUB.REY_SEL_2;
            });
        } else if (this.subFase === SUB.REY_SEL_2) {
            if (xogador === this.habSel1.xogador && slotIdx === this.habSel1.slot) return;
            this.habSel2 = { xogador, slot: slotIdx };
            if (xogador === 0) this.conocidas.add(slotIdx);
            if (this.turnoActual > 0) {
                this.memorizar(this.turnoActual, xogador, slotIdx, slot.carta);
            }
            // Show second card, then both cards together for the swap decision
            const carta1 = this.slots[this.habSel1.xogador][this.habSel1.slot].carta;
            this.mostrarPopup([slot.carta], 2000, () => {
                // Now show both cards side by side and present swap buttons
                this.popupCartas = [carta1, slot.carta];
                this.popupTempo = -1; // stays until button is clicked
                this.subFase = SUB.REY_DECIDIR;
            });
        }
    }

    mostrarPopup(cartas, duracion, callback) {
        this.popupCartas = cartas;
        this.popupTempo = duracion;
        this.popupCallback = callback;
    }

    executarSwapRey(doSwap) {
        if (this.subFase !== SUB.REY_DECIDIR) return;
        this.popupCartas = [];
        this.popupTempo = 0;
        this.popupCallback = null;
        if (doSwap) {
            const a = this.habSel1, b = this.habSel2;
            const tmp = this.slots[a.xogador][a.slot].carta;
            const tmpB = this.slots[a.xogador][a.slot].bocaArriba;
            this.slots[a.xogador][a.slot].carta = this.slots[b.xogador][b.slot].carta;
            this.slots[a.xogador][a.slot].bocaArriba = this.slots[b.xogador][b.slot].bocaArriba;
            this.slots[b.xogador][b.slot].carta = tmp;
            this.slots[b.xogador][b.slot].bocaArriba = tmpB;

            // Update human knowledge
            if (a.xogador === 0 && this.conocidas.has(a.slot)) {
                this.conocidas.delete(a.slot);
                this.conocidas.add(a.slot); // still knows (saw both cards)
            }
            if (b.xogador === 0 && this.conocidas.has(b.slot)) {
                this.conocidas.delete(b.slot);
                this.conocidas.add(b.slot);
            }
            // Update AI memory for the swapping AI
            if (this.turnoActual > 0) {
                const ia = this.turnoActual;
                const cartaA = this.slots[a.xogador][a.slot].carta; // after swap
                const cartaB = this.slots[b.xogador][b.slot].carta;
                this.memorizar(ia, a.xogador, a.slot, cartaA);
                this.memorizar(ia, b.xogador, b.slot, cartaB);
            }
            this.reproducirSon(`son_dar${1 + Math.floor(Math.random() * 6)}`);
        }
        this.fase = FASE.INTERCAMBIAR;
        this.subFase = SUB.NONE;
        this.habSel1 = null;
        this.habSel2 = null;
    }

    procesarReyIA(iaIdx) {
        const dif = this.dificultades[iaIdx];
        // Pick 2 hidden cards to peek at
        const candidates = [];
        for (let p = 0; p < this.numXogadores; p++) {
            for (let s = 0; s < this.slots[p].length; s++) {
                if (this.slots[p][s].carta && !this.slots[p][s].bocaArriba) {
                    if (!this.recordar(iaIdx, p, s)) {
                        candidates.push({ xogador: p, slot: s });
                    }
                }
            }
        }
        if (candidates.length < 2) {
            for (let p = 0; p < this.numXogadores; p++) {
                for (let s = 0; s < this.slots[p].length; s++) {
                    if (this.slots[p][s].carta && !this.slots[p][s].bocaArriba) {
                        if (!candidates.some(c => c.xogador === p && c.slot === s)) {
                            candidates.push({ xogador: p, slot: s });
                        }
                    }
                }
            }
        }

        if (candidates.length < 2) {
            this.fase = FASE.INTERCAMBIAR;
            this.subFase = SUB.NONE;
            return;
        }

        // Shuffle and pick 2
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }
        const pick1 = candidates[0], pick2 = candidates[1];

        this.memorizar(iaIdx, pick1.xogador, pick1.slot, this.slots[pick1.xogador][pick1.slot].carta);
        this.memorizar(iaIdx, pick2.xogador, pick2.slot, this.slots[pick2.xogador][pick2.slot].carta);

        // Highlight the two selected cards briefly (border only, no face reveal)
        this.peeking.push({ xogador: pick1.xogador, slot: pick1.slot, tempo: 1500, soBorde: true });
        this.peeking.push({ xogador: pick2.xogador, slot: pick2.slot, tempo: 1500, soBorde: true });

        // Decide whether to swap
        const v1 = this.valorAgochado(this.slots[pick1.xogador][pick1.slot].carta);
        const v2 = this.valorAgochado(this.slots[pick2.xogador][pick2.slot].carta);
        const isOwn1 = pick1.xogador === iaIdx;
        const isOwn2 = pick2.xogador === iaIdx;

        let doSwap = false;
        if (isOwn1 && !isOwn2 && v2 < v1) doSwap = true;
        if (!isOwn1 && isOwn2 && v1 < v2) doSwap = true;

        if (doSwap) {
            // Show message then animate the swap
            this.mostrarMsg(`${this.nomes[iaIdx]} intercambia!`, 1200, () => {
                this.habSel1 = pick1;
                this.habSel2 = pick2;
                this._executarReySwapAnimado();
            });
        } else {
            this.mostrarMsg(`${this.nomes[iaIdx]} espiou 2 cartas`, 1200, () => {
                this.fase = FASE.INTERCAMBIAR;
                this.subFase = SUB.NONE;
            });
        }
    }

    _executarReySwapAnimado() {
        const a = this.habSel1, b = this.habSel2;
        const posA = this.posicionSlot(a.xogador, a.slot);
        const posB = this.posicionSlot(b.xogador, b.slot);

        // Swap state
        const tmp = this.slots[a.xogador][a.slot].carta;
        const tmpB = this.slots[a.xogador][a.slot].bocaArriba;
        this.slots[a.xogador][a.slot].carta = this.slots[b.xogador][b.slot].carta;
        this.slots[a.xogador][a.slot].bocaArriba = this.slots[b.xogador][b.slot].bocaArriba;
        this.slots[b.xogador][b.slot].carta = tmp;
        this.slots[b.xogador][b.slot].bocaArriba = tmpB;

        if (a.xogador === 0) this.conocidas.delete(a.slot);
        if (b.xogador === 0) this.conocidas.delete(b.slot);

        // AI who did this knows both cards after swap
        const ia = this.turnoActual;
        if (ia > 0) {
            this.memorizar(ia, a.xogador, a.slot, this.slots[a.xogador][a.slot].carta);
            this.memorizar(ia, b.xogador, b.slot, this.slots[b.xogador][b.slot].carta);
        }

        // Simultaneous swap animations (dorso since cards are hidden)
        this.animacions.push(new AnimacionDesprazamento(
            this.assets, CW, CH, 'dorso',
            posA.x, posA.y, posB.x, posB.y,
            null, 0.05
        ));
        this.animacions.push(new AnimacionDesprazamento(
            this.assets, CW, CH, 'dorso',
            posB.x, posB.y, posA.x, posA.y,
            () => {
                this.reproducirSon(`son_dar${1 + Math.floor(Math.random() * 6)}`);
                this.fase = FASE.INTERCAMBIAR;
                this.subFase = SUB.NONE;
                this.habSel1 = null;
                this.habSel2 = null;
            },
            0.05
        ));
    }

    // ═══════════════════════════════════════════
    //  COUNTDOWN PHASE
    // ═══════════════════════════════════════════

    iniciarContaAtras() {
        this.fase = FASE.CONTA_ATRAS;
        this.contaAtrasT = CONTA_ATRAS_MS;
        this.reclamantes = [];
        this.iaReclamado = new Array(this.numXogadores).fill(false);
    }

    procesarReclamacionHumano(slotIdx) {
        if (this.fase !== FASE.CONTA_ATRAS || this.contaAtrasT <= 0) return;
        if (this.alguenPechou && this.xogadorPechador === 0) return;
        const slot = this.slots[0][slotIdx];
        if (!slot.carta || slot.bocaArriba) return;

        // Toggle selection: click same card to deselect, different card to switch
        const existing = this.reclamantes.findIndex(r => r.xogador === 0);
        if (existing >= 0) {
            const wasSlot = this.reclamantes[existing].slot;
            this.reclamantes.splice(existing, 1);
            if (wasSlot === slotIdx) return; // deselected
        }
        this.reclamantes.push({ xogador: 0, slot: slotIdx });
    }

    iaDecidirContaAtras(iaIdx) {
        if (this.iaReclamado[iaIdx]) return;
        if (this.descartes.length === 0) return;
        if (this.alguenPechou && this.xogadorPechador === iaIdx) return;

        const topDescarte = this.descartes[this.descartes.length - 1];
        const valorDescarte = topDescarte.puntos();
        const dif = this.dificultades[iaIdx];

        for (let s = 0; s < this.slots[iaIdx].length; s++) {
            const slot = this.slots[iaIdx][s];
            if (!slot.carta || slot.bocaArriba) continue;
            const mem = this.recordar(iaIdx, iaIdx, s);
            if (mem && mem.puntos() === valorDescarte) {
                const prob = dif === 'facil' ? 0.35 : dif === 'medio' ? 0.65 : 0.9;
                this.iaReclamado[iaIdx] = true;
                if (Math.random() < prob) {
                    this.reclamantes.push({ xogador: iaIdx, slot: s });
                }
                return;
            }
        }
        this.iaReclamado[iaIdx] = true;
    }

    resolverContaAtras() {
        if (this.reclamantes.length === 0) {
            this.fase = FASE.PECHAR;
            return;
        }

        // Pick random claimant
        const pick = this.reclamantes[Math.floor(Math.random() * this.reclamantes.length)];
        const slot = this.slots[pick.xogador][pick.slot];
        const topDescarte = this.descartes[this.descartes.length - 1];

        if (!slot.carta) { this.fase = FASE.PECHAR; return; }

        const match = slot.carta.puntos() === topDescarte.puntos();

        if (match) {
            // Success: card goes to discard, slot becomes empty
            this.descartes.push(slot.carta);
            slot.carta = null;
            slot.bocaArriba = false;
            if (pick.xogador === 0) this.conocidas.delete(pick.slot);
            this.esquecerSlotTodos(pick.xogador, pick.slot);
            this.reproducirSon(`son_dar${1 + Math.floor(Math.random() * 6)}`);

            this.mostrarMsg(`${this.nomes[pick.xogador]} acertou!`, 1200, () => {
                // Check empty hand
                if (this.cartasRestantes(pick.xogador) === 0) {
                    this.puntuacions[pick.xogador] -= 10;
                    this.finalizarRonda();
                    return;
                }
                this.fase = FASE.PECHAR;
            });
        } else {
            // Fail: reveal card, add penalty card
            slot.bocaArriba = true;
            this.memorizarPublico(pick.xogador, pick.slot, slot.carta);
            if (pick.xogador === 0) this.conocidas.add(pick.slot);

            // Draw penalty card
            if (this.baralla.restantes() === 0) this.reshuffleDiscard();
            if (this.baralla.restantes() > 0) {
                const penalty = this.baralla.roubar();
                this.slots[pick.xogador].push({ carta: penalty, bocaArriba: false });
            }

            this.reproducirSon(`son_dar${1 + Math.floor(Math.random() * 6)}`);
            this.mostrarMsg(`${this.nomes[pick.xogador]} fallou!`, 1200, () => {
                // Force close at 7 cards
                if (this.cartasRestantes(pick.xogador) >= MAX_CARTAS) {
                    this._forceClose(pick.xogador);
                    return;
                }
                this.fase = FASE.PECHAR;
            });
        }
    }

    // ═══════════════════════════════════════════
    //  CLOSE & END ROUND
    // ═══════════════════════════════════════════

    pecharRonda() {
        if (this.fase !== FASE.PECHAR || this.turnoActual !== 0) return;
        if (!this.cicloCompleto) return;
        this._iniciarPeche(0);
    }

    _iniciarPeche(xogador) {
        this.alguenPechou = true;
        this.xogadorPechador = xogador;
        this.turnosFinaisRestantes = [];
        let next = (xogador + 1) % this.numXogadores;
        for (let i = 0; i < this.numXogadores - 1; i++) {
            this.turnosFinaisRestantes.push(next);
            next = (next + 1) % this.numXogadores;
        }
        this.mostrarMsg(
            xogador === 0 ? 'Pechaches a ronda!' : `${this.nomes[xogador]} pechou!`,
            1200, () => this.avanzarTurno()
        );
    }

    _forceClose(xogador) {
        this.mostrarMsg(`${this.nomes[xogador]} ten ${MAX_CARTAS} cartas - peche forzado!`, 1500, () => {
            this._iniciarPeche(xogador);
        });
    }

    continuarTurno() {
        if (this.fase !== FASE.PECHAR || this.turnoActual !== 0) return;
        this.avanzarTurno();
    }

    finalizarRonda() {
        // Reveal all cards
        for (let p = 0; p < this.numXogadores; p++) {
            for (const slot of this.slots[p]) {
                if (slot.carta) slot.bocaArriba = true;
            }
        }

        const puntuacionsRonda = [];
        for (let p = 0; p < this.numXogadores; p++) {
            let sum = 0;
            for (const slot of this.slots[p]) {
                if (slot.carta) sum += this.valorAgochado(slot.carta);
            }
            puntuacionsRonda.push(sum);
            this.puntuacions[p] += sum;
        }

        this.resultadoRonda = { puntuacionsRonda };

        if (this.puntuacions.some(p => p >= 100)) {
            this.ganadorPartida = this.puntuacions.indexOf(Math.min(...this.puntuacions));
            this.estado = ESTADO.FIN_PARTIDA;
        } else {
            this.estado = ESTADO.FIN_RONDA;
        }
    }

    // ═══════════════════════════════════════════
    //  AI LOGIC
    // ═══════════════════════════════════════════

    executarIA(dt) {
        this.tempIA += dt;
        const iaIdx = this.turnoActual;
        const dif = this.dificultades[iaIdx];

        switch (this.fase) {
            case FASE.HABILIDADE:
                if (this.tempIA > 500) {
                    this.tempIA = 0;
                    if (this.subFase === SUB.SOTA_SEL) this.procesarSotaIA(iaIdx);
                    else if (this.subFase === SUB.CABALLO_SEL_PROPIA) this.procesarCaballoIA(iaIdx);
                    else if (this.subFase === SUB.REY_SEL_1) this.procesarReyIA(iaIdx);
                }
                break;

            case FASE.INTERCAMBIAR:
                if (this.tempIA > 600) {
                    this.tempIA = 0;
                    this._iaDecidirIntercambio(iaIdx, dif);
                }
                break;

            case FASE.PECHAR:
                if (this.tempIA > 400) {
                    this.tempIA = 0;
                    if (this.cicloCompleto && !this.alguenPechou && this._iaDecidirPechar(iaIdx, dif)) {
                        this._iniciarPeche(iaIdx);
                    } else {
                        this.avanzarTurno();
                    }
                }
                break;
        }
    }

    _iaDecidirIntercambio(iaIdx, dif) {
        const valorRev = this.valorAgochado(this.cartaRevelada);

        // Find worst known card in hand
        let worstSlot = -1, worstVal = -Infinity;
        for (let s = 0; s < this.slots[iaIdx].length; s++) {
            if (!this.slots[iaIdx][s].carta || this.slots[iaIdx][s].bocaArriba) continue;
            const mem = this.recordar(iaIdx, iaIdx, s);
            if (mem) {
                const v = this.valorAgochado(mem);
                if (v > worstVal) { worstVal = v; worstSlot = s; }
            }
        }

        // Exchange if revealed card is better than worst known
        if (worstSlot >= 0 && valorRev < worstVal) {
            this.trocarCarta(iaIdx, worstSlot);
            return;
        }

        // If revealed card is very good, exchange with an unknown slot
        if (valorRev <= 2) {
            for (let s = 0; s < this.slots[iaIdx].length; s++) {
                if (!this.slots[iaIdx][s].carta || this.slots[iaIdx][s].bocaArriba) continue;
                if (!this.recordar(iaIdx, iaIdx, s)) {
                    if (dif !== 'facil' || Math.random() < 0.5) {
                        this.trocarCarta(iaIdx, s);
                        return;
                    }
                }
            }
        }

        // Leave it
        this._deixar();
    }

    _iaDecidirPechar(iaIdx, dif) {
        let estimado = 0;
        let known = 0;
        for (let s = 0; s < this.slots[iaIdx].length; s++) {
            if (!this.slots[iaIdx][s].carta) continue;
            const mem = this.recordar(iaIdx, iaIdx, s);
            if (mem) {
                estimado += this.valorAgochado(mem);
                known++;
            } else {
                estimado += 5; // average estimate
            }
        }
        switch (dif) {
            case 'facil': return estimado <= 4;
            case 'medio': return estimado <= 8;
            case 'dificil': return estimado <= 12;
        }
        return false;
    }

    // ═══════════════════════════════════════════
    //  PLAYER INPUT
    // ═══════════════════════════════════════════

    procesarClick(entrada) {
        if (this.tempMsg > 0 || this.animacions.length > 0) return;

        if (this.estado === ESTADO.ESPIAR) {
            const s = this.detectarClickSlotPropio(entrada);
            if (s >= 0) this.procesarEspiar(s);
            return;
        }

        if (this.estado !== ESTADO.XOGANDO || this.turnoActual !== 0) return;

        if (this.fase === FASE.HABILIDADE) {
            this._procesarClickHabilidade(entrada);
        } else if (this.fase === FASE.INTERCAMBIAR) {
            const s = this.detectarClickSlotPropio(entrada);
            if (s >= 0) {
                const slot = this.slots[0][s];
                if (slot.carta && !slot.bocaArriba) {
                    this.trocarCarta(0, s);
                }
            }
        } else if (this.fase === FASE.CONTA_ATRAS) {
            const s = this.detectarClickSlotPropio(entrada);
            if (s >= 0) this.procesarReclamacionHumano(s);
        }
    }

    _procesarClickHabilidade(entrada) {
        if (this.subFase === SUB.SOTA_SEL) {
            const s = this.detectarClickSlotPropio(entrada);
            if (s >= 0) this.procesarSotaHumano(s);
        } else if (this.subFase === SUB.CABALLO_SEL_PROPIA) {
            const s = this.detectarClickSlotPropio(entrada);
            if (s >= 0 && this.slots[0][s].carta) {
                this.procesarCaballoPropia(0, s);
            }
        } else if (this.subFase === SUB.CABALLO_SEL_OPONENTE) {
            for (let ia = 1; ia < this.numXogadores; ia++) {
                const s = this.detectarClickSlotIA(ia, entrada);
                if (s >= 0 && this.slots[ia][s].carta) {
                    this.procesarCaballoOponente(0, ia, s);
                    return;
                }
            }
        } else if (this.subFase === SUB.REY_SEL_1 || this.subFase === SUB.REY_SEL_2) {
            // Can click own slots or AI slots
            const s = this.detectarClickSlotPropio(entrada);
            if (s >= 0 && this.slots[0][s].carta && !this.slots[0][s].bocaArriba) {
                this.procesarReySeleccion(0, s);
                return;
            }
            for (let ia = 1; ia < this.numXogadores; ia++) {
                const s2 = this.detectarClickSlotIA(ia, entrada);
                if (s2 >= 0 && this.slots[ia][s2].carta && !this.slots[ia][s2].bocaArriba) {
                    this.procesarReySeleccion(ia, s2);
                    return;
                }
            }
        }
    }

    // ═══════════════════════════════════════════
    //  CLICK DETECTION
    // ═══════════════════════════════════════════

    detectarClickSlotPropio(entrada) {
        const positions = this.posicionsSlots(this.slots[0].length);
        for (let i = positions.length - 1; i >= 0; i--) {
            const p = positions[i];
            if (entrada.x >= p.x && entrada.x < p.x + CW &&
                entrada.y >= Y_PLAYER_SLOTS && entrada.y < Y_PLAYER_SLOTS + CH) {
                return i;
            }
        }
        return -1;
    }

    detectarClickSlotIA(iaIdx, entrada) {
        const barIdx = iaIdx - 1;
        const barY = 2 + barIdx * (AI_BAR_H + 2);
        const barX = 6, barW = CANVAS_W - 12;
        const n = this.slots[iaIdx].length;
        for (let j = n - 1; j >= 0; j--) {
            const sx = barX + barW - 6 - (n - j) * (MINI_W + 2);
            const sy = barY + AI_BAR_H - MINI_H - 2;
            if (entrada.x >= sx && entrada.x < sx + MINI_W &&
                entrada.y >= sy && entrada.y < sy + MINI_H) {
                return j;
            }
        }
        return -1;
    }

    // ═══════════════════════════════════════════
    //  POSITIONS
    // ═══════════════════════════════════════════

    posicionsSlots(n) {
        if (n === 0) return [];
        const maxW = CANVAS_W - 20;
        const space = n <= 1 ? 0 : Math.min(CW + GAP, (maxW - CW) / (n - 1));
        const totalW = CW + (n > 1 ? (n - 1) * space : 0);
        const startX = (CANVAS_W - totalW) / 2;
        const pos = [];
        for (let i = 0; i < n; i++) {
            pos.push({ x: startX + i * space, y: Y_PLAYER_SLOTS });
        }
        return pos;
    }

    posicionSlot(xogador, slotIdx) {
        if (xogador === 0) {
            const positions = this.posicionsSlots(this.slots[0].length);
            return { x: positions[slotIdx].x, y: Y_PLAYER_SLOTS, w: CW, h: CH };
        }
        const barIdx = xogador - 1;
        const barY = 2 + barIdx * (AI_BAR_H + 2);
        const barX = 6, barW = CANVAS_W - 12;
        const n = this.slots[xogador].length;
        const sx = barX + barW - 6 - (n - slotIdx) * (MINI_W + 2);
        const sy = barY + AI_BAR_H - MINI_H - 2;
        return { x: sx, y: sy, w: MINI_W, h: MINI_H };
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

    reshuffleDiscard() {
        if (this.descartes.length <= 1) return;
        const top = this.descartes.pop();
        while (this.descartes.length > 0) this.baralla.cartas.push(this.descartes.pop());
        this.descartes = [top];
        this.baralla.barallar();
        this.reproducirSon('son_barallar');
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

        if (this.estado === ESTADO.XOGANDO || this.estado === ESTADO.ESPIAR) {
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
            return;
        }

        // Popup timer (Rey peek overlay)
        if (this.popupTempo > 0) {
            this.popupTempo -= dt;
            if (this.popupTempo <= 0) {
                this.popupTempo = 0;
                this.popupCartas = [];
                if (this.popupCallback) {
                    const cb = this.popupCallback;
                    this.popupCallback = null;
                    cb();
                }
            }
            return; // block game while popup is showing
        }

        // Peeking timers
        for (let i = this.peeking.length - 1; i >= 0; i--) {
            this.peeking[i].tempo -= dt;
            if (this.peeking[i].tempo <= 0) this.peeking.splice(i, 1);
        }

        if (this.msgEnRemate) return;

        switch (this.estado) {
            case ESTADO.ESPIAR:
                this.actualizarEspiar(entrada, dt);
                break;
            case ESTADO.XOGANDO:
                this.actualizarXogo(entrada, dt);
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

    actualizarEspiar(entrada, dt) {
        this.actualizarHoverPropio(entrada);
        if (entrada.clicado) this.procesarClick(entrada);
        this.director.canvas.style.cursor = this.slotHover >= 0 ? 'pointer' : 'default';
    }

    actualizarXogo(entrada, dt) {
        // Auto-reveal for ALL players (including human)
        if (this.fase === FASE.REVELAR) {
            this.tempIA += dt;
            if (this.tempIA > 500) {
                this.revelarCarta();
            }
            this.director.canvas.style.cursor = 'default';
            return;
        }

        if (this.turnoActual === 0) {
            this.actualizarHoverPropio(entrada);
            this.actualizarHoverIA(entrada);

            if (this.fase === FASE.INTERCAMBIAR) {
                this.btnDeixar.actualizar(entrada, dt);
            } else if (this.fase === FASE.PECHAR) {
                this.btnPechar.deshabilitado = !this.cicloCompleto || this.alguenPechou;
                this.btnPechar.actualizar(entrada, dt);
                this.btnContinuar.actualizar(entrada, dt);
            } else if (this.subFase === SUB.REY_DECIDIR && this.popupCartas.length > 0) {
                // Position buttons to match popup layout
                const ch2 = CH * 2;
                const cy = CANVAS_H / 2 - ch2 / 2 - 20;
                this.btnSwapRey.y = cy + ch2 + 28;
                this.btnNoSwapRey.y = cy + ch2 + 28;
                this.btnSwapRey.actualizar(entrada, dt);
                this.btnNoSwapRey.actualizar(entrada, dt);
            }

            if (entrada.clicado) this.procesarClick(entrada);

            const anyHover = this.slotHover >= 0 || this.iaSlotHover !== null ||
                this.btnDeixar.estado === 'peneirar' ||
                this.btnPechar.estado === 'peneirar' ||
                this.btnContinuar.estado === 'peneirar' ||
                this.btnSwapRey.estado === 'peneirar' ||
                this.btnNoSwapRey.estado === 'peneirar';
            this.director.canvas.style.cursor = anyHover ? 'pointer' : 'default';

            // Countdown: decrement timer, AI decides
            if (this.fase === FASE.CONTA_ATRAS) {
                this.contaAtrasT -= dt;
                for (let ia = 1; ia < this.numXogadores; ia++) {
                    if (this.contaAtrasT < CONTA_ATRAS_MS - 800) {
                        this.iaDecidirContaAtras(ia);
                    }
                }
                if (this.contaAtrasT <= 0) this.resolverContaAtras();
            }
        } else {
            // AI turn
            this.director.canvas.style.cursor = 'default';

            if (this.fase === FASE.CONTA_ATRAS) {
                this.contaAtrasT -= dt;
                // Human can still click during AI's countdown
                this.actualizarHoverPropio(entrada);
                if (entrada.clicado) {
                    const s = this.detectarClickSlotPropio(entrada);
                    if (s >= 0) this.procesarReclamacionHumano(s);
                }
                // Other AIs decide
                for (let ia = 1; ia < this.numXogadores; ia++) {
                    if (ia !== this.turnoActual && this.contaAtrasT < CONTA_ATRAS_MS - 800) {
                        this.iaDecidirContaAtras(ia);
                    }
                }
                // Active AI also decides
                if (this.contaAtrasT < CONTA_ATRAS_MS - 500) {
                    this.iaDecidirContaAtras(this.turnoActual);
                }
                if (this.contaAtrasT <= 0) this.resolverContaAtras();
            } else {
                this.executarIA(dt);
            }
        }
    }

    actualizarHoverPropio(entrada) {
        this.slotHover = -1;
        const positions = this.posicionsSlots(this.slots[0].length);
        for (let i = positions.length - 1; i >= 0; i--) {
            const p = positions[i];
            if (entrada.x >= p.x && entrada.x < p.x + CW &&
                entrada.y >= Y_PLAYER_SLOTS && entrada.y < Y_PLAYER_SLOTS + CH) {
                this.slotHover = i;
                return;
            }
        }
    }

    actualizarHoverIA(entrada) {
        this.iaSlotHover = null;
        for (let ia = 1; ia < this.numXogadores; ia++) {
            const s = this.detectarClickSlotIA(ia, entrada);
            if (s >= 0) {
                this.iaSlotHover = { xogador: ia, slot: s };
                return;
            }
        }
    }

    // ═══════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════

    debuxar(ctx) {
        ctx.fillStyle = '#1a3a1a';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        this.debuxarInfoIA(ctx);
        this.debuxarMesa(ctx);
        this.debuxarSlotsXogador(ctx);
        this.debuxarInfoXogador(ctx);
        this.debuxarBotonsXogo(ctx);
        this.debuxarTextoFase(ctx);

        if (this.fase === FASE.CONTA_ATRAS) this.debuxarContaAtras(ctx);

        for (const anim of this.animacions) anim.debuxar(ctx);
        if (this.tempMsg > 0) this.debuxarMsg(ctx);
        if (this.popupCartas.length > 0) this.debuxarPopup(ctx);
        if (this.estado === ESTADO.FIN_RONDA) this.debuxarFinRonda(ctx);
        if (this.estado === ESTADO.FIN_PARTIDA) this.debuxarFinPartida(ctx);

        if (this.estado === ESTADO.XOGANDO || this.estado === ESTADO.ESPIAR) this.btnCog.debuxar(ctx);
        if (this.pausado) this.debuxarPausa(ctx);
    }

    debuxarInfoIA(ctx) {
        for (let i = 0; i < this.numXogadores - 1; i++) {
            const iaIdx = i + 1;
            const y = 2 + i * (AI_BAR_H + 2);
            const isActive = this.turnoActual === iaIdx && this.estado === ESTADO.XOGANDO;

            const barX = 6, barW = CANVAS_W - 12;
            ctx.fillStyle = isActive ? 'rgba(255,215,0,0.15)' : 'rgba(0,0,0,0.3)';
            ctx.fillRect(barX, y, barW, AI_BAR_H);
            if (isActive) {
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = 1;
                ctx.strokeRect(barX, y, barW, AI_BAR_H);
            }

            ctx.fillStyle = CORES_IA[i];
            ctx.fillRect(barX + 4, y + 4, 8, 8);

            ctx.fillStyle = isActive ? '#ffd700' : '#e0e0e0';
            ctx.font = '10px Minipixel';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(this.nomes[iaIdx], barX + 16, y + 3);

            ctx.fillStyle = '#aaa';
            ctx.fillText(`${this.cartasRestantes(iaIdx)} cartas`, barX + 16, y + 16);

            ctx.fillStyle = this.puntuacions[iaIdx] >= 80 ? '#f44' : '#ccc';
            ctx.textAlign = 'right';
            ctx.fillText(`${this.puntuacions[iaIdx]} pts`, barX + barW - 6, y + 3);

            // Mini card slots
            const n = this.slots[iaIdx].length;
            const dorso = this.assets['dorso'];
            for (let j = 0; j < n; j++) {
                const sx = barX + barW - 6 - (n - j) * (MINI_W + 2);
                const sy = y + AI_BAR_H - MINI_H - 2;
                const slot = this.slots[iaIdx][j];

                if (!slot.carta) {
                    ctx.strokeStyle = '#444';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(sx, sy, MINI_W, MINI_H);
                } else if (slot.bocaArriba) {
                    const img = this.assets[slot.carta.valor.toString()];
                    if (img) ctx.drawImage(img, sx, sy, MINI_W, MINI_H);
                } else {
                    if (dorso) ctx.drawImage(dorso, sx, sy, MINI_W, MINI_H);
                }

                // Peek highlight (border only for AI peeks, no face reveal)
                const peekE = this.peeking.find(p => p.xogador === iaIdx && p.slot === j);
                if (peekE && slot.carta) {
                    ctx.strokeStyle = '#ff8800';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(sx - 1, sy - 1, MINI_W + 2, MINI_H + 2);
                }

                // Hover highlight for abilities
                if (this.iaSlotHover && this.iaSlotHover.xogador === iaIdx && this.iaSlotHover.slot === j) {
                    const canClick = (this.subFase === SUB.CABALLO_SEL_OPONENTE ||
                                     this.subFase === SUB.REY_SEL_1 || this.subFase === SUB.REY_SEL_2);
                    if (canClick) {
                        ctx.strokeStyle = '#ffd700';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(sx - 1, sy - 1, MINI_W + 2, MINI_H + 2);
                    }
                }

                // Countdown claim indicator
                if (this.fase === FASE.CONTA_ATRAS) {
                    const claimed = this.reclamantes.some(r => r.xogador === iaIdx && r.slot === j);
                    if (claimed) {
                        ctx.strokeStyle = '#4f4';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(sx - 1, sy - 1, MINI_W + 2, MINI_H + 2);
                    }
                }
            }
        }
    }

    debuxarMesa(ctx) {
        const dorso = this.assets['dorso'];

        // Labels
        ctx.fillStyle = '#888';
        ctx.font = '10px Minipixel';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('Baralla', BARALLA_X + CW / 2, PILE_Y - 6);
        if (this.cartaRevelada || this.fase === FASE.REVELAR) ctx.fillText('Revelada', REVELADA_X + CW / 2, PILE_Y - 6);
        ctx.fillText('Descarte', DESCARTE_X + CW / 2, PILE_Y - 6);

        // Deck
        if (dorso && this.baralla.restantes() > 0) {
            ctx.drawImage(dorso, BARALLA_X, PILE_Y, CW, CH);
            ctx.fillStyle = '#888';
            ctx.font = '10px Minipixel';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(`${this.baralla.restantes()}`, BARALLA_X + CW / 2, PILE_Y + CH + 4);
        }

        // Discard
        if (this.descartes.length > 0) {
            const top = this.descartes[this.descartes.length - 1];
            const img = this.assets[top.valor.toString()];
            if (img) ctx.drawImage(img, DESCARTE_X, PILE_Y, CW, CH);
        }

        // Revealed card (hide during animation — the animation draws it in transit)
        if (this.cartaRevelada && this.animacions.length === 0) {
            const img = this.assets[this.cartaRevelada.valor.toString()];
            if (img) ctx.drawImage(img, REVELADA_X, PILE_Y, CW, CH);
        }

        // Turn indicator
        if (this.estado === ESTADO.XOGANDO && this.tempMsg <= 0) {
            ctx.fillStyle = '#ffd700';
            ctx.font = '10px Minipixel';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(`Turno: ${this.nomes[this.turnoActual]}`, CANVAS_W / 2, PILE_Y - 22);
        }

        // Round info
        const numIA = this.numXogadores - 1;
        ctx.fillStyle = '#666';
        ctx.font = '10px Minipixel';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`Ronda ${this.ronda}`, 34, 2 + numIA * (AI_BAR_H + 2) + 8);
    }

    debuxarSlotsXogador(ctx) {
        const slots = this.slots[0];
        if (!slots || slots.length === 0) return;
        const positions = this.posicionsSlots(slots.length);

        for (let i = 0; i < slots.length; i++) {
            const p = positions[i];
            const slot = slots[i];
            const isHover = this.slotHover === i;
            const peekEntry = this.peeking.find(pk => pk.xogador === 0 && pk.slot === i);
            const isPeekingFace = peekEntry && !peekEntry.soBorde;
            const isPeekingBorder = !!peekEntry;

            if (!slot.carta) {
                ctx.strokeStyle = '#444';
                ctx.setLineDash([4, 4]);
                ctx.lineWidth = 1;
                ctx.strokeRect(p.x, Y_PLAYER_SLOTS, CW, CH);
                ctx.setLineDash([]);
                continue;
            }

            // Only show face-up if publicly revealed or player is peeking (not AI border-only peek)
            const showFace = slot.bocaArriba || isPeekingFace;

            if (showFace && slot.carta) {
                const img = this.assets[slot.carta.valor.toString()];
                if (img) ctx.drawImage(img, p.x, Y_PLAYER_SLOTS, CW, CH);
            } else {
                const dorso = this.assets['dorso'];
                if (dorso) ctx.drawImage(dorso, p.x, Y_PLAYER_SLOTS, CW, CH);
            }

            // AI peek border-only highlight (shows the AI selected this card)
            if (isPeekingBorder && !isPeekingFace) {
                ctx.strokeStyle = '#ff8800';
                ctx.lineWidth = 2;
                ctx.strokeRect(p.x - 1, Y_PLAYER_SLOTS - 1, CW + 2, CH + 2);
            }

            // Hover
            if (isHover) {
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = 2;
                ctx.strokeRect(p.x - 1, Y_PLAYER_SLOTS - 1, CW + 2, CH + 2);
            }

            // Countdown claim highlight
            if (this.fase === FASE.CONTA_ATRAS) {
                const claimed = this.reclamantes.some(r => r.xogador === 0 && r.slot === i);
                if (claimed) {
                    ctx.strokeStyle = '#4f4';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(p.x - 1, Y_PLAYER_SLOTS - 1, CW + 2, CH + 2);
                }
            }

            // Revealed card indicator (red border for publicly revealed)
            if (slot.bocaArriba) {
                ctx.strokeStyle = '#f44';
                ctx.lineWidth = 2;
                ctx.strokeRect(p.x - 1, Y_PLAYER_SLOTS - 1, CW + 2, CH + 2);
            }
        }
    }

    debuxarInfoXogador(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, Y_PLAYER_INFO, CANVAS_W, 30);
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '10px Minipixel';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(`Ti: ${this.cartasRestantes(0)} cartas`, 8, Y_PLAYER_INFO + 16);

        ctx.fillStyle = this.puntuacions[0] >= 80 ? '#f44' : '#ffd700';
        ctx.textAlign = 'right';
        ctx.fillText(`${this.puntuacions[0]} pts`, CANVAS_W - 8, Y_PLAYER_INFO + 16);
    }

    debuxarBotonsXogo(ctx) {
        if (this.estado !== ESTADO.XOGANDO || this.turnoActual !== 0 || this.tempMsg > 0) return;

        if (this.fase === FASE.INTERCAMBIAR) {
            this.btnDeixar.debuxar(ctx);
        } else if (this.fase === FASE.PECHAR) {
            this.btnPechar.debuxar(ctx);
            this.btnContinuar.debuxar(ctx);
        }
        // Rey swap buttons are drawn inside debuxarPopup instead
    }

    debuxarTextoFase(ctx) {
        if (this.estado !== ESTADO.XOGANDO && this.estado !== ESTADO.ESPIAR) return;
        if (this.turnoActual !== 0 && this.fase !== FASE.CONTA_ATRAS) return;
        if (this.tempMsg > 0) return;

        ctx.fillStyle = '#ccc';
        ctx.font = '10px Minipixel';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        const y = Y_TEXT;

        if (this.estado === ESTADO.ESPIAR) {
            ctx.fillText('Selecciona unha carta para espiar', CANVAS_W / 2, y);
        } else if (this.fase === FASE.INTERCAMBIAR && this.turnoActual === 0) {
            ctx.fillText('Toca unha carta tua para trocar', CANVAS_W / 2, y - 10);
            ctx.fillText('ou preme Deixar', CANVAS_W / 2, y);
        } else if (this.fase === FASE.CONTA_ATRAS) {
            ctx.fillText('Toca unha carta que coincida!', CANVAS_W / 2, y);
        } else if (this.fase === FASE.PECHAR && this.turnoActual === 0) {
            ctx.fillText(this.alguenPechou ? 'Turno final' : 'Pechar a ronda?', CANVAS_W / 2, y);
        } else if (this.subFase === SUB.SOTA_SEL && this.turnoActual === 0) {
            ctx.fillText('Sota: Espia unha carta tua', CANVAS_W / 2, y);
        } else if (this.subFase === SUB.CABALLO_SEL_PROPIA && this.turnoActual === 0) {
            ctx.fillText('Caballo: Selecciona unha carta tua', CANVAS_W / 2, y);
        } else if (this.subFase === SUB.CABALLO_SEL_OPONENTE && this.turnoActual === 0) {
            ctx.fillText('Caballo: Selecciona carta dun oponente', CANVAS_W / 2, y);
        } else if ((this.subFase === SUB.REY_SEL_1 || this.subFase === SUB.REY_SEL_2) && this.turnoActual === 0) {
            const num = this.subFase === SUB.REY_SEL_1 ? '1a' : '2a';
            ctx.fillText(`Rey: Selecciona ${num} carta para ver`, CANVAS_W / 2, y);
        } else if (this.subFase === SUB.REY_DECIDIR && this.turnoActual === 0) {
            ctx.fillText('Rey: Intercambiar as cartas?', CANVAS_W / 2, y);
        }
    }

    debuxarContaAtras(ctx) {
        const fraction = Math.max(0, this.contaAtrasT / CONTA_ATRAS_MS);
        const barW = 200, barH = 12;
        const barX = (CANVAS_W - barW) / 2;
        const barY = PILE_Y + CH + 24;

        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = fraction > 0.33 ? '#4a4' : '#a44';
        ctx.fillRect(barX, barY, barW * fraction, barH);
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);

        ctx.fillStyle = '#fff';
        ctx.font = '10px Minipixel';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`${Math.ceil(this.contaAtrasT / 1000)}`, CANVAS_W / 2, barY + barH + 4);
    }

    debuxarPopup(ctx) {
        // Dim background
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        const n = this.popupCartas.length;
        const scale = 2;
        const cw = CW * scale, ch = CH * scale;
        const gap = 16;
        const totalW = n * cw + (n - 1) * gap;
        const startX = (CANVAS_W - totalW) / 2;
        const cy = CANVAS_H / 2 - ch / 2 - 20;

        for (let i = 0; i < n; i++) {
            const x = startX + i * (cw + gap);
            const carta = this.popupCartas[i];
            const img = this.assets[carta.valor.toString()];
            if (img) {
                ctx.shadowBlur = 16;
                ctx.shadowColor = 'rgba(255,215,0,0.5)';
                ctx.drawImage(img, x, cy, cw, ch);
                ctx.shadowBlur = 0;
            }
            // Card name below
            ctx.fillStyle = '#ffd700';
            ctx.font = '10px Minipixel';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(this.nomeCartaBreve(carta), x + cw / 2, cy + ch + 6);
        }

        // If REY_DECIDIR, draw swap buttons inside the popup
        if (this.subFase === SUB.REY_DECIDIR && this.turnoActual === 0) {
            this.btnSwapRey.y = cy + ch + 28;
            this.btnNoSwapRey.y = cy + ch + 28;
            this.btnSwapRey.debuxar(ctx);
            this.btnNoSwapRey.debuxar(ctx);
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

        const r = this.resultadoRonda;
        if (!r) return;

        const popW = 280, popH = 60 + this.numXogadores * 30 + 70;
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
        ctx.font = '10px Minipixel';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('Fin da ronda', popX + popW / 2, popY + 10);

        let y = popY + 35;
        for (let i = 0; i < this.numXogadores; i++) {
            ctx.fillStyle = i === 0 ? '#e0e0e0' : CORES_IA[i - 1];
            ctx.textAlign = 'left';
            ctx.fillText(this.nomes[i], popX + 10, y);

            const penStr = r.puntuacionsRonda[i] >= 0 ? `+${r.puntuacionsRonda[i]}` : `${r.puntuacionsRonda[i]}`;
            ctx.fillStyle = r.puntuacionsRonda[i] <= 0 ? '#4f4' : '#f44';
            ctx.textAlign = 'right';
            ctx.fillText(`${penStr} pts`, popX + popW / 2, y);

            ctx.fillStyle = this.puntuacions[i] >= 80 ? '#f44' : '#ccc';
            ctx.fillText(`Total: ${this.puntuacions[i]}`, popX + popW - 10, y);
            y += 28;
        }

        ctx.textBaseline = 'alphabetic';
        this.btnSeguinte.y = popY + popH - 52;
        this.btnMenuFin.y = popY + popH - 18;
        this.btnSeguinte.debuxar(ctx);
        this.btnMenuFin.debuxar(ctx);
    }

    debuxarFinPartida(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        const popW = 260, popH = 200;
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
        ctx.font = '10px Minipixel';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const g = this.ganadorPartida;
        ctx.fillText(g === 0 ? 'Ganaches a partida!' : `${this.nomes[g]} gana a partida!`, popX + popW / 2, popY + 12);

        ctx.fillStyle = '#ccc';
        ctx.fillText(`${this.ronda} rondas xogadas`, popX + popW / 2, popY + 30);

        let y = popY + 55;
        for (let i = 0; i < this.numXogadores; i++) {
            const isWinner = i === g;
            ctx.fillStyle = isWinner ? '#ffd700' : (i === 0 ? '#e0e0e0' : CORES_IA[i - 1]);
            ctx.fillText(
                `${this.nomes[i]}: ${this.puntuacions[i]} pts${isWinner ? ' \u2605' : ''}`,
                popX + popW / 2, y
            );
            y += 18;
        }

        ctx.textBaseline = 'alphabetic';
        this.btnMenuFin.y = popY + popH - 36;
        this.btnMenuFin.debuxar(ctx);
    }

    debuxarPausa(ctx) {
        const p = this.popupPausa;
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(p.x + 3, p.y + 3, p.w, p.h);
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
