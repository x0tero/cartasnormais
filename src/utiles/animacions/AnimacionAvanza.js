import Animacion from '../Animacion.js';

// Slides a card + mask block from one grid row to the next.
export default class AnimacionAvanza extends Animacion {
    constructor(assets, cartaAncho, cartaAlto, cartaId, nomeMascara, comezoX, comezoY, destinoX, destinoY, filaDestino, colDestino, velocidade, enRemate) {
        super(velocidade, enRemate);
        this.assets = assets;
        this.cartaAncho = cartaAncho;
        this.cartaAlto = cartaAlto;
        this.cartaId = cartaId;
        this.nomeMascara = nomeMascara;
        this.comezoX = comezoX;
        this.comezoY = comezoY;
        this.destinoX = destinoX;
        this.destinoY = destinoY;
        this.filaDestino = filaDestino;
        this.colDestino = colDestino;
        this.actualX = comezoX;
        this.actualY = comezoY;
    }

    _actualizar() {
        this.actualX = this.comezoX + (this.destinoX - this.comezoX) * this.progreso;
        this.actualY = this.comezoY + (this.destinoY - this.comezoY) * this.progreso;
    }

    debuxar(ctx) {
        const cartaImx = this.assets[this.cartaId.toString()];
        if (cartaImx) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.drawImage(cartaImx, this.actualX, this.actualY, this.cartaAncho, this.cartaAlto);
        }
        const mascaraImx = this.assets[this.nomeMascara];
        if (mascaraImx) {
            ctx.drawImage(mascaraImx, this.actualX, this.actualY - 5, this.cartaAncho, this.cartaAlto);
        }
        ctx.shadowBlur = 0;
    }
}
