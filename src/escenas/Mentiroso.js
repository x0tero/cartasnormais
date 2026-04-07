import Escena from '../Escena.js';
import Baralla from '../Baralla.js';
import Boton from '../utiles/Boton.js';
import AnimacionDesprazamento from '../utiles/animacions/AnimacionDesprazamento.js';

const CW = 48, CH = 76, GAP = 4;
const CANVAS_W = 380, CANVAS_H = 600;

const Y_PLAYER_INFO = CANVAS_H - 24;
const Y_PLAYER_HAND = Y_PLAYER_INFO - CH - 6;
const Y_BUTTONS = Y_PLAYER_HAND - 58;
const Y_PILE = 200; // center pile

const CORES_IA = ['#e03030', '#3070e0', '#30b040'];
const NOMES_RANGO = ['', 'As', '2', '3', '4', '5', '6', '7', 'Sota', 'Caballo', 'Rey'];

const ESTADO = {
    ELIXIR_RANGO: 0,     // Player picks rank and cards to declare
    ELIXIR_CARTAS: 1,    // Player selects cards to play
    TURNO_IA_XOGAR: 2,   // IA plays cards
    ESPERAR_RESPOSTA: 3,  // Next player decides: play or challenge
    IA_RESPOSTA: 4,       // IA decides: play or challenge
    RESOLVER: 5,          // Resolving a challenge
    FIN_XOGO: 6,
};

export default class Mentiroso extends Escena {
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

        // Game state
        this.mans = [];
        this.pila = [];            // center pile (all cards played face-down)
        this.rangoDeclarado = 0;   // the rank currently declared (puntos value 1-10)
        this.ultimoXogador = -1;   // who played last
        this.ultimasCartas = [];   // cards the last player put down
        this.turnoActual = 0;
        this.ganador = -1;

        // Player selection state
        this.cartasSel = new Set();
        this.rangoSel = 1;

        // UI
        this.estado = ESTADO.ELIXIR_RANGO;
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
        const bw = 70, bh = 26;
        this.btnXogar = new Boton(
            CANVAS_W / 2 - bw - 4, Y_BUTTONS, bw, bh,
            ['#2a7a2a', '#3a9a3a', '#1a5a1a', '#444'],
            [], 'Xogar',
            () => this.xogadorXogar(),
            { tamanhoTexto: 10 }
        );
        this.btnMentiroso = new Boton(
            CANVAS_W / 2 + 4, Y_BUTTONS, bw, bh,
            ['#7a2a2a', '#9a3a3a', '#5a1a1a', '#444'],
            [], 'Mentiroso!',
            () => this.xogadorDesafiar(),
            { tamanhoTexto: 9 }
        );

        // Rank selection arrows
        this.btnRangoLeft = new Boton(
            CANVAS_W / 2 - 80, Y_BUTTONS, 24, bh,
            ['#555', '#777', '#333', '#2a2a2a'], [], '<',
            () => { this.rangoSel = this.rangoSel <= 1 ? 10 : this.rangoSel - 1; },
            { corTexto: 'white', tamanhoTexto: 12, instantaneo: true }
        );
        this.btnRangoRight = new Boton(
            CANVAS_W / 2 + 56, Y_BUTTONS, 24, bh,
            ['#555', '#777', '#333', '#2a2a2a'], [], '>',
            () => { this.rangoSel = this.rangoSel >= 10 ? 1 : this.rangoSel + 1; },
            { corTexto: 'white', tamanhoTexto: 12, instantaneo: true }
        );
        this.btnConfirmarRango = new Boton(
            CANVAS_W / 2 - 40, Y_BUTTONS - 30, 80, 24,
            ['#2a7a2a', '#3a9a3a', '#1a5a1a'], [], 'Confirmar',
            () => this.confirmarRango(),
            { tamanhoTexto: 9, corTexto: 'white' }
        );

        // Cog / Pause
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
    //  GAME FLOW
    // ═══════════════════════════════════════════

