import Escena from '../Escena.js';
import Baralla from '../Baralla.js';
import Boton from '../utiles/Boton.js';
import AnimacionDesprazamento from '../utiles/animacions/AnimacionDesprazamento.js';

// ── DISPLAY CONSTANTS ──
const CW = 48, CH = 76, GAP = 4;
const CANVAS_W = 380, CANVAS_H = 600;
const Y_PLAYER_INFO = CANVAS_H - 24;
const Y_BUTTONS = Y_PLAYER_INFO - 32;
const Y_PLAYER_HAND = Y_BUTTONS - CH - 8;

// Card ranking for Presidente (index = puntos(), higher value = stronger)
// 3 < 4 < 5 < 6 < 7 < Sota(8) < Caballo(9) < Rey(10) < As(1) < 2
const RANGO = [-1, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7];

const NOMES_PALO = ['Ouros', 'Copas', 'Espadas', 'Bastos'];
const ROLES = ['Presidente', 'Vicepresidente', 'Viceculo', 'Culo'];
const CORES_ROLES = ['#ffd700', '#c0c0c0', '#cd7f32', '#888'];
const CORES_IA = ['#e03030', '#3070e0', '#30b040'];

const ESTADO = {
    INTERCAMBIO: 0,
    XOGANDO: 1,
    FIN_RONDA: 2,
    FIN_PARTIDA: 3,
};

export default class Presidente extends Escena {
    constructor(director, config = {}) {
        super(director);
        this.assets = director.assets;
        this.config = config;

        const dificultades = config.dificultades || ['medio', 'medio', 'medio'];
        this.numXogadores = 4;

        this.nomes = ['Ti', 'IA 1', 'IA 2', 'IA 3'];
        this.dificultades = ['humano', ...dificultades.slice(0, 3)];
        while (this.dificultades.length < 4) this.dificultades.push('medio');

        // Persistent state across rounds
        this.roles = [-1, -1, -1, -1]; // -1 = unassigned, 0-3 = role index
        this.ronda = 0;
        this.victorias = [0, 0, 0, 0]; // times each player was Presidente
        this.victoriasMeta = config.victoriasMeta || 5;

        // Per-round state
        this.mans = [[], [], [], []];
        this.turnoActual = 0;
        this.ordeFinalizacion = [];
        this.acabaron = [false, false, false, false];

        // Trick state
        this.baza = { cantidade: 0, rangoActual: -1, ultimoXogador: -1, pasaron: new Set() };
        this.saltado = -1; // one-time skip (not a permanent pass)
        this.mesaHistorial = []; // all plays in current trick for display

        // UI state
        this.estado = ESTADO.XOGANDO;
        this.mensaxe = '';
        this.tempMsg = 0;
        this.msgEnRemate = null;
        this.animacions = [];
        this.estaAnimando = false;
        this.pausado = false;
        this._voltandoDePausa = false;
        this.cartaHover = -1;
        this.seleccion = new Set(); // selected card indices for player

        // Intercambio UI state
        this.intercambioSeleccion = new Set();
        this.intercambioNumRequerido = 0;

        // Buttons
        this.btnXogar = new Boton(
            CANVAS_W / 2 - 95, Y_BUTTONS, 80, 28,
            ['#2a7a2a', '#3a9a3a', '#1a5a1a', '#333'],
            [], 'Xogar',
            () => this.xogarSeleccion(),
            { corTexto: '#fff', tamanhoTexto: 12 }
        );
        this.btnPasar = new Boton(
            CANVAS_W / 2 + 15, Y_BUTTONS, 80, 28,
            ['#7a2a2a', '#9a3a3a', '#5a1a1a', '#333'],
            [], 'Pasar',
            () => this.pasarTurno(),
            { corTexto: '#fff', tamanhoTexto: 12 }
        );
        this.btnConfirmarIntercambio = new Boton(
            CANVAS_W / 2 - 50, Y_BUTTONS, 100, 28,
            ['#2a7a2a', '#3a9a3a', '#1a5a1a', '#333'],
            [], 'Confirmar',
            () => this.confirmarIntercambio(),
            { corTexto: '#fff', tamanhoTexto: 12 }
        );

        // Pause – placed below the 3 IA info bars (bottom of last bar ≈ 120)
        const cogSize = 24;
        this.btnCog = new Boton(
            6, 124, cogSize, cogSize,
            ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.6)'],
            [], '\u2699', () => { this.pausado = true; },
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

        // End of round buttons
        this.btnSeguinte = new Boton(
            CANVAS_W / 2 - 55, CANVAS_H / 2 + 80, 110, 32,
            ['#2a2a7a', '#3a3a9a', '#1a1a5a'], [], 'Seguinte ronda',
            () => this.iniciarRonda()
        );
        this.btnMenuFin = new Boton(
            CANVAS_W / 2 - 55, CANVAS_H / 2 + 120, 110, 32,
            ['#7a2a2a', '#9a3a3a', '#5a1a1a'], [], 'Menu',
            () => { import('./Menu.js').then(m => this.director.cambiarEscena(new m.default(this.director))); }
        );

        this.iniciarRonda();
    }

    // ═══════════════════════════════════════════
    //  CARD HELPERS
    // ═══════════════════════════════════════════

    rango(carta) {
        return RANGO[carta.puntos()];
    }

    es2DeOuros(carta) {
        return carta.valor === 2; // puntos=2, palo=0 (Oros)
    }

    // Sort hand by presidente rank (low to high)
    ordenarMan(man) {
        man.sort((a, b) => {
            const ra = this.rango(a), rb = this.rango(b);
            if (ra !== rb) return ra - rb;
            return a.palo() - b.palo();
        });
    }

    // Group cards by rank
    agruparPorRango(man) {
        const grupos = {};
        for (const carta of man) {
            const r = this.rango(carta);
            if (!grupos[r]) grupos[r] = [];
            grupos[r].push(carta);
        }
        return grupos;
    }

