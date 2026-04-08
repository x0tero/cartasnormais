export default class Boton {
    constructor(x, y, ancho, alto, cores = [], imaxes = [], texto = '', enClic = null, opcions = {}) {
        this.x = x;
        this.y = y;
        this.ancho = ancho;
        this.alto = alto;
        this.cores = cores;   // [normal, peneirar, premido, deshabilitado]
        this.imaxes = imaxes; // [normal, peneirar, premido, deshabilitado]
        this.texto = texto;
        this.enClic = enClic;
        this.estado = 'normal';
        this.deshabilitado = false;
        this.corTexto = opcions.corTexto || 'black';
        this.tamanhoTexto = opcions.tamanhoTexto || 10;
        this.instantaneo = opcions.instantaneo || false;
    }

    actualizar(entrada, dt) {
        if (this.deshabilitado) {
            this.estado = 'deshabilitado';
            return false;
        }

        const dentro = this._dentro(entrada.x, entrada.y);

        if (this.estado !== 'premido') {
            this.estado = dentro ? 'peneirar' : 'normal';
        }

        if (entrada.clicado && dentro && this.estado !== 'premido') {
            this.estado = 'premido';
            if (this.enClic) {
                if (this.instantaneo) {
                    this.enClic();
                    this.resetar();
                } else {
                    setTimeout(() => {
                        this.resetar();
                        this.enClic();
                    }, 200);
                }
            }
            return true;
        }

        return false;
    }

    debuxar(ctx) {
        const idx = { normal: 0, peneirar: 1, premido: 2, deshabilitado: 3 }[this.estado] ?? 0;

        if (this.imaxes.length > 0) {
            const imx = this.imaxes[idx] ?? this.imaxes[0];
            if (imx) {
                if (this.estado === 'deshabilitado') {
                    ctx.save();
                    ctx.globalAlpha = 0.5;
                    ctx.drawImage(imx, this.x, this.y, this.ancho, this.alto);
                    ctx.restore();
                } else {
                    ctx.drawImage(imx, this.x, this.y, this.ancho, this.alto);
                }
                return;
            }
        }

        // Color fallback
        let cor = this.cores[idx] ?? this.cores[0] ?? '#888888';
        if (this.estado === 'deshabilitado') {
            cor = this.cores[3] ?? '#555555';
        }
        ctx.fillStyle = cor;
        ctx.fillRect(this.x, this.y, this.ancho, this.alto);

        if (this.texto) {
            ctx.save();
            if (this.estado === 'deshabilitado') ctx.globalAlpha = 0.35;
            ctx.fillStyle = this.corTexto;
            ctx.font = `${this.tamanhoTexto}px Minipixel`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.texto, this.x + this.ancho / 2, this.y + this.alto / 2);
            ctx.restore();
        }
    }

    resetar() {
        this.estado = this.deshabilitado ? 'deshabilitado' : 'normal';
    }

    _dentro(px, py) {
        return px > this.x && px < this.x + this.ancho && py > this.y && py < this.y + this.alto;
    }
}