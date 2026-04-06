import Animacion from '../Animacion.js';

// Moves a card image smoothly from (comezoX, comezoY) to (destinoX, destinoY).
export default class AnimacionDesprazamento extends Animacion {
    constructor(assets, cartaAncho, cartaAlto, cartaId, comezoX, comezoY, destinoX, destinoY, enRemate, velocidade = 0.045) {
        super(velocidade, enRemate);
        this.assets = assets;
        this.cartaAncho = cartaAncho;
        this.cartaAlto = cartaAlto;
        this.cartaId = cartaId;
        this.comezoX = comezoX;
        this.comezoY = comezoY;
        this.destinoX = destinoX;
        this.destinoY = destinoY;
        this.actualX = comezoX;
        this.actualY = comezoY;
    }

    _actualizar() {
        this.actualX = this.comezoX + (this.destinoX - this.comezoX) * this.progreso;
        this.actualY = this.comezoY + (this.destinoY - this.comezoY) * this.progreso;
    }

    debuxar(ctx) {
        const imx = this.assets[this.cartaId.toString()];
        if (!imx) return;
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.drawImage(imx, this.actualX, this.actualY, this.cartaAncho, this.cartaAlto);
        ctx.shadowBlur = 0;
    }
}