    iniciarPartida() {
        this.baralla = new Baralla();
        this.mans = [];
        this.pila = [];
        this.rangoDeclarado = 0;
        this.ultimoXogador = -1;
        this.ultimasCartas = [];
        this.ganador = -1;

        for (let i = 0; i < this.numXogadores; i++) this.mans.push([]);
        let idx = 0;
        while (this.baralla.restantes() > 0) {
            this.mans[idx % this.numXogadores].push(this.baralla.roubar());
            idx++;
        }
        for (const man of this.mans) man.sort((a, b) => a.valor - b.valor);

        this.turnoActual = 0;
        this.reproducirSon('son_barallar');

        // First player must declare a rank and play
        this.iniciarTurnoNovo();
    }

    iniciarTurnoNovo() {
        // Starting a new declaration round (no previous cards to challenge)
        this.rangoDeclarado = 0;
        this.ultimoXogador = -1;
        this.ultimasCartas = [];
        this.cartasSel.clear();

        if (this.turnoActual === 0) {
            this.estado = ESTADO.ELIXIR_RANGO;
            this.mostrarMsg('Escolle un rango e xoga');
        } else {
            this.estado = ESTADO.TURNO_IA_XOGAR;
            this.tempIA = 0;
            this.iaNovaDeclaracion = true;
        }
    }

    iniciarTurnoSeguinte() {
        // After someone played, the next player decides: play same rank or challenge
        const prev = this.turnoActual;
        this.turnoActual = (this.turnoActual + 1) % this.numXogadores;

        // Check if previous player won
        if (this.mans[prev].length === 0) {
            // Next player must decide before win is confirmed
            this.pendingGanador = prev;
        }

        if (this.turnoActual === 0) {
            this.estado = ESTADO.ESPERAR_RESPOSTA;
            this.cartasSel.clear();
        } else {
            this.estado = ESTADO.IA_RESPOSTA;
            this.tempIA = 0;
        }
    }

    // ═══════════════════════════════════════════
    //  PLAYER ACTIONS
    // ═══════════════════════════════════════════

    confirmarRango() {
        if (this.estado !== ESTADO.ELIXIR_RANGO) return;
        this.rangoDeclarado = this.rangoSel;
        this.estado = ESTADO.ELIXIR_CARTAS;
        this.cartasSel.clear();
    }

    xogadorXogar() {
        if (this.estado === ESTADO.ELIXIR_CARTAS) {
            if (this.cartasSel.size < 1 || this.cartasSel.size > 3) return;
            this.executarXogada(0, Array.from(this.cartasSel), this.rangoDeclarado);
        } else if (this.estado === ESTADO.ESPERAR_RESPOSTA) {
            if (this.cartasSel.size < 1 || this.cartasSel.size > 3) return;
            this.executarXogada(0, Array.from(this.cartasSel), this.rangoDeclarado);
        }
    }

    xogadorDesafiar() {
        if (this.estado !== ESTADO.ESPERAR_RESPOSTA) return;
        if (this.ultimoXogador < 0) return;
        this.resolverDesafio(0);
    }

    executarXogada(playerIdx, cardIndices, rango) {
        // Sort descending for safe splice
        const sorted = [...cardIndices].sort((a, b) => b - a);
        const cartas = sorted.map(i => this.mans[playerIdx][i]);
        for (const i of sorted) this.mans[playerIdx].splice(i, 1);

        this.ultimasCartas = cartas;
        this.ultimoXogador = playerIdx;
        this.rangoDeclarado = rango;

        for (const c of cartas) this.pila.push(c);

        const count = cartas.length;
        const rangoNome = NOMES_RANGO[rango] || rango;
        this.mostrarMsg(`${this.nomes[playerIdx]}: ${count} ${rangoNome}`, 1200, () => {
            this.reproducirSon(`son_dar${1 + Math.floor(Math.random() * 6)}`);
            this.iniciarTurnoSeguinte();
        });
    }

