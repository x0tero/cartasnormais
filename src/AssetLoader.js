export default class AssetLoader {
    constructor() {
        this.images = {}; 
    }

    async loadAll() {
        const promises = [];

        await this.loadSpriteSheet('./spanish_deck/barallamini.png', 'cards');
        await this.loadSpriteSheet('./spanish_deck/mascaras.png', 'masks');

        promises.push(this.loadImage('back', `./spanish_deck/baralladorso.png`));
        promises.push(this.loadImage('board_disabled', `./spanish_deck/taboleiro.png`));
        promises.push(this.loadImage('board', `./spanish_deck/taboleirod.png`));
        promises.push(this.loadImage('menu_bg', `./spanish_deck/menuEstatico.png`));
        promises.push(this.loadImage('btn_normal', './spanish_deck/btnMenuNormal.png'));
        promises.push(this.loadImage('btn_hover', './spanish_deck/btnMenuHover.png'));
        promises.push(this.loadImage('btn_pressed', './spanish_deck/btnMenuPressed.png'));
        promises.push(this.loadImage('flush_normal', './spanish_deck/flush/flush1.png'));
        promises.push(this.loadImage('flush_hover', './spanish_deck/flush/flush2.png'));
        promises.push(this.loadImage('flush_pressed', './spanish_deck/flush/flush3.png'));
        promises.push(this.loadImage('flush_disabled', './spanish_deck/flush/flush4.png'));

        const fontLoad = new FontFace('Minipixel', 'url(./spanish_deck/Minipixel.ttf');
        
        // Add the font promise to our waiting list
        promises.push(
            fontLoad.load().then((loadedFont) => {
                document.fonts.add(loadedFont);
                console.log("Font loaded!");
            }).catch((err) => {
                console.error("Failed to load font:", err);
            })
        );

        await Promise.all(promises);
        return this.images;
    }

    loadImage(key, src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = src;
            img.onload = () => { this.images[key] = img; resolve(img); };
            img.onerror = () => { console.error(`Error loading ${src}`); reject(); };
        });
    }

    // Generalized Sprite Sheet Loader
    loadSpriteSheet(src, type) {
        return new Promise((resolve, reject) => {
            const spriteSheet = new Image();
            spriteSheet.src = src;
            
            spriteSheet.onload = () => {
                if (type === 'cards') {
                    this.sliceCards(spriteSheet);
                } else if (type === 'masks') {
                    this.sliceMasks(spriteSheet);
                }
                resolve();
            };
            spriteSheet.onerror = () => {
                console.error(`Failed to load sprite sheet: ${src}`);
                reject();
            };
        });
    }

    // --- SLICE LOGIC FOR CARDS (1-40) ---
    sliceCards(sheet) {
        const cardWidth = 48;
        const cardHeight = 76;
        const rowStartIds = [11, 21, 1, 31]; // Copas, Espadas, Oros, Bastos
        // Oros, Copas, Espadas, Bastos

        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 10; col++) {
                const canvas = document.createElement('canvas');
                canvas.width = cardWidth;
                canvas.height = cardHeight;
                const ctx = canvas.getContext('2d');
                
                // Disable smoothing for pixel art crispness
                ctx.imageSmoothingEnabled = false;

                ctx.drawImage(sheet, 
                    col * cardWidth, row * cardHeight, 
                    cardWidth, cardHeight, 
                    0, 0, cardWidth, cardHeight
                );

                const newImg = new Image();
                newImg.src = canvas.toDataURL();
                
                const finalId = rowStartIds[row] + col;
                this.images[finalId.toString()] = newImg;
            }
        }
        console.log("Cards loaded!");
    }

    // --- SLICE LOGIC FOR MASKS (Named List) ---
    sliceMasks(sheet) {
        const cardWidth = 48;
        const cardHeight = 76;

        // The list of names provided, in order (Left->Right, Top->Bottom)
        const maskNames = [
            // Row 1
            "Felicidad", "Tristeza", "Cinismo", "Ira", "Conspirador", "Soldado",
            // Row 2
            "Desliz", "Preocupacion", "Sorpresa", "Trauma", "Afouteza", "Bruto",
            // Row 3
            "Decepcion", "Enfado", "Presumido", "Dereita", "Esquerda", "Borracho",
            // Row 4
            "Alteza", "Cabalo", "Carlista", "Artista", "Pirata", "Codicia"
        ];

        let nameIndex = 0;

        // 4 Rows
        for (let row = 0; row < 4; row++) {
            // 6 Columns
            for (let col = 0; col < 6; col++) {
                
                // Safety check: Don't crash if image is bigger than name list
                if (nameIndex >= maskNames.length) break;

                const canvas = document.createElement('canvas');
                canvas.width = cardWidth;
                canvas.height = cardHeight;
                const ctx = canvas.getContext('2d');
                
                ctx.imageSmoothingEnabled = false;

                ctx.drawImage(sheet, 
                    col * cardWidth, row * cardHeight, 
                    cardWidth, cardHeight, 
                    0, 0, cardWidth, cardHeight
                );

                const newImg = new Image();
                newImg.src = canvas.toDataURL();
                
                const maskName = maskNames[nameIndex];
                this.images[maskName] = newImg;

                nameIndex++;
            }
        }
        console.log("Masks loaded!");
    }
}