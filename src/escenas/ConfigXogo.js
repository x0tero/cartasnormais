import Escena from '../Escena.js';
import Xogo from './Xogo.js';
import Brisca from './Brisca.js';
import SeteEMedio from './SeteEMedio.js';
import Cinquillo from './Cinquillo.js';
import Presidente from './Presidente.js';
import Boton from '../utiles/Boton.js';

const CORES_IA = ['#e03030', '#3070e0', '#30b040'];

export default class ConfigXogo extends Escena {
    constructor(director, xogoTipo = 'escoba') {
        super(director);

        this.xogoTipo = xogoTipo;
        this.numOponentes = xogoTipo === 'presidente' ? 3 : 1;
        this.puntosMeta = 10;
        this.victoriasMeta = 5;
        this.dificultades = ['medio', 'medio', 'medio'];

        const DIFS = ['facil', 'medio', 'dificil'];
        this.DIFS = DIFS;

        const cw = this.director.canvas.width;
        const ch = this.director.canvas.height;
        const centerX = cw / 2;
        const arrowW = 30, arrowH = 24;

        // Opponent count arrows
        this.btnMenos = new Boton(
            centerX - 50, 190, arrowW, arrowH,
            ['#555', '#777', '#333', '#2a2a2a'],
            [], '<',
            () => { if (this.numOponentes > 1) this.numOponentes--; },
            { corTexto: 'white', tamanhoTexto: 14, instantaneo: true }
        );

        this.btnMais = new Boton(
            centerX + 20, 190, arrowW, arrowH,
            ['#555', '#777', '#333', '#2a2a2a'],
            [], '>',
            () => { if (this.numOponentes < 3) this.numOponentes++; },
            { corTexto: 'white', tamanhoTexto: 14, instantaneo: true }
        );

        // Points to win arrows
        this.btnPuntosMenos = new Boton(
            centerX - 50, 250, arrowW, arrowH,
            ['#555', '#777', '#333', '#2a2a2a'],
            [], '<',
            () => { if (this.puntosMeta > 10) this.puntosMeta--; },
            { corTexto: 'white', tamanhoTexto: 14, instantaneo: true }
        );

        this.btnPuntosMais = new Boton(
            centerX + 20, 250, arrowW, arrowH,
            ['#555', '#777', '#333', '#2a2a2a'],
            [], '>',
            () => { if (this.puntosMeta < 31) this.puntosMeta++; },
            { corTexto: 'white', tamanhoTexto: 14, instantaneo: true }
        );

        // Victories to win arrows (presidente only)
        const vicY = 235;
        this.btnVicMenos = new Boton(
            centerX - 50, vicY, arrowW, arrowH,
            ['#555', '#777', '#333', '#2a2a2a'],
            [], '<',
            () => { if (this.victoriasMeta > 5) this.victoriasMeta--; },
            { corTexto: 'white', tamanhoTexto: 14, instantaneo: true }
        );
        this.btnVicMais = new Boton(
            centerX + 20, vicY, arrowW, arrowH,
            ['#555', '#777', '#333', '#2a2a2a'],
            [], '>',
            () => { if (this.victoriasMeta < 10) this.victoriasMeta++; },
            { corTexto: 'white', tamanhoTexto: 14, instantaneo: true }
        );

        // Difficulty arrows for each opponent (up to 3)
        this.difBtns = [];
        const difBaseY = xogoTipo === 'presidente' ? 300 : 340;
        for (let i = 0; i < 3; i++) {
            const y = difBaseY + i * 54;
            const btnLeft = new Boton(
                centerX - 80, y, arrowW, arrowH,
                ['#555', '#777', '#333', '#2a2a2a'],
                [], '<',
                (() => {
                    const idx = i;
                    return () => {
                        const cur = DIFS.indexOf(this.dificultades[idx]);
                        if (cur > 0) this.dificultades[idx] = DIFS[cur - 1];
                    };
                })(),
                { corTexto: 'white', tamanhoTexto: 14, instantaneo: true }
            );
            const btnRight = new Boton(
                centerX + 50, y, arrowW, arrowH,
                ['#555', '#777', '#333', '#2a2a2a'],
                [], '>',
                (() => {
                    const idx = i;
                    return () => {
                        const cur = DIFS.indexOf(this.dificultades[idx]);
                        if (cur < DIFS.length - 1) this.dificultades[idx] = DIFS[cur + 1];
                    };
                })(),
                { corTexto: 'white', tamanhoTexto: 14, instantaneo: true }
            );
            this.difBtns.push({ left: btnLeft, right: btnRight });
        }

        // Xogar button
        this.btnXogar = new Boton(
            centerX - 60, ch - 100, 120, 36,
            ['#2a7a2a', '#3a9a3a', '#1a5a1a'],
            [], 'Xogar',
            () => {
                const config = {
                    numOponentes: this.numOponentes,
                    dificultades: this.dificultades.slice(0, this.numOponentes),
                    puntosMeta: this.puntosMeta
                };
                if (this.xogoTipo === 'brisca') {
                    this.director.cambiarEscena(new Brisca(this.director, config));
                } else if (this.xogoTipo === 'seteemedio') {
                    this.director.cambiarEscena(new SeteEMedio(this.director, config));
                } else if (this.xogoTipo === 'cinquillo') {
                    this.director.cambiarEscena(new Cinquillo(this.director, config));
                } else if (this.xogoTipo === 'presidente') {
                    config.numOponentes = 3; // Always 4 players
                    config.dificultades = this.dificultades.slice(0, 3);
                    config.victoriasMeta = this.victoriasMeta;
                    this.director.cambiarEscena(new Presidente(this.director, config));
                } else {
                    this.director.cambiarEscena(new Xogo(this.director, config));
                }
            },
            { corTexto: 'white', tamanhoTexto: 14 }
        );

        // Back button
        this.btnVolver = new Boton(
            10, ch - 40, 60, 24,
            ['#555', '#777', '#333'],
            [], 'Volver',
            () => {
                import('./Menu.js').then(m => {
                    this.director.cambiarEscena(new m.default(this.director));
                });
            },
            { corTexto: 'white', tamanhoTexto: 10 }
        );
    }

