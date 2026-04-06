import Animacion from '../Animacion.js';

// Fades out a mask image while scaling it up.
export default class AnimacionEfecto extends Animacion {
    constructor(assets, cartaAncho, cartaAlto, assetKey, x, y, velocidade, enRemate) {
        super(velocidade, enRemate);
        this.assets = assets;
        this.cartaAncho = cartaAncho;
        this.cartaAlto = cartaAlto;
        this.assetKey = assetKey;
        this.actualX = x;
        this.actualY = y;
        this.alfa = 1;
        this.escala = 1;
    }

    _actualizar() {
        this.alfa = 1 - this.progreso;
        this.escala = 1 + (this.progreso * 0.5);
    }

    debuxar(ctx) {
        const imx = this.assets[this.assetKey];
        if (!imx) return;
        ctx.save();
        ctx.globalAlpha = this.alfa;
        const centroX = this.actualX + this.cartaAncho / 2;
        const centroY = this.actualY + this.cartaAlto / 2;
        ctx.translate(centroX, centroY);
        ctx.scale(this.escala, this.escala);
        ctx.drawImage(imx, -this.cartaAncho / 2, -this.cartaAlto / 2 - 5, this.cartaAncho, this.cartaAlto);
        ctx.restore();
    }
}
