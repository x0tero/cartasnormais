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

const PILE_Y = 200;
const BARALLA_X = CANVAS_W / 2 - CW - 15;
const DESCARTE_X = CANVAS_W / 2 + 15;

const NOMES_PALO = ['Ouros', 'Copas', 'Espadas', 'Bastos'];
const CORES_IA = ['#e03030', '#3070e0', '#30b040'];

const ESTADO = {
    XOGANDO: 0,
    FIN_RONDA: 1,
    FIN_PARTIDA: 2,
};

const FASE = {
    ROUBAR: 0,
    DESCARTAR: 1,
};

export default class Chinchon extends Escena {
    constructor(director, config = {}) {
        super(director);
        this.assets = director.assets;
        this.config = config;

        const dificultades = config.dificultades || ['medio'];
        this.numXogadores = (config.numOponentes || 1) + 1;

        this.nomes = ['Ti', 'IA 1', 'IA 2', 'IA 3'].slice(0, this.numXogadores);
        this.dificultades = ['humano', ...dificultades.slice(0, this.numXogadores - 1)];
        while (this.dificultades.length < this.numXogadores) this.dificultades.push('medio');

        // Persistent state across rounds
        this.puntuacions = new Array(this.numXogadores).fill(0);
        this.eliminados = new Array(this.numXogadores).fill(false);
        this.ronda = 0;

        // Per-round state
        this.mans = [];
        this.baralla = null;
        this.descartes = [];
        this.turnoActual = 0;
        this.fase = FASE.ROUBAR;

        // UI state
        this.estado = ESTADO.XOGANDO;
        this.mensaxe = '';
        this.tempMsg = 0;
        this.msgEnRemate = null;
        this.animacions = [];
        this.pausado = false;
        this._voltandoDePausa = false;
        this.cartaHover = -1;
        this.seleccion = -1;
        this.resultadoRonda = null;

        // ── Buttons: Draw phase ──
        this.btnRoubarBaralla = new Boton(
            CANVAS_W / 2 - 100, Y_BUTTONS, 90, 28,
            ['#2a7a2a', '#3a9a3a', '#1a5a1a', '#333'],
            [], 'Baralla',
            () => this.procesarRoubar('baralla'),
            { corTexto: '#fff', tamanhoTexto: 10 }
        );
        this.btnRoubarDescarte = new Boton(
            CANVAS_W / 2 + 10, Y_BUTTONS, 90, 28,
            ['#7a7a2a', '#9a9a3a', '#5a5a1a', '#333'],
            [], 'Descarte',
            () => this.procesarRoubar('descarte'),
            { corTexto: '#fff', tamanhoTexto: 10 }
        );

        // ── Buttons: Discard phase ──
        this.btnDescartar = new Boton(
            CANVAS_W / 2 - 100, Y_BUTTONS, 90, 28,
            ['#7a2a2a', '#9a3a3a', '#5a1a1a', '#333'],
            [], 'Descartar',
            () => this.procesarDescartar(),
            { corTexto: '#fff', tamanhoTexto: 10 }
        );
        this.btnPechar = new Boton(
            CANVAS_W / 2 + 10, Y_BUTTONS, 90, 28,
            ['#2a2a7a', '#3a3a9a', '#1a1a5a', '#333'],
            [], 'Pechar',
            () => this.procesarPechar(),
            { corTexto: '#fff', tamanhoTexto: 10 }
        );

        // ── Pause ──
        const numIA = this.numXogadores - 1;
        const cogY = 2 + numIA * 40 + 4;
        this.btnCog = new Boton(
            6, cogY, 24, 24,
            ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.6)'],
            [], '\u2699', () => { this.pausado = true; },
            { corTexto: '#fff', tamanhoTexto: 10 }
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
            { corTexto: '#fff', tamanhoTexto: 10 }
        );
        this.btnVolverMenu = new Boton(
            pbx, popupY + 82, pbw, pbh,
            ['#7a2a2a', '#9a3a3a', '#5a1a1a'], [], 'Volver ao menu',
            () => { import('./Menu.js').then(m => this.director.cambiarEscena(new m.default(this.director))); },
            { corTexto: '#fff', tamanhoTexto: 10 }
        );

        // ── End-of-round / end-of-match buttons ──
        this.btnSeguinte = new Boton(
            CANVAS_W / 2 - 55, CANVAS_H / 2 + 80, 110, 32,
            ['#2a2a7a', '#3a3a9a', '#1a1a5a'], [], 'Seguinte ronda',
            () => this.iniciarRonda(),
            { corTexto: '#fff', tamanhoTexto: 10 }
        );
        this.btnMenuFin = new Boton(
            CANVAS_W / 2 - 55, CANVAS_H / 2 + 120, 110, 32,
            ['#7a2a2a', '#9a3a3a', '#5a1a1a'], [], 'Menu',
            () => { import('./Menu.js').then(m => this.director.cambiarEscena(new m.default(this.director))); },
            { corTexto: '#fff', tamanhoTexto: 10 }
        );