    // Get N best (highest rank) cards from a hand
    melloresCartas(man, n) {
        const sorted = [...man].sort((a, b) => this.rango(b) - this.rango(a));
        return sorted.slice(0, n);
    }

    // Get N worst (lowest rank) cards from a hand
    peoresCartas(man, n) {
        const sorted = [...man].sort((a, b) => this.rango(a) - this.rango(b));
        return sorted.slice(0, n);
    }

    // ═══════════════════════════════════════════
    //  GAME FLOW
    // ═══════════════════════════════════════════

    iniciarRonda() {
        this.ronda++;
        this.baralla = new Baralla();
        this.mans = [[], [], [], []];
        this.ordeFinalizacion = [];
        this.acabaron = [false, false, false, false];
        this.seleccion.clear();
        this.intercambioSeleccion.clear();
        this.mesaHistorial = [];
        this.resetarBaza();
        this.animacions = [];

        // Deal all 40 cards (10 each)
        let idx = 0;
        while (this.baralla.restantes() > 0) {
            this.mans[idx % 4].push(this.baralla.roubar());
            idx++;
        }

        for (const man of this.mans) this.ordenarMan(man);

        this.reproducirSon('son_barallar');

        if (this.ronda > 1 && this.roles[0] !== -1) {
            // Card exchange
            this.realizarIntercambio();
        } else {
            this.iniciarXogo();
        }
    }

    realizarIntercambio() {
        // Find players by role
        const presidente = this.roles.indexOf(0);
        const vice = this.roles.indexOf(1);
        const viceculo = this.roles.indexOf(2);
        const culo = this.roles.indexOf(3);

        // Auto-resolve forced exchanges first (Culo→Presidente, Viceculo→Vicepresidente)
        // Culo gives 2 best to Presidente
        const culoMellores = this.melloresCartas(this.mans[culo], 2);
        for (const c of culoMellores) {
            const i = this.mans[culo].indexOf(c);
            this.mans[culo].splice(i, 1);
            this.mans[presidente].push(c);
        }

        // Viceculo gives 1 best to Vicepresidente
        const viceculoMellor = this.melloresCartas(this.mans[viceculo], 1);
        for (const c of viceculoMellor) {
            const i = this.mans[viceculo].indexOf(c);
            this.mans[viceculo].splice(i, 1);
            this.mans[vice].push(c);
        }

        // Check if human needs to choose cards to give
        const humanRole = this.roles[0]; // human is player 0
        if (humanRole === 0 || humanRole === 1) {
            // Human is Presidente or Vicepresidente - let them choose
            this.intercambioNumRequerido = humanRole === 0 ? 2 : 1;
            this.intercambioDestino = humanRole === 0 ? culo : viceculo;
            this.estado = ESTADO.INTERCAMBIO;

            // AI resolves their choice if applicable
            if (humanRole === 0) {
                // Vice (AI) gives 1 worst to Viceculo
                if (vice !== 0) this.autoIntercambioIA(vice, viceculo, 1);
            } else {
                // Presidente (AI) gives 2 worst to Culo
                if (presidente !== 0) this.autoIntercambioIA(presidente, culo, 2);
            }

            for (const man of this.mans) this.ordenarMan(man);
            const numStr = this.intercambioNumRequerido === 2 ? '2 cartas' : '1 carta';
            const destNome = this.nomes[this.intercambioDestino];
            this.mostrarMsg(`Elixe ${numStr} para dar a ${destNome}`, 2000);
        } else {
            // Human doesn't choose - auto-resolve all
            // Presidente (AI) gives 2 worst to Culo
            this.autoIntercambioIA(presidente, culo, 2);
            // Vicepresidente (AI) gives 1 worst to Viceculo
            this.autoIntercambioIA(vice, viceculo, 1);

            for (const man of this.mans) this.ordenarMan(man);
            this.mostrarMsg('Intercambio de cartas completado', 1500, () => this.iniciarXogo());
        }
    }

    autoIntercambioIA(from, to, n) {
        const peores = this.peoresCartas(this.mans[from], n);
        for (const c of peores) {
            const i = this.mans[from].indexOf(c);
            this.mans[from].splice(i, 1);
            this.mans[to].push(c);
        }
    }

    confirmarIntercambio() {
        if (this.intercambioSeleccion.size !== this.intercambioNumRequerido) return;

        const indices = Array.from(this.intercambioSeleccion).sort((a, b) => b - a);
        for (const i of indices) {
            const carta = this.mans[0].splice(i, 1)[0];
            this.mans[this.intercambioDestino].push(carta);
        }

        this.intercambioSeleccion.clear();
        for (const man of this.mans) this.ordenarMan(man);
        this.estado = ESTADO.XOGANDO;
        this.mostrarMsg('Intercambio completado!', 1200, () => this.iniciarXogo());
    }

    iniciarXogo() {
        this.estado = ESTADO.XOGANDO;

        if (this.ronda === 1) {
            // First game: find 3 de Ouros (valor=3, puntos=3, palo=0)
            let primeiro = -1;
            for (let i = 0; i < 4; i++) {
                if (this.mans[i].some(c => c.puntos() === 3 && c.palo() === 0)) {
                    primeiro = i;
                    break;
                }
            }
            this.turnoActual = primeiro >= 0 ? primeiro : 0;
            this.mostrarMsg(`${this.nomes[this.turnoActual]} ten o 3 de Ouros`, 1500, () => {
                this.iniciarTurno();
            });
        } else {
            // Subsequent rounds: Culo leads
            const culo = this.roles.indexOf(3);
            this.turnoActual = culo >= 0 ? culo : 0;
            this.mostrarMsg(`${this.nomes[this.turnoActual]} (Culo) comeza`, 1500, () => {
                this.iniciarTurno();
            });
        }
    }

