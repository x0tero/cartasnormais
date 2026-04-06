export default class Escena {
    constructor(director) {
        this.director = director;
    }

    actualizar(entrada, dt) {
        throw new Error("actualizar() debe estar implementada na subclase.");
    }

    debuxar(ctx) {
        throw new Error("render() debe estar implementada na subclase.");
    }
}