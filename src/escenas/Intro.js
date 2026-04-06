import Escena from '../Escena.js';
import Menu from './Menu.js';

export default class Intro extends Escena {
    constructor(director) {
        super(director);
        this.introDuracion = 2600; // Duración en milisegundos
        this.totalFrames = 64; // 8x8 grid
        this.tTranscurrido = 0;
        this.frameActual = 0;
        this.completado = false;
    }
    
    actualizar(entrada, dt) {
        if (this.completado) return;
        
        this.tTranscurrido += dt;
        
        const frameTime = this.introDuracion / this.totalFrames; // Time per frame
        this.frameActual = Math.floor(this.tTranscurrido / frameTime);
        
        if (this.frameActual >= this.totalFrames) {
            this.frameActual = this.totalFrames - 1;
            this.completado = true;
            this.director.cambiarEscena(new Menu(this.director));
        }
    }
    
    debuxar(ctx) {
        ctx.clearRect(0, 0, this.director.canvas.width, this.director.canvas.height);
        ctx.drawImage(this.director.assets['menu_bg'], 0, 0, this.director.canvas.width, this.director.canvas.height);
        
        const frameKey = `introFrame_${this.frameActual}`;
        const frameImg = this.director.assets[frameKey];
        
        if (frameImg) {
             ctx.drawImage(frameImg, 0, 0, this.director.canvas.width, this.director.canvas.height);
        } else {
             ctx.fillStyle = "#1a1a1a";
             ctx.fillRect(0, 0, this.director.canvas.width, this.director.canvas.height);
        }
    }
}