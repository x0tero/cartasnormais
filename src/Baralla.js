import Card from './Carta.js';

export default class Baralla {
    constructor() {
        this.cartas = [];
        this.crearBaralla();
        this.barallar();
    }

    restablecer() {
        this.cartas = [];
        this.crearBaralla();
        this.barallar();
    }

    roubar() {
        return this.cartas.pop();
    }

    repartir(n) {
        const resultado = [];
        for (let i = 0; i < n && this.cartas.length > 0; i++) {
            resultado.push(this.cartas.pop());
        }
        return resultado;
    }

    crearBaralla() {
        for (let i = 1; i <= 40; i++) {
            this.cartas.push(new Card(i));
        }
    }

    barallar() {
        // algoritmo de barallar Fisher-Yates
        for (let i = this.cartas.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cartas[i], this.cartas[j]] = [this.cartas[j], this.cartas[i]];
        }
    }

    restantes() {
        return this.cartas.length;
    }
}