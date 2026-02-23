export default class Card {
    constructor(value) {
        this.value = value; // 1 to 40
        this.width = 73;   // Adjust based on your image size
        this.height = 113;
        
        // Load the face image
        this.image = new Image();
        //this.image.src = `./spanish_deck/${value}.png`; // Assumes .png

        // Load the back image (static property for efficiency)
        //if (!Card.backImage) {
        //    Card.backImage = new Image();
        //    Card.backImage.src = './spanish_deck/back.png';
        //}

        // Target position (for animation/drawing)
        this.x = 0;
        this.y = 0;
    }

    draw(ctx, x, y) {
        this.x = x;
        this.y = y;

        // If image is loaded, draw it. Otherwise, wait (loop will catch it)
        if (this.image.complete) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        } else {
            // Placeholder while loading
            ctx.fillStyle = 'white';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }

    drawBack(ctx, x, y) {
        if (Card.backImage.complete) {
            ctx.drawImage(Card.backImage, x, y, this.width, this.height);
        }
    }
}