        this.iniciarRonda();
    }

    // ═══════════════════════════════════════════
    //  CARD HELPERS
    // ═══════════════════════════════════════════

    // Penalty value: 1-7 face value, Sota/Caballo/Rey = 10
    valorPenalizacion(carta) {
        const p = carta.puntos();
        return p <= 7 ? p : 10;
    }

    // Sort by suit, then by rank within suit (ideal for spotting runs)
    ordenarMan(man) {
        man.sort((a, b) => {
            if (a.palo() !== b.palo()) return a.palo() - b.palo();
            return a.puntos() - b.puntos();
        });
    }

    nomeCartaBreve(carta) {
        const nomesPuntos = ['', 'As', '2', '3', '4', '5', '6', '7', 'Sota', 'Caballo', 'Rey'];
        return `${nomesPuntos[carta.puntos()]} de ${NOMES_PALO[carta.palo()]}`;
    }

    // ═══════════════════════════════════════════
    //  MELD DETECTION
    // ═══════════════════════════════════════════

    // Set: 3-4 cards of the same rank, all different suits
    isSet(cards) {
        if (cards.length < 3) return false;
        return cards.every(c => c.puntos() === cards[0].puntos()) &&
               new Set(cards.map(c => c.palo())).size === cards.length;
    }

    // Run: 3+ consecutive puntos of the same suit
    isRun(cards) {
        if (cards.length < 3) return false;
        const suit = cards[0].palo();
        if (!cards.every(c => c.palo() === suit)) return false;
        const sorted = [...cards].sort((a, b) => a.puntos() - b.puntos());
        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i].puntos() !== sorted[i - 1].puntos() + 1) return false;
        }
        return true;
    }

    // Chinchon: exactly 7 consecutive cards of the same suit
    isChinchon(hand) {
        if (hand.length !== 7) return false;
        const suit = hand[0].palo();
        if (!hand.every(c => c.palo() === suit)) return false;
        const sorted = [...hand].sort((a, b) => a.puntos() - b.puntos());
        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i].puntos() !== sorted[i - 1].puntos() + 1) return false;
        }
        return true;
    }

    // Enumerate every possible meld from a hand
    findAllMelds(hand) {
        const melds = [];

        // ── Sets (same rank, different suits) ──
        const byRank = {};
        for (const c of hand) {
            const r = c.puntos();
            if (!byRank[r]) byRank[r] = [];
            byRank[r].push(c);
        }
        for (const cards of Object.values(byRank)) {
            if (cards.length >= 4) {
                melds.push({ type: 'set', cards: [...cards] });
                for (let i = 0; i < cards.length; i++) {
                    melds.push({ type: 'set', cards: cards.filter((_, j) => j !== i) });
                }
            } else if (cards.length >= 3) {
                melds.push({ type: 'set', cards: [...cards] });
            }
        }

        // ── Runs (consecutive same suit) ──
        const bySuit = {};
        for (const c of hand) {
            const s = c.palo();
            if (!bySuit[s]) bySuit[s] = [];
            bySuit[s].push(c);
        }
        for (const cards of Object.values(bySuit)) {
            const sorted = [...cards].sort((a, b) => a.puntos() - b.puntos());
            for (let start = 0; start < sorted.length; start++) {
                const run = [sorted[start]];
                for (let j = start + 1; j < sorted.length; j++) {
                    if (sorted[j].puntos() === run[run.length - 1].puntos() + 1) {
                        run.push(sorted[j]);
                        if (run.length >= 3) {
                            melds.push({ type: 'run', cards: [...run] });
                        }
                    } else {
                        break;
                    }
                }
            }
        }

        return melds;
    }

    // Find the non-overlapping combination of melds that minimises deadwood
    findBestMelds(hand) {
        const allMelds = this.findAllMelds(hand);
        let bestDeadwood = hand.reduce((s, c) => s + this.valorPenalizacion(c), 0);
        let bestMelds = [];

        const used = new Set();
        const currentMelds = [];

        const backtrack = (startIdx) => {
            const deadwood = hand
                .filter(c => !used.has(c))
                .reduce((s, c) => s + this.valorPenalizacion(c), 0);

            if (deadwood < bestDeadwood) {
                bestDeadwood = deadwood;
                bestMelds = currentMelds.map(m => ({ type: m.type, cards: [...m.cards] }));
            }
            if (deadwood === 0) return;

            for (let i = startIdx; i < allMelds.length; i++) {
                const meld = allMelds[i];
                if (meld.cards.every(c => !used.has(c))) {
                    for (const c of meld.cards) used.add(c);
                    currentMelds.push(meld);
                    backtrack(i + 1);
                    currentMelds.pop();
                    for (const c of meld.cards) used.delete(c);
                }
            }
        };

        backtrack(0);

        const matched = new Set();
        for (const m of bestMelds) for (const c of m.cards) matched.add(c);
        const unmatched = hand.filter(c => !matched.has(c));

        return { melds: bestMelds, deadwood: bestDeadwood, unmatched };
    }

    // Can a card be added to an existing meld on the table?
    canLayOff(card, meld) {
        if (meld.type === 'set') {
            if (meld.cards.length >= 4) return false;
            if (card.puntos() !== meld.cards[0].puntos()) return false;
            return !meld.cards.some(c => c.palo() === card.palo());
        }
        if (meld.type === 'run') {
            if (card.palo() !== meld.cards[0].palo()) return false;
            const sorted = [...meld.cards].sort((a, b) => a.puntos() - b.puntos());
            const minP = sorted[0].puntos();
            const maxP = sorted[sorted.length - 1].puntos();
            return card.puntos() === minP - 1 || card.puntos() === maxP + 1;
        }
        return false;
    }

    // ═══════════════════════════════════════════
    //  GAME FLOW
    // ═══════════════════════════════════════════

    iniciarRonda() {
        this.ronda++;
        this.baralla = new Baralla();
        this.mans = [];
        for (let i = 0; i < this.numXogadores; i++) this.mans.push([]);
        this.descartes = [];
        this.seleccion = -1;
        this.animacions = [];
        this.resultadoRonda = null;

        // Deal 7 cards to each active player
        for (let c = 0; c < 7; c++) {
            for (let i = 0; i < this.numXogadores; i++) {
                if (!this.eliminados[i]) {
                    this.mans[i].push(this.baralla.roubar());
                }
            }
        }

        // Flip one card to start the discard pile
        this.descartes.push(this.baralla.roubar());

        for (const man of this.mans) this.ordenarMan(man);
        this.reproducirSon('son_barallar');

        this.turnoActual = this.seguinteActivo(-1);
        this.fase = FASE.ROUBAR;
        this.estado = ESTADO.XOGANDO;

        this.mostrarMsg(`Ronda ${this.ronda}`, 1200, () => this.iniciarTurno());
    }

    seguinteActivo(desde) {
        let next = (desde + 1) % this.numXogadores;
        for (let i = 0; i < this.numXogadores; i++) {
            if (!this.eliminados[next]) return next;
            next = (next + 1) % this.numXogadores;
        }
        return -1;
    }

    xogadoresActivos() {
        let count = 0;
        for (let i = 0; i < this.numXogadores; i++) {
            if (!this.eliminados[i]) count++;
        }
        return count;
    }

    iniciarTurno() {
        this.fase = FASE.ROUBAR;
        this.seleccion = -1;
        if (this.turnoActual !== 0) {
            this.tempIA = 0;
        }
    }

    avanzarTurno() {
        this.turnoActual = this.seguinteActivo(this.turnoActual);
        this.iniciarTurno();
    }

    reshuffleDiscard() {
        if (this.descartes.length <= 1) return;
        const topCard = this.descartes.pop();
        while (this.descartes.length > 0) {
            this.baralla.cartas.push(this.descartes.pop());
        }
        this.descartes = [topCard];
        this.baralla.barallar();
        this.reproducirSon('son_barallar');
    }

    // ═══════════════════════════════════════════
    //  DRAW & DISCARD
    // ═══════════════════════════════════════════

    procesarRoubar(fonte) {
        if (this.estado !== ESTADO.XOGANDO || this.fase !== FASE.ROUBAR) return;
        if (this.turnoActual !== 0) return;
        this._executarRoubar(this.turnoActual, fonte);
    }

    _executarRoubar(xogador, fonte) {
        let carta;
        let srcX, srcY;

        if (fonte === 'baralla') {
            if (this.baralla.restantes() === 0) this.reshuffleDiscard();
            if (this.baralla.restantes() === 0) return;
            carta = this.baralla.roubar();
            srcX = BARALLA_X;
            srcY = PILE_Y;
        } else {
            if (this.descartes.length === 0) return;
            carta = this.descartes.pop();
            srcX = DESCARTE_X;
            srcY = PILE_Y;
        }

        this.mans[xogador].push(carta);
        this.ordenarMan(this.mans[xogador]);

        const cardIdx = this.mans[xogador].indexOf(carta);
        const hp = this.posicionsMan(this.mans[xogador].length);

        let destX, destY;
        if (xogador === 0) {
            destX = hp[cardIdx].x;
            destY = hp[cardIdx].y;
        } else {
            const iaIdx = xogador - 1;
            destX = CANVAS_W - 30;
            destY = 2 + iaIdx * 40 + 8;
        }

        // Human always sees own card; AI: show face only when drawing from discard
        let cardId;
        if (xogador === 0) {
            cardId = carta.valor;
        } else {
            cardId = fonte === 'descarte' ? carta.valor : 'dorso';
        }

        this.animacions.push(new AnimacionDesprazamento(
            this.assets, CW, CH, cardId,
            srcX, srcY, destX, destY,
            () => {
                this.reproducirSon(`son_dar${1 + Math.floor(Math.random() * 6)}`);
                this.fase = FASE.DESCARTAR;
                this.seleccion = -1;
                this.tempIA = 0;
            },
            0.06
        ));
    }

    procesarDescartar() {
        if (this.estado !== ESTADO.XOGANDO || this.fase !== FASE.DESCARTAR) return;
        if (this.turnoActual !== 0 || this.seleccion < 0) return;
        this._executarDescartar(0, this.seleccion, false);
    }

    procesarPechar() {
        if (this.estado !== ESTADO.XOGANDO || this.fase !== FASE.DESCARTAR) return;
        if (this.turnoActual !== 0 || this.seleccion < 0) return;

        const testMan = this.mans[0].filter((_, i) => i !== this.seleccion);
        const { deadwood } = this.findBestMelds(testMan);
        if (deadwood > 5) {
            this.mostrarMsg('Necesitas 5 ou menos puntos sen combinar!', 1000);
            return;
        }
        this._executarDescartar(0, this.seleccion, true);
    }

    _executarDescartar(xogador, cardIdx, pechar) {
        const man = this.mans[xogador];
        const carta = man[cardIdx];

        let srcX, srcY;
        if (xogador === 0) {
            const hp = this.posicionsMan(man.length);
            srcX = hp[cardIdx].x;
            srcY = hp[cardIdx].y;
        } else {
            const iaIdx = xogador - 1;
            srcX = CANVAS_W - 30;
            srcY = 2 + iaIdx * 40 + 8;
        }

        man.splice(cardIdx, 1);
        this.descartes.push(carta);

        const cardId = pechar ? 'dorso' : carta.valor;

        this.animacions.push(new AnimacionDesprazamento(
            this.assets, CW, CH, cardId,
            srcX, srcY, DESCARTE_X, PILE_Y,
            () => {
                this.reproducirSon(`son_dar${1 + Math.floor(Math.random() * 6)}`);
                this.seleccion = -1;
                if (pechar) {
                    this.resolverCerrar(xogador);
                } else {
                    this.avanzarTurno();
                }
            },
            0.06
        ));
    }

    // ═══════════════════════════════════════════
    //  CLOSING & ROUND END
    // ═══════════════════════════════════════════

    resolverCerrar(cerrador) {
        const manCerrador = this.mans[cerrador];

        // ── Chinchon check ──
        if (this.isChinchon(manCerrador)) {
            this.resultadoRonda = { cerrador, chinchon: true, resultados: [], newlyEliminated: [] };
            this.ganadorPartida = cerrador;
            this.mostrarMsg(
                cerrador === 0 ? 'CHINCHON!' : `${this.nomes[cerrador]} fai CHINCHON!`,
                2000,
                () => { this.estado = ESTADO.FIN_PARTIDA; }
            );
            return;
        }

        // ── Closer's melds ──
        const cerradorResult = this.findBestMelds(manCerrador);
        const pecharPerfeito = cerradorResult.deadwood === 0;

        // Collect all melds on the table (for possible lay-off)
        const allMelds = cerradorResult.melds.map(m => ({ type: m.type, cards: [...m.cards] }));

        // ── Other players' melds ──
        const resultados = [];
        for (let i = 0; i < this.numXogadores; i++) {
            if (this.eliminados[i]) {
                resultados.push({ melds: [], unmatched: [], deadwood: 0, penalty: 0 });
                continue;
            }
            if (i === cerrador) {
                resultados.push({
                    melds: cerradorResult.melds,
                    unmatched: [...cerradorResult.unmatched],
                    deadwood: cerradorResult.deadwood,
                    penalty: pecharPerfeito ? -10 : cerradorResult.deadwood
                });
                continue;
            }
            const result = this.findBestMelds(this.mans[i]);
            allMelds.push(...result.melds.map(m => ({ type: m.type, cards: [...m.cards] })));
            resultados.push({
                melds: result.melds,
                unmatched: [...result.unmatched],
                deadwood: result.deadwood,
                penalty: result.deadwood
            });
        }

        // ── Lay-off phase (only when closer had > 0 deadwood) ──
        if (!pecharPerfeito) {
            let changed = true;
            while (changed) {
                changed = false;
                for (let i = 0; i < this.numXogadores; i++) {
                    if (this.eliminados[i]) continue;
                    const unmatched = resultados[i].unmatched;
                    for (let j = unmatched.length - 1; j >= 0; j--) {
                        for (const meld of allMelds) {
                            if (this.canLayOff(unmatched[j], meld)) {
                                meld.cards.push(unmatched[j]);
                                if (meld.type === 'run') {
                                    meld.cards.sort((a, b) => a.puntos() - b.puntos());
                                }
                                unmatched.splice(j, 1);
                                changed = true;
                                break;
                            }
                        }
                    }
                }
            }

            // Recalculate penalties after lay-off
            for (let i = 0; i < this.numXogadores; i++) {
                if (this.eliminados[i]) continue;
                resultados[i].deadwood = resultados[i].unmatched.reduce(
                    (s, c) => s + this.valorPenalizacion(c), 0
                );
                if (i !== cerrador) {
                    resultados[i].penalty = resultados[i].deadwood;
                }
            }
        }

        // ── Apply penalties ──
        const newlyEliminated = [];
        for (let i = 0; i < this.numXogadores; i++) {
            if (this.eliminados[i]) continue;
            this.puntuacions[i] += resultados[i].penalty;
            if (this.puntuacions[i] >= 100) {
                this.eliminados[i] = true;
                newlyEliminated.push(i);
            }
        }

        this.resultadoRonda = { cerrador, chinchon: false, pecharPerfeito, resultados, newlyEliminated };

        // ── Check game-over conditions ──
        const activos = this.xogadoresActivos();
        const humanOut = this.eliminados[0];

        const msg = cerrador === 0
            ? 'Pechaches a ronda!'
            : `${this.nomes[cerrador]} pechou!`;

        this.mostrarMsg(msg, 1500, () => {
            if (activos <= 1 || humanOut) {
                this.ganadorPartida = -1;
                for (let i = 0; i < this.numXogadores; i++) {
                    if (!this.eliminados[i]) { this.ganadorPartida = i; break; }
                }
                this.estado = ESTADO.FIN_PARTIDA;
            } else {
                this.estado = ESTADO.FIN_RONDA;
            }
        });
    }

    // ═══════════════════════════════════════════
    //  PLAYER INPUT
    // ═══════════════════════════════════════════

    procesarClickCarta(entrada) {
        if (this.estado !== ESTADO.XOGANDO || this.turnoActual !== 0) return;
        if (this.tempMsg > 0 || this.animacions.length > 0) return;

        if (this.fase === FASE.ROUBAR) {
            // Click on discard pile
            if (this.descartes.length > 0 &&
                entrada.x >= DESCARTE_X && entrada.x <= DESCARTE_X + CW &&
                entrada.y >= PILE_Y && entrada.y <= PILE_Y + CH) {
                this.procesarRoubar('descarte');
                return;
            }
            // Click on draw pile
            if ((this.baralla.restantes() > 0 || this.descartes.length > 1) &&
                entrada.x >= BARALLA_X && entrada.x <= BARALLA_X + CW &&
                entrada.y >= PILE_Y && entrada.y <= PILE_Y + CH) {
                this.procesarRoubar('baralla');
                return;
            }
            return;
        }

        // Discard phase: select a card from hand
        const hp = this.posicionsMan(this.mans[0].length);
        for (let i = hp.length - 1; i >= 0; i--) {
            const p = hp[i];
            const yo = this.seleccion === i ? -12 : 0;
            if (entrada.x >= p.x && entrada.x < p.x + CW &&
                entrada.y >= p.y + yo && entrada.y < p.y + yo + CH) {
                this.seleccion = this.seleccion === i ? -1 : i;
                return;
            }
        }
    }

    // ═══════════════════════════════════════════
    //  AI LOGIC
    // ═══════════════════════════════════════════

    executarIA(dt) {
        this.tempIA = (this.tempIA || 0) + dt;

        if (this.fase === FASE.ROUBAR) {
            if (this.tempIA < 700) return;
            const fonte = this._iaDecidirRoubar(this.turnoActual, this.dificultades[this.turnoActual]);
            this._executarRoubar(this.turnoActual, fonte);
        } else if (this.fase === FASE.DESCARTAR) {
            if (this.tempIA < 500) return;
            this._iaDescartar(this.turnoActual);
        }
    }

    _iaDecidirRoubar(xogador, dificultade) {
        if (this.descartes.length === 0) return 'baralla';

        if (dificultade === 'facil') {
            return Math.random() < 0.25 ? 'descarte' : 'baralla';
        }

        const man = this.mans[xogador];
        const topDescarte = this.descartes[this.descartes.length - 1];
        const currentResult = this.findBestMelds(man);

        // Test: if we take the discard card, what's the best possible hand?
        const testHand = [...man, topDescarte];
        let bestImprovement = 0;
        for (let i = 0; i < testHand.length; i++) {
            const reduced = testHand.filter((_, j) => j !== i);
            const result = this.findBestMelds(reduced);
            const improvement = currentResult.deadwood - result.deadwood;
            if (improvement > bestImprovement) bestImprovement = improvement;
        }

        if (dificultade === 'dificil') return bestImprovement >= 2 ? 'descarte' : 'baralla';
        return bestImprovement >= 3 ? 'descarte' : 'baralla'; // medio
    }

    _iaDescartar(xogador) {
        const man = this.mans[xogador];
        const dif = this.dificultades[xogador];

        // Find the best card to discard
        let bestIdx = 0;
        let bestDeadwood = Infinity;

        for (let i = 0; i < man.length; i++) {
            const testMan = man.filter((_, j) => j !== i);
            const { deadwood } = this.findBestMelds(testMan);
            if (deadwood < bestDeadwood) {
                bestDeadwood = deadwood;
                bestIdx = i;
            }
        }

        // Should the AI close?
        let shouldClose = false;
        if (bestDeadwood <= 5) {
            const testMan = man.filter((_, j) => j !== bestIdx);
            if (this.isChinchon(testMan)) {
                shouldClose = true;
            } else {
                switch (dif) {
                    case 'facil':   shouldClose = bestDeadwood === 0; break;
                    case 'medio':   shouldClose = bestDeadwood <= 3; break;
                    case 'dificil': shouldClose = bestDeadwood <= 5; break;
                }
            }
        }

        this._executarDescartar(xogador, bestIdx, shouldClose);
    }

    // ═══════════════════════════════════════════
    //  POSITIONS
    // ═══════════════════════════════════════════

    posicionsMan(n) {
        if (n === 0) return [];
        const maxW = CANVAS_W - 20;
        const cardSpace = n <= 1 ? 0 : Math.min(CW + GAP, (maxW - CW) / (n - 1));
        const totalW = CW + (n > 1 ? (n - 1) * cardSpace : 0);
        const startX = (CANVAS_W - totalW) / 2;
        const pos = [];
        for (let i = 0; i < n; i++) {
            pos.push({ x: startX + i * cardSpace, y: Y_PLAYER_HAND });
        }
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
        // ── Pause ──
        if (this.pausado) {
            this.btnResumir.actualizar(entrada, dt);
            this.btnVolverMenu.actualizar(entrada, dt);
            this.director.canvas.style.cursor =
                (this.btnResumir.estado === 'peneirar' || this.btnVolverMenu.estado === 'peneirar')
                    ? 'pointer' : 'default';
            return;
        }
        if (this._voltandoDePausa) { this._voltandoDePausa = false; return; }

        if (this.estado === ESTADO.XOGANDO) {
            if (this.btnCog.actualizar(entrada, dt)) return;
        }

        // ── Messages ──
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

        // ── Animations ──
        if (this.animacions.length > 0) {
            for (let i = this.animacions.length - 1; i >= 0; i--) {
                this.animacions[i].actualizar(null, dt);
                if (this.animacions[i].completada) this.animacions.splice(i, 1);
            }
            return;
        }

        if (this.msgEnRemate) return;

        // ── State-specific update ──
        switch (this.estado) {
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

    actualizarXogo(entrada, dt) {
        if (this.turnoActual === 0) {
            // ── Human turn ──
            if (this.fase === FASE.ROUBAR) {
                this.btnRoubarBaralla.deshabilitado =
                    this.baralla.restantes() === 0 && this.descartes.length <= 1;
                this.btnRoubarDescarte.deshabilitado = this.descartes.length === 0;
                this.btnRoubarBaralla.actualizar(entrada, dt);
                this.btnRoubarDescarte.actualizar(entrada, dt);
            } else {
                this.btnDescartar.deshabilitado = this.seleccion < 0;

                let canPechar = false;
                if (this.seleccion >= 0) {
                    const testMan = this.mans[0].filter((_, i) => i !== this.seleccion);
                    canPechar = this.findBestMelds(testMan).deadwood <= 5;
                }
                this.btnPechar.deshabilitado = !canPechar;

                this.btnDescartar.actualizar(entrada, dt);
                this.btnPechar.actualizar(entrada, dt);
            }

            this.actualizarHover(entrada);
            if (entrada.clicado) this.procesarClickCarta(entrada);

            const anyHover = this.cartaHover >= 0 ||
                this.cartaHover === -2 || this.cartaHover === -3 ||
                this.btnRoubarBaralla.estado === 'peneirar' ||
                this.btnRoubarDescarte.estado === 'peneirar' ||
                this.btnDescartar.estado === 'peneirar' ||
                this.btnPechar.estado === 'peneirar';
            this.director.canvas.style.cursor = anyHover ? 'pointer' : 'default';
        } else {
            // ── AI turn ──
            this.director.canvas.style.cursor = 'default';
            this.executarIA(dt);
        }
    }

    actualizarHover(entrada) {
        this.cartaHover = -1;
        if (this.mans[0].length === 0) return;

        // Hand cards (only selectable during discard phase)
        if (this.fase === FASE.DESCARTAR) {
            const hp = this.posicionsMan(this.mans[0].length);
            for (let i = hp.length - 1; i >= 0; i--) {
                const p = hp[i];
                const yo = this.seleccion === i ? -12 : 0;
                if (entrada.x >= p.x && entrada.x < p.x + CW &&
                    entrada.y >= p.y + yo && entrada.y < p.y + yo + CH) {
                    this.cartaHover = i;
                    return;
                }
            }
        }

        // Piles (only during draw phase)
        if (this.fase === FASE.ROUBAR) {
            if (this.descartes.length > 0 &&
                entrada.x >= DESCARTE_X && entrada.x <= DESCARTE_X + CW &&
                entrada.y >= PILE_Y && entrada.y <= PILE_Y + CH) {
                this.cartaHover = -2;
                return;
            }
            if (entrada.x >= BARALLA_X && entrada.x <= BARALLA_X + CW &&
                entrada.y >= PILE_Y && entrada.y <= PILE_Y + CH) {
                this.cartaHover = -3;
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
        this.debuxarManXogador(ctx);
        this.debuxarInfoXogador(ctx);
        this.debuxarBotonsXogo(ctx);

        for (const anim of this.animacions) anim.debuxar(ctx);
        if (this.tempMsg > 0) this.debuxarMsg(ctx);
        if (this.estado === ESTADO.FIN_RONDA) this.debuxarFinRonda(ctx);
        if (this.estado === ESTADO.FIN_PARTIDA) this.debuxarFinPartida(ctx);

        if (this.estado === ESTADO.XOGANDO) this.btnCog.debuxar(ctx);
        if (this.pausado) this.debuxarPausa(ctx);
    }

    debuxarInfoIA(ctx) {
        const barH = 38;
        for (let i = 0; i < this.numXogadores - 1; i++) {
            const iaIdx = i + 1;
            const y = 2 + i * (barH + 2);
            const isActive = this.turnoActual === iaIdx && this.estado === ESTADO.XOGANDO;

            const barX = 6, barW = CANVAS_W - 12;
            ctx.fillStyle = this.eliminados[iaIdx] ? 'rgba(100,0,0,0.3)'
                : isActive ? 'rgba(255,215,0,0.15)' : 'rgba(0,0,0,0.3)';
            ctx.fillRect(barX, y, barW, barH);

            if (isActive) {
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = 1;
                ctx.strokeRect(barX, y, barW, barH);
            }

            // Color dot
            ctx.fillStyle = this.eliminados[iaIdx] ? '#555' : CORES_IA[i];
            ctx.fillRect(barX + 4, y + 4, 8, 8);

            // Name
            ctx.fillStyle = this.eliminados[iaIdx] ? '#888' : (isActive ? '#ffd700' : '#e0e0e0');
            ctx.font = '10px Minipixel';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(this.nomes[iaIdx], barX + 16, y + 3);

            // Card count / eliminated
            const numCartas = this.mans[iaIdx] ? this.mans[iaIdx].length : 0;
            ctx.fillStyle = '#aaa';
            ctx.font = '10px Minipixel';
            ctx.fillText(
                this.eliminados[iaIdx] ? 'Eliminado' : `${numCartas} cartas`,
                barX + 16, y + 16
            );

            // Score
            ctx.fillStyle = this.puntuacions[iaIdx] >= 80 ? '#f44' : '#ccc';
            ctx.font = '10px Minipixel';
            ctx.textAlign = 'right';
            ctx.fillText(`${this.puntuacions[iaIdx]} pts`, barX + barW - 6, y + 3);

            // Mini card backs
            if (!this.eliminados[iaIdx] && numCartas > 0) {
                const dorso = this.assets['dorso'];
                if (dorso) {
                    const miniW = 16, miniH = 25;
                    const cardStartX = barX + barW - 6 - Math.min(numCartas, 8) * (miniW + 2);
                    for (let j = 0; j < Math.min(numCartas, 8); j++) {
                        ctx.drawImage(dorso, cardStartX + j * (miniW + 2), y + barH - miniH - 2, miniW, miniH);
                    }
                }
            }
        }
    }

    debuxarMesa(ctx) {
        // ── Draw pile ──
        const dorso = this.assets['dorso'];
        if (dorso && (this.baralla.restantes() > 0 || this.descartes.length > 1)) {
            const deckHover = this.cartaHover === -3;
            if (deckHover) {
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = 2;
                ctx.strokeRect(BARALLA_X - 2, PILE_Y - 2, CW + 4, CH + 4);
            }
            ctx.drawImage(dorso, BARALLA_X, PILE_Y, CW, CH);

            ctx.fillStyle = '#888';
            ctx.font = '10px Minipixel';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(`${this.baralla.restantes()}`, BARALLA_X + CW / 2, PILE_Y + CH + 4);
        }

        ctx.fillStyle = '#888';
        ctx.font = '10px Minipixel';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('Baralla', BARALLA_X + CW / 2, PILE_Y - 6);

        // ── Discard pile ──
        if (this.descartes.length > 0) {
            const topCard = this.descartes[this.descartes.length - 1];
            const img = this.assets[topCard.valor.toString()];
            const discardHover = this.cartaHover === -2;
            if (discardHover) {
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = 2;
                ctx.strokeRect(DESCARTE_X - 2, PILE_Y - 2, CW + 4, CH + 4);
            }
            if (img) ctx.drawImage(img, DESCARTE_X, PILE_Y, CW, CH);
        }

        ctx.fillStyle = '#888';
        ctx.font = '10px Minipixel';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('Descarte', DESCARTE_X + CW / 2, PILE_Y - 6);

        // ── Turn indicator ──
        if (this.estado === ESTADO.XOGANDO && this.tempMsg <= 0) {
            ctx.fillStyle = '#ffd700';
            ctx.font = '10px Minipixel';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            const faseTxt = this.fase === FASE.ROUBAR ? 'Rouba' : 'Descarta';
            ctx.fillText(`${this.nomes[this.turnoActual]}: ${faseTxt}`, CANVAS_W / 2, PILE_Y - 20);
        }

        // ── Round info ──
        ctx.fillStyle = '#666';
        ctx.font = '10px Minipixel';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        const numIA = this.numXogadores - 1;
        ctx.fillText(`Ronda ${this.ronda}`, 34, 2 + numIA * 40 + 8);
    }

    debuxarManXogador(ctx) {
        const man = this.mans[0];
        if (!man || man.length === 0) return;
        const hp = this.posicionsMan(man.length);
        const isDiscardPhase = this.fase === FASE.DESCARTAR && this.turnoActual === 0;

        for (let i = 0; i < man.length; i++) {
            const p = hp[i];
            const selected = this.seleccion === i;
            const isHover = i === this.cartaHover;
            const yo = selected ? -12 : (isHover && isDiscardPhase ? -6 : 0);

            if (selected) {
                ctx.fillStyle = 'rgba(100,255,100,0.3)';
                ctx.fillRect(p.x - 1, p.y + yo - 1, CW + 2, CH + 2);
            }

            const img = this.assets[man[i].valor.toString()];
            if (img) ctx.drawImage(img, p.x, p.y + yo, CW, CH);

            if (selected) {
                ctx.strokeStyle = '#66ff66';
                ctx.lineWidth = 2;
                ctx.strokeRect(p.x - 1, p.y + yo - 1, CW + 2, CH + 2);
            } else if (isHover && isDiscardPhase) {
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = 1;
                ctx.strokeRect(p.x - 1, p.y + yo - 1, CW + 2, CH + 2);
            }
        }
    }

    debuxarInfoXogador(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, Y_PLAYER_INFO, CANVAS_W, 24);
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '10px Minipixel';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(`Ti: ${this.mans[0].length} cartas`, 8, Y_PLAYER_INFO + 13);

        ctx.fillStyle = this.puntuacions[0] >= 80 ? '#f44' : '#ffd700';
        ctx.textAlign = 'right';
        ctx.fillText(`${this.puntuacions[0]} pts`, CANVAS_W - 8, Y_PLAYER_INFO + 13);
    }

    debuxarBotonsXogo(ctx) {
        if (this.estado !== ESTADO.XOGANDO || this.turnoActual !== 0 || this.tempMsg > 0) return;

        if (this.fase === FASE.ROUBAR) {
            this.btnRoubarBaralla.debuxar(ctx);
            this.btnRoubarDescarte.debuxar(ctx);

            ctx.fillStyle = '#ccc';
            ctx.font = '10px Minipixel';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText('Elixe de onde roubar', CANVAS_W / 2, Y_BUTTONS - 8);
        } else {
            this.btnDescartar.debuxar(ctx);
            this.btnPechar.debuxar(ctx);

            ctx.fillStyle = '#ccc';
            ctx.font = '10px Minipixel';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText('Selecciona carta e accion', CANVAS_W / 2, Y_BUTTONS - 8);
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

        // Count players to display
        let displayCount = 0;
        for (let i = 0; i < this.numXogadores; i++) {
            if (!this.eliminados[i] || r.newlyEliminated.includes(i)) displayCount++;
        }

        const popW = 280;
        const popH = 60 + displayCount * 42 + 70;
        const popX = CANVAS_W / 2 - popW / 2;
        const popY = CANVAS_H / 2 - popH / 2 - 10;

        // Box
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(popX + 3, popY + 3, popW, popH);
        ctx.fillStyle = '#222';
        ctx.fillRect(popX, popY, popW, popH);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.strokeRect(popX, popY, popW, popH);

        // Title
        ctx.fillStyle = '#ffd700';
        ctx.font = '10px Minipixel';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(
            r.cerrador === 0 ? 'Pechaches a ronda!' : `${this.nomes[r.cerrador]} pechou`,
            popX + popW / 2, popY + 10
        );

        if (r.pecharPerfeito) {
            ctx.fillStyle = '#4f4';
            ctx.font = '10px Minipixel';
            ctx.fillText('Peche perfecto! (-10 puntos)', popX + popW / 2, popY + 28);
        }

        // Player results
        let y = popY + 50;
        for (let i = 0; i < this.numXogadores; i++) {
            if (this.eliminados[i] && !r.newlyEliminated.includes(i)) continue;

            const res = r.resultados[i];
            const isCerrador = i === r.cerrador;

            // Name
            ctx.fillStyle = i === 0 ? '#e0e0e0' : CORES_IA[i - 1];
            ctx.font = '10px Minipixel';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(
                `${this.nomes[i]}${isCerrador ? ' (pechou)' : ''}`,
                popX + 10, y
            );

            // Melds
            if (res.melds.length > 0) {
                ctx.fillStyle = '#8d8';
                ctx.font = '10px Minipixel';
                const meldsStr = res.melds.map(m =>
                    m.type === 'set' ? `Grupo(${m.cards.length})` : `Escalera(${m.cards.length})`
                ).join(', ');
                ctx.fillText(meldsStr, popX + 10, y + 13);
            }

            // Penalty
            const penaltyStr = res.penalty >= 0 ? `+${res.penalty}` : `${res.penalty}`;
            ctx.fillStyle = res.penalty <= 0 ? '#4f4' : '#f44';
            ctx.font = '10px Minipixel';
            ctx.textAlign = 'right';
            ctx.fillText(`${penaltyStr} pts`, popX + popW - 40, y);

            // Cumulative score
            ctx.fillStyle = this.puntuacions[i] >= 80 ? '#f44' : '#ccc';
            ctx.font = '10px Minipixel';
            ctx.fillText(`Total: ${this.puntuacions[i]}`, popX + popW - 10, y + 13);

            if (r.newlyEliminated.includes(i)) {
                ctx.fillStyle = '#f44';
                ctx.font = '10px Minipixel';
                ctx.textAlign = 'left';
                ctx.fillText('ELIMINADO!', popX + 10, y + 26);
            }

            y += 42;
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

        const r = this.resultadoRonda;
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

        // Title
        ctx.fillStyle = '#ffd700';
        ctx.font = '10px Minipixel';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        if (r && r.chinchon) {
            ctx.fillText(
                r.cerrador === 0 ? 'CHINCHON! Ganaches!' : `CHINCHON! ${this.nomes[r.cerrador]} gana!`,
                popX + popW / 2, popY + 12
            );
        } else {
            const g = this.ganadorPartida;
            if (g === 0) {
                ctx.fillText('Ganaches a partida!', popX + popW / 2, popY + 12);
            } else if (g >= 0) {
                ctx.fillText(`${this.nomes[g]} gana a partida!`, popX + popW / 2, popY + 12);
            } else {
                ctx.fillText('Partida rematada!', popX + popW / 2, popY + 12);
            }
        }

        // Subtitle
        ctx.fillStyle = '#ccc';
        ctx.font = '10px Minipixel';
        if (r && r.chinchon) {
            ctx.fillText('Victoria instantanea por chinchon!', popX + popW / 2, popY + 34);
        } else {
            ctx.fillText(`${this.ronda} rondas xogadas`, popX + popW / 2, popY + 34);
        }

        // Player scores
        let y = popY + 60;
        const lineH = 16;
        ctx.font = '10px Minipixel';
        for (let i = 0; i < this.numXogadores; i++) {
            const isWinner = i === this.ganadorPartida || (r && r.chinchon && i === r.cerrador);
            ctx.fillStyle = isWinner ? '#ffd700' : (i === 0 ? '#e0e0e0' : CORES_IA[i - 1]);
            const status = this.eliminados[i] ? ' (eliminado)' : '';
            ctx.fillText(
                `${this.nomes[i]}: ${this.puntuacions[i]} pts${status}${isWinner ? ' \u2605' : ''}`,
                popX + popW / 2, y
            );
            y += lineH;
        }

        y += 8;
        ctx.fillStyle = '#888';
        ctx.font = '10px Minipixel';
        ctx.fillText(`${this.ronda} rondas xogadas`, popX + popW / 2, y);

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