    resetarBaza() {
        this.baza = { cantidade: 0, rangoActual: -1, ultimoXogador: -1, pasaron: new Set() };
        this.saltado = -1;
        // Mark finished players as passed
        for (let i = 0; i < 4; i++) {
            if (this.acabaron[i]) this.baza.pasaron.add(i);
        }
    }

    iniciarTurno() {
        if (this.ordeFinalizacion.length >= 3) {
            this.finalizarRonda();
            return;
        }

        // Skip finished players
        if (this.acabaron[this.turnoActual]) {
            this.avanzarTurno();
            return;
        }

        this.seleccion.clear();

        if (this.turnoActual === 0) {
            // Human turn - check if can play
            if (!this.tenXogada(0)) {
                this.mostrarMsg('Non podes xogar, pasas!', 800, () => {
                    this.procesarPaso(0);
                });
            }
            // else wait for input
        } else {
            // AI turn
            this.tempIA = 0;
        }
    }

    avanzarTurno() {
        // Find next non-passed, non-finished player, also skip the temporarily skipped player
        let next = (this.turnoActual + 1) % 4;
        let found = false;
        for (let i = 0; i < 4; i++) {
            const isSkipped = this.saltado === next;
            if (!this.acabaron[next] && !this.baza.pasaron.has(next) && !isSkipped) {
                found = true;
                break;
            }
            next = (next + 1) % 4;
        }
        // Clear the one-time skip after it's been consumed
        this.saltado = -1;

        // Trick over: no one left to challenge, or came back to the last player
        if (!found || next === this.baza.ultimoXogador) {
            this.ganadarBaza();
            return;
        }

        this.turnoActual = next;
        this.iniciarTurno();
    }

    xogadoresActivos() {
        const activos = [];
        for (let i = 0; i < 4; i++) {
            if (!this.acabaron[i]) activos.push(i);
        }
        return activos;
    }

    ganadarBaza() {
        const ganador = this.baza.ultimoXogador;
        this.mesaHistorial = [];

        const nextPlayer = this.acabaron[ganador]
            ? this.seguinteActivo(ganador)
            : ganador;

        this.resetarBaza();
        this.turnoActual = nextPlayer;

        if (this.ordeFinalizacion.length >= 3) {
            this.finalizarRonda();
            return;
        }

        this.mostrarMsg(`${this.nomes[ganador]} gana a baza`, 900, () => {
            this.iniciarTurno();
        });
    }

    seguinteActivo(desde) {
        let next = (desde + 1) % 4;
        for (let i = 0; i < 4; i++) {
            if (!this.acabaron[next]) return next;
            next = (next + 1) % 4;
        }
        return desde;
    }

    procesarPaso(xogador) {
        this.baza.pasaron.add(xogador);
        this.avanzarTurno();
    }

    // Check if a player has any valid play
    tenXogada(xogador) {
        const man = this.mans[xogador];
        if (man.length === 0) return false;

        // 2 de Ouros can always be played
        if (man.some(c => this.es2DeOuros(c))) return true;

        if (this.baza.cantidade === 0) return true; // Leading: can always play

        // Check if any group of correct size can beat current rank
        const grupos = this.agruparPorRango(man);
        for (const [r, cartas] of Object.entries(grupos)) {
            if (cartas.length >= this.baza.cantidade && parseInt(r) >= this.baza.rangoActual) {
                return true;
            }
        }
        return false;
    }

    // ═══════════════════════════════════════════
    //  PLAY CARDS
    // ═══════════════════════════════════════════

    validarXogada(xogador, indices) {
        const man = this.mans[xogador];
        const cartas = indices.map(i => man[i]);

        // Single 2 de Ouros cuts anything
        if (cartas.length === 1 && this.es2DeOuros(cartas[0])) return true;

        // All cards must be the same rank
        const rangos = cartas.map(c => this.rango(c));
        if (new Set(rangos).size !== 1) return false;

        const rangoXogada = rangos[0];

        if (this.baza.cantidade === 0) {
            // Leading: 1-4 cards of same rank
            return cartas.length >= 1 && cartas.length <= 4;
        }

        // Must match quantity
        if (cartas.length !== this.baza.cantidade) return false;

        // Must be >= current rank (same rank triggers skip)
        return rangoXogada >= this.baza.rangoActual;
    }

    xogarCartas(xogador, indices) {
        const man = this.mans[xogador];
        const cartas = indices.map(i => man[i]);
        const es2Ouros = cartas.length === 1 && this.es2DeOuros(cartas[0]);
        const rangoXogada = this.rango(cartas[0]);
        const mesmaRango = !es2Ouros && this.baza.rangoActual === rangoXogada && this.baza.cantidade > 0;

        // Calculate source positions BEFORE removing cards
        const srcPos = [];
        if (xogador === 0) {
            const hp = this.posicionsMan(man.length);
            for (const i of indices) srcPos.push({ x: hp[i].x, y: hp[i].y });
        } else {
            const iaIdx = xogador - 1;
            const barY = 2 + iaIdx * 40 + 8;
            for (let j = 0; j < cartas.length; j++) {
                srcPos.push({ x: CANVAS_W - 30, y: barY });
            }
        }

        // Remove cards from hand (indices in reverse to maintain order)
        const sortedIndices = [...indices].sort((a, b) => b - a);
        for (const i of sortedIndices) man.splice(i, 1);

        // Calculate destination: next slot on the mesa, stacking within the play
        const playIdx = this.mesaHistorial.length;
        const destBase = this.posicionMesaXogada(playIdx);

        // Snapshot context for the callback
        const ctx = { xogador, cartas, es2Ouros, rangoXogada, mesmaRango };

        // Launch one AnimacionDesprazamento per card, all simultaneously
        for (let j = 0; j < cartas.length; j++) {
            const isLast = j === cartas.length - 1;
            const destY = destBase.y + j * 16;

            this.animacions.push(new AnimacionDesprazamento(
                this.assets, CW, CH, cartas[j].valor,
                srcPos[j].x, srcPos[j].y,
                destBase.x, destY,
                isLast ? () => this.enRemateXogada(ctx) : null,
                0.06
            ));
        }
    }

