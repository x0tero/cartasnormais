export default class AssetLoader {
    constructor() {
        this.images = {};
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    async loadAll() {
        const promises = [];

        await this.loadSpriteSheet('./barallaEsp/barallamini.png', 'cartas');
        await this.loadSpriteSheet('./barallaEsp/mascaras.png', 'mascaras');
        await this.loadSpriteSheet('./barallaEsp/menuIntro-paxina.png', 'intro');

        promises.push(this.loadImage('dorso', `./barallaEsp/baralladorso.png`));
        promises.push(this.loadImage('taboleiro_d', `./barallaEsp/taboleiro.png`));
        promises.push(this.loadImage('taboleiro', `./barallaEsp/taboleirod.png`));
        promises.push(this.loadImage('menu_bg', `./barallaEsp/menuEstatico.png`));
        
        promises.push(this.loadImage('btn_normal', './barallaEsp/btnMenuNormal.png'));
        promises.push(this.loadImage('btn_peneirar', './barallaEsp/btnMenuHover.png'));
        promises.push(this.loadImage('btn_premido', './barallaEsp/btnMenuPressed.png'));

        promises.push(this.loadImage('flush_normal', './barallaEsp/flush/flush1.png'));
        promises.push(this.loadImage('flush_peneirado', './barallaEsp/flush/flush2.png'));
        promises.push(this.loadImage('flush_premido', './barallaEsp/flush/flush3.png'));
        promises.push(this.loadImage('flush_deshabilitado', './barallaEsp/flush/flush4.png'));

        promises.push(this.loadImage('push_normal', './barallaEsp/push/push1.png'));
        promises.push(this.loadImage('push_peneirado', './barallaEsp/push/push2.png'));
        promises.push(this.loadImage('push_premido', './barallaEsp/push/push3.png'));
        promises.push(this.loadImage('push_deshabilitado', './barallaEsp/push/push4.png'));

        const fontLoad = new FontFace('Minipixel', 'url(./barallaEsp/Minipixel.ttf');
        
        // Add the font promise to our waiting list
        promises.push(
            fontLoad.load().then((loadedFont) => {
                document.fonts.add(loadedFont);
                console.log("Font loaded!");
            }).catch((err) => {
                console.error("Failed to load font:", err);
            })
        );

        promises.push(this.loadAudio('son_barallar', './barallaEsp/son/barallar.mp3'));
        promises.push(this.loadAudio('son_axitaMascara', './barallaEsp/son/axitaMascara.mp3'));
        promises.push(this.loadAudio('son_rompeMascara', './barallaEsp/son/rompeMascara.mp3'));
        for (let i = 1; i <= 6; i++) {
            promises.push(this.loadAudio(`son_dar${i}`, `./barallaEsp/son/dar${i}.mp3`));
        }

        await Promise.all(promises);
        this.images['_audioContext'] = this.audioContext;
        return this.images;
    }

    loadAudio(key, src) {
        return fetch(src)
            .then(r => r.arrayBuffer())
            .then(buf => this.audioContext.decodeAudioData(buf))
            .then(decoded => { this.images[key] = decoded; })
            .catch(err => { console.error(`Error loading audio ${src}:`, err); });
    }

    loadImage(key, src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = src;
            img.onload = () => { this.images[key] = img; resolve(img); };
            img.onerror = () => { console.error(`Error loading ${src}`); reject(); };
        });
    }

    loadSpriteSheet(src, type) {
        return new Promise((resolve, reject) => {
            const spriteSheet = new Image();
            spriteSheet.src = src;
            
            spriteSheet.onload = () => {
                if (type === 'cartas') {
                    this.sliceCards(spriteSheet);
                } else if (type === 'mascaras') {
                    this.sliceMasks(spriteSheet);
                } else if (type === 'intro') {
                    this.sliceIntroFrames(spriteSheet);
                }
                resolve();
            };
            spriteSheet.onerror = () => {
                console.error(`Fallou en cargar a folla de sprites: ${src}`);
                reject();
            };
        });
    }

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
        console.log("Cartas cargadas");
    }

    sliceMasks(sheet) {
        const cardWidth = 48;
        const cardHeight = 76;

        // The list of names provided, in order (Left->Right, Top->Bottom)
        const maskNames = [
            // Row 1
            "Felicidade", "Tristeza", "Cinismo", "Ira", "Conspirador", "Soldado",
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
        console.log("Mascaras cargadas");
    }

    sliceIntroFrames(sheet) {
        const frameWidth = 380;
        const frameHeight = 600;
        const cols = 8;
        const rows = 8;
        const totalFrames = cols * rows; // 64 frames

        let frameIndex = 0;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const canvas = document.createElement('canvas');
                canvas.width = frameWidth;
                canvas.height = frameHeight;
                const ctx = canvas.getContext('2d');
                
                ctx.imageSmoothingEnabled = false;

                ctx.drawImage(sheet, 
                    col * frameWidth, row * frameHeight, 
                    frameWidth, frameHeight, 
                    0, 0, frameWidth, frameHeight
                );

                const newImg = new Image();
                newImg.src = canvas.toDataURL();
                
                this.images[`introFrame_${frameIndex}`] = newImg;
                frameIndex++;
            }
        }
        console.log(`Intro frames cargados: ${totalFrames}`);
    }
}