    actualizar(entrada, dt) {
        const isPresidente = this.xogoTipo === 'presidente';

        // Disable arrows at limits
        this.btnMenos.deshabilitado = this.numOponentes <= 1 || isPresidente;
        this.btnMais.deshabilitado = this.numOponentes >= 3 || isPresidente;

        if (!isPresidente) {
            this.btnMenos.actualizar(entrada, dt);
            this.btnMais.actualizar(entrada, dt);
        }

        this.btnPuntosMenos.deshabilitado = this.puntosMeta <= 10;
        this.btnPuntosMais.deshabilitado = this.puntosMeta >= 31;
        if (!isPresidente) {
            this.btnPuntosMenos.actualizar(entrada, dt);
            this.btnPuntosMais.actualizar(entrada, dt);
        }

        if (isPresidente) {
            this.btnVicMenos.deshabilitado = this.victoriasMeta <= 5;
            this.btnVicMais.deshabilitado = this.victoriasMeta >= 10;
            this.btnVicMenos.actualizar(entrada, dt);
            this.btnVicMais.actualizar(entrada, dt);
        }

        for (let i = 0; i < this.numOponentes; i++) {
            const cur = this.DIFS.indexOf(this.dificultades[i]);
            this.difBtns[i].left.deshabilitado = cur <= 0;
            this.difBtns[i].right.deshabilitado = cur >= this.DIFS.length - 1;
            this.difBtns[i].left.actualizar(entrada, dt);
            this.difBtns[i].right.actualizar(entrada, dt);
        }

        this.btnXogar.actualizar(entrada, dt);
        this.btnVolver.actualizar(entrada, dt);

        const allBtns = [this.btnMenos, this.btnMais, this.btnPuntosMenos, this.btnPuntosMais,
            this.btnVicMenos, this.btnVicMais, this.btnXogar, this.btnVolver,
            ...this.difBtns.slice(0, this.numOponentes).flatMap(b => [b.left, b.right])
        ];
        const anyHover = allBtns.some(b => b.estado === 'peneirar');
        this.director.canvas.style.cursor = anyHover ? 'pointer' : 'default';
    }

