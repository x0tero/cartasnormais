import Escena from '../Escena.js';
import Baralla from '../Baralla.js';
import Boton from '../utiles/Boton.js';
import AnimacionDesprazamento from '../utiles/animacions/AnimacionDesprazamento.js';

const CW = 48, CH = 76, GAP = 8;
const CANVAS_W = 380, CANVAS_H = 600;

const Y_PLAYER_INFO = CANVAS_H - 24;
const Y_PLAYER_HAND = Y_PLAYER_INFO - CH - 6;

// Card ranking and points (index = puntos() value, 1-10)
// puntos(): As=1, 2=2, 3=3, 4=4, 5=5, 6=6, 7=7, Sota=8, Caballo=9, Rey=10
const RANGO = [0, 14, 1, 13, 2, 3, 4, 5, 6, 7, 8];
const PUNTOS = [0, 11, 0, 10, 0, 0, 0, 0, 2, 3, 4];

const NOMES_PALO = ['Ouros', 'Copas', 'Espadas', 'Bastos'];
const NOMES_RANGO = ['', 'As', '2', '3', '4', '5', '6', '7', 'Sota', 'Caballo', 'Rey'];
const CORES_EQUIPO = ['#4488ff', '#ff6644'];

const ESTADO = {
    REPARTIR: 0,
    TURNO_XOGADOR: 1,
    TURNO_IA: 2,
    CANTE: 3,
    FIN_RONDA: 4,
    FIN_XOGO: 5,
};

