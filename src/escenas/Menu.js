import Escena from '../Escena.js';
import Xogo from './Xogo.js';
import Boton from '../utiles/Boton.js';

export default class Menu extends Escena {
    constructor(director) {
        super(director);
        
        const btnAncho = 200; 
        const btnAlto = 80;
        const btnX = (this.director.canvas.width - btnAncho) / 2;

        const assets = this.director.assets;
        this.comezarBtn = new Boton(
            btnX, 400, btnAncho, btnAlto,
            [],
            [assets['btn_normal'], assets['btn_peneirar'], assets['btn_premido']],
            '',
            () => this.director.cambiarEscena(new Xogo(this.director))
        );
    }

    actualizar(entrada, dt) {
        this.comezarBtn.actualizar(entrada, dt);
        this.director.canvas.style.cursor = this.comezarBtn.estado === 'peneirar' ? 'pointer' : 'default';
    }

    debuxar(ctx) {
        ctx.clearRect(0, 0, this.director.canvas.width, this.director.canvas.height);
        const menuBg = this.director.assets['menu_bg'];
        if (menuBg) {
             ctx.drawImage(menuBg, 0, 0, this.director.canvas.width, this.director.canvas.height);
        } else {
             ctx.fillStyle = "#1a1a1a";
             ctx.fillRect(0, 0, this.director.canvas.width, this.director.canvas.height);
        }

        this.comezarBtn.debuxar(ctx);
    }
}