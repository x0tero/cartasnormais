import Escena from '../Escena.js';
import Xogo from './Xogo.js';
import Boton from '../utiles/Boton.js';

export default class ConfigXogo extends Escena {
    constructor(director) {
        super(director);

        this.numOponentes = 1;
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
            ['#555', '#777', '#333'],
            [], '<',
            () => { if (this.numOponentes > 1) this.numOponentes--; },
            { corTexto: 'white', tamanhoTexto: 14 }
        );

        this.btnMais = new Boton(
            centerX + 20, 190, arrowW, arrowH,
            ['#555', '#777', '#333'],
            [], '>',
            () => { if (this.numOponentes < 3) this.numOponentes++; },
            { corTexto: 'white', tamanhoTexto: 14 }
        );

        // Difficulty arrows for each opponent (up to 3)
        this.difBtns = [];
        for (let i = 0; i < 3; i++) {
            const y = 280 + i * 60;
            const btnLeft = new Boton(
                centerX - 80, y, arrowW, arrowH,
                ['#555', '#777', '#333'],
                [], '<',
                (() => {
                    const idx = i;
                    return () => {
                        const cur = DIFS.indexOf(this.dificultades[idx]);
                        if (cur > 0) this.dificultades[idx] = DIFS[cur - 1];
                    };
                })(),
                { corTexto: 'white', tamanhoTexto: 14 }
            );
            const btnRight = new Boton(
                centerX + 50, y, arrowW, arrowH,
                ['#555', '#777', '#333'],
                [], '>',
                (() => {
                    const idx = i;
                    return () => {
                        const cur = DIFS.indexOf(this.dificultades[idx]);
                        if (cur < DIFS.length - 1) this.dificultades[idx] = DIFS[cur + 1];
                    };
                })(),
                { corTexto: 'white', tamanhoTexto: 14 }
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
                    dificultades: this.dificultades.slice(0, this.numOponentes)
                };
                this.director.cambiarEscena(new Xogo(this.director, config));
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
        this.btnMenos.actualizar(entrada, dt);
        this.btnMais.actualizar(entrada, dt);

        for (let i = 0; i < this.numOponentes; i++) {
            this.difBtns[i].left.actualizar(entrada, dt);
            this.difBtns[i].right.actualizar(entrada, dt);
        }

        this.btnXogar.actualizar(entrada, dt);
        this.btnVolver.actualizar(entrada, dt);

        const anyHover = [this.btnMenos, this.btnMais, this.btnXogar, this.btnVolver,
            ...this.difBtns.slice(0, this.numOponentes).flatMap(b => [b.left, b.right])
        ].some(b => b.estado === 'peneirar');
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
        ctx.fillText('ESCOBA', centerX, 60);

        // Opponent count section
        ctx.fillStyle = 'white';
        ctx.font = '13px Minipixel';
        ctx.fillText('Numero de oponentes', centerX, 170);

        this.btnMenos.debuxar(ctx);
        this.btnMais.debuxar(ctx);

        ctx.fillStyle = 'white';
        ctx.font = '16px Minipixel';
        ctx.textAlign = 'center';
        ctx.fillText(this.numOponentes.toString(), centerX, 208);

        // Difficulty selectors
        for (let i = 0; i < this.numOponentes; i++) {
            const y = 280 + i * 60;

            ctx.fillStyle = '#ccc';
            ctx.font = '11px Minipixel';
            ctx.textAlign = 'center';
            ctx.fillText(`Dificultade IA ${i + 1}`, centerX, y - 8);

            this.difBtns[i].left.debuxar(ctx);
            this.difBtns[i].right.debuxar(ctx);

            const difText = { facil: 'Facil', medio: 'Medio', dificil: 'Dificil' };
            ctx.fillStyle = 'white';
            ctx.font = '13px Minipixel';
            ctx.textAlign = 'center';
            ctx.fillText(difText[this.dificultades[i]], centerX, y + 16);
        }

        // Xogar button
        this.btnXogar.debuxar(ctx);

        // Back button
        this.btnVolver.debuxar(ctx);
    }
}