export default class Tute extends Escena {
    constructor(director, config = {}) {
        super(director);
        this.assets = director.assets;
        this.config = config;
        this.victoriasMeta = config.victoriasMeta || 5;

        // 4 fixed players: index 0 = human, 1-3 = IA
        this.numXogadores = 4;
        this.nomes = ['Ti', 'IA 1', 'IA 2', 'IA 3'];
        const difs = config.dificultades || ['medio', 'medio', 'medio'];
        this.dificultades = ['humano', ...difs];

        // Teams: randomly assign (0,partner) vs (other1,other2)
        // Shuffle indices 1,2,3 to pick human's partner
        const others = [1, 2, 3].sort(() => Math.random() - 0.5);
        this.equipos = [0, 0, 0, 0]; // 0 or 1
        this.equipos[0] = 0;
        this.equipos[others[0]] = 0; // human's partner
        this.equipos[others[1]] = 1;
        this.equipos[others[2]] = 1;
        this.companeiroIdx = others[0];

        this.vitoriasEquipo = [0, 0];
        this.ronda = 0;

        // Per-round state
        this.mans = [];
        this.bazas = [[], []]; // cards won per team
        this.mesa = [];        // [{carta, xogador}]
        this.triunfo = null;
        this.paloTriunfo = -1;
        this.turnoActual = 0;
        this.liderBaza = 0;
        this.cantes = [0, 0]; // cante points per team
        this.cantesPendentes = []; // cantes to declare after trick
        this.declarouTute = false;
        this.bazaNum = 0;

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
        this.tempIA = 0;

        // Buttons
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
    //  HELPERS
    // ═══════════════════════════════════════════

    rango(carta) { return RANGO[carta.puntos()] || 0; }
    puntosCarta(carta) { return PUNTOS[carta.puntos()] || 0; }

    contarPuntos(cartas) {
        let t = 0;
        for (const c of cartas) t += this.puntosCarta(c);
        return t;
    }

    // Determine which cards are legal to play
    cartasLegais(playerIdx) {
        const man = this.mans[playerIdx];
        if (this.mesa.length === 0) return man.map((_, i) => i); // lead anything

        const paloLider = this.mesa[0].carta.palo();
        const mellorRangoMesa = this.mellorRangoEnMesa(paloLider);
        const mellorTriunfoMesa = this.mellorTriunfoEnMesa();

        // Cards of lead suit
        const doPalo = [];
        const doPaloAlto = []; // can beat current best of lead suit
        for (let i = 0; i < man.length; i++) {
            if (man[i].palo() === paloLider) {
                doPalo.push(i);
                if (this.rango(man[i]) > mellorRangoMesa) doPaloAlto.push(i);
            }
        }

        // Must follow suit
        if (doPalo.length > 0) {
            // Must head (montar) if possible
            return doPaloAlto.length > 0 ? doPaloAlto : doPalo;
        }

        // No lead suit: must trump (fallar)
        const triunfos = [];
        const triunfosAlto = [];
        for (let i = 0; i < man.length; i++) {
            if (man[i].palo() === this.paloTriunfo) {
                triunfos.push(i);
                if (this.rango(man[i]) > mellorTriunfoMesa) triunfosAlto.push(i);
            }
        }

        if (triunfos.length > 0) {
            return triunfosAlto.length > 0 ? triunfosAlto : triunfos;
        }

        // No suit, no trump: play anything
        return man.map((_, i) => i);
    }

    mellorRangoEnMesa(palo) {
        let best = -1;
        for (const m of this.mesa) {
            if (m.carta.palo() === palo) {
                const r = this.rango(m.carta);
                if (r > best) best = r;
            }
        }
        return best;
    }

    mellorTriunfoEnMesa() {
        let best = -1;
        for (const m of this.mesa) {
            if (m.carta.palo() === this.paloTriunfo) {
                const r = this.rango(m.carta);
                if (r > best) best = r;
            }
        }
        return best;
    }

    ganadorBaza() {
        const paloLider = this.mesa[0].carta.palo();
        let mellor = 0;
        for (let i = 1; i < this.mesa.length; i++) {
            const c = this.mesa[i].carta;
            const m = this.mesa[mellor].carta;
            const cT = c.palo() === this.paloTriunfo;
            const mT = m.palo() === this.paloTriunfo;
            if (cT && !mT) mellor = i;
            else if (cT && mT && this.rango(c) > this.rango(m)) mellor = i;
            else if (!cT && !mT) {
                if (c.palo() === paloLider && m.palo() !== paloLider) mellor = i;
                else if (c.palo() === paloLider && m.palo() === paloLider &&
                         this.rango(c) > this.rango(m)) mellor = i;
            }
        }
        return this.mesa[mellor].xogador;
    }

    // Check for cantes (King+Knight of same suit)
    comprobarCantes(playerIdx) {
        const man = this.mans[playerIdx];
        const cantes = [];
        for (let palo = 0; palo < 4; palo++) {
            const tenRey = man.some(c => c.palo() === palo && c.puntos() === 10); // Rey
            const tenCaballo = man.some(c => c.palo() === palo && c.puntos() === 9); // Caballo
            if (tenRey && tenCaballo) {
                const pts = palo === this.paloTriunfo ? 40 : 20;
                cantes.push({ palo, pts });
            }
        }

        // Check for Tute (all 4 Kings or all 4 Knights)
        const reis = [0, 1, 2, 3].every(p => man.some(c => c.palo() === p && c.puntos() === 10));
        const cabalos = [0, 1, 2, 3].every(p => man.some(c => c.palo() === p && c.puntos() === 9));
        if (reis || cabalos) cantes.push({ tute: true });

        return cantes;
    }

    // ═══════════════════════════════════════════
    //  GAME FLOW
    // ═══════════════════════════════════════════

    iniciarRonda() {
        this.ronda++;
        this.baralla = new Baralla();
        this.mans = [];
        this.bazas = [[], []];
        this.mesa = [];
        this.cantes = [0, 0];
        this.declarouTute = false;
        this.bazaNum = 0;

        // Deal all 40 cards (10 per player)
        for (let i = 0; i < 4; i++) this.mans.push([]);
        let idx = 0;
        while (this.baralla.restantes() > 0) {
            this.mans[idx % 4].push(this.baralla.roubar());
            idx++;
        }
        for (const man of this.mans) man.sort((a, b) => a.valor - b.valor);

        // Last card dealt determines trump
        this.triunfo = this.mans[3][this.mans[3].length - 1];
        this.paloTriunfo = this.triunfo.palo();

        this.liderBaza = (this.ronda - 1) % 4;
        this.turnoActual = this.liderBaza;

        this.reproducirSon('son_barallar');
        this.mostrarMsg(`Triunfo: ${NOMES_PALO[this.paloTriunfo]}`, 1500, () => {
            this.iniciarTurno();
        });
    }

    iniciarTurno() {
        if (this.turnoActual === 0) {
            this.estado = ESTADO.TURNO_XOGADOR;
        } else {
            this.estado = ESTADO.TURNO_IA;
            this.tempIA = 0;
        }
    }

    xogarCarta(playerIdx, cardIdx) {
        const carta = this.mans[playerIdx].splice(cardIdx, 1)[0];
        this.mesa.push({ carta, xogador: playerIdx });
        this.reproducirSon(`son_dar${1 + Math.floor(Math.random() * 6)}`);

        if (this.mesa.length >= 4) {
            // All played, resolve trick
            setTimeout(() => this.resolverBaza(), 400);
        } else {
            this.turnoActual = (this.turnoActual + 1) % 4;
            this.iniciarTurno();
        }
    }

    resolverBaza() {
        this.bazaNum++;
        const ganador = this.ganadorBaza();
        const equipo = this.equipos[ganador];
        const cartas = this.mesa.map(m => m.carta);
        this.bazas[equipo].push(...cartas);

        const pts = this.contarPuntos(cartas);
        const isUltima = this.mans.every(m => m.length === 0);

        // 10 bonus for last trick
        const bonus = isUltima ? 10 : 0;

        const nomes = ['Ti', 'IA 1', 'IA 2', 'IA 3'];
        const equipoNome = equipo === 0 ? 'Equipo A' : 'Equipo B';
        const msg = `${nomes[ganador]} gaña a baza (+${pts}${bonus ? '+10' : ''})`;

        this.mostrarMsg(msg, 1200, () => {
            this.mesa = [];

            // Check for cantes
            const cantesDisponibles = this.comprobarCantes(ganador);
            if (cantesDisponibles.length > 0 && !isUltima) {
                this.procesarCantes(ganador, cantesDisponibles, () => {
                    if (this.declarouTute) {
                        this.finalizarRondaTute(equipo);
                    } else if (isUltima) {
                        this.finalizarRonda();
                    } else {
                        this.liderBaza = ganador;
                        this.turnoActual = ganador;
                        this.iniciarTurno();
                    }
                });
            } else if (isUltima) {
                this.finalizarRonda();
            } else {
                this.liderBaza = ganador;
                this.turnoActual = ganador;
                this.iniciarTurno();
            }
        });
    }

    procesarCantes(playerIdx, cantes, enRemate) {
        const equipo = this.equipos[playerIdx];
        const msgs = [];

        for (const c of cantes) {
            if (c.tute) {
                this.declarouTute = true;
                msgs.push('TUTE!');
            } else {
                this.cantes[equipo] += c.pts;
                msgs.push(`${c.pts} en ${NOMES_PALO[c.palo]}`);
            }
        }

        this.mostrarMsg(`${this.nomes[playerIdx]}: ${msgs.join(', ')}`, 2000, enRemate);
    }

    finalizarRondaTute(equipo) {
        this.vitoriasEquipo[equipo]++;
        this.detalles = {
            puntosEquipo: [0, 0],
            cantesEquipo: [0, 0],
            tute: true,
            equipoGanador: equipo
        };
        this.checkFinXogo();
    }

    finalizarRonda() {
        const pts = [this.contarPuntos(this.bazas[0]), this.contarPuntos(this.bazas[1])];

        // Last trick bonus already in bazas
        // Actually we need to track who won last trick
        // The bonus is already implied by resolverBaza adding 10
        // Let me just add it to the team that won the last trick
        // Find who won the last trick from bazaNum context
        const totalA = pts[0] + this.cantes[0] + (this.liderBaza !== undefined && this.equipos[this.liderBaza] === 0 ? 10 : 0);
        const totalB = pts[1] + this.cantes[1] + (this.liderBaza !== undefined && this.equipos[this.liderBaza] === 1 ? 10 : 0);

        const ganador = totalA >= totalB ? 0 : 1;
        this.vitoriasEquipo[ganador]++;

        this.detalles = {
            puntosEquipo: pts,
            cantesEquipo: [...this.cantes],
            ultimas: [this.equipos[this.liderBaza] === 0 ? 10 : 0, this.equipos[this.liderBaza] === 1 ? 10 : 0],
            totalA, totalB,
            tute: false,
            equipoGanador: ganador
        };

        this.checkFinXogo();
    }

    checkFinXogo() {
        if (this.vitoriasEquipo[0] >= this.victoriasMeta || this.vitoriasEquipo[1] >= this.victoriasMeta) {
            this.estado = ESTADO.FIN_XOGO;
        } else {
            this.estado = ESTADO.FIN_RONDA;
        }
    }

    // ═══════════════════════════════════════════
    //  PLAYER INPUT
    // ═══════════════════════════════════════════

    procesarEntrada(entrada) {
        if (!entrada.clicado) return;
        const hp = this.posicionsMan(this.mans[0].length);
        const legais = this.cartasLegais(0);

        for (let i = 0; i < this.mans[0].length; i++) {
            const p = hp[i];
            if (entrada.x >= p.x && entrada.x < p.x + CW &&
                entrada.y >= p.y && entrada.y < p.y + CH) {
                if (legais.includes(i)) {
                    this.xogarCarta(0, i);
                }
                return;
            }
        }
    }

    // ═══════════════════════════════════════════
    //  AI LOGIC
    // ═══════════════════════════════════════════

    executarIA(dt) {
        this.tempIA += dt;
        if (this.tempIA < 600) return;

        const idx = this.turnoActual;
        const man = this.mans[idx];
        if (man.length === 0) return;
        const legais = this.cartasLegais(idx);
        if (legais.length === 0) return;

        const dif = this.dificultades[idx];
        let escollaIdx;

        if (dif === 'facil') {
            escollaIdx = legais[Math.floor(Math.random() * legais.length)];
        } else {
            // Smart play: if partner is winning trick, play low. If opponent winning, try to win.
            let bestScore = -Infinity;
            escollaIdx = legais[0];

            const partnerWinning = this.mesa.length > 0 &&
                this.equipos[this.ganadorBazaParcial()] === this.equipos[idx];

            for (const ci of legais) {
                const c = man[ci];
                let score = 0;

                if (partnerWinning) {
                    // Play lowest value card
                    score = -this.puntosCarta(c) - this.rango(c) * 0.1;
                } else {
                    // Try to win with minimum waste
                    const wouldWin = this.simulaGana(idx, c);
                    if (wouldWin) {
                        score = 50 - this.puntosCarta(c); // prefer winning cheaply
                        // Extra value if trick has points
                        const trickPts = this.mesa.reduce((s, m) => s + this.puntosCarta(m.carta), 0);
                        score += trickPts;
                    } else {
                        score = -this.puntosCarta(c); // dump lowest
                    }
                }

                if (score > bestScore) { bestScore = score; escollaIdx = ci; }
            }
        }

        this.xogarCarta(idx, escollaIdx);
    }

    ganadorBazaParcial() {
        if (this.mesa.length === 0) return -1;
        const paloLider = this.mesa[0].carta.palo();
        let mellor = 0;
        for (let i = 1; i < this.mesa.length; i++) {
            const c = this.mesa[i].carta;
            const m = this.mesa[mellor].carta;
            const cT = c.palo() === this.paloTriunfo;
            const mT = m.palo() === this.paloTriunfo;
            if (cT && !mT) mellor = i;
            else if (cT && mT && this.rango(c) > this.rango(m)) mellor = i;
            else if (!cT && !mT) {
                if (c.palo() === paloLider && m.palo() !== paloLider) mellor = i;
                else if (c.palo() === paloLider && m.palo() === paloLider &&
                         this.rango(c) > this.rango(m)) mellor = i;
            }
        }
        return this.mesa[mellor].xogador;
    }

    simulaGana(playerIdx, carta) {
        const tempMesa = [...this.mesa, { carta, xogador: playerIdx }];
        const paloLider = tempMesa[0].carta.palo();
        let mellor = 0;
        for (let i = 1; i < tempMesa.length; i++) {
            const c = tempMesa[i].carta;
            const m = tempMesa[mellor].carta;
            const cT = c.palo() === this.paloTriunfo;
            const mT = m.palo() === this.paloTriunfo;
            if (cT && !mT) mellor = i;
            else if (cT && mT && this.rango(c) > this.rango(m)) mellor = i;
            else if (!cT && !mT) {
                if (c.palo() === paloLider && m.palo() !== paloLider) mellor = i;
                else if (c.palo() === paloLider && m.palo() === paloLider &&
                         this.rango(c) > this.rango(m)) mellor = i;
            }
        }
        return tempMesa[mellor].xogador === playerIdx;
    }

    // ═══════════════════════════════════════════
    //  POSITIONS
    // ═══════════════════════════════════════════

    posicionsMan(n) {
        if (n === 0) return [];
        const totalW = n * CW + (n - 1) * GAP;
        const sx = (CANVAS_W - totalW) / 2;
        const pos = [];
        for (let i = 0; i < n; i++) {
            pos.push({ x: sx + i * (CW + GAP), y: Y_PLAYER_HAND });
        }
        return pos;
    }

    posicionMesaCarta(idx) {
        const positions = [
            { x: CANVAS_W / 2 - CW / 2, y: 260 },        // bottom (human side)
            { x: CANVAS_W / 2 + CW + 10, y: 200 },        // right
            { x: CANVAS_W / 2 - CW / 2, y: 140 },         // top
            { x: CANVAS_W / 2 - CW * 2 - 10, y: 200 },    // left
        ];
        // Map player positions relative to leader
        const relIdx = (idx - this.liderBaza + 4) % 4;
        return positions[relIdx];
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
            case ESTADO.FIN_RONDA:
                this.director.canvas.style.cursor = 'default';
                this.btnContinuar.actualizar(entrada, dt);
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
        const legais = this.cartasLegais(0);
        for (let i = 0; i < this.mans[0].length; i++) {
            const p = hp[i];
            if (entrada.x >= p.x && entrada.x < p.x + CW &&
                entrada.y >= p.y && entrada.y < p.y + CH) {
                this.cartaHover = i;
                break;
            }
        }
        const playable = this.cartaHover >= 0 && legais.includes(this.cartaHover);
        this.director.canvas.style.cursor = playable ? 'pointer' : 'default';
    }

    // ═══════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════

    debuxar(ctx) {
        ctx.fillStyle = '#1a2a3a';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        this.debuxarInfoEquipos(ctx);
        this.debuxarMesaCartas(ctx);
        this.debuxarManXogador(ctx);
        this.debuxarInfoXogador(ctx);

        for (const anim of this.animacions) anim.debuxar(ctx);
        if (this.tempMsg > 0) this.debuxarMsg(ctx);

        if (this.estado === ESTADO.FIN_RONDA) this.debuxarFinRonda(ctx);
        if (this.estado === ESTADO.FIN_XOGO) this.debuxarFinXogo(ctx);

        if (!this.pausado && this.estado !== ESTADO.FIN_RONDA && this.estado !== ESTADO.FIN_XOGO) {
            this.btnCog.debuxar(ctx);
        }
        if (this.pausado) this.debuxarPausa(ctx);
    }

    debuxarInfoEquipos(ctx) {
        // Team info at top
        ctx.font = '9px Minipixel';
        ctx.textBaseline = 'alphabetic';

        // Equipo A (human's team)
        const membrosA = [];
        const membrosB = [];
        for (let i = 0; i < 4; i++) {
            if (this.equipos[i] === 0) membrosA.push(this.nomes[i]);
            else membrosB.push(this.nomes[i]);
        }

        ctx.fillStyle = CORES_EQUIPO[0];
        ctx.textAlign = 'left';
        ctx.fillText(`A: ${membrosA.join('+')} [${this.vitoriasEquipo[0]}]`, 36, 14);

        ctx.fillStyle = CORES_EQUIPO[1];
        ctx.textAlign = 'right';
        ctx.fillText(`B: ${membrosB.join('+')} [${this.vitoriasEquipo[1]}]`, CANVAS_W - 8, 14);

        // Trump indicator
        ctx.fillStyle = '#ffd700';
        ctx.textAlign = 'center';
        ctx.fillText(`Triunfo: ${NOMES_PALO[this.paloTriunfo]}`, CANVAS_W / 2, 30);

        // Show whose turn / cards held by IAs
        ctx.font = '8px Minipixel';
        for (let i = 1; i < 4; i++) {
            const isActive = this.turnoActual === i;
            const eq = this.equipos[i];
            ctx.fillStyle = isActive ? '#ffd700' : CORES_EQUIPO[eq];

            const positions = [null, { x: CANVAS_W - 8, align: 'right', y: 56 },
                              { x: CANVAS_W / 2, align: 'center', y: 44 },
                              { x: 8, align: 'left', y: 56 }];
            const p = positions[i];
            ctx.textAlign = p.align;
            ctx.fillText(`${this.nomes[i]}: ${this.mans[i]?.length || 0}`, p.x, p.y);
        }
    }

    debuxarMesaCartas(ctx) {
        for (let i = 0; i < this.mesa.length; i++) {
            const m = this.mesa[i];
            const pos = this.posicionMesaCarta(m.xogador);
            const img = this.assets[m.carta.valor.toString()];
            if (img) ctx.drawImage(img, pos.x, pos.y, CW, CH);
        }
    }

    debuxarManXogador(ctx) {
        const man = this.mans[0];
        if (!man) return;
        const hp = this.posicionsMan(man.length);
        const legais = this.estado === ESTADO.TURNO_XOGADOR ? this.cartasLegais(0) : [];

        for (let i = 0; i < man.length; i++) {
            const p = hp[i];
            const isLegal = legais.includes(i);
            const isHover = i === this.cartaHover && isLegal;
            const yo = isHover ? -8 : 0;

            if (this.estado === ESTADO.TURNO_XOGADOR && !isLegal) {
                ctx.save();
                ctx.globalAlpha = 0.4;
            }

            const img = this.assets[man[i].valor.toString()];
            if (img) ctx.drawImage(img, p.x, p.y + yo, CW, CH);

            if (this.estado === ESTADO.TURNO_XOGADOR && !isLegal) {
                ctx.restore();
            }

            if (isLegal && this.estado === ESTADO.TURNO_XOGADOR) {
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
        ctx.font = '9px Minipixel';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        const eq = this.equipos[0] === 0 ? 'A' : 'B';
        ctx.fillText(
            `Ti (Eq.${eq}) | Comp: ${this.nomes[this.companeiroIdx]} | Ronda ${this.ronda}`,
            8, Y_PLAYER_INFO + 13
        );
    }

    debuxarMsg(ctx) {
        ctx.font = '12px Minipixel';
        const textW = ctx.measureText(this.mensaxe).width;
        const w = Math.max(220, textW + 40), h = 34;
        const x = (CANVAS_W - w) / 2;
        const y = 100;

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
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        const popW = 260, popH = 180;
        const popX = CANVAS_W / 2 - popW / 2;
        const popY = CANVAS_H / 2 - popH / 2 - 20;

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

        const d = this.detalles;
        if (d.tute) {
            ctx.fillText('TUTE!', popX + popW / 2, popY + 12);
            ctx.font = '10px Minipixel';
            ctx.fillStyle = '#ccc';
            ctx.fillText(`Equipo ${d.equipoGanador === 0 ? 'A' : 'B'} gaña a ronda`, popX + popW / 2, popY + 36);
        } else {
            ctx.fillText('Fin da ronda', popX + popW / 2, popY + 12);

            ctx.font = '10px Minipixel';
            let y = popY + 38;
            for (let eq = 0; eq < 2; eq++) {
                const label = eq === 0 ? 'A' : 'B';
                ctx.fillStyle = CORES_EQUIPO[eq];
                ctx.fillText(
                    `Eq.${label}: ${d.puntosEquipo[eq]} pts + ${d.cantesEquipo[eq]} cantes + ${d.ultimas[eq]} ultimas = ${eq === 0 ? d.totalA : d.totalB}`,
                    popX + popW / 2, y
                );
                y += 18;
            }

            ctx.fillStyle = '#ffd700';
            y += 8;
            ctx.fillText(`Gaña Equipo ${d.equipoGanador === 0 ? 'A' : 'B'}`, popX + popW / 2, y);
        }

        ctx.fillStyle = '#ccc';
        ctx.font = '10px Minipixel';
        ctx.fillText(`Victorias: A=${this.vitoriasEquipo[0]} B=${this.vitoriasEquipo[1]}`, popX + popW / 2, popY + popH - 50);

        ctx.textBaseline = 'alphabetic';
        this.btnContinuar.y = popY + popH - 38;
        this.btnContinuar.debuxar(ctx);
    }

    debuxarFinXogo(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        const popW = 240, popH = 130;
        const popX = CANVAS_W / 2 - popW / 2;
        const popY = CANVAS_H / 2 - popH / 2 - 10;

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(popX + 3, popY + 3, popW, popH);
        ctx.fillStyle = '#222';
        ctx.fillRect(popX, popY, popW, popH);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.strokeRect(popX, popY, popW, popH);

        const ganador = this.vitoriasEquipo[0] >= this.victoriasMeta ? 0 : 1;
        const ganouXogador = this.equipos[0] === ganador;

        ctx.fillStyle = '#ffd700';
        ctx.font = '16px Minipixel';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(ganouXogador ? 'Gañaches!' : 'Perdiches!', popX + popW / 2, popY + 14);

        ctx.font = '11px Minipixel';
        ctx.fillStyle = '#ccc';
        ctx.fillText(`Equipo A: ${this.vitoriasEquipo[0]} | Equipo B: ${this.vitoriasEquipo[1]}`, popX + popW / 2, popY + 44);

        ctx.textBaseline = 'alphabetic';
        this.btnMenuFin.y = popY + popH - 38;
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
