import Escena from '../Escena.js';
import Baralla from '../Baralla.js';
import Boton from '../utiles/Boton.js';
import AnimacionDesprazamento from '../utiles/animacions/AnimacionDesprazamento.js';

// ── DISPLAY CONSTANTS ──
const CW = 48, CH = 76, GAP = 4;
const SMALL_CW = 34, SMALL_CH = 53;
const CANVAS_W = 380, CANVAS_H = 600;

const Y_PLAYER_INFO = CANVAS_H - 24;
const Y_PLAYER_HAND = Y_PLAYER_INFO - CH - 6;

// Table layout: 4 suit rows, each showing cards from As(1) to Rey(10)
// The 5 is at the center, cards extend left (4,3,2,1) and right (6,7,Sota,Caballo,Rey)
const TABLE_Y_START = 50;
const TABLE_ROW_H = SMALL_CH + 4;
const TABLE_CELL_W = SMALL_CW + 2;
const TABLE_TOTAL_W = 10 * TABLE_CELL_W;
const TABLE_X_START = (CANVAS_W - TABLE_TOTAL_W) / 2;

// Sequence order: internal positions 0-9 map to card puntos:
// pos 0=As(1), 1=2, 2=3, 3=4, 4=5, 5=6, 6=7, 7=Sota(8), 8=Caballo(9), 9=Rey(10)
// puntos() to table position: puntos - 1

const ESTADO = {
    REPARTIR: 0,
    TURNO_XOGADOR: 1,
    TURNO_IA: 2,
    FIN_XOGO: 3,
};

const NOMES_PALO = ['Ouros', 'Copas', 'Espadas', 'Bastos'];
const CORES_IA = ['#e03030', '#3070e0', '#30b040'];

