import Escena from '../Escena.js';
import Menu from './Menu.js';
import Xogo from './Xogo.js';
import Boton from '../utiles/Boton.js';

export default class FinXogo extends Escena {
    constructor(director, nivel) {
        super(director);
        this.restartBtn = new Boton(90, 350, 200, 60, ['#d32f2f', '#ff6659', '#b71c1c'], [], 'Reintentar',
            () => this.director.cambiarEscena(new Xogo(this.director))
        );
        this.menuBtn = new Boton(90, 450, 200, 60, ['#33b5e5', '#62c9e5', '#0288d1'], [], 'Menú principal',
            () => this.director.cambiarEscena(new Menu(this.director))
        );
        this.botons = [this.restartBtn, this.menuBtn];
        this.nivel = nivel;
    }

    actualizar(entrada, dt) {
        this.botons.forEach(btn => btn.actualizar(entrada, dt));
        const cursorActivo = this.botons.some(b => b.estado === 'peneirar');
        this.director.canvas.style.cursor = cursorActivo ? 'pointer' : 'default';
    }

    debuxar(ctx) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
        ctx.fillRect(0, 0, this.director.canvas.width, this.director.canvas.height);

        ctx.fillStyle = "#ff4444"; 
        ctx.font = "10px Minipixel";
        ctx.textAlign = "center";
        ctx.fillText("DERROTA TOTAL", this.director.canvas.width / 2, 250);

        ctx.fillStyle = "white";
        ctx.font = "10px Minipixel";
        ctx.fillText("A máscara chegou ao final.", this.director.canvas.width / 2, 300);

        this.botons.forEach(btn => btn.debuxar(ctx));
    }
}