    // Called when the play animation finishes
    enRemateXogada({ xogador, cartas, es2Ouros, rangoXogada, mesmaRango }) {
        const man = this.mans[xogador];
        this.reproducirSon(`son_dar${1 + Math.floor(Math.random() * 6)}`);

        // Add play to the visible mesa history
        this.mesaHistorial.push({ cartas, xogador });

        if (es2Ouros) {
            // Check if player finished
            if (man.length === 0 && !this.acabaron[xogador]) {
                this.acabaron[xogador] = true;
                this.ordeFinalizacion.push(xogador);
            }

            if (this.ordeFinalizacion.length >= 3) {
                this.mostrarMsg(`${this.nomes[xogador]} corta co 2 de Ouros!`, 1200, () => {
                    this.finalizarRonda();
                });
                return;
            }

            const nextPlayer = this.acabaron[xogador]
                ? this.seguinteActivo(xogador)
                : xogador;

            this.mostrarMsg(`${this.nomes[xogador]} corta co 2 de Ouros!`, 1200, () => {
                this.mesaHistorial = [];
                this.resetarBaza();
                this.turnoActual = nextPlayer;
                this.iniciarTurno();
            });
            return;
        }

        // Update trick state
        if (this.baza.cantidade === 0) {
            this.baza.cantidade = cartas.length;
        }
        this.baza.rangoActual = rangoXogada;
        this.baza.ultimoXogador = xogador;

        // Check if player finished
        if (man.length === 0 && !this.acabaron[xogador]) {
            this.acabaron[xogador] = true;
            this.ordeFinalizacion.push(xogador);
            this.baza.pasaron.add(xogador);
        }

        if (this.ordeFinalizacion.length >= 3) {
            this.mostrarMsg(`${this.nomes[xogador]} rematou!`, 1200, () => {
                this.finalizarRonda();
            });
            return;
        }

        // Skip rule: same rank as previous play → skip next player's turn (not out of trick)
        if (mesmaRango) {
            const skipped = this.seguinteNoPasado(xogador);
            if (skipped !== -1 && skipped !== xogador) {
                this.saltado = skipped; // temporarily skip, not a permanent pass
                this.mostrarMsg(`${this.nomes[xogador]} xoga! ${this.nomes[skipped]} saltado!`, 900, () => {
                    this.avanzarTurno();
                });
                return;
            }
        }

        if (man.length === 0) {
            this.mostrarMsg(`${this.nomes[xogador]} rematou!`, 900, () => {
                this.avanzarTurno();
            });
            return;
        }

        this.avanzarTurno();
    }

    seguinteNoPasado(desde) {
        let next = (desde + 1) % 4;
        for (let i = 0; i < 4; i++) {
            if (!this.acabaron[next] && !this.baza.pasaron.has(next)) return next;
            next = (next + 1) % 4;
        }
        return -1;
    }

    finalizarRonda() {
        // Assign last remaining player as 4th
        for (let i = 0; i < 4; i++) {
            if (!this.acabaron[i]) {
                this.acabaron[i] = true;
                this.ordeFinalizacion.push(i);
                break;
            }
        }

        // Assign roles
        for (let pos = 0; pos < 4; pos++) {
            const xogador = this.ordeFinalizacion[pos];
            this.roles[xogador] = pos; // 0=Presidente, 1=Vice, 2=Viceculo, 3=Culo
        }

        this.victorias[this.ordeFinalizacion[0]]++;
        this.mesaHistorial = [];

        // Check if someone won the match
        const ganadorPartida = this.victorias.findIndex(v => v >= this.victoriasMeta);
        if (ganadorPartida !== -1) {
            this.ganadorPartida = ganadorPartida;
            this.estado = ESTADO.FIN_PARTIDA;
        } else {
            this.estado = ESTADO.FIN_RONDA;
        }
    }

    // ═══════════════════════════════════════════
    //  PLAYER INPUT
    // ═══════════════════════════════════════════

    xogarSeleccion() {
        if (this.estado !== ESTADO.XOGANDO || this.turnoActual !== 0) return;
        if (this.seleccion.size === 0) return;

        const indices = Array.from(this.seleccion).sort((a, b) => a - b);
        if (!this.validarXogada(0, indices)) {
            this.mostrarMsg('Xogada non valida!', 800);
            return;
        }

        this.seleccion.clear();
        this.xogarCartas(0, indices);
    }

    pasarTurno() {
        if (this.estado !== ESTADO.XOGANDO || this.turnoActual !== 0) return;
        if (this.baza.cantidade === 0) {
            this.mostrarMsg('Debes xogar ao liderar!', 800);
            return;
        }
        this.seleccion.clear();
        this.procesarPaso(0);
    }

    _cartaEnPunto(hp, entrada, selSet) {
        for (let i = hp.length - 1; i >= 0; i--) {
            const p = hp[i];
            const yo = selSet && selSet.has(i) ? -12 : 0;
            if (entrada.x >= p.x && entrada.x < p.x + CW &&
                entrada.y >= p.y + yo && entrada.y < p.y + yo + CH) {
                return i;
            }
        }
        return -1;
    }

    procesarClickCarta(entrada) {
        if (this.estado === ESTADO.INTERCAMBIO) {
            this.procesarClickIntercambio(entrada);
            return;
        }

        if (this.estado !== ESTADO.XOGANDO || this.turnoActual !== 0) return;
        if (this.tempMsg > 0 || this.animacions.length > 0) return;

        const hp = this.posicionsMan(this.mans[0].length);
        const i = this._cartaEnPunto(hp, entrada, this.seleccion);
        if (i >= 0) {
            if (this.seleccion.has(i)) this.seleccion.delete(i);
            else this.seleccion.add(i);
        }
    }

