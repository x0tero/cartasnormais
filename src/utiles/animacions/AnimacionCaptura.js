import Animacion from '../Animacion.js';

// Multi-step capture animation:
// 1. Hand card flies to first table card position
// 2. They stack, fly to next table card
// 3. Repeat until all table cards are collected
// 4. Full stack flies to the destination (capture zone)
export default class AnimacionCaptura extends Animacion {
    /**
     * @param {object} assets
     * @param {number} cartaAncho
     * @param {number} cartaAlto
     * @param {{valor: number, x: number, y: number}} cartaMan - hand card info
     * @param {{valor: number, x: number, y: number}[]} cartasMesa - table cards in pickup order
     * @param {{x: number, y: number}} destino - final destination
     * @param {function|null} enRemate
     * @param {boolean} abaixo - if true, collected cards stack below hand card (player style)
     */
    constructor(assets, cartaAncho, cartaAlto, cartaMan, cartasMesa, destino, enRemate, abaixo = false) {
        super(0.045, enRemate);
        this.assets = assets;
        this.cartaAncho = cartaAncho;
        this.cartaAlto = cartaAlto;
        this.destino = destino;
        this.abaixo = abaixo;
        this.STACK_OFFSET = 16;

        // Build steps: hand card flies to each table card's position + growing offset
        // Player (abaixo): +offset (hand card below captured card)
        // IA: -offset (hand card above captured card)
        const dir = abaixo ? 1 : -1;
        this.pasos = [];
        // Step 0: hand flies to card0 position + 1*offset
        this.pasos.push({
            fromX: cartaMan.x, fromY: cartaMan.y,
            toX: cartasMesa[0].x, toY: cartasMesa[0].y + dir * this.STACK_OFFSET
        });
        // Steps 1..n-1: stack flies to next card position + growing offset
        for (let i = 1; i < cartasMesa.length; i++) {
            const prevTo = cartasMesa[i - 1].y + dir * i * this.STACK_OFFSET;
            this.pasos.push({
                fromX: cartasMesa[i - 1].x, fromY: prevTo,
                toX: cartasMesa[i].x, toY: cartasMesa[i].y + dir * (i + 1) * this.STACK_OFFSET
            });
        }
        // Final step: stack flies to destination
        const last = cartasMesa[cartasMesa.length - 1];
        const lastToY = last.y + dir * cartasMesa.length * this.STACK_OFFSET;
        this.pasos.push({
            fromX: last.x, fromY: lastToY,
            toX: destino.x, toY: destino.y
        });

        this.cartasMesa = cartasMesa;
        this.cartasMesaValores = cartasMesa.map(c => c.valor);
        this.cartaManValor = cartaMan.valor;

        this.pasoActual = 0;
        this.progresoLocal = 0;
        this.recollidas = 0;
        this.stackX = cartaMan.x;
        this.stackY = cartaMan.y;
    }

    _actualizar() {}

    actualizar(entrada, dt) {
        if (this.completada) return;

        this.progresoLocal += this.velocidade;
        if (this.progresoLocal >= 1) {
            const paso = this.pasos[this.pasoActual];
            this.stackX = paso.toX;
            this.stackY = paso.toY;

            if (this.pasoActual < this.pasos.length - 1) {
                this.recollidas = this.pasoActual + 1;
            }

            this.pasoActual++;
            this.progresoLocal = 0;

            if (this.pasoActual >= this.pasos.length) {
                this.completada = true;
                this.progreso = 1;
                if (this.enRemate) this.enRemate();
                return;
            }
        }

        const paso = this.pasos[this.pasoActual];
        const t = this.progresoLocal;
        this.stackX = paso.fromX + (paso.toX - paso.fromX) * t;
        this.stackY = paso.fromY + (paso.toY - paso.fromY) * t;
    }

    debuxar(ctx) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';

        // 1. Draw not-yet-collected table cards first (background)
        for (let i = this.recollidas; i < this.cartasMesa.length; i++) {
            const c = this.cartasMesa[i];
            const imx = this.assets[c.valor.toString()];
            if (imx) {
                ctx.drawImage(imx, c.x, c.y, this.cartaAncho, this.cartaAlto);
            }
        }

        // 2. Draw collected stack (last captured first = behind, first captured last = front)
        for (let i = this.recollidas - 1; i >= 0; i--) {
            const offset = (i + 1) * this.STACK_OFFSET;
            const imx = this.assets[this.cartasMesaValores[i].toString()];
            if (imx) {
                const y = this.abaixo ? this.stackY - offset : this.stackY + offset;
                ctx.drawImage(imx, this.stackX, y, this.cartaAncho, this.cartaAlto);
            }
        }

        // Draw hand card on top of stack
        const imx = this.assets[this.cartaManValor.toString()];
        if (imx) {
            ctx.drawImage(imx, this.stackX, this.stackY, this.cartaAncho, this.cartaAlto);
        }

        ctx.shadowBlur = 0;
    }
}
