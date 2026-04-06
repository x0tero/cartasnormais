export default class Animacion {
    constructor(velocidade, enRemate) {
        this.progreso = 0;
        this.velocidade = velocidade;
        this.enRemate = enRemate;
        this.completada = false;
    }

    actualizar(entrada, dt) {
        this.progreso += this.velocidade;
        if (this.progreso >= 1) {
            this.progreso = 1;
            this.completada = true;
            this._alRemate();
            if (this.enRemate) this.enRemate();
        } else {
            this._actualizar();
        }
    }

    // Override to update interpolated state each frame
    _actualizar() {}

    // Override for any action to run at completion before enRemate fires
    _alRemate() {}

    debuxar(ctx) {}
}