export default class Director {
    constructor(canvas, ctx, assets) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.assets = assets;
        this.pila = [];
        this.sair_escena = false;
        
        this.FPS = 24;
        this.fpsIntervalo = 1000 / this.FPS;
        this.daquela = null;

        this.entrada = { x: 0, y: 0, clicado: false, movido: false, clicDereito: false };
        this.establecerEntradas();
    }

    establecerEntradas() {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.entrada.x = e.clientX - rect.left;
            this.entrada.y = e.clientY - rect.top;
            this.entrada.movido = true;
        });
        
        this.canvas.addEventListener('mousedown', () => { 
            this.entrada.clicado = true; 
        });

        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.entrada.clicDereito = true;
        });
    }


    bucle(now) {
        if (this.pila.length === 0) return;

        requestAnimationFrame((n) => this.bucle(n));

        if (!this.daquela) this.daquela = now;
        const tempo_pasado = now - this.daquela;

        if (tempo_pasado > this.fpsIntervalo) {
            this.daquela = now - (tempo_pasado % this.fpsIntervalo);

            const escenaActual = this.pila[this.pila.length - 1];

            escenaActual.actualizar(this.entrada, tempo_pasado);
            escenaActual.debuxar(this.ctx);

            this.entrada.clicado = false; 
            this.entrada.movido = false;
            this.entrada.clicDereito = false;
        }
    }

    executar() {
        requestAnimationFrame((now) => this.bucle(now));
    }

    apilarEscena(escena) {
        this.sair_escena = false;
        this.pila.push(escena);
    }

    sacarEscena() {
        this.sair_escena = true;
        if (this.pila.length > 0) {
            this.pila.pop();
        }
    }

    cambiarEscena(escena) {
        this.sacarEscena();
        this.apilarEscena(escena);
    }

    baleirarPila() {
        while (this.pila.length > 0) {
            this.sacarEscena();
        }
    }

    actualizar(entrada, dt) {
        if (this.pila.length > 0) {
            this.pila[this.pila.length - 1].actualizar(entrada, dt);
        }
    }

    render() {
        if (this.pila.length > 0) {
            this.pila[this.pila.length - 1].render(this.ctx);
        }
    }
}