    resolverDesafio(desafiadorIdx) {
        this.estado = ESTADO.RESOLVER;
        const acusado = this.ultimoXogador;
        const cartas = this.ultimasCartas;
        const rangoNome = NOMES_RANGO[this.rangoDeclarado];

        // Check if the accused was lying
        const mentiu = cartas.some(c => c.puntos() !== this.rangoDeclarado);

        const desafiadorNome = this.nomes[desafiadorIdx];
        const acusadoNome = this.nomes[acusado];

        if (mentiu) {
            // Liar caught: accused picks up the pile
            const msg = `${acusadoNome} mentiu! Recolle ${this.pila.length} cartas`;
            this.mostrarMsg(msg, 2500, () => {
                this.mans[acusado].push(...this.pila);
                this.mans[acusado].sort((a, b) => a.valor - b.valor);
                this.pila = [];
                this.pendingGanador = -1;
                this.turnoActual = desafiadorIdx;
                this.iniciarTurnoNovo();
            });
        } else {
            // False accusation: challenger picks up
            // Check if accused wins (had played their last cards truthfully)
            if (this.mans[acusado].length === 0) {
                this.ganador = acusado;
                this.estado = ESTADO.FIN_XOGO;
                this.mostrarMsg(`${acusadoNome} dixo a verdade e gaña!`, 3000);
                return;
            }

            const msg = `${acusadoNome} dixo a verdade! ${desafiadorNome} recolle ${this.pila.length}`;
            this.mostrarMsg(msg, 2500, () => {
                this.mans[desafiadorIdx].push(...this.pila);
                this.mans[desafiadorIdx].sort((a, b) => a.valor - b.valor);
                this.pila = [];
                this.pendingGanador = -1;
                this.turnoActual = acusado;
                this.iniciarTurnoNovo();
            });
        }
    }

    // ═══════════════════════════════════════════
    //  AI LOGIC
    // ═══════════════════════════════════════════

    executarIAXogar(dt) {
        this.tempIA += dt;
        if (this.tempIA < 800) return;

        const idx = this.turnoActual;
        const man = this.mans[idx];
        if (man.length === 0) return;
        const dif = this.dificultades[idx];

        let rango, cartas;

        if (this.iaNovaDeclaracion) {
            // IA starts a new round: pick a rank they have the most of
            this.iaNovaDeclaracion = false;
            const counts = {};
            for (const c of man) {
                const p = c.puntos();
                counts[p] = (counts[p] || 0) + 1;
            }
            let bestRango = man[0].puntos(), bestCount = 0;
            for (const [r, cnt] of Object.entries(counts)) {
                if (cnt > bestCount) { bestCount = cnt; bestRango = parseInt(r); }
            }
            rango = bestRango;

            // Play real cards of that rank
            const realCards = [];
            for (let i = 0; i < man.length && realCards.length < 3; i++) {
                if (man[i].puntos() === rango) realCards.push(i);
            }
            cartas = realCards.length > 0 ? realCards : [0];
        } else {
            // IA continues with the declared rank
            rango = this.rangoDeclarado;
            const realCards = [];
            for (let i = 0; i < man.length && realCards.length < 3; i++) {
                if (man[i].puntos() === rango) realCards.push(i);
            }

            if (realCards.length > 0) {
                cartas = realCards;
            } else {
                // Must bluff: play 1 random card
                cartas = [Math.floor(Math.random() * man.length)];
            }
        }

        this.executarXogada(idx, cartas, rango);
    }

    executarIAResposta(dt) {
        this.tempIA += dt;
        if (this.tempIA < 1000) return;

        const idx = this.turnoActual;
        const dif = this.dificultades[idx];
        const man = this.mans[idx];

        // Decide: challenge or play
        let challengeProb = 0.15;
        if (dif === 'facil') challengeProb = 0.1;
        if (dif === 'dificil') challengeProb = 0.25;

        // If we have cards of the declared rank, prefer playing
        const hasRealCards = man.some(c => c.puntos() === this.rangoDeclarado);
        if (!hasRealCards) challengeProb += 0.2;

        // More likely to challenge if pile is small (less penalty)
        if (this.pila.length <= 4) challengeProb += 0.1;

        // If previous player played 3 cards, more suspicious
        if (this.ultimasCartas.length >= 3) challengeProb += 0.15;

        // If pending winner, must challenge or they win
        if (this.pendingGanador >= 0) challengeProb = 0.7;

        if (Math.random() < challengeProb) {
            this.mostrarMsg(`${this.nomes[idx]}: Mentiroso!`, 1000, () => {
                this.resolverDesafio(idx);
            });
        } else {
            // Play cards
            this.estado = ESTADO.TURNO_IA_XOGAR;
            this.tempIA = 0;
            this.iaNovaDeclaracion = false;

            // If pending winner wasn't challenged, they win
            if (this.pendingGanador >= 0 && this.pendingGanador !== idx) {
                // Actually the pending winner is confirmed by not being challenged
                // but only if everyone passes without challenging
                // In this game, each player either plays or challenges.
                // Playing = believing = the pending winner is confirmed
                this.ganador = this.pendingGanador;
                this.estado = ESTADO.FIN_XOGO;
                this.mostrarMsg(`${this.nomes[this.ganador]} gaña!`, 3000);
                return;
            }
        }
    }