    debuxar(ctx) {
        const cw = this.director.canvas.width;
        const ch = this.director.canvas.height;
        const centerX = cw / 2;

        // Green background
        ctx.fillStyle = '#1a472a';
        ctx.fillRect(0, 0, cw, ch);

        // Title
        ctx.fillStyle = '#FFD700';
        ctx.font = '22px Minipixel';
        ctx.textAlign = 'center';
        const titulos = { escoba: 'ESCOBA', brisca: 'BRISCA', seteemedio: 'SETE E MEDIO', cinquillo: 'CINQUILLO', presidente: 'PRESIDENTE' };
        ctx.fillText(titulos[this.xogoTipo] || 'ESCOBA', centerX, 60);

        const isPresidente = this.xogoTipo === 'presidente';

        if (!isPresidente) {
            // Opponent count section
            ctx.fillStyle = 'white';
            ctx.font = '13px Minipixel';
            ctx.fillText('Numero de oponentes', centerX, 170);

            this.btnMenos.debuxar(ctx);
            this.btnMais.debuxar(ctx);

            ctx.fillStyle = 'white';
            ctx.font = '16px Minipixel';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.numOponentes.toString(), centerX, 190 + 12);

            // Points to win section
            ctx.fillStyle = 'white';
            ctx.font = '13px Minipixel';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText('Puntos para ganar', centerX, 238);

            this.btnPuntosMenos.debuxar(ctx);
            this.btnPuntosMais.debuxar(ctx);

            ctx.fillStyle = 'white';
            ctx.font = '16px Minipixel';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.puntosMeta.toString(), centerX, 250 + 12);
        } else {
            // Presidente: fixed 4 players notice
            ctx.fillStyle = '#ccc';
            ctx.font = '11px Minipixel';
            ctx.fillText('4 xogadores (fixo)', centerX, 190);

            // Victories to win
            ctx.fillStyle = 'white';
            ctx.font = '13px Minipixel';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText('Victorias para ganar', centerX, 230);

            this.btnVicMenos.debuxar(ctx);
            this.btnVicMais.debuxar(ctx);

            ctx.fillStyle = 'white';
            ctx.font = '16px Minipixel';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.victoriasMeta.toString(), centerX, 235 + 12);
        }

        // Difficulty selectors
        const difYStart = isPresidente ? 300 : 340;
        for (let i = 0; i < this.numOponentes; i++) {
            const y = difYStart + i * 54;

            ctx.fillStyle = '#ccc';
            ctx.font = '11px Minipixel';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(`Dificultade IA ${i + 1}`, centerX, y - 8);

            this.difBtns[i].left.debuxar(ctx);
            this.difBtns[i].right.debuxar(ctx);

            const difText = { facil: 'Facil', medio: 'Medio', dificil: 'Dificil' };
            ctx.fillStyle = 'white';
            ctx.font = '13px Minipixel';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(difText[this.dificultades[i]], centerX, y + 12);

            // Color indicator
            const dotSize = 10;
            ctx.fillStyle = CORES_IA[i];
            ctx.fillRect(centerX + 88, y + 7, dotSize, dotSize);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.strokeRect(centerX + 88, y + 7, dotSize, dotSize);
        }

        // Xogar button
        this.btnXogar.debuxar(ctx);

        // Back button
        this.btnVolver.debuxar(ctx);
    }
}