    procesarClickIntercambio(entrada) {
        if (this.tempMsg > 0) return;
        const hp = this.posicionsMan(this.mans[0].length);
        const i = this._cartaEnPunto(hp, entrada, this.intercambioSeleccion);
        if (i >= 0) {
            if (this.intercambioSeleccion.has(i)) this.intercambioSeleccion.delete(i);
            else if (this.intercambioSeleccion.size < this.intercambioNumRequerido) this.intercambioSeleccion.add(i);
        }
    }

    // ═══════════════════════════════════════════
    //  AI LOGIC
    // ═══════════════════════════════════════════

    executarIA(dt) {
        this.tempIA = (this.tempIA || 0) + dt;
        if (this.tempIA < 700) return;

        const idx = this.turnoActual;
        const man = this.mans[idx];
        const dif = this.dificultades[idx];

        if (!this.tenXogada(idx)) {
            if (this.baza.cantidade === 0) {
                // Shouldn't happen, but safeguard
                return;
            }
            this.procesarPaso(idx);
            return;
        }

        // AI decides what to play
        const xogada = this.decidirXogadaIA(idx, dif);

        if (xogada === null) {
            // Pass strategically
            this.procesarPaso(idx);
            return;
        }

        this.xogarCartas(idx, xogada);
    }

    decidirXogadaIA(xogador, dificultade) {
        const man = this.mans[xogador];
        const grupos = this.agruparPorRango(man);

        // Check for 2 de Ouros
        const idx2Ouros = man.findIndex(c => this.es2DeOuros(c));

        if (this.baza.cantidade === 0) {
            // Leading: choose what to play
            return this.iaLiderar(man, grupos, dificultade);
        }

        // Following: must match quantity and beat rank
        const cant = this.baza.cantidade;
        const rangoMin = this.baza.rangoActual;

        // Find valid groups
        const opcions = [];
        for (const [r, cartas] of Object.entries(grupos)) {
            const rank = parseInt(r);
            if (rank >= rangoMin && cartas.length >= cant) {
                opcions.push({ rank, cartas: cartas.slice(0, cant) });
            }
        }

        if (opcions.length === 0) {
            // Can only play 2 de Ouros or pass
            if (idx2Ouros !== -1 && dificultade === 'dificil') {
                // Hard AI: use 2 de Ouros strategically
                if (man.length <= 3) {
                    return [idx2Ouros];
                }
            }
            if (idx2Ouros !== -1 && dificultade === 'facil') {
                return Math.random() < 0.5 ? [idx2Ouros] : null;
            }
            return null; // pass
        }

        // Sort options by rank (ascending)
        opcions.sort((a, b) => a.rank - b.rank);

        if (dificultade === 'facil') {
            // Easy: play random valid option, sometimes pass
            if (Math.random() < 0.15 && opcions.length > 0) return null;
            const choice = opcions[Math.floor(Math.random() * opcions.length)];
            return choice.cartas.map(c => man.indexOf(c));
        }

        if (dificultade === 'dificil') {
            // Hard: play lowest valid, but save same-rank plays for skip potential
            // Prefer to pass if only high cards available and many cards left
            if (opcions[0].rank >= 7 && man.length > 5 && Math.random() < 0.3) {
                return null;
            }
        }

        // Medium/default: play lowest valid option
        const choice = opcions[0];
        return choice.cartas.map(c => man.indexOf(c));
    }

    iaLiderar(man, grupos, dificultade) {
        // Collect all possible leads: singles, pairs, triples, quads
        const leads = [];
        for (const [r, cartas] of Object.entries(grupos)) {
            const rank = parseInt(r);
            // Singles
            leads.push({ rank, cartas: [cartas[0]], size: 1 });
            // Pairs
            if (cartas.length >= 2) leads.push({ rank, cartas: cartas.slice(0, 2), size: 2 });
            // Triples
            if (cartas.length >= 3) leads.push({ rank, cartas: cartas.slice(0, 3), size: 3 });
            // Quads
            if (cartas.length >= 4) leads.push({ rank, cartas: cartas.slice(0, 4), size: 4 });
        }

        if (leads.length === 0) return null;

        if (dificultade === 'facil') {
            const choice = leads[Math.floor(Math.random() * leads.length)];
            return choice.cartas.map(c => man.indexOf(c));
        }

        // Medium/Hard: prefer to play low-rank multiples to get rid of cards
        leads.sort((a, b) => {
            // Prefer larger groups (get rid of more cards)
            if (b.size !== a.size) return b.size - a.size;
            // Then lower rank
            return a.rank - b.rank;
        });

        if (dificultade === 'dificil') {
            // Hard: play pairs/triples of low cards, keep high singles
            const multis = leads.filter(l => l.size >= 2);
            if (multis.length > 0) {
                multis.sort((a, b) => a.rank - b.rank);
                const choice = multis[0];
                return choice.cartas.map(c => man.indexOf(c));
            }
        }

        // Play the lowest single or largest group of lowest rank
        const choice = leads.sort((a, b) => {
            if (a.rank !== b.rank) return a.rank - b.rank;
            return b.size - a.size;
        })[0];
        return choice.cartas.map(c => man.indexOf(c));
    }

    // ═══════════════════════════════════════════
    //  POSITIONS
    // ═══════════════════════════════════════════

    posicionsMan(n) {
        if (n === 0) return [];
        const maxPerRow = 5;
        const pos = [];
        for (let i = 0; i < n; i++) {
            const row = Math.floor(i / maxPerRow);
            const col = i % maxPerRow;
            const inRow = Math.min(maxPerRow, n - row * maxPerRow);
            const rowW = inRow * CW + (inRow - 1) * GAP;
            const sx = (CANVAS_W - rowW) / 2;
            pos.push({
                x: sx + col * (CW + GAP),
                y: Y_PLAYER_HAND - row * (CH + 4)
            });
        }
        return pos;
    }

