import Game from './Game.js';
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
    
    const input = { x: 0, y: 0, clicked: false, moved: false };
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        input.x = e.clientX - rect.left;
        input.y = e.clientY - rect.top;
        input.moved = true;
    });
    canvas.addEventListener('mousedown', () => { input.clicked = true; });

    let then = null;
    function loop(now) {
        if (!then) then = now;
        const elapsed = now - then;
        if (elapsed > fpsIntervalo) {
            then = now - (elapsed % fpsIntervalo)
            game.update(input);
            game.render();
            input.clicked = false; input.moved = false;
        }
        requestAnimationFrame(loop);
    }
    loop();
});