export default class Cinquillo extends Escena {
    constructor(director, config = {}) {
        super(director);
        this.assets = director.assets;
        this.config = config;

        const numOponentes = config.numOponentes || 3;
        const dificultades = config.dificultades || ['medio', 'medio', 'medio'];
        this.numXogadores = 1 + numOponentes;

        this.nomes = ['Ti'];
        this.dificultades = ['humano'];
        for (let i = 0; i < numOponentes; i++) {
            this.nomes.push(`IA ${i + 1}`);
            this.dificultades.push(dificultades[i] || 'medio');
        }

        // Per-round state
        this.mans = [];
        // Table: 4 suits, each an array of 10 booleans (card played or not)
        this.taboleiro = []; // taboleiro[palo][pos] = true if card is on table
        this.turnoActual = 0;

        // UI
        this.estado = ESTADO.REPARTIR;
        this.mensaxe = '';
        this.tempMsg = 0;
        this.msgEnRemate = null;
        this.animacions = [];
        this.estaAnimando = false;
        this.pausado = false;
        this._voltandoDePausa = false;
        this.cartaHover = -1;
        this.ganador = -1;

        // Buttons
        const cogSize = 24;
        this.btnCog = new Boton(
            6, 22, cogSize, cogSize,
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
        this.btnMenuFin = new Boton(
            CANVAS_W / 2 - 55, CANVAS_H / 2 + 60, 110, 32,
            ['#2a2a7a', '#3a3a9a', '#1a1a5a'], [], 'Menu',
            () => { import('./Menu.js').then(m => this.director.cambiarEscena(new m.default(this.director))); }
        );

        this.iniciarPartida();
    }

    // ═══════════════════════════════════════════
    //  GAME HELPERS
    // ═══════════════════════════════════════════

    // Card puntos (1-10) to table position (0-9)
    cartaAPos(carta) { return carta.puntos() - 1; }

    // Check if a card can be played
    podeXogar(carta) {
        const palo = carta.palo();
        const pos = this.cartaAPos(carta);

        // Must be a 5 (pos 4) to start a suit
        if (pos === 4) return !this.taboleiro[palo][4];

        // Otherwise, the suit must have the 5 already placed
        if (!this.taboleiro[palo][4]) return false;

        // Card must be adjacent to the existing sequence
        if (pos < 4) {
            // Going down: the card above (pos+1) must be on the table
            return this.taboleiro[palo][pos + 1] && !this.taboleiro[palo][pos];
        } else {
            // Going up: the card below (pos-1) must be on the table
            return this.taboleiro[palo][pos - 1] && !this.taboleiro[palo][pos];
        }
    }

    // Get all playable card indices for a hand
    cartasXogables(man) {
        const indices = [];
        for (let i = 0; i < man.length; i++) {
            if (this.podeXogar(man[i])) indices.push(i);
        }
        return indices;
    }

    // Table position to screen coords for small cards
    posicionTaboleiro(palo, pos) {
        return {
            x: TABLE_X_START + pos * TABLE_CELL_W,
            y: TABLE_Y_START + palo * TABLE_ROW_H
        };
    }

    // ═══════════════════════════════════════════
    //  GAME FLOW
    // ═══════════════════════════════════════════

    iniciarPartida() {
        this.baralla = new Baralla();
        this.mans = [];
        this.taboleiro = [];
        for (let i = 0; i < 4; i++) {
            this.taboleiro.push(new Array(10).fill(false));
        }

        // Deal all 40 cards
        for (let i = 0; i < this.numXogadores; i++) this.mans.push([]);
        let idx = 0;
        while (this.baralla.restantes() > 0) {
            this.mans[idx % this.numXogadores].push(this.baralla.roubar());
            idx++;
        }

        // Sort each hand for display
        for (const man of this.mans) {
            man.sort((a, b) => a.valor - b.valor);
        }

        // Find who has the 5 de Ouros (valor 5, palo 0, puntos 5)
        let primeiro = -1;
        for (let i = 0; i < this.numXogadores; i++) {
            if (this.mans[i].some(c => c.palo() === 0 && c.puntos() === 5)) {
                primeiro = i;
                break;
            }
        }

        this.turnoActual = primeiro >= 0 ? primeiro : 0;
        this.reproducirSon('son_barallar');

        // Auto-play the 5 de Ouros
        const man = this.mans[this.turnoActual];
        const cincoIdx = man.findIndex(c => c.palo() === 0 && c.puntos() === 5);
        if (cincoIdx >= 0) {
            this.mostrarMsg(`${this.nomes[this.turnoActual]} pon o 5 de Ouros`, 1200, () => {
                this.xogarCartaAnimada(this.turnoActual, cincoIdx, () => {
                    this.avanzarTurno();
                });
            });
        } else {
            this.iniciarTurno();
        }
    }

    iniciarTurno() {
        if (this.turnoActual === 0) {
            this.estado = ESTADO.TURNO_XOGADOR;
            const xogables = this.cartasXogables(this.mans[0]);
            if (xogables.length === 0) {
                this.mostrarMsg('Paso! (sen movementos)', 1000, () => this.avanzarTurno());
            }
        } else {
            this.estado = ESTADO.TURNO_IA;
            this.tempIA = 0;
        }
    }

    avanzarTurno() {
        this.turnoActual = (this.turnoActual + 1) % this.numXogadores;
        this.iniciarTurno();
    }

    xogarCartaAnimada(playerIdx, cardIdx, enRemate) {
        const carta = this.mans[playerIdx][cardIdx];
        const palo = carta.palo();
        const pos = this.cartaAPos(carta);
        const dest = this.posicionTaboleiro(palo, pos);

        // Source position
        let fromX, fromY;
        if (playerIdx === 0) {
            const hp = this.posicionsMan(this.mans[playerIdx].length);
            fromX = hp[cardIdx].x;
            fromY = hp[cardIdx].y;
        } else {
            // IA: from their info area
            fromX = CANVAS_W - 30;
            fromY = Y_PLAYER_HAND - 60 - (playerIdx - 1) * 20;
        }

        this.mans[playerIdx].splice(cardIdx, 1);

        this.animacions.push(new AnimacionDesprazamento(
            this.assets, SMALL_CW, SMALL_CH, carta.valor,
            fromX, fromY, dest.x, dest.y,
            () => {
                this.taboleiro[palo][pos] = true;
                this.reproducirSon(`son_dar${1 + Math.floor(Math.random() * 6)}`);

                // Check win
                if (this.mans[playerIdx].length === 0) {
                    this.ganador = playerIdx;
                    this.estado = ESTADO.FIN_XOGO;
                    this.mostrarMsg(`${this.nomes[playerIdx]} gana!`, 2500);
                    return;
                }

                if (enRemate) enRemate();
            },
            0.08
        ));
    }

    // ═══════════════════════════════════════════
    //  PLAYER INPUT
    // ═══════════════════════════════════════════

    procesarEntrada(entrada) {
        if (!entrada.clicado) return;
        if (this.mans[0].length === 0) return;

        const hp = this.posicionsMan(this.mans[0].length);
        const xogables = this.cartasXogables(this.mans[0]);
        if (xogables.length === 0) return;

        for (let i = 0; i < this.mans[0].length; i++) {
            const p = hp[i];
            if (entrada.x >= p.x && entrada.x < p.x + CW &&
                entrada.y >= p.y && entrada.y < p.y + CH) {
                if (xogables.includes(i)) {
                    this.xogarCartaAnimada(0, i, () => this.avanzarTurno());
                }
                return;
            }
        }
    }

    // ═══════════════════════════════════════════
    //  AI LOGIC
    // ═══════════════════════════════════════════

    executarIA(dt) {
        this.tempIA = (this.tempIA || 0) + dt;
        if (this.tempIA < 600) return;

        const idx = this.turnoActual;
        const man = this.mans[idx];
        const xogables = this.cartasXogables(man);

        if (xogables.length === 0) {
            this.mostrarMsg(`${this.nomes[idx]} pasa`, 800, () => this.avanzarTurno());
            return;
        }

        // AI strategy
        let escollaIdx;
        if (this.dificultades[idx] === 'facil') {
            escollaIdx = xogables[Math.floor(Math.random() * xogables.length)];
        } else {
            // Prefer: 5s first (opens suits), then cards that extend extremes,
            // then cards from suits where we have many cards
            let bestScore = -Infinity;
            escollaIdx = xogables[0];
            for (const ci of xogables) {
                const c = man[ci];
                let score = 0;
                const pos = this.cartaAPos(c);

                // Prefer 5s (opens new suit)
                if (pos === 4) score += 20;

                // Prefer extremes (blocks opponents less)
                if (pos === 0 || pos === 9) score += 5;

                // Prefer suits where we have more cards
                const suitCount = man.filter(m => m.palo() === c.palo()).length;
                score += suitCount * 2;

                if (this.dificultades[idx] === 'dificil') {
                    // Avoid opening sequences that help opponents
                    // Prefer keeping middle cards that block
                    if (pos >= 3 && pos <= 5) score -= 3;
                }

                if (score > bestScore) { bestScore = score; escollaIdx = ci; }
            }
        }

        this.xogarCartaAnimada(idx, escollaIdx, () => this.avanzarTurno());
    }

    // ═══════════════════════════════════════════
    //  POSITIONS
    // ═══════════════════════════════════════════

    posicionsMan(n) {
        if (n === 0) return [];
        // Player hand: up to 13 cards, use wrapping if needed
        const maxPerRow = 7;
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

        if (this.estado !== ESTADO.FIN_XOGO) {
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
            case ESTADO.TURNO_XOGADOR:
                this.actualizarHover(entrada);
                this.procesarEntrada(entrada);
                break;
            case ESTADO.TURNO_IA:
                this.director.canvas.style.cursor = 'default';
                this.executarIA(dt);
                break;
            case ESTADO.FIN_XOGO:
                this.director.canvas.style.cursor = 'default';
                this.btnMenuFin.actualizar(entrada, dt);
                break;
        }
    }

    actualizarHover(entrada) {
        this.cartaHover = -1;
        const hp = this.posicionsMan(this.mans[0].length);
        const xogables = this.cartasXogables(this.mans[0]);
        for (let i = 0; i < this.mans[0].length; i++) {
            const p = hp[i];
            if (entrada.x >= p.x && entrada.x < p.x + CW &&
                entrada.y >= p.y && entrada.y < p.y + CH) {
                this.cartaHover = i;
                break;
            }
        }
        this.director.canvas.style.cursor =
            (this.cartaHover >= 0 && xogables.includes(this.cartaHover)) ? 'pointer' : 'default';
    }

    // ═══════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════

    debuxar(ctx) {
        ctx.fillStyle = '#1a3a1a';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        this.debuxarTaboleiro(ctx);
        this.debuxarManXogador(ctx);
        this.debuxarInfoXogadores(ctx);

        for (const anim of this.animacions) anim.debuxar(ctx);

        if (this.tempMsg > 0) this.debuxarMsg(ctx);
        if (this.estado === ESTADO.FIN_XOGO) this.debuxarFinXogo(ctx);

        if (!this.pausado && this.estado !== ESTADO.FIN_XOGO) {
            this.btnCog.debuxar(ctx);
        }
        if (this.pausado) this.debuxarPausa(ctx);
    }

    debuxarTaboleiro(ctx) {
        // Suit labels
        ctx.font = '8px Minipixel';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        for (let palo = 0; palo < 4; palo++) {
            const rowY = TABLE_Y_START + palo * TABLE_ROW_H;

            // Draw card slots
            for (let pos = 0; pos < 10; pos++) {
                const p = this.posicionTaboleiro(palo, pos);

                if (this.taboleiro[palo][pos]) {
                    // Card played: draw card image
                    const valor = palo * 10 + pos + 1;
                    const img = this.assets[valor.toString()];
                    if (img) ctx.drawImage(img, p.x, p.y, SMALL_CW, SMALL_CH);
                } else {
                    // Empty slot
                    ctx.fillStyle = pos === 4 ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.05)';
                    ctx.fillRect(p.x, p.y, SMALL_CW, SMALL_CH);
                    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(p.x, p.y, SMALL_CW, SMALL_CH);
                }
            }

            // Suit label
            ctx.fillStyle = '#888';
            ctx.fillText(NOMES_PALO[palo][0], TABLE_X_START - 3, rowY + SMALL_CH / 2);
        }
    }