    // ═══════════════════════════════════════════
    //  POSITIONS
    // ═══════════════════════════════════════════

    posicionsMan(n) {
        if (n === 0) return [];
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
            case ESTADO.ELIXIR_RANGO:
                this.btnRangoLeft.actualizar(entrada, dt);
                this.btnRangoRight.actualizar(entrada, dt);
                this.btnConfirmarRango.actualizar(entrada, dt);
                this.actualizarHover(entrada);
                break;

            case ESTADO.ELIXIR_CARTAS:
                this.btnXogar.deshabilitado = this.cartasSel.size < 1 || this.cartasSel.size > 3;
                this.btnXogar.actualizar(entrada, dt);
                this.actualizarHover(entrada);
                this.procesarSeleccion(entrada);
                break;

            case ESTADO.ESPERAR_RESPOSTA:
                this.btnXogar.deshabilitado = this.cartasSel.size < 1 || this.cartasSel.size > 3;
                this.btnXogar.actualizar(entrada, dt);
                this.btnMentiroso.deshabilitado = false;
                this.btnMentiroso.actualizar(entrada, dt);
                this.actualizarHover(entrada);
                this.procesarSeleccion(entrada);
                break;

            case ESTADO.TURNO_IA_XOGAR:
                this.director.canvas.style.cursor = 'default';
                this.executarIAXogar(dt);
                break;

            case ESTADO.IA_RESPOSTA:
                this.director.canvas.style.cursor = 'default';
                this.executarIAResposta(dt);
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
        for (let i = 0; i < this.mans[0].length; i++) {
            const p = hp[i];
            if (entrada.x >= p.x && entrada.x < p.x + CW &&
                entrada.y >= p.y && entrada.y < p.y + CH) {
                this.cartaHover = i;
                break;
            }
        }
        this.director.canvas.style.cursor = this.cartaHover >= 0 ? 'pointer' : 'default';
    }

    procesarSeleccion(entrada) {
        if (!entrada.clicado || this.cartaHover < 0) return;
        const i = this.cartaHover;
        if (this.cartasSel.has(i)) {
            this.cartasSel.delete(i);
        } else if (this.cartasSel.size < 3) {
            this.cartasSel.add(i);
        }
    }

    // ═══════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════

    debuxar(ctx) {
        ctx.fillStyle = '#1a2a1a';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        this.debuxarInfoIAs(ctx);
        this.debuxarPila(ctx);
        this.debuxarManXogador(ctx);
        this.debuxarInfoXogador(ctx);
        this.debuxarControles(ctx);

        for (const anim of this.animacions) anim.debuxar(ctx);
        if (this.tempMsg > 0) this.debuxarMsg(ctx);
        if (this.estado === ESTADO.FIN_XOGO) this.debuxarFinXogo(ctx);

        if (!this.pausado && this.estado !== ESTADO.FIN_XOGO) this.btnCog.debuxar(ctx);
        if (this.pausado) this.debuxarPausa(ctx);
    }

    debuxarInfoIAs(ctx) {
        ctx.font = '9px Minipixel';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        let x = 36;
        for (let i = 1; i < this.numXogadores; i++) {
            const isActive = this.turnoActual === i;
            ctx.fillStyle = isActive ? '#ffd700' : (CORES_IA[i - 1] || '#ccc');
            const txt = `${this.nomes[i]}: ${this.mans[i]?.length || 0}`;
            ctx.fillText(txt, x, 14);
            x += ctx.measureText(txt).width + 16;
        }
    }

