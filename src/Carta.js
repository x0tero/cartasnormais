export default class Carta {
    constructor(valor) {
        this.valor = valor; // Card ID 1-40
        this.imaxe = new Image();
        this.x = 0;
        this.y = 0;
        this.ancho = 73;
        this.alto = 113;
    }

    // Escoba point value (1-10): As=1..7=7, Sota=8, Caballo=9, Rey=10
    puntos() {
        return ((this.valor - 1) % 10) + 1;
    }

    // Suit: 0=Oros, 1=Copas, 2=Espadas, 3=Bastos
    palo() {
        return Math.floor((this.valor - 1) / 10);
    }

    esPaloOro() {
        return this.palo() === 0;
    }

    esSete() {
        return this.puntos() === 7;
    }
    /*
    roubar(ctx, x, y) {
        this.x = x;
        this.y = y;

        if (this.imaxe.complete) {
            ctx.drawImage(this.imaxe, this.x, this.y, this.ancho, this.alto);
        } else {
            ctx.fillStyle = 'white';
            ctx.fillRect(this.x, this.y, this.ancho, this.alto);
        }
    }
    */
   draw(ctx, x, y) {
        this.x = x;
        this.y = y;

        // If image is loaded, draw it. Otherwise, wait (loop will catch it)
        if (this.imaxe.complete) {
            ctx.drawImage(this.imaxe, this.x, this.y, this.ancho, this.alto);
        } else {
            ctx.fillStyle = 'white';
            ctx.fillRect(this.x, this.y, this.ancho, this.alto);
        }
    }
    
    drawBack(ctx, x, y) {
        if (Card.backImage.complete) {
            ctx.drawImage(Card.backImage, x, y, this.ancho, this.alto);
        }
    }
    
}