    // Position for the Nth play (pile) on the table, side by side
    posicionMesaXogada(idx) {
        const mesaY = 155;
        const slotW = CW + 6;
        // Count includes the incoming play (idx is 0-based, could equal mesaHistorial.length)
        const total = Math.max(idx + 1, this.mesaHistorial.length);
        const totalW = (total - 1) * slotW + CW;
        const startX = (CANVAS_W - totalW) / 2;
        return { x: startX + idx * slotW, y: mesaY };
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

    nomeCartaBreve(carta) {
        const nomesPuntos = ['', 'As', '2', '3', '4', '5', '6', '7', 'Sota', 'Caballo', 'Rey'];
        return `${nomesPuntos[carta.puntos()]} de ${NOMES_PALO[carta.palo()]}`;
    }

    // ═══════════════════════════════════════════
    //  UPDATE
    // ═══════════════════════════════════════════

    actualizar(entrada, dt) {
        // Pause handling
        if (this.pausado) {
            this.btnResumir.actualizar(entrada, dt);
            this.btnVolverMenu.actualizar(entrada, dt);
            this.director.canvas.style.cursor =
                (this.btnResumir.estado === 'peneirar' || this.btnVolverMenu.estado === 'peneirar') ? 'pointer' : 'default';
            return;
        }
        if (this._voltandoDePausa) { this._voltandoDePausa = false; return; }

        if (this.estado !== ESTADO.FIN_RONDA && this.estado !== ESTADO.FIN_PARTIDA) {
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
            case ESTADO.INTERCAMBIO:
                this.actualizarIntercambio(entrada, dt);
                break;
            case ESTADO.XOGANDO:
                this.actualizarXogo(entrada, dt);
                break;
            case ESTADO.FIN_RONDA:
                this.btnSeguinte.actualizar(entrada, dt);
                this.btnMenuFin.actualizar(entrada, dt);
                this.director.canvas.style.cursor =
                    (this.btnSeguinte.estado === 'peneirar' || this.btnMenuFin.estado === 'peneirar') ? 'pointer' : 'default';
                break;
            case ESTADO.FIN_PARTIDA:
                this.btnMenuFin.actualizar(entrada, dt);
                this.director.canvas.style.cursor =
                    this.btnMenuFin.estado === 'peneirar' ? 'pointer' : 'default';
                break;
        }
    }

    actualizarIntercambio(entrada, dt) {
        this.btnConfirmarIntercambio.deshabilitado =
            this.intercambioSeleccion.size !== this.intercambioNumRequerido;
        this.btnConfirmarIntercambio.actualizar(entrada, dt);

        // Hover & click on cards
        this.actualizarHover(entrada);
        if (entrada.clicado) this.procesarClickCarta(entrada);

        const anyHover = this.cartaHover >= 0 || this.btnConfirmarIntercambio.estado === 'peneirar';
        this.director.canvas.style.cursor = anyHover ? 'pointer' : 'default';
    }

    actualizarXogo(entrada, dt) {
        if (this.turnoActual === 0 && !this.acabaron[0]) {
            // Human turn
            const podeXogar = this.baza.cantidade === 0 || this.tenXogada(0);
            this.btnXogar.deshabilitado = this.seleccion.size === 0;
            this.btnPasar.deshabilitado = this.baza.cantidade === 0; // Can't pass when leading

            this.btnXogar.actualizar(entrada, dt);
            this.btnPasar.actualizar(entrada, dt);

            this.actualizarHover(entrada);
            if (entrada.clicado) this.procesarClickCarta(entrada);

            const anyHover = this.cartaHover >= 0 ||
                this.btnXogar.estado === 'peneirar' ||
                this.btnPasar.estado === 'peneirar';
            this.director.canvas.style.cursor = anyHover ? 'pointer' : 'default';
        } else {
            // AI turn
            this.director.canvas.style.cursor = 'default';
            this.executarIA(dt);
        }
    }

    actualizarHover(entrada) {
        this.cartaHover = -1;
        if (this.mans[0].length === 0) return;
        const hp = this.posicionsMan(this.mans[0].length);
        const selSet = this.estado === ESTADO.INTERCAMBIO ? this.intercambioSeleccion : this.seleccion;
        this.cartaHover = this._cartaEnPunto(hp, entrada, selSet);
    }

    // ═══════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════

    debuxar(ctx) {
        // Background
        ctx.fillStyle = '#1a3a1a';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        this.debuxarInfoIA(ctx);
        this.debuxarMesa(ctx);
        this.debuxarManXogador(ctx);
        this.debuxarInfoXogador(ctx);
        this.debuxarBotonsXogo(ctx);

        // Trick info
        this.debuxarInfoBaza(ctx);

        for (const anim of this.animacions) anim.debuxar(ctx);
        if (this.tempMsg > 0) this.debuxarMsg(ctx);
        if (this.estado === ESTADO.FIN_RONDA) this.debuxarFinRonda(ctx);
        if (this.estado === ESTADO.FIN_PARTIDA) this.debuxarFinPartida(ctx);

        if (!this.pausado && this.estado !== ESTADO.FIN_RONDA && this.estado !== ESTADO.FIN_PARTIDA) {
            this.btnCog.debuxar(ctx);
        }
        if (this.pausado) this.debuxarPausa(ctx);
    }

    debuxarInfoIA(ctx) {
        const barH = 38;
        for (let i = 0; i < 3; i++) {
            const iaIdx = i + 1;
            const y = 2 + i * (barH + 2);
            const isActive = this.turnoActual === iaIdx && this.estado === ESTADO.XOGANDO;

            // Bar background – stretches nearly full width
            const barX = 6, barW = CANVAS_W - 12;
            ctx.fillStyle = isActive ? 'rgba(255,215,0,0.15)' : 'rgba(0,0,0,0.3)';
            ctx.fillRect(barX, y, barW, barH);

            if (isActive) {
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = 1;
                ctx.strokeRect(barX, y, barW, barH);
            }

            // Color dot
            ctx.fillStyle = CORES_IA[i];
            ctx.fillRect(barX + 4, y + 4, 8, 8);

            // Name & cards
            ctx.fillStyle = isActive ? '#ffd700' : '#e0e0e0';
            ctx.font = '10px Minipixel';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(this.nomes[iaIdx], barX + 16, y + 3);

            // Card count
            const numCartas = this.mans[iaIdx].length;
            ctx.fillStyle = '#aaa';
            ctx.font = '9px Minipixel';
            ctx.fillText(`${numCartas} cartas`, barX + 16, y + 16);

            // Role
            if (this.roles[iaIdx] !== -1) {
                const roleIdx = this.roles[iaIdx];
                ctx.fillStyle = CORES_ROLES[roleIdx];
                ctx.font = '9px Minipixel';
                ctx.textAlign = 'right';
                ctx.fillText(ROLES[roleIdx], barX + barW - 6, y + 3);
            }

            // Finished indicator
            if (this.acabaron[iaIdx]) {
                ctx.fillStyle = '#4a4';
                ctx.font = '9px Minipixel';
                ctx.textAlign = 'right';
                const pos = this.ordeFinalizacion.indexOf(iaIdx) + 1;
                ctx.fillText(`${pos}o lugar`, barX + barW - 6, y + 16);
            }

            // Mini card backs (16×25 preserves the 48×76 card aspect ratio)
            if (!this.acabaron[iaIdx]) {
                const dorso = this.assets['dorso'];
                if (dorso) {
                    const miniW = 16, miniH = 25;
                    const cardStartX = barX + barW - 6 - Math.min(numCartas, 10) * (miniW + 2);
                    for (let j = 0; j < Math.min(numCartas, 10); j++) {
                        ctx.drawImage(dorso, cardStartX + j * (miniW + 2), y + barH - miniH - 2, miniW, miniH);
                    }
                }
            }
        }
    }

    debuxarMesa(ctx) {
        // Draw all plays in the current trick, side by side with stacking
        for (let p = 0; p < this.mesaHistorial.length; p++) {
            const play = this.mesaHistorial[p];
            const base = this.posicionMesaXogada(p);

            // Player name label above the pile
            ctx.fillStyle = play.xogador === 0 ? '#e0e0e0' : CORES_IA[play.xogador - 1];
            ctx.font = '8px Minipixel';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(this.nomes[play.xogador], base.x + CW / 2, base.y - 4);

            // Draw cards stacked: bottom card first, each +16px Y offset
            for (let j = 0; j < play.cartas.length; j++) {
                const img = this.assets[play.cartas[j].valor.toString()];
                if (img) {
                    ctx.drawImage(img, base.x, base.y + j * 16, CW, CH);
                }
            }
        }

        // Trick requirement info below the mesa area
        if (this.baza.cantidade > 0) {
            const stackH = (this.baza.cantidade - 1) * 16 + CH;
            const cantText = this.baza.cantidade === 1 ? 'carta' :
                             this.baza.cantidade === 2 ? 'parella' :
                             this.baza.cantidade === 3 ? 'trinca' : 'poker';
            ctx.fillStyle = '#888';
            ctx.font = '8px Minipixel';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(`Requirido: ${cantText}`, CANVAS_W / 2, 155 + stackH + 12);
        }
    }

    debuxarInfoBaza(ctx) {
        // Show who has passed in current trick
        if (this.baza.cantidade > 0 && this.estado === ESTADO.XOGANDO) {
            const stackH = (this.baza.cantidade - 1) * 16 + CH;
            const y = 155 + stackH + 28;
            ctx.font = '8px Minipixel';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';

            let txt = '';
            for (let i = 0; i < 4; i++) {
                if (!this.acabaron[i] && this.baza.pasaron.has(i)) {
                    txt += (txt ? ', ' : '') + this.nomes[i];
                }
            }
            if (txt) {
                ctx.fillStyle = '#a66';
                ctx.fillText(`Pasaron: ${txt}`, CANVAS_W / 2, y);
            }
        }

        // Turn indicator
        if (this.estado === ESTADO.XOGANDO && this.tempMsg <= 0) {
            ctx.fillStyle = '#ffd700';
            ctx.font = '10px Minipixel';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            const turnoTxt = this.baza.cantidade === 0 ? 'Lidera' : 'Turno';
            ctx.fillText(`${turnoTxt}: ${this.nomes[this.turnoActual]}`, CANVAS_W / 2, 132);
        }

        // Round info
        ctx.fillStyle = '#666';
        ctx.font = '8px Minipixel';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`Ronda ${this.ronda}`, 34, 128);
    }

