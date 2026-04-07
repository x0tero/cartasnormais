import Escena from '../Escena.js';
import ConfigXogo from './ConfigXogo.js';
import Boton from '../utiles/Boton.js';

export default class Menu extends Escena {
    constructor(director) {
        super(director);

        const cw = this.director.canvas.width;
        const btnW = 160, btnH = 36;
        const btnX = (cw - btnW) / 2;
        const btnGap = 44;
        let btnY = 250;

        this.btnEscoba = new Boton(
            btnX, btnY, btnW, btnH,
            ['#8B4513', '#A0522D', '#6B3410'],
            [], 'Escoba',
            () => this.director.cambiarEscena(new ConfigXogo(this.director, 'escoba')),
            { corTexto: 'white', tamanhoTexto: 14 }
        );

        this.btnBrisca = new Boton(
            btnX, btnY += btnGap, btnW, btnH,
            ['#2a4a7a', '#3a5a9a', '#1a3a5a'],
            [], 'Brisca',
            () => this.director.cambiarEscena(new ConfigXogo(this.director, 'brisca')),
            { corTexto: 'white', tamanhoTexto: 14 }
        );

        this.btnSeteEMedio = new Boton(
            btnX, btnY += btnGap, btnW, btnH,
            ['#6a2a6a', '#8a3a8a', '#4a1a4a'],
            [], 'Sete e medio',
            () => this.director.cambiarEscena(new ConfigXogo(this.director, 'seteemedio')),
            { corTexto: 'white', tamanhoTexto: 14 }
        );

        this.btnCinquillo = new Boton(
            btnX, btnY += btnGap, btnW, btnH,
            ['#6a6a2a', '#8a8a3a', '#4a4a1a'],
            [], 'Cinquillo',
            () => this.director.cambiarEscena(new ConfigXogo(this.director, 'cinquillo')),
            { corTexto: 'white', tamanhoTexto: 14 }
        );

        this.btnPresidente = new Boton(
            btnX, btnY += btnGap, btnW, btnH,
            ['#6a2a2a', '#8a3a3a', '#4a1a1a'],
            [], 'Presidente',
            () => this.director.cambiarEscena(new ConfigXogo(this.director, 'presidente')),
            { corTexto: 'white', tamanhoTexto: 14 }
        );

        this.btnMentiroso = new Boton(
            btnX, btnY += btnGap, btnW, btnH,
            ['#2a6a5a', '#3a8a7a', '#1a4a3a'],
            [], 'Mentiroso',
            () => this.director.cambiarEscena(new ConfigXogo(this.director, 'mentiroso')),
            { corTexto: 'white', tamanhoTexto: 14 }
        );

        this.btnTute = new Boton(
            btnX, btnY += btnGap, btnW, btnH,
            ['#5a3a1a', '#7a5a3a', '#3a2a0a'],
            [], 'Tute',
            () => this.director.cambiarEscena(new ConfigXogo(this.director, 'tute')),
            { corTexto: 'white', tamanhoTexto: 14 }
        );

        this.btnMus = new Boton(
            btnX, btnY += btnGap, btnW, btnH,
            ['#3a5a3a', '#5a7a5a', '#2a3a2a'],
            [], 'Mus',
            () => this.director.cambiarEscena(new ConfigXogo(this.director, 'mus')),
            { corTexto: 'white', tamanhoTexto: 14 }
        );

        this.btnOpcions = new Boton(
            btnX, btnY += btnGap, btnW, btnH,
            ['#555', '#777', '#333'],
            [], 'Opcions',
            () => {},
            { corTexto: 'white', tamanhoTexto: 14 }
        );
    }

    actualizar(entrada, dt) {
        this.btnEscoba.actualizar(entrada, dt);
        this.btnBrisca.actualizar(entrada, dt);
        this.btnSeteEMedio.actualizar(entrada, dt);
        this.btnCinquillo.actualizar(entrada, dt);
        this.btnPresidente.actualizar(entrada, dt);
        this.btnMentiroso.actualizar(entrada, dt);
        this.btnTute.actualizar(entrada, dt);
        this.btnMus.actualizar(entrada, dt);
        this.btnOpcions.actualizar(entrada, dt);

        const hover = this.btnEscoba.estado === 'peneirar' ||
                      this.btnBrisca.estado === 'peneirar' ||
                      this.btnSeteEMedio.estado === 'peneirar' ||
                      this.btnCinquillo.estado === 'peneirar' ||
                      this.btnPresidente.estado === 'peneirar' ||
                      this.btnMentiroso.estado === 'peneirar' ||
                      this.btnTute.estado === 'peneirar' ||
                      this.btnMus.estado === 'peneirar' ||
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
        this.btnPresidente.debuxar(ctx);
        this.btnMentiroso.debuxar(ctx);
        this.btnTute.debuxar(ctx);
        this.btnMus.debuxar(ctx);
        this.btnOpcions.debuxar(ctx);
    }
}
