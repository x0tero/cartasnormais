import Animacion from '../Animacion.js';

export default class AnimacionTremer extends Animacion {
    constructor(fila, col, velocidade, enRemate) {
        super(velocidade, enRemate);
        this.fila = fila;
        this.col = col;
        this.desvioX = 0;
    }

    _actualizar() {
        this.desvioX = Math.sin(this.progreso * Math.PI * 4) * 4;
    }

    debuxar(ctx) {}
}