    debuxarManXogador(ctx) {
        const man = this.mans[0];
        if (!man || man.length === 0) return;
        const hp = this.posicionsMan(man.length);
        const isInterchange = this.estado === ESTADO.INTERCAMBIO;
        const isPlayerTurn = this.estado === ESTADO.XOGANDO && this.turnoActual === 0;
        const selSet = isInterchange ? this.intercambioSeleccion : this.seleccion;

        for (let i = 0; i < man.length; i++) {
            const p = hp[i];
            const selected = selSet.has(i);
            const isHover = i === this.cartaHover;
            const yo = selected ? -12 : (isHover ? -6 : 0);

            // Draw selection highlight
            if (selected) {
                ctx.fillStyle = isInterchange ? 'rgba(255,100,100,0.3)' : 'rgba(100,255,100,0.3)';
                ctx.fillRect(p.x - 1, p.y + yo - 1, CW + 2, CH + 2);
            }

            const img = this.assets[man[i].valor.toString()];
            if (img) ctx.drawImage(img, p.x, p.y + yo, CW, CH);

            if (selected) {
                ctx.strokeStyle = isInterchange ? '#ff6666' : '#66ff66';
                ctx.lineWidth = 2;
                ctx.strokeRect(p.x - 1, p.y + yo - 1, CW + 2, CH + 2);
            } else if (isHover && (isPlayerTurn || isInterchange)) {
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = 1;
                ctx.strokeRect(p.x - 1, p.y + yo - 1, CW + 2, CH + 2);
            }
        }
    }