    debuxarManXogador(ctx) {
        const man = this.mans[0];
        if (!man) return;
        const hp = this.posicionsMan(man.length);
        const xogables = this.cartasXogables(man);

        for (let i = 0; i < man.length; i++) {
            const p = hp[i];
            const isPlayable = xogables.includes(i);
            const isHover = i === this.cartaHover && isPlayable && this.estado === ESTADO.TURNO_XOGADOR;
            const yo = isHover ? -8 : 0;

            // Dim non-playable cards during player turn
            if (this.estado === ESTADO.TURNO_XOGADOR && !isPlayable) {
                ctx.save();
                ctx.globalAlpha = 0.4;
            }

            if (isHover) {
                ctx.fillStyle = 'rgba(255,255,255,0.15)';
                ctx.fillRect(p.x - 2, p.y + yo - 2, CW + 4, CH + 4);
            }

            const img = this.assets[man[i].valor.toString()];
            if (img) ctx.drawImage(img, p.x, p.y + yo, CW, CH);

            if (this.estado === ESTADO.TURNO_XOGADOR && !isPlayable) {
                ctx.restore();
            }

            // Gold border on playable cards
            if (isPlayable && this.estado === ESTADO.TURNO_XOGADOR) {
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = 1;
                ctx.strokeRect(p.x - 1, p.y + yo - 1, CW + 2, CH + 2);
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
        ctx.fillText(`Ti: ${this.mans[0]?.length || 0} cartas`, 8, Y_PLAYER_INFO + 13);

        // IA info at the top
        ctx.font = '9px Minipixel';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        let infoX = 36;
        for (let i = 0; i < this.nomes.length - 1; i++) {
            const iaIdx = i + 1;
            const ia = this.mans[iaIdx];
            const isActive = this.turnoActual === iaIdx && this.estado === ESTADO.TURNO_IA;

            ctx.fillStyle = isActive ? '#ffd700' : (CORES_IA[i] || '#ccc');
            const txt = `${this.nomes[iaIdx]}: ${ia?.length || 0}`;
            ctx.fillText(txt, infoX, 14);
            infoX += ctx.measureText(txt).width + 16;
        }
    }

    debuxarMsg(ctx) {
        ctx.font = '12px Minipixel';
        const textW = ctx.measureText(this.mensaxe).width;
        const w = Math.max(220, textW + 40), h = 34;
        const x = (CANVAS_W - w) / 2;
        const y = CANVAS_H / 2;

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

    debuxarFinXogo(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Gold-bordered popup (infoUtil style)
        const popW = 220, lineH = 16;
        const contentH = 30 + this.numXogadores * lineH + 20;
        const popH = contentH + 50;
        const popX = CANVAS_W / 2 - popW / 2;
        const popY = CANVAS_H / 2 - popH / 2 - 20;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(popX + 3, popY + 3, popW, popH);
        // Box
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
        ctx.fillText(this.ganador === 0 ? 'Gañaches!' : `${this.nomes[this.ganador]} gana!`, popX + popW / 2, popY + 12);

        // Player results
        ctx.font = '10px Minipixel';
        let y = popY + 38;
        for (let i = 0; i < this.numXogadores; i++) {
            ctx.fillStyle = i === this.ganador ? '#ffd700' : '#ccc';
            ctx.fillText(`${this.nomes[i]}: ${this.mans[i]?.length || 0} cartas restantes`, popX + popW / 2, y);
            y += lineH;
        }

        ctx.textBaseline = 'alphabetic';

        // Reposition menu button inside popup
        this.btnMenuFin.y = popY + popH - 40;
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
