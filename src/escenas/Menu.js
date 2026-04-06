import Escena from '../Escena.js';
import ConfigXogo from './ConfigXogo.js';
import Boton from '../utiles/Boton.js';

export default class Menu extends Escena {
    constructor(director) {
        super(director);

        const cw = this.director.canvas.width;
        const btnW = 160, btnH = 40;
        const btnX = (cw - btnW) / 2;

        this.btnEscoba = new Boton(
            btnX, 280, btnW, btnH,
            ['#8B4513', '#A0522D', '#6B3410'],
            [], 'Escoba',
            () => this.director.cambiarEscena(new ConfigXogo(this.director, 'escoba')),
            { corTexto: 'white', tamanhoTexto: 16 }
        );

        this.btnBrisca = new Boton(
            btnX, 340, btnW, btnH,
            ['#2a4a7a', '#3a5a9a', '#1a3a5a'],
            [], 'Brisca',
            () => this.director.cambiarEscena(new ConfigXogo(this.director, 'brisca')),
            { corTexto: 'white', tamanhoTexto: 16 }
        );

        this.btnSeteEMedio = new Boton(
            btnX, 400, btnW, btnH,
            ['#6a2a6a', '#8a3a8a', '#4a1a4a'],
            [], 'Sete e medio',
            () => this.director.cambiarEscena(new ConfigXogo(this.director, 'seteemedio')),
            { corTexto: 'white', tamanhoTexto: 14 }
        );

        this.btnCinquillo = new Boton(
            btnX, 460, btnW, btnH,
            ['#6a6a2a', '#8a8a3a', '#4a4a1a'],
            [], 'Cinquillo',
            () => this.director.cambiarEscena(new ConfigXogo(this.director, 'cinquillo')),
            { corTexto: 'white', tamanhoTexto: 16 }
        );

        this.btnOpcions = new Boton(
            btnX, 520, btnW, btnH,
            ['#555', '#777', '#333'],
            [], 'Opcions',
            () => {},
            { corTexto: 'white', tamanhoTexto: 16 }
        );
    }

    actualizar(entrada, dt) {
        this.btnEscoba.actualizar(entrada, dt);
        this.btnBrisca.actualizar(entrada, dt);
        this.btnSeteEMedio.actualizar(entrada, dt);
        this.btnCinquillo.actualizar(entrada, dt);
        this.btnOpcions.actualizar(entrada, dt);

        const hover = this.btnEscoba.estado === 'peneirar' ||
                      this.btnBrisca.estado === 'peneirar' ||
                      this.btnSeteEMedio.estado === 'peneirar' ||
                      this.btnCinquillo.estado === 'peneirar' ||
                      this.btnOpcions.estado === 'peneirar';
        this.director.canvas.style.cursor = hover ? 'pointer' : 'default';
    }

    debuxar(ctx) {
        const cw = this.director.canvas.width;
        const ch = this.director.canvas.height;

        ctx.fillStyle = '#1a472a';
        ctx.fillRect(0, 0, cw, ch);

        ctx.fillStyle = '#FFD700';
        ctx.font = '28px Minipixel';
        ctx.textAlign = 'center';
        ctx.fillText('CARTAS', cw / 2, 200);

        this.btnEscoba.debuxar(ctx);
        this.btnBrisca.debuxar(ctx);
        this.btnSeteEMedio.debuxar(ctx);
        this.btnCinquillo.debuxar(ctx);
        this.btnOpcions.debuxar(ctx);
    }
}
