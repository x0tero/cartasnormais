import Director from './Director.js';
import AssetLoader from './AssetLoader.js';
import Menu from './escenas/Menu.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// ── Pixel-perfect text: round coordinates and manually resolve alignment ──
const _origFillText = CanvasRenderingContext2D.prototype.fillText;
const _origStrokeText = CanvasRenderingContext2D.prototype.strokeText;

function _pixelText(origFn, text, x, y, maxWidth) {
    const ry = Math.round(y);
    const align = this.textAlign;
    if (align === 'center' || align === 'right') {
        const w = this.measureText(text).width;
        const rx = Math.round(align === 'center' ? x - w / 2 : x - w);
        const saved = this.textAlign;
        this.textAlign = 'left';
        if (maxWidth !== undefined) origFn.call(this, text, rx, ry, maxWidth);
        else origFn.call(this, text, rx, ry);
        this.textAlign = saved;
    } else {
        if (maxWidth !== undefined) origFn.call(this, text, Math.round(x), ry, maxWidth);
        else origFn.call(this, text, Math.round(x), ry);
    }
}

CanvasRenderingContext2D.prototype.fillText = function (t, x, y, mw) {
    _pixelText.call(this, _origFillText, t, x, y, mw);
};
CanvasRenderingContext2D.prototype.strokeText = function (t, x, y, mw) {
    _pixelText.call(this, _origStrokeText, t, x, y, mw);
};

const loader = new AssetLoader();

loader.loadAll().then((assets) => {
    const director = new Director(canvas, ctx, assets);
    
    const escena = new Menu(director);
    director.apilarEscena(escena);
    director.executar();
});

/*import Game from './Game.js';
import AssetLoader from './AssetLoader.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const loader = new AssetLoader();
const FPS = 24;
const fpsIntervalo = 1000 / FPS;

loader.loadAll().then((loadedAssets) => {
    const game = new Game(canvas, ctx, loadedAssets);
    game.startGame();
    
    const input = { x: 0, y: 0, clicado: false, movido: false };
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        input.x = e.clientX - rect.left;
        input.y = e.clientY - rect.top;
        input.movido = true;
    });
    canvas.addEventListener('mousedown', () => { input.clicado = true; });

    let then = null;
    function loop(now) {
        if (!then) then = now;
        const elapsed = now - then;
        if (elapsed > fpsIntervalo) {
            then = now - (elapsed % fpsIntervalo)
            game.update(input);
            game.render();
            input.clicado = false; input.movido = false;
        }
        requestAnimationFrame(loop);
    }
    loop();
});
*/