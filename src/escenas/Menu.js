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
            btnX, 300, btnW, btnH,
            ['#8B4513', '#A0522D', '#6B3410'],
            [], 'Escoba',
            () => this.director.cambiarEscena(new ConfigXogo(this.director)),
            { corTexto: 'white', tamanhoTexto: 16 }
        );

        this.btnOpcions = new Boton(
            btnX, 360, btnW, btnH,
            ['#555', '#777', '#333'],
            [], 'Opcions',
            () => {},
            { corTexto: 'white', tamanhoTexto: 16 }
        );
    }

    actualizar(entrada, dt) {
        this.btnEscoba.actualizar(entrada, dt);
        this.btnOpcions.actualizar(entrada, dt);

        const hover = this.btnEscoba.estado === 'peneirar' || this.btnOpcions.estado === 'peneirar';
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
        ctx.fillText('ESCOBA', cw / 2, 200);

        this.btnEscoba.debuxar(ctx);
        this.btnOpcions.debuxar(ctx);
    }
}