    debuxarPila(ctx) {
        const pileX = CANVAS_W / 2 - CW / 2;
        const dorso = this.assets['dorso'];

        if (this.pila.length > 0 && dorso) {
            const stack = Math.min(this.pila.length, 4);
            for (let i = 0; i < stack; i++) {
                ctx.drawImage(dorso, pileX + i * 3, Y_PILE - i * 2, CW, CH);
            }
        }

        ctx.fillStyle = 'white';
        ctx.font = '9px Minipixel';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(`Pila: ${this.pila.length}`, CANVAS_W / 2, Y_PILE + CH + 14);

        if (this.rangoDeclarado > 0) {
            ctx.fillStyle = '#ffd700';
            ctx.fillText(`Rango: ${NOMES_RANGO[this.rangoDeclarado]}`, CANVAS_W / 2, Y_PILE + CH + 28);
        }
    }

    debuxarManXogador(ctx) {
        const man = this.mans[0];
        if (!man) return;
        const hp = this.posicionsMan(man.length);
        const canSelect = this.estado === ESTADO.ELIXIR_CARTAS || this.estado === ESTADO.ESPERAR_RESPOSTA;

        for (let i = 0; i < man.length; i++) {
            const p = hp[i];
            const sel = this.cartasSel.has(i);
            const yo = sel ? -10 : (i === this.cartaHover && canSelect ? -4 : 0);

            const img = this.assets[man[i].valor.toString()];
            if (img) ctx.drawImage(img, p.x, p.y + yo, CW, CH);

            if (sel) {
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = 2;
                ctx.strokeRect(p.x - 1, p.y + yo - 1, CW + 2, CH + 2);
            }
        }
    }

    debuxarInfoXogador(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, Y_PLAYER_INFO, CANVAS_W, 24);
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '9px Minipixel';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(`Ti: ${this.mans[0]?.length || 0} cartas`, 8, Y_PLAYER_INFO + 13);
    }

    debuxarControles(ctx) {
        if (this.estado === ESTADO.ELIXIR_RANGO) {
            // Rank selection
            this.btnRangoLeft.debuxar(ctx);
            this.btnRangoRight.debuxar(ctx);
            this.btnConfirmarRango.debuxar(ctx);

            ctx.fillStyle = '#ffd700';
            ctx.font = '14px Minipixel';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(NOMES_RANGO[this.rangoSel], CANVAS_W / 2, Y_BUTTONS + 13);

            ctx.fillStyle = '#ccc';
            ctx.font = '9px Minipixel';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText('Escolle rango', CANVAS_W / 2, Y_BUTTONS - 38);
        } else if (this.estado === ESTADO.ELIXIR_CARTAS) {
            this.btnXogar.debuxar(ctx);
            ctx.fillStyle = '#ccc';
            ctx.font = '9px Minipixel';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(`Selecciona 1-3 cartas (${NOMES_RANGO[this.rangoDeclarado]})`, CANVAS_W / 2, Y_BUTTONS - 8);
        } else if (this.estado === ESTADO.ESPERAR_RESPOSTA) {
            this.btnXogar.debuxar(ctx);
            this.btnMentiroso.debuxar(ctx);
            ctx.fillStyle = '#ccc';
            ctx.font = '9px Minipixel';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(`Xoga ${NOMES_RANGO[this.rangoDeclarado]} ou desafia`, CANVAS_W / 2, Y_BUTTONS - 8);
        }
    }

    debuxarMsg(ctx) {
        ctx.font = '12px Minipixel';
        const textW = ctx.measureText(this.mensaxe).width;
        const w = Math.max(220, textW + 40), h = 34;
        const x = (CANVAS_W - w) / 2;
        const y = Y_PILE - 50;

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

        const popW = 220, lineH = 16;
        const popH = 60 + this.numXogadores * lineH + 50;
        const popX = CANVAS_W / 2 - popW / 2;
        const popY = CANVAS_H / 2 - popH / 2 - 10;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
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
        ctx.fillText(this.ganador === 0 ? 'Gañaches!' : `${this.nomes[this.ganador]} gaña!`, popX + popW / 2, popY + 12);

        ctx.font = '10px Minipixel';
        let y = popY + 40;
        for (let i = 0; i < this.numXogadores; i++) {
            ctx.fillStyle = i === this.ganador ? '#ffd700' : '#ccc';
            ctx.fillText(`${this.nomes[i]}: ${this.mans[i]?.length || 0} cartas`, popX + popW / 2, y);
            y += lineH;
        }
        ctx.textBaseline = 'alphabetic';

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