    debuxarInfoXogador(ctx) {
        // Player info bar at bottom
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, Y_PLAYER_INFO, CANVAS_W, 24);
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '9px Minipixel';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';

        let txt = `Ti: ${this.mans[0].length} cartas`;
        if (this.roles[0] !== -1) {
            txt += ` | ${ROLES[this.roles[0]]}`;
        }
        ctx.fillText(txt, 8, Y_PLAYER_INFO + 13);

        if (this.victorias[0] > 0) {
            ctx.fillStyle = '#ffd700';
            ctx.textAlign = 'right';
            ctx.fillText(`Victorias: ${this.victorias[0]}`, CANVAS_W - 8, Y_PLAYER_INFO + 13);
        }
    }

    debuxarBotonsXogo(ctx) {
        if (this.estado === ESTADO.XOGANDO && this.turnoActual === 0 && !this.acabaron[0] && this.tempMsg <= 0) {
            this.btnXogar.debuxar(ctx);
            this.btnPasar.debuxar(ctx);
        }
        if (this.estado === ESTADO.INTERCAMBIO && this.tempMsg <= 0) {
            this.btnConfirmarIntercambio.debuxar(ctx);

            // Instruction text
            ctx.fillStyle = '#ffd700';
            ctx.font = '9px Minipixel';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            const numStr = this.intercambioNumRequerido === 2 ? '2 cartas' : '1 carta';
            ctx.fillText(`Selecciona ${numStr} para entregar`, CANVAS_W / 2, Y_BUTTONS - 10);
        }
    }

    debuxarMsg(ctx) {
        ctx.font = '12px Minipixel';
        const textW = ctx.measureText(this.mensaxe).width;
        const w = Math.max(220, textW + 40), h = 34;
        const x = (CANVAS_W - w) / 2;
        const y = CANVAS_H / 2 - 40;

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

    debuxarFinRonda(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        const popW = 240, lineH = 20;
        const contentH = 40 + 4 * lineH + 30;
        const popH = contentH + 80;
        const popX = CANVAS_W / 2 - popW / 2;
        const popY = CANVAS_H / 2 - popH / 2 - 10;

        // Shadow + box
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(popX + 3, popY + 3, popW, popH);
        ctx.fillStyle = '#222';
        ctx.fillRect(popX, popY, popW, popH);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.strokeRect(popX, popY, popW, popH);

        // Title
        ctx.fillStyle = '#ffd700';
        ctx.font = '14px Minipixel';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const winner = this.ordeFinalizacion[0];
        ctx.fillText(winner === 0 ? 'Es Presidente!' : `${this.nomes[winner]} e Presidente`, popX + popW / 2, popY + 12);

        // Results
        ctx.font = '10px Minipixel';
        let y = popY + 42;
        for (let pos = 0; pos < 4; pos++) {
            const xogador = this.ordeFinalizacion[pos];
            ctx.fillStyle = CORES_ROLES[pos];
            ctx.fillText(`${pos + 1}o - ${ROLES[pos]}: ${this.nomes[xogador]}`, popX + popW / 2, y);
            y += lineH;
        }

        // Victory counts
        y += 10;
        ctx.fillStyle = '#888';
        ctx.font = '9px Minipixel';
        ctx.fillText(`Victorias (${this.victoriasMeta} para ganar):`, popX + popW / 2, y);
        y += 14;
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = i === 0 ? '#e0e0e0' : CORES_IA[i - 1];
            ctx.fillText(`${this.nomes[i]}: ${this.victorias[i]}`, popX + popW / 2, y);
            y += 12;
        }

        ctx.textBaseline = 'alphabetic';

        // Reposition buttons
        this.btnSeguinte.y = popY + popH - 52;
        this.btnMenuFin.y = popY + popH - 18;
        this.btnSeguinte.debuxar(ctx);
        this.btnMenuFin.debuxar(ctx);
    }

    debuxarFinPartida(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        const popW = 240, lineH = 16;
        const popH = 200;
        const popX = CANVAS_W / 2 - popW / 2;
        const popY = CANVAS_H / 2 - popH / 2 - 10;

        // Shadow + box
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(popX + 3, popY + 3, popW, popH);
        ctx.fillStyle = '#222';
        ctx.fillRect(popX, popY, popW, popH);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.strokeRect(popX, popY, popW, popH);

        // Title
        ctx.fillStyle = '#ffd700';
        ctx.font = '16px Minipixel';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const g = this.ganadorPartida;
        ctx.fillText(g === 0 ? 'Ganaches a partida!' : `${this.nomes[g]} gana a partida!`, popX + popW / 2, popY + 12);

        // Subtitle
        ctx.fillStyle = '#ccc';
        ctx.font = '10px Minipixel';
        ctx.fillText(`${this.victoriasMeta} victorias alcanzadas`, popX + popW / 2, popY + 34);

        // Final scores
        let y = popY + 60;
        ctx.font = '10px Minipixel';
        for (let i = 0; i < 4; i++) {
            const isWinner = i === g;
            ctx.fillStyle = isWinner ? '#ffd700' : (i === 0 ? '#e0e0e0' : CORES_IA[i - 1]);
            ctx.fillText(`${this.nomes[i]}: ${this.victorias[i]} victorias${isWinner ? ' \u2605' : ''}`, popX + popW / 2, y);
            y += lineH;
        }

        // Rounds played
        y += 8;
        ctx.fillStyle = '#888';
        ctx.font = '9px Minipixel';
        ctx.fillText(`${this.ronda} rondas xogadas`, popX + popW / 2, y);

        ctx.textBaseline = 'alphabetic';

        // Menu button
        this.btnMenuFin.y = popY + popH - 36;
        this.btnMenuFin.debuxar(ctx);
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
