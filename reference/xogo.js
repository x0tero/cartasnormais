import Escena from '../Escena.js';
import Baralla from '../Baralla.js';
import FinXogo from './FinXogo.js';
import NivelCompletado from './NivelCompletado.js';
import Boton from '../utiles/Boton.js';
import AnimacionDesprazamento from '../utiles/animacions/AnimacionDesprazamento.js';
import AnimacionEfecto from '../utiles/animacions/AnimacionEfecto.js';
import AnimacionTremer from '../utiles/animacions/AnimacionTremer.js';
import AnimacionAvanza from '../utiles/animacions/AnimacionAvanza.js';

export default class Xogo extends Escena {
    constructor(director, nivel=0) {
        super(director);
        this.baralla = new Baralla();

        // Configuracion do taboleiro
        this.filas = 4;
        this.cols = 4;
        this.taboleiro = [];
        this.taboleiroMascaras = [];
        this.pilaDescartes = [];

        this.animacions = [];
        this.estaAnimando = false;
        this.estaProcesando = false;

        this.cartaAncho = 48;
        this.cartaAlto = 76;
        this.oco = 22;
        this.ocoMan = 12;
        
        const anchoTaboleiro = (this.cols * this.cartaAncho) + ((this.cols - 1) * this.oco);
        this.taboleiroComezoX = 103;
        this.taboleiroComezoY = 75; 

        this.barallaX = 21;
        this.barallaY = 368;

        // Titorial e caixas de texto
        this.pasoTitorial = -1; // -1 significa titorial non activo
        this.mensaxesTitorial = [
            { titulo: "BENVIDO", texto: "Existen varios tipos de mÃ¡scaras, cada unha cunha condiciÃ³n Ãºnica para ser derrotada." },
            { titulo: "INFORMACIÃ“N", texto: "Podes facer clic nunha mÃ¡scara en calquera momento para ver a sÃºa condiciÃ³n de vitoria." },
            { titulo: "COMBATE", texto: "Para derrotar unha mÃ¡scara, selecciona unha carta da tÃºa man e logo fai clic na mÃ¡scara que queres eliminar." },
            { titulo: "ROUBAR", texto: "Podes roubar cartas do mazo premendo nel, pero coidado: unha mÃ¡scara baixarÃ¡ unha fila como penalizaciÃ³n." },
            { titulo: "DESCARTAR (FLUSH)", texto: "O botÃ³n FLUSH permite barallar a tÃºa man e o descarte de novo no mazo. SÃ³ tes 2 usos por nivel!" },
            { titulo: "SORTE!", texto: "Elimina todas as mÃ¡scaras do taboleiro para avanzar ao seguinte nivel." }
        ];

        // Elementos da interfaz de usuario
        const assets = this.director.assets;
        this.flushBtn = new Boton(
            24, 300, 42, 18,
            [],
            [assets['flush_normal'], assets['flush_peneirado'], assets['flush_premido'], assets['flush_deshabilitado']]
        );
        this.flushRestantes = 2;
        this.maxFlush = 2;

        this.pushBtn = new Boton(
            24, 130, 42, 18,
            [],
            [assets['push_normal'], assets['push_peneirado'], assets['push_premido'], assets['push_deshabilitado']]
        );
        this.pushModo = false;
        this.pushCartasSeleccionadas = [];

        this.pilaDescarteX = 21;
        this.pilaDescarteY = 172;

        this.manXogador = []; 
        this.indiceCartaSeleccionada = -1; 
        this.manXogadorY = 500; 

        // Progreso do xogo
        this.nivel = nivel;
        this.errosNivel = 0; 
        this.mascarasDesbloqueadas = new Set(['Felicidade', 'Tristeza', 'Ira', 'Conspirador']);
        this.ePausaDescubrimento = false;
        this.pasoDescubrimento = 0; 
        this.mascaraDescuberta = null;
        this.infoUtilActiva = null; 

        // Depuracion
        this.depurar = true;
        this.depurarModo = null;
        this.depurarMenuX = 0;
        this.depurarMenuY = 0;
        this.depurarCeldaSeleccionada = null;

        this.comezarNivel();
    }

    actualizar(entrada, dt) {
        // Depuracion: clic dereito abre menu
        if (this.depurar && entrada.clicDereito) {
            this.depurarModo = 'menu';
            this.depurarMenuX = Math.min(entrada.x, this.director.canvas.width - 155);
            this.depurarMenuY = Math.min(entrada.y, this.director.canvas.height - 70);
        }

        // Procesar entradas
        if (entrada.movido) this.procesarMovemento(entrada.x, entrada.y);
        if (entrada.clicado) this.procesarClic(entrada.x, entrada.y);

        // Procesar animacions
        if (this.animacions.length === 0) {
            this.estaAnimando = false;
            return;
        }

        this.estaAnimando = true;
        
        for (let i = this.animacions.length - 1; i >= 0; i--) {
            const anim = this.animacions[i];
            anim.actualizar(null, dt);
            if (anim.completada) this.animacions.splice(i, 1);
        }
    }

    debuxar(ctx) {
        const assets = this.director.assets;
        const canvas = this.director.canvas;

        // 1. Debuxa o fondo do taboleiro
        let nomeTaboleiroImx = (this.manXogador.length >= 5 || this.estaProcesando) ? 'taboleiro_d' : 'taboleiro';
        const taboleiroImx = assets[nomeTaboleiroImx];
        if (taboleiroImx) {
            ctx.drawImage(taboleiroImx, 0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = '#0a6c0a'; 
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // 2. Debuxa texto de HUD
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.font = "15px minipixel";
        ctx.textAlign = "left";
        ctx.fillText(`Nivel: ${this.nivel}`, 20, 30);

        ctx.font = "10px Minipixel";
        const masksLeft = this.mascarasTotalNivelActual - this.mascarasDerrotadas;
        ctx.fillText(`Mascaras restantes: ${masksLeft}/${this.mascarasTotalNivelActual}`, 20, 50);

        // 3. Debuxa mazo e descarte
        const dorsoImx = assets['dorso'];
        if (dorsoImx) {
            ctx.drawImage(dorsoImx, this.barallaX, this.barallaY, this.cartaAncho, this.cartaAlto);
            ctx.drawImage(dorsoImx, this.barallaX, this.barallaY, this.cartaAncho, this.cartaAlto-3);
            ctx.drawImage(dorsoImx, this.barallaX, this.barallaY, this.cartaAncho, this.cartaAlto-6);
            ctx.drawImage(dorsoImx, this.barallaX, this.barallaY, this.cartaAncho, this.cartaAlto-9);
        }
        
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.font = "12px Minipixel";
        ctx.textAlign = "center";
        ctx.fillText(`${this.baralla.restantes()}/40`, this.barallaX + (this.cartaAncho / 2), this.barallY + this.cartaAlto + 30); 
        
        if (this.pilaDescartes.length > 0) {
            const cartaTopo = this.pilaDescartes[this.pilaDescartes.length - 1];
            const imx = assets[cartaTopo.toString()];
            if(imx) ctx.drawImage(imx, this.pilaDescarteX, this.pilaDescarteY, this.cartaAncho, this.cartaAlto);
        }

        // 4. Debuxar grella (Cartas e mascaras)
        for (let fila = 0; fila < this.filas; fila++) {
            for (let col = 0; col < this.cols; col++) {
                let x = this.taboleiroComezoX + col * (this.cartaAncho + this.oco);
                let y = this.taboleiroComezoY + fila * (this.cartaAlto + this.oco);

                const cartaValor = this.taboleiro[fila][col];
                if (cartaValor !== null) {
                    const imx = assets[cartaValor.toString()];
                    if(imx) ctx.drawImage(imx, x, y, this.cartaAncho, this.cartaAlto);
                }

                // Aplicar Desprazamento ao tremer
                const tremerActivo = this.animacions.find(a => a instanceof AnimacionTremer && a.fila === fila && a.col === col);
                if (tremerActivo) x += tremerActivo.desvioX; 
                    
                const mascaraValor = this.taboleiroMascaras[fila][col];
                if (mascaraValor !== null) {
                    const mascaraImx = assets[mascaraValor];
                    if (mascaraImx) {
                        if (!this.mascarasDesbloqueadas.has(mascaraValor)) {
                            ctx.save();
                            ctx.filter = "brightness(95%) contrast(100%)";
                            ctx.drawImage(mascaraImx, x, y - 3, this.cartaAncho, this.cartaAlto);
                            ctx.restore();
                        } else {
                            ctx.drawImage(mascaraImx, x, y - 3, this.cartaAncho, this.cartaAlto);
                        }
                    }
                }
            }
        }

        // 5. Debuxar boton de flush
        const estaFlushDeshabilitado = this.flushRestantes === 0 || this.manXogador.length === 0 || this.estaProcesando || this.estaAnimando;
        this.flushBtn.deshabilitado = estaFlushDeshabilitado;
        if (estaFlushDeshabilitado && this.flushBtn.estado !== 'premido') {
            this.flushBtn.estado = 'deshabilitado';
        }
        this.flushBtn.debuxar(ctx);
        
        ctx.fillStyle = "black";
        ctx.font = "8px Minipixel"; 
        ctx.textAlign = "center";
        ctx.fillText(`${this.flushRestantes}/${this.maxFlush}`, this.flushBtn.x + (this.flushBtn.ancho / 2), this.flushBtn.y - 5);

        // 5b. Debuxar boton de push
        const estaPushDeshabilitado = this.estaProcesando || this.estaAnimando;
        this.pushBtn.deshabilitado = estaPushDeshabilitado;
        if (estaPushDeshabilitado && this.pushBtn.estado !== 'premido') {
            this.pushBtn.estado = 'deshabilitado';
        }
        this.pushBtn.debuxar(ctx);

        // 6. Debuxar man do xogador
        if (this.manXogador.length > 0) {
            const anchoManTotal = (this.manXogador.length * this.cartaAncho) + ((this.manXogador.length - 1) * this.ocoMan);
            const comezoX = (canvas.width - anchoManTotal) / 2;

            this.manXogador.forEach((cartaId, indice) => {
                const imx = assets[cartaId.toString()];
                //if(!imx) return;
                const x = comezoX + indice * (this.cartaAncho + this.ocoMan);
                const eSeleccionadaPush = this.pushModo && this.pushCartasSeleccionadas.includes(indice);
                if (indice === this.indiceCartaSeleccionada || eSeleccionadaPush) {
                    ctx.shadowBlur = 20;
                    ctx.shadowColor = eSeleccionadaPush ? "#ff4400" : "#000000";
                    ctx.drawImage(imx, x, this.manXogadorY - 10, this.cartaAncho, this.cartaAlto);
                } else {
                    ctx.shadowBlur = 0;
                    ctx.drawImage(imx, x, this.manXogadorY, this.cartaAncho, this.cartaAlto);
                }
            });
            ctx.shadowBlur = 0;
        }

        // 7. Debuxar Animacions
        this.animacions.forEach(anim => anim.debuxar(ctx));

        // 7b. Modo push indicador
        if (this.pushModo) {
            ctx.save();
            ctx.fillStyle = 'rgba(255,100,0,0.1)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#ff6600';
            ctx.font = '10px Minipixel';
            ctx.textAlign = 'center';
            if (this.pushCartasSeleccionadas.length < 2) {
                ctx.fillText(`PUSH: Selecciona ${2 - this.pushCartasSeleccionadas.length} carta(s) da man`, canvas.width / 2, 15);
            } else {
                ctx.fillText('PUSH: Selecciona unha mÃ¡scara no taboleiro', canvas.width / 2, 15);
            }
            ctx.restore();
        }

        // 8. Draw Active Tooltip
        if (this.infoUtilActiva) {
            this.debuxarInfoUtil(ctx, this.infoUtilActiva);
        }

        // 9. Depuracion
        this.debuxarDepurar(ctx);
    }

    procesarMovemento(x, y) {
        if (!this.flushBtn.deshabilitado && this.flushBtn.estado !== 'premido') {
            this.flushBtn.estado = this.flushBtn._dentro(x, y) ? 'peneirar' : 'normal';
        }
        if (!this.pushBtn.deshabilitado && this.pushBtn.estado !== 'premido') {
            this.pushBtn.estado = this.pushBtn._dentro(x, y) ? 'peneirar' : 'normal';
        }
        const ePunteiro = this.flushBtn.estado === 'peneirar' || this.pushBtn.estado === 'peneirar';
        this.director.canvas.style.cursor = ePunteiro ? 'pointer' : 'default';
    }

    procesarClic(x, y) {
        // Loxica Titorial
        if (this.nivel === 0 && this.pasoTitorial !== -1) {
            this.pasoTitorial++;
            if (this.pasoTitorial < this.mensaxesTitorial.length) {
                this.amosarPasoTitorial();
            } else {
                this.pasoTitorial = -1;
                this.ePausaDescubrimento = false;
                this.infoUtilActiva = null;
                this.estaProcesando = false; 
            }
            return;
        }
        
        // Loxica Descubrimento
        if (this.ePausaDescubrimento) {
            if (this.pasoDescubrimento === 1) {
                this.pasoDescubrimento = 2;
                this.infoUtilActiva.texto = this.verDescripcionMascara(this.mascaraDescuberta);
            } else {
                const data = this.datosPendentes;
                this.mascarasDesbloqueadas.add(this.mascaraDescuberta);
                this.ePausaDescubrimento = false;
                this.pasoDescubrimento = 0;
                this.infoUtilActiva = null;
                this.continuarSecuencia(data.mascara, data.fila, data.col, data.cartaXogada, data.manCartaX, data.manCartaY);
            }
            return;
        }

        if (this.depurar && this.depurarModo) {
            this.procesarClicDepurar(x, y);
            return;
        }

        if (this.estaAnimando || this.estaProcesando) return;
        this.infoUtilActiva = null;

        // Push mode: seleccion de cartas e mascara
        if (this.pushModo) {
            // Seleccion de cartas da man (precisa 2)
            const totalAnchoManPush = (this.manXogador.length * this.cartaAncho) + ((this.manXogador.length - 1) * this.ocoMan);
            const comezoManXPush = (this.director.canvas.width - totalAnchoManPush) / 2;

            for (let i = 0; i < this.manXogador.length; i++) {
                const cartaX = comezoManXPush + i * (this.cartaAncho + this.ocoMan);
                if (x > cartaX && x < cartaX + this.cartaAncho && y > this.manXogadorY && y < this.manXogadorY + this.cartaAlto) {
                    const idx = this.pushCartasSeleccionadas.indexOf(i);
                    if (idx !== -1) {
                        this.pushCartasSeleccionadas.splice(idx, 1);
                    } else if (this.pushCartasSeleccionadas.length < 2) {
                        this.pushCartasSeleccionadas.push(i);
                    }
                    return;
                }
            }

            // Con 2 cartas seleccionadas, clic nunha mascara do taboleiro executa o push
            if (this.pushCartasSeleccionadas.length === 2) {
                const relXPush = x - this.taboleiroComezoX;
                const relYPush = y - this.taboleiroComezoY;
                const colPush = Math.floor(relXPush / (this.cartaAncho + this.oco));
                const filaPush = Math.floor(relYPush / (this.cartaAlto + this.oco));
                const colValidaPush = colPush >= 0 && colPush < this.cols && (relXPush % (this.cartaAncho + this.oco) < this.cartaAncho);
                const filaValidaPush = filaPush >= 0 && filaPush < this.filas && (relYPush % (this.cartaAlto + this.oco) < this.cartaAlto);

                if (colValidaPush && filaValidaPush && this.taboleiroMascaras[filaPush][colPush] !== null) {
                    this.executarPush(filaPush, colPush);
                    return;
                }
            }

            // Clic fora das cartas e sen mascara valida: cancelar
            this.pushModo = false;
            this.pushCartasSeleccionadas = [];
            return;
        }

        // Roubar cartas
        /*
        if (this.estaDentro(x, y, this.baralla)) {
            this.dispararPenalizacion();
            return;
        }
        */
        if (x > this.barallaX && x < this.barallaX + this.cartaAncho && y > this.barallaY && y < this.barallaY + this.cartaAlto) {
            this.dispararPenalizacion();
            return;
        }
        

        // Seleccion de carta
        const totalAnchoMan = (this.manXogador.length * this.cartaAncho) + ((this.manXogador.length - 1) * this.ocoMan);
        const comezoManX = (this.director.canvas.width - totalAnchoMan) / 2;

        for (let i = 0; i < this.manXogador.length; i++) {
            const cartaX = comezoManX + i * (this.cartaAncho + this.ocoMan);
            if (x > cartaX && x < cartaX + this.cartaAncho && y > this.manXogadorY && y < this.manXogadorY + this.cartaAlto) {
                this.indiceCartaSeleccionada = (this.indiceCartaSeleccionada === i) ? -1 : i;
                //this.debuxar(this.director.ctx);
                return;
            }
        }

        // Boton de Flush
        if (this.flushBtn._dentro(x, y) && !this.flushBtn.deshabilitado) {
            this.flushBtn.estado = 'premido';
            setTimeout(() => {
                if (this.flushRestantes > 0) {
                    this.flushRestantes--;
                    this.triggerFlushAction(); 
                }
                this.flushBtn.resetar();
            }, 150);
            return;
        }

        // Boton de Push
        if (this.pushBtn._dentro(x, y) && !this.pushBtn.deshabilitado) {
            this.pushBtn.estado = 'premido';
            setTimeout(() => {
                this.pushModo = true;
                this.pushCartasSeleccionadas = [];
                this.indiceCartaSeleccionada = -1;
                this.pushBtn.resetar();
            }, 150);
            return;
        }

        // Grella
        const relX = x - this.taboleiroComezoX;
        const relY = y - this.taboleiroComezoY;
        const col = Math.floor(relX / (this.cartaAncho + this.oco));
        const fila = Math.floor(relY / (this.cartaAlto + this.oco));
        const colValida = col >= 0 && col < this.cols && (relX % (this.cartaAncho + this.oco) < this.cartaAncho);
        const filaValida = fila >= 0 && fila < this.filas && (relY % (this.cartaAlto + this.oco) < this.cartaAlto);

        if (colValida && filaValida) {
            this.resolverInteraccionGrella(fila, col);
        }
    }


    comezarNivel() {
        this.baralla.restablecer();
        this.taboleiro = Array(this.filas).fill(null).map(() => Array(this.cols).fill(null));
        this.taboleiroMascaras = Array(this.filas).fill(null).map(() => Array(this.cols).fill(null));
        this.pilaDescartes = [];
        this.manXogador = [];
        this.mascarasEnXogo = 0;
        this.errosNivel = 0;
        this.mascarasTotalNivelActual = this.adLimiteMascarasNivel();
        this.mascarasDerrotadas = 0;
        this.indiceCartaSeleccionada = -1; 
        this.estaProcesando = false;
        this.datosPendentes = null;
        this.flushRestantes = 2; 
        this.pushModo = false;
        this.pushCartasSeleccionadas = [];

        if (this.nivel === 0) {
            this.establecerFilaTitorial();
            this.pasoTitorial = 0;
            this.ePausaDescubrimento = true; 
            this.amosarPasoTitorial();
        } else {
            this.pasoTitorial = -1;
            this.ePausaDescubrimento = false;
            this.montarFilaInicial();
        }

        this.manXogador.push(this.baralla.roubar());
    }

    resolverInteraccionGrella(fila, col) {
        const mascaraObxectivo = this.taboleiroMascaras[fila][col];
        if (!mascaraObxectivo) return; 
        
        // Modo informacion
        if (this.indiceCartaSeleccionada === -1) {
            const celdaX = this.taboleiroComezoX + col * (this.cartaAncho + this.oco);
            const celdaY = this.taboleiroComezoY + fila * (this.cartaAlto + this.oco);
            const estaDesbloqueado = this.mascarasDesbloqueadas.has(mascaraObxectivo);

            this.infoUtilActiva = {
                x: celdaX + this.cartaAncho / 2,
                y: celdaY - 15,
                titulo: estaDesbloqueado ? mascaraObxectivo.toUpperCase() : "???",
                texto: estaDesbloqueado ? this.verDescripcionMascara(mascaraObxectivo) : "Derrota esta mÃ¡scara para coÃ±ecer a sÃºa condiciÃ³n."
            };
            return; 
        }

        this.estaProcesando = true; 
        const valorCartaObxectivo = this.taboleiro[fila][col];
        const cartaXogada = this.manXogador[this.indiceCartaSeleccionada]; 
        
        const xogadorVence = this.batalla(mascaraObxectivo, cartaXogada, valorCartaObxectivo, fila, col);

        const anchoManTotal = (this.manXogador.length * this.cartaAncho) + ((this.manXogador.length - 1) * this.ocoMan);
        const manComezaX = (this.director.canvas.width - anchoManTotal) / 2;
        const manCartaX = manComezaX + this.indiceCartaSeleccionada * (this.cartaAncho + this.ocoMan);
        const manCartaY = this.manXogadorY;

        if (xogadorVence) {
            if (!this.mascarasDesbloqueadas.has(mascaraObxectivo)) {
                this.ePausaDescubrimento = true;
                this.pasoDescubrimento = 1;
                this.mascaraDescuberta = mascaraObxectivo;
                this.datosPendentes = { mascara: mascaraObxectivo, fila, col, cartaXogada, manCartaX, manCartaY };

                this.infoUtilActiva = {
                    x: this.director.canvas.width / 2,
                    y: this.director.canvas.height / 2 + 30,
                    titulo: mascaraObxectivo.toUpperCase(),
                    texto: "Â¡MÃSCARA DESBLOQUEADA!",
                    centrado: true 
                };
                return; 
            }
            this.continuarSecuencia(mascaraObxectivo, fila, col, cartaXogada, manCartaX, manCartaY);
        } else {
            this.errosNivel++;
            this.disparaAnimTremer(fila, col, () => {
                this.manXogador.splice(this.indiceCartaSeleccionada, 1);
                this.indiceCartaSeleccionada = -1;

                this.disparaAnimDescarte(cartaXogada, manCartaX, manCartaY, () => {
                    if (mascaraObxectivo === 'Trauma') {
                        this.disparaPenalizacionTrauma(() => this.acabaTurnoPenalizado());
                    } else {
                        this.empuxaMascara(fila, col, () => this.acabaTurnoPenalizado());
                    }
                });
            });
        }
    }

    acabaTurnoPenalizado() {
        const novaCarta = this.baralla.roubar();
        if (novaCarta) {
            this.disparaAnimDesprazamento(novaCarta, this.barallaX, this.barallaY, () => {
                this.estaProcesando = false;
            });
        } else {
            this.estaProcesando = false;
        }
    }

    continuarSecuencia(mascara, fila, col, cartaXogada, manCartaX, manCartaY) {
        this.manXogador.splice(this.manXogador.indexOf(cartaXogada), 1);
        this.indiceCartaSeleccionada = -1;

        this.disparaAnimDescarte(cartaXogada, manCartaX, manCartaY, () => {
            const celdaX = this.taboleiroComezoX + col * (this.cartaAncho + this.oco);
            const celdaY = this.taboleiroComezoY + fila * (this.cartaAlto + this.oco);
            const idCartaCapturada = this.taboleiro[fila][col];

            this.disparaAnimDesvaecemento(mascara, celdaX, celdaY, () => {
                this.taboleiroMascaras[fila][col] = null;
                this.mascarasDerrotadas++;

                setTimeout(() => {
                    if (this.comprobaVictoria()) {
                        // --- SCENE TRANSITIONS HAPPEN HERE ---
                        if (this.nivel >= 3) {
                            // this.director.cambiarEscena(new GameCompleteScene(this.director));
                            console.log("GAME COMPLETE SCENE GOES HERE");
                        } else {
                            this.director.cambiarEscena(new NivelCompletado(this.director, this.nivel));
                        }
                        return;
                    }

                    const enviarCartaCapturada = () => {
                        this.taboleiro[fila][col] = null;
                        if (this.manXogador.length < 5) {
                            this.disparaAnimDesprazamento(idCartaCapturada, celdaX, celdaY, () => {
                                this.talvezAparecenMascaras();
                                this.estaProcesando = false;
                            });
                        } else {
                            this.disparaAnimDescarte(idCartaCapturada, celdaX, celdaY, () => {
                                this.talvezAparecenMascaras();
                                this.estaProcesando = false;
                            });
                        }
                    };

                    const cartaExtra = this.baralla.roubar();
                    if (cartaExtra) {
                        this.disparaAnimDesprazamento(cartaExtra, this.barallaX, this.barallaY, () => {
                            enviarCartaCapturada();
                        });
                    } else {
                        enviarCartaCapturada();
                    }
                }, 1000);
            });
        });
    }

    empuxaMascara(fila, col, enRemate) {
        let dispararaFinXogo = false;
        for (let f = fila; f < this.filas; f++) {
            if (this.taboleiroMascaras[f][col] !== null && f === this.filas - 1) {
                dispararaFinXogo = true;
                break;
            }
        }

        if (dispararaFinXogo) {
            this.director.cambiarEscena(new FinXogo(this.director, this.nivel));
            return; 
        }

        let empuxados = [];
        for (let f = this.filas - 2; f >= fila; f--) {
            if (this.taboleiroMascaras[f][col] !== null) empuxados.push(f);
        }

        if (empuxados.length === 0) {
            enRemate();
            return;
        }

        let rematado = 0;
        empuxados.forEach(f => {
            this.disparaAnimAvanza(f, col, f + 1, () => {
                rematado++;
                if (rematado === empuxados.length) {
                    this.talvezAparecenMascaras();
                    enRemate();
                }
            });
        });
    }

    executarPush(fila, col) {
        // Comprobar se a mascara pode retroceder
        const filaDestino = fila - 1;
        if (filaDestino < 0) return;
        if (this.taboleiroMascaras[filaDestino][col] !== null) {
            // Hai unha mascara detrÃ¡s, comprobar se pode moverse tamÃ©n
            const filaDetrasDest = filaDestino - 1;
            if (filaDetrasDest < 0 || this.taboleiroMascaras[filaDetrasDest][col] !== null) {
                return;
            }
        }

        this.estaProcesando = true;
        const indicesOrdenados = [...this.pushCartasSeleccionadas].sort((a, b) => b - a);
        const cartasADescartar = indicesOrdenados.map(i => this.manXogador[i]);

        indicesOrdenados.forEach(i => this.manXogador.splice(i, 1));
        this.pushCartasSeleccionadas = [];
        this.pushModo = false;
        this.indiceCartaSeleccionada = -1;

        const totalAnchoMan = ((this.manXogador.length + cartasADescartar.length) * this.cartaAncho) + (((this.manXogador.length + cartasADescartar.length) - 1) * this.ocoMan);
        const comezoManX = (this.director.canvas.width - totalAnchoMan) / 2;

        let descartesRematados = 0;
        const totalDescartes = cartasADescartar.length;

        const tralaDescartes = () => {
            this.retrocedeMascara(fila, col, () => {
                this.estaProcesando = false;
            });
        };

        cartasADescartar.forEach((cartaId, idx) => {
            const cartaX = comezoManX + indicesOrdenados[idx] * (this.cartaAncho + this.ocoMan);
            this.disparaAnimDescarte(cartaId, cartaX, this.manXogadorY, () => {
                descartesRematados++;
                if (descartesRematados === totalDescartes) {
                    tralaDescartes();
                }
            });
        });
    }

    retrocedeMascara(fila, col, enRemate) {
        const filaDestino = fila - 1;
        // Se hai mascara detrÃ¡s, movela primeiro
        if (this.taboleiroMascaras[filaDestino][col] !== null) {
            this.disparaAnimAvanza(filaDestino, col, filaDestino - 1, () => {
                this.disparaAnimAvanza(fila, col, filaDestino, () => {
                    if (enRemate) enRemate();
                });
            });
        } else {
            this.disparaAnimAvanza(fila, col, filaDestino, () => {
                if (enRemate) enRemate();
            });
        }
    }

    disparaPenalizacionTrauma(enRemate) {
        this.estaProcesando = true; 
        let finalXogo = false;
        for (let c = 0; c < this.cols; c++) {
            if (this.taboleiroMascaras[this.filas - 1][c] !== null) {
                finalXogo = true;
                break;
            }
        }

        if (finalXogo) {
            console.log("GAME OVER SCENE GOES HERE");
            // this.director.cambiarEscena(new GameOverScene(this.director, this.level));
            return; 
        }
        
        let movibles = 0;
        let animacionsFinalizadas = 0;

        for(let r = 0; r < this.rows - 1; r++) {
            for(let c = 0; c < this.cols; c++) {
                if (this.maskBoard[r][c] !== null) movibles++;
            }
        }

        if (movibles === 0) {
            if (enRemate) enRemate();
            return;
        }

        const comprobaTodo = () => {
            animacionsFinalizadas++;
            if (animacionsFinalizadas === totalMovers && enRemate) enRemate();
        };

        for(let f = 0; f < this.filas - 1; f++) {
            for(let c = 0; c < this.cols; c++) {
                if (this.taboleiroMascaras[f][c] !== null) this.triggerSlideAnimation(f, c, f + 1, comprobaTodo);
            }
        }
    }

    debuxarInfoUtil(ctx, tip) {
        ctx.save();
        const recheo = 15;
        const maxAncho = 180; 
        ctx.font = "10px Minipixel"; 
        
        const palabras = tip.texto.split(' ');
        let linhas = [];
        let linhaActual = palabras[0];

        for (let i = 1; i < palabras.length; i++) {
            let linhaTest = linhaActual + " " + palabras[i];
            let metricas = ctx.measureText(linhaTest);
            if (metricas.width > maxAncho) {
                linhas.push(linhaActual);
                linhaActual = palabras[i];
            } else {
                linhaActual = linhaTest;
            }
        }
        linhas.push(linhaActual);

        ctx.font = "14px Minipixel";
        const anchoTitulo = ctx.measureText(tip.titulo).width;
        const anchoCaixa = Math.max(anchoTitulo, maxAncho) + (recheo * 2);
        const linhaAlto = 12;
        const seccionTituloAlto = 25;
        const altoCaixa = seccionTituloAlto + (linhas.length * linhaAlto) + recheo;

        let caixaX = tip.x - anchoCaixa / 2;
        let caixaY = tip.y - altoCaixa;
        let direccionFlecha = 'abaixo';

        if (tip.centrado) caixaY = (this.director.canvas.height - altoCaixa) / 2;
       
        if (caixaY < 10) {
            const aproxCartaAlto = 100;
            caixaY = tip.y + aproxCartaAlto + 20;
            direccionFlecha = 'arriba';
        }

        if (caixaX < 5) caixaX = 5;
        if ((caixaX + anchoCaixa) > this.director.canvas.width - 5) caixaX = this.director.canvas.width - anchoCaixa - 5;

        // sombra e fondo
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(caixaX + 3, caixaY + 3, anchoCaixa, altoCaixa);
        ctx.fillStyle = "#222";
        ctx.strokeStyle = "#ffd700";
        ctx.lineWidth = 2;
        ctx.fillRect(caixaX, caixaY, anchoCaixa, altoCaixa);
        ctx.strokeRect(caixaX, caixaY, anchoCaixa, altoCaixa);

        // flecha
        if (!tip.centrado) {
            ctx.beginPath();
            ctx.fillStyle = "#ffd700";
            if (direccionFlecha === 'abaixo') {
                ctx.moveTo(tip.x - 6, caixaY + altoCaixa);
                ctx.lineTo(tip.x + 6, caixaY + altoCaixa);
                ctx.lineTo(tip.x, caixaY + altoCaixa + 5);
            } else {
                ctx.moveTo(tip.x - 6, caixaY);
                ctx.lineTo(tip.x + 6, caixaY);
                ctx.lineTo(tip.x, caixaY - 6);
            }
            ctx.fill();
        }

        // Text
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffd700";
        ctx.font = "12px Minipixel";
        ctx.fillText(tip.titulo, caixaX + anchoCaixa / 2, caixaY + 18);

        ctx.fillStyle = "white";
        ctx.font = "10px Minipixel";
        linhas.forEach((linha, indice) => {
            ctx.fillText(linha, caixaX + anchoCaixa / 2, caixaY + seccionTituloAlto + (indice * linhaAlto) + 10);
        });
        ctx.restore();
    }
    
    estaDentro(x, y, btn) { return x > btn.x && x < btn.x + btn.ancho && y > btn.y && y < btn.y + btn.alto; }
    // adValorCarta (adquirir = get) / atValorCarta (atribuir = set) 
    adValorCarta(id) { return (id - 1) % 10 + 1; }
    adPaloCarta(id) { return Math.floor((id - 1) / 10); }
    cartaMaisBaixa(){ let l = 999; this.manXogador.forEach(c => { const v = this.adValorCarta(c); if(v<l) l=v; }); return l; }
    cartaMaisAlta(){ let h = 0; this.manXogador.forEach(c => { const v = this.adValorCarta(c); if(v>h) h=v; }); return h; }
    comprobaVictoria() { return this.contaMascarasActivas() === 0 && this.mascarasEnXogo >= this.mascarasTotalNivelActual; }
    contaMascarasActivas() {
        let conta = 0;
        for (let f = 0; f < this.filas; f++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.taboleiroMascaras[f][c] !== null) conta++;
            }
        }
        return conta;
    }
    amosarPasoTitorial() {
        const msx = this.mensaxesTitorial[this.pasoTitorial];
        this.infoUtilActiva = { x: this.director.canvas.width / 2, y: this.director.canvas.height / 2, titulo: msx.titulo, texto: msx.texto, centrado: true };
    }
    adLimiteMascarasNivel() {
        if (this.nivel === 0) return 4;
        if (this.nivel === 1) return 15;
        if (this.nivel === 2) return 20;
        return 25;
    }
    adConxuntoMascarasNivel() {
        const mascaras0 = ['Felicidade', 'Tristeza', 'Ira', 'Conspirador'];
        const mascaras1 = [...mascaras0, 'Cinismo', 'Soldado', 'Codicia', 'Bruto', 'Borracho', 'Artista', 'Cabalo', 'Alteza', 'Carlista', 'Desliz', 'Preocupacion'];
        const mascaras2 = [...mascaras1, 'Pirata', 'Presumido', 'Decepcion', 'Sorpresa', 'Afouteza'];
        const mascaras3 = [...mascaras2, 'Enfado', 'Dereita', 'Esquerda', 'Trauma'];

        if (this.nivel === 0) return mascaras0;
        if (this.nivel === 1) return mascaras1;
        if (this.nivel === 2) return mascaras2;
        return mascaras3;
    }

    eConxuntoValido(nomeMascara, idCarta) {
        const val = this.adValorCarta(idCarta);
        // Impossible: Needs > 10, but card is 10
        if (nomeMascara === 'Felicidade' && val === 10) return false;
        // Impossible: Needs < 1, but card is 1
        if (nomeMascara === 'Tristeza' && val === 1) return false;
        return true;
    }


    establecerFilaTitorial() {
        const mascarasTitorial = ["Felicidade", "Tristeza", "Ira", "Conspirador"];
        let conxuntoValidoAtopado = false;

        while (!conxuntoValidoAtopado) {
            let conxuntoActual = [];
            for(let i = 0; i < 4; i++) conxuntoActual.push(this.baralla.roubar());
            conxuntoActual.sort((a, b) => this.adValorCarta(a) - this.adValorCarta(b));
            let correcto = true;
            for(let i = 0; i < 4; i++) {
                if (!this.eConxuntoValido(mascarasTitorial[i], conxuntoActual[i])) {
                    correcto = false;
                    break;
                }
            }

            if (correcto) {
                for(let c = 0; c < 4; c++) {
                    this.taboleiro[0][c] = conxuntoActual[c];
                    this.taboleiroMascaras[0][c] = mascarasTitorial[c];
                    this.mascarasEnXogo++;
                }
                conxuntoValidoAtopado = true;
            } else {
                // Recalculate if the random cards didn't fit the fixed tutorial masks
                this.baralla.cartas.unshift(...conxuntoActual);
            }
        }
    }

    establecerFilaAleatoria() {
        const conxunto = this.adConxuntoMascarasNivel();
        let conxuntoValidoAtopado = false;

        while (!conxuntoValidoAtopado) {
            let conxuntoActual = [];
            for(let i=0; i<4; i++) conxuntoActual.push(this.baralla.roubar());
            conxuntoActual.sort((a, b) => this.adValorCarta(a) - this.adValorCarta(b));

            let correcto = true;
            let mascarasSeleccionadas = [];
            for(let i=0; i<4; i++) {
                const m = conxunto[Math.floor(Math.random() * conxunto.length)];
                if (!this.eConxuntoValido(m, conxuntoActual[i])) {
                    correcto = false;
                    break;
                }
                mascarasSeleccionadas.push(m);
            }

            if (correcto) {
                for(let c = 0; c < 4; c++) {
                    this.taboleiro[0][c] = conxuntoActual[c];
                    this.taboleiroMascaras[0][c] = mascarasSeleccionadas[c];
                    this.mascarasEnXogo++;
                }
                conxuntoValidoAtopado = true;
            } else {
                this.baralla.cartas.unshift(...conxuntoActual);
            }
        }
    }


    talvezAparecenMascaras(aparicionForzada = false) {
        if (this.nivel === 0) return;
        if (this.mascarasEnXogo >= this.mascarasTotalNivelActual) return;

        const mascaras = this.adConxuntoMascarasNivel()
        let aparicion = false;

        for (let c = 0; c < this.cols; c++) {
            if (this.taboleiroMascaras[0][c] === null && this.mascarasEnXogo < this.mascarasTotalNivelActual) {
                // 40% ou forzado se esta o taboleiro limpo
                if (aparicionForzada || Math.random() < 0.4) { 
                    let valido = false;
                    while (!valido) {
                        const mascara = mascaras[Math.floor(Math.random() * mascaras.length)];
                        const carta = this.baralla.roubar();
                        if (this.eConxuntoValido(mascara, carta)) {
                            this.taboleiro[0][c] = carta;
                            this.taboleiroMascaras[0][c] = mascara;
                            this.mascarasEnXogo++;
                            valido = true;
                            aparicion = true;
                        } else {
                            this.baralla.cartas.unshift(carta);
                        }
                    }
                }
            }
        }

        if (this.contaMascarasActivas() === 0 && !aparicion && this.mascarasEnXogo < this.mascarasTotalNivelActual) {
            this.talvezAparecenMascaras(true);
        }
    }


    dispararPenalizacion() {
        if (this.estaAnimando || this.estaProcesando || this.manXogador.length >= 5) return; 

        this.estaProcesando = true; // BLOQUEA
        const novaCarta = this.baralla.roubar();

        if (!novaCarta) {
            this.estaProcesando = false;
            return;
        }
        this.disparaAnimDesprazamento(novaCarta, this.barallaX, this.barallaY, () => {
            setTimeout(() => {
                let candidatos = [];
                for(let f = 0; f < this.filas; f++) {
                    for(let c = 0; c < this.cols; c++) {
                        if (this.taboleiroMascaras[f][c] !== null) {
                            // Esta na ultima fila -> Fin do xogo
                            if (f === this.filas - 1) {
                                candidatos.push({fila: f, col: c, finXogo: true});
                            } 
                            else if (this.taboleiro[f+1][c] === null) {
                                candidatos.push({fila: f, col: c, finXogo: false});
                            }
                        }
                    }
                }

                if (candidatos.length > 0) {
                    let minFila = this.filas; // Movese a mascara mais atrasada
                    candidatos.forEach(c => {
                        if (c.fila < minFila) minFila = c.fila;
                    });
                    const candidatosValidos = candidatos.filter(c => c.fila === minFila);
                    const indiceAleatorio = Math.floor(Math.random() * candidatosValidos.length);
                    const mSeleccionada = candidatosValidos[indiceAleatorio];

                    if (mSeleccionada.finXogo) {
                        this.estado = 'FIN_XOGO';
                    } else {
                        console.log(`Penalizacion: Mascara en [${mSeleccionada.fila},${mSeleccionada.col}] moveu a [${mSeleccionada.fila+1},${mSeleccionada.col}]`);
                        this.disparaAnimAvanza(mSeleccionada.fila, mSeleccionada.col, mSeleccionada.fila + 1, () => {
                            this.talvezAparecenMascaras();
                            this.estaProcesando = false;
                        });
                    }
                }
                //this.debuxar();
            }, 300);
        })
    }

    // Disparadores de animacions

    reproducirSon(key) {
        const buf = this.director.assets[key];
        const ctx = this.director.assets['_audioContext'];
        if (!buf || !ctx) return;
        if (ctx.state === 'suspended') ctx.resume();
        const source = ctx.createBufferSource();
        source.buffer = buf;
        source.connect(ctx.destination);
        source.start();
    }

    reproducirSonDar() {
        const n = Math.floor(Math.random() * 6) + 1;
        this.reproducirSon(`son_dar${n}`);
    }

    disparaAnimDesprazamento(cartaId, comezoX, comezoY, enRemate) {
        const tamManObxectivo = this.manXogador.length + 1;
        const anchoManTotal = (tamManObxectivo * this.cartaAncho) + ((tamManObxectivo - 1) * this.ocoMan);
        const destinoX = (this.director.canvas.width - anchoManTotal) / 2;
        const destinoY = this.manXogadorY;

        const anim = new AnimacionDesprazamento(
            this.director.assets, this.cartaAncho, this.cartaAlto,
            cartaId, comezoX, comezoY, destinoX, destinoY,
            () => { this.manXogador.unshift(cartaId); if (enRemate) enRemate(); }
        );
        this.reproducirSonDar();
        this.animacions.push(anim);
        this.estaAnimando = true;
    }


    disparaAnimTremer(fila, col, enRemate) {
        this.reproducirSon('son_axitaMascara');
        this.animacions.push(new AnimacionTremer(fila, col, 0.07, enRemate));
        this.estaAnimando = true;
    }

    disparaAnimDesvaecemento(nomeMascara, x, y, enRemate) {
        this.reproducirSon('son_rompeMascara');
        this.animacions.push(new AnimacionEfecto(
            this.director.assets, this.cartaAncho, this.cartaAlto,
            nomeMascara, x, y, 0.15, enRemate
        ));
        this.estaAnimando = true;
    }

    disparaAnimAvanza(fila, col, segFila, enRemate) {
        const cartaId = this.taboleiro[fila][col];
        const nomeMascara = this.taboleiroMascaras[fila][col];
        
        const comezoX = this.taboleiroComezoX + col * (this.cartaAncho + this.oco);
        const comezoY = this.taboleiroComezoY + fila * (this.cartaAlto + this.oco);
        const destinoX = comezoX;
        const destinoY = this.taboleiroComezoY + segFila * (this.cartaAlto + this.oco);

        this.taboleiro[fila][col] = null;
        this.taboleiroMascaras[fila][col] = null;

        const anim = new AnimacionAvanza(
            this.director.assets, this.cartaAncho, this.cartaAlto,
            cartaId, nomeMascara,
            comezoX, comezoY, destinoX, destinoY,
            segFila, col, 0.07,
            () => {
                this.taboleiro[segFila][col] = cartaId;
                this.taboleiroMascaras[segFila][col] = nomeMascara;
                if (enRemate) enRemate();
            }
        );
        this.animacions.push(anim);
        this.estaAnimando = true;
    }


    disparaAnimDescarte(cartaId, comezoX, comezoY, enRemate) {
        const anim = new AnimacionDesprazamento(
            this.director.assets, this.cartaAncho, this.cartaAlto,
            cartaId, comezoX, comezoY, this.pilaDescarteX, this.pilaDescarteY,
            () => { this.pilaDescartes.push(cartaId); if (enRemate) enRemate(); }
        );
        this.animacions.push(anim);
        this.estaAnimando = true;
    }


    verDescripcionMascara(mascara) {
        // Helper to format text (Upper Case first letter)
        const nomeFormato = (nome) => nome.charAt(0).toUpperCase() + nome.slice(1);

        switch (mascara) {
            case "Felicidade": 
                return "Require carta con MAIOR valor.";
            case "Tristeza":   
                return "Require carta con MENOR valor.";
            case "Ira": 
                return "Require carta co MESMO valor.";
            case "Conspirador": 
                return "Require carta do MESMO pao.";
            case "Cinismo":
                return "Require carta dun pao e nÃºmero diferente.";
            case "Soldado":
                return "Require carta do pao de ESPADAS";
            case "Desliz":
                return "Require carta con valor de paridade oposta";
            case "Preocupacion":
                return "Require carta da mesma paridade e o mesmo pao";
            case "Sorpresa":
                return "Require carta que ao ser sumada ou restada de como resultado o nÃºmero 7.";
            case "Trauma":
                return "Require carta co mesmo valor, o seguinte ou o anterior. Penalizacion extra ao fallar.";
            case "Afouteza":
                return "Require unha carta de valor igual ao numero de mascaras no taboleiro.";
            case "Bruto":
                return "Require carta de BASTOS";
            case "DecepciÃ³n":
                return "Require carta de menor valor entre as cartas da tÃºa man.";
            case "Enfado":
                return "Require carta de valor igual ao nÃºmero de veces que fallache neste nivel."
            case "Presumido":
                return "Require carta de maior valor entre as cartas da tÃºa man.";
            case "Dereita":
                return "Ten a condiciÃ³n da carta da DEREITA";
            case "Esquerda":
                return "Ten a condiciÃ³n da carta da ESQUERDA";
            case "Borracho":
                return "Require carta de COPAS";
            case "Alteza":
                return "Require carta de REI";
            case "Cabalo":
                return "Require carta de CABALO";
            case "Carlista":
                return "Require carta de SOTA";
            case "Artista":
                return "Require a seguinte carta ou a anterior carta";
            case "Pirata":
                return "Require carta de OUROS ou COPAS que sexan de MAIOR valor";
            case "Codicia":
                return "Require carta de OUROS.";
            default: 
                return "???";
        }
    }

    batalla(nomeMascara, cartaXogada, cartaTaboleiro, fila, col, profundidade=0) {
        const xVal = this.adValorCarta(cartaXogada);
        const tVal = this.adValorCarta(cartaTaboleiro);
        const xPalo = this.adPaloCarta(cartaXogada);
        const tPalo = this.adPaloCarta(cartaTaboleiro);
        let tParidade = 0;
        let xParidade = 0;

        switch (nomeMascara) {
            case "Felicidade":
                return xVal > tVal;
            
            case "Tristeza": 
                return xVal < tVal;
            
            case "Conspirador":
                return xPalo === tPalo;
            
            case "Ira": 
                return xVal === tVal;
            
            case "Cinismo":
                return (xVal !== tVal) && (xPalo !== tPalo);
            
            case "Soldado":
                return (xPalo === 2);
            
            case "Desliz":
                tParidade = (tVal % 2 === 0);
                xParidade = (xVal % 2 === 0);
                return (xParidade !== tParidade);
            
            case "Preocupacion":
                tParidade = (tVal % 2 === 0);
                xParidade = (xVal % 2 === 0);
                return (xParidade === tParidade) && (xPalo === tPalo);
            
            case "Sorpresa":
                // IMPOSIBLE SE OCULTA UN 7
                let tValor = tVal > 7 ? tVal + 2 : tVal;
                let xValor = xVal > 7 ? xVal + 2 : xVal;
                let sumaSete = (tValor + xValor) === 7;
                let restaSete = Math.abs(tValor - xValor) === 7;
                return sumaSete || restaSete;
            
            case "Trauma":
                return (xVal + 1 === tVal) || (xVal - 1 === tVal) || (xVal === tVal);
            
            case "Afouteza":
                const mascarasTotais = this.contaMascarasActivas();
                return (xVal === mascarasTotais);
            
            case "Bruto":
                return (xPalo === 3);

            case "Decepcion":
                const cartaBaixa = this.cartaMaisBaixa()
                return (xVal === cartaBaixa);
            
            case "Enfado":
                let xValor1 = xVal > 7 ? xVal + 2 : xVal;
                return (xValor1 === this.errosNivel);
            
            case "Presumido":
                const cartaAlta = this.cartaMaisAlta()
                return (xVal === cartaAlta);

            case "Dereita":
                // Imposible na ultima columna
                const targetCol = col + 1;
                if (targetCol >= this.cols) return false;
                const neighborMask = this.taboleiroMascaras[fila][targetCol];
                if (!neighborMask) return false;
                return this.batalla(neighborMask, xVal, tVal, fila, targetCol, profundidade + 1);
            
            case "Esquerda":
                // Imposible na primeira columna
                const targetCol1 = col - 1;
                if (targetCol1 <= 0) return false;
                const neighborMask1 = this.taboleiroMascaras[fila][targetCol1];
                if (!neighborMask1) return false;
                return this.batalla(neighborMask1, xVal, tVal, fila, targetCol1, profundidade + 1);
            
            case "Borracho":
                return (xPalo === 1);
            
            case "Alteza":
                return (xVal === 10);

            case "Cabalo":
                return (xVal === 9);
            
            case "Carlista":
                return (xVal === 8);
            
            case "Artista": // un arriba ou un abaixo
                return (xVal + 1 === tVal) || (xVal - 1 === tVal)
            
            case "Pirata":
                // IMPOSIBLE SE GARDA UN REI
                return ((xPalo === 1)  || (xPalo == 0)) && (xVal > tVal);
            
            case "Codicia":
                return (xPalo === 0);

            default: return false;
        }
    }


    triggerFlushAction() {
        this.estaProcesando = true;

        const manOrixinal = [...this.manXogador];
        const descarteOrixinal = [...this.pilaDescartes];
        const cartasARoubar = manOrixinal.length;

        this.pilaDescartes = [];
        this.indiceCartaSeleccionada = -1;

        this.animaDescarteABaralla([...descarteOrixinal], descarteOrixinal, manOrixinal, cartasARoubar);
    }


    animaDescarteABaralla(animListaDescarte, descarteData, manData, cartasARoubar) {
        if (animListaDescarte.length === 0) {
            this.animaManABaralla(descarteData, manData, cartasARoubar);
            return;
        }

        const cartaId = animListaDescarte.pop();
        const comezoX = this.pilaDescarteX;
        const comezoY = this.pilaDescarteY;

        const anim = new AnimacionDesprazamento(
            this.director.assets, this.cartaAncho, this.cartaAlto,
            cartaId, comezoX, comezoY, this.barallaX, this.barallaY,
            () => {}
        );
        this.animacions.push(anim);
        this.estaAnimando = true;

        setTimeout(() => {
            this.animaDescarteABaralla(animListaDescarte, descarteData, manData, cartasARoubar);
        }, 150);
    }

    animaManABaralla(descarteData, manData, cartasARoubar) {
        setTimeout(() => {
            this.reproducirSon('son_barallar');

            this.manXogador = [];
            if (manData.length === 0) {
                this.barallarFlush(manData, descarteData, cartasARoubar);
                return;
            }

            let landedCount = 0;
            const ocoMan = 20; 
            const anchoManTotal = (manData.length * this.cartaAncho) + ((manData.length - 1) * ocoMan);
            const comezoManX = (this.director.canvas.width - anchoManTotal) / 2;

            manData.forEach((cartaId, indice) => {
                const comezoX = comezoManX + indice * (this.cartaAncho + ocoMan);
                const anim = new AnimacionDesprazamento(
                    this.director.assets, this.cartaAncho, this.cartaAlto,
                    cartaId, comezoX, this.manXogadorY, this.barallaX, this.barallaY,
                    () => {
                        landedCount++;
                        if (landedCount === manData.length) {
                            this.barallarFlush(manData, descarteData, cartasARoubar);
                        }
                    }
                );
                this.animacions.push(anim);
            });
            this.estaAnimando = true;

        }, 300);
    }


    barallarFlush(manData, descarteData, cartasARoubar) {
        this.baralla.cartas.push(...manData);
        this.baralla.cartas.push(...descarteData);
        
        this.baralla.barallar();
        
        this.roubarMultiplesCartas(cartasARoubar);
    }

    roubarMultiplesCartas(cartasARoubar) {
        let cartasRoubadas = 0;

        const roubarSeguinte = () => {
            if (cartasRoubadas >= cartasARoubar) {
                this.estaProcesando = false;
                return;
            }

            const novaCarta = this.baralla.roubar();
            if (novaCarta) {
                cartasRoubadas++;
                
                this.disparaAnimDesprazamento(novaCarta, this.barallaX, this.barallaY, () => {
                    setTimeout(roubarSeguinte, 100); 
                });
            } else {
                // Baralla baleira (Inprobable despois dun flush, pero seguro preveer este caso)
                this.estaProcesando = false;
            }
        };
        if (cartasARoubar > 0) {
            roubarSeguinte();
        } else {
            this.estaProcesando = false;
        }
    }




    // ===================== DEPURACION =====================

    procesarClicDepurar(x, y) {
        switch (this.depurarModo) {
            case 'menu': {
                const opcions = ['Borrar mÃ¡scara', 'Engadir mÃ¡scara', 'Engadir carta a man', 'Descobrir mÃ¡scara', 'Seguinte nivel'];
                const modos = ['borrarMascara', 'engadirMascara', 'engadirCarta', 'descobrirMascara', 'seguinteNivel'];
                const anchoOpcion = 210;
                const altoOpcion = 22;
                for (let i = 0; i < opcions.length; i++) {
                    const opY = this.depurarMenuY + i * altoOpcion;
                    if (x >= this.depurarMenuX && x <= this.depurarMenuX + anchoOpcion &&
                        y >= opY && y <= opY + altoOpcion) {
                        this.depurarModo = modos[i];
                        return;
                    }
                }
                this.depurarModo = null;
                return;
            }
            case 'borrarMascara': {
                const celda = this.depurarObterCelda(x, y);
                if (celda.valida && this.taboleiroMascaras[celda.fila][celda.col] !== null) {
                    this.taboleiroMascaras[celda.fila][celda.col] = null;
                    const cartaId = this.taboleiro[celda.fila][celda.col];
                    if (cartaId !== null) {
                        this.baralla.cartas.push(cartaId);
                        this.taboleiro[celda.fila][celda.col] = null;
                    }
                    this.mascarasDerrotadas++;
                }
                this.depurarModo = null;
                return;
            }
            case 'engadirMascara': {
                const celda = this.depurarObterCelda(x, y);
                if (celda.valida && this.taboleiroMascaras[celda.fila][celda.col] === null) {
                    this.depurarCeldaSeleccionada = { fila: celda.fila, col: celda.col };
                    this.depurarModo = 'seleccionarTipoMascara';
                } else {
                    this.depurarModo = null;
                }
                return;
            }
            case 'seleccionarTipoMascara': {
                const mascaras = this.depurarListaMascaras();
                const numCols = 2;
                const anchoColumna = 120;
                const altoFila = 18;
                const recheo = 10;
                const tituloAlto = 20;
                const numFilas = Math.ceil(mascaras.length / numCols);
                const anchoPanel = numCols * anchoColumna + recheo * 2;
                const altoPanel = tituloAlto + numFilas * altoFila + recheo * 2;
                const panelX = (this.director.canvas.width - anchoPanel) / 2;
                const panelY = (this.director.canvas.height - altoPanel) / 2;

                for (let i = 0; i < mascaras.length; i++) {
                    const c = i % numCols;
                    const f = Math.floor(i / numCols);
                    const celdaX = panelX + recheo + c * anchoColumna;
                    const celdaY = panelY + tituloAlto + recheo + f * altoFila;
                    if (x >= celdaX && x <= celdaX + anchoColumna && y >= celdaY && y <= celdaY + altoFila) {
                        const { fila, col } = this.depurarCeldaSeleccionada;
                        const carta = this.baralla.roubar();
                        if (carta) {
                            this.taboleiro[fila][col] = carta;
                            this.taboleiroMascaras[fila][col] = mascaras[i];
                            this.mascarasEnXogo++;
                        }
                        this.depurarModo = null;
                        this.depurarCeldaSeleccionada = null;
                        return;
                    }
                }
                this.depurarModo = null;
                this.depurarCeldaSeleccionada = null;
                return;
            }
            case 'descobrirMascara': {
                const celda = this.depurarObterCelda(x, y);
                if (celda.valida && this.taboleiroMascaras[celda.fila][celda.col] !== null) {
                    const mascara = this.taboleiroMascaras[celda.fila][celda.col];
                    const cartaId = this.taboleiro[celda.fila][celda.col];
                    const valor = this.adValorCarta(cartaId);
                    const palo = this.adPaloCarta(cartaId);
                    const nomesPalos = ['Ouros', 'Copas', 'Espadas', 'Bastos'];
                    const celdaX = this.taboleiroComezoX + celda.col * (this.cartaAncho + this.oco);
                    const celdaY = this.taboleiroComezoY + celda.fila * (this.cartaAlto + this.oco);
                    this.infoUtilActiva = {
                        x: celdaX + this.cartaAncho / 2,
                        y: celdaY - 15,
                        titulo: mascara.toUpperCase(),
                        texto: `Carta: ${valor} de ${nomesPalos[palo]} (ID: ${cartaId})`
                    };
                }
                this.depurarModo = null;
                return;
            }
            case 'seguinteNivel': {
                this.depurarModo = null;
                this.director.cambiarEscena(new NivelCompletado(this.director, this.nivel));
                return;
            }
            case 'engadirCarta': {
                const cartasDisponibles = this.depurarCartasDisponibles();
                if (cartasDisponibles.length === 0) { this.depurarModo = null; return; }
                const cartaAnchoDep = 30;
                const cartaAltoDep = 47;
                const ocoDep = 4;
                const numCols = 10;
                const recheo = 10;
                const tituloAlto = 20;
                const numFilas = Math.ceil(cartasDisponibles.length / numCols);
                const anchoPanel = numCols * (cartaAnchoDep + ocoDep) - ocoDep + recheo * 2;
                const altoPanel = tituloAlto + numFilas * (cartaAltoDep + ocoDep) - ocoDep + recheo * 2;
                const panelX = (this.director.canvas.width - anchoPanel) / 2;
                const panelY = (this.director.canvas.height - altoPanel) / 2;

                for (let i = 0; i < cartasDisponibles.length; i++) {
                    const c = i % numCols;
                    const f = Math.floor(i / numCols);
                    const celdaX = panelX + recheo + c * (cartaAnchoDep + ocoDep);
                    const celdaY = panelY + tituloAlto + recheo + f * (cartaAltoDep + ocoDep);
                    if (x >= celdaX && x <= celdaX + cartaAnchoDep && y >= celdaY && y <= celdaY + cartaAltoDep) {
                        const { id, orixe } = cartasDisponibles[i];
                        if (orixe === 'baralla') {
                            const idx = this.baralla.cartas.indexOf(id);
                            if (idx !== -1) this.baralla.cartas.splice(idx, 1);
                        } else {
                            const idx = this.pilaDescartes.indexOf(id);
                            if (idx !== -1) this.pilaDescartes.splice(idx, 1);
                        }
                        this.manXogador.push(id);
                        this.depurarModo = null;
                        return;
                    }
                }
                this.depurarModo = null;
                return;
            }
            default:
                this.depurarModo = null;
        }
    }

    depurarObterCelda(x, y) {
        const relX = x - this.taboleiroComezoX;
        const relY = y - this.taboleiroComezoY;
        const col = Math.floor(relX / (this.cartaAncho + this.oco));
        const fila = Math.floor(relY / (this.cartaAlto + this.oco));
        const colValida = col >= 0 && col < this.cols && (relX % (this.cartaAncho + this.oco) < this.cartaAncho);
        const filaValida = fila >= 0 && fila < this.filas && (relY % (this.cartaAlto + this.oco) < this.cartaAlto);
        return { fila, col, valida: colValida && filaValida };
    }

    depurarListaMascaras() {
        return [
            'Felicidade', 'Tristeza', 'Ira', 'Conspirador', 'Cinismo', 'Soldado',
            'Codicia', 'Bruto', 'Borracho', 'Artista', 'Cabalo', 'Alteza',
            'Carlista', 'Desliz', 'Preocupacion', 'Pirata', 'Presumido',
            'Decepcion', 'Sorpresa', 'Afouteza', 'Enfado', 'Dereita', 'Esquerda', 'Trauma'
        ];
    }

    depurarCartasDisponibles() {
        const cartas = [];
        this.baralla.cartas.forEach(id => cartas.push({ id, orixe: 'baralla' }));
        this.pilaDescartes.forEach(id => cartas.push({ id, orixe: 'descarte' }));
        cartas.sort((a, b) => a.id - b.id);
        return cartas;
    }

    debuxarDepurar(ctx) {
        if (!this.depurar || !this.depurarModo) return;
        ctx.save();

        switch (this.depurarModo) {
            case 'menu': {
                const opcions = ['Borrar mÃ¡scara', 'Engadir mÃ¡scara', 'Engadir carta a man', 'Descobrir mÃ¡scara', 'Seguinte nivel'];
                const anchoOpcion = 210;
                const altoOpcion = 22;

                ctx.fillStyle = 'rgba(0,0,0,0.85)';
                ctx.fillRect(this.depurarMenuX, this.depurarMenuY, anchoOpcion, altoOpcion * opcions.length);
                ctx.strokeStyle = '#ff0';
                ctx.lineWidth = 1;
                ctx.strokeRect(this.depurarMenuX, this.depurarMenuY, anchoOpcion, altoOpcion * opcions.length);

                ctx.font = '10px Minipixel';
                ctx.textAlign = 'left';
                opcions.forEach((op, i) => {
                    const opY = this.depurarMenuY + i * altoOpcion;
                    if (i > 0) {
                        ctx.strokeStyle = '#555';
                        ctx.beginPath();
                        ctx.moveTo(this.depurarMenuX + 4, opY);
                        ctx.lineTo(this.depurarMenuX + anchoOpcion - 4, opY);
                        ctx.stroke();
                    }
                    ctx.fillStyle = '#ff0';
                    ctx.fillText(op, this.depurarMenuX + 8, opY + 15);
                });
                break;
            }
            case 'borrarMascara': {
                ctx.fillStyle = 'rgba(255,0,0,0.12)';
                ctx.fillRect(0, 0, this.director.canvas.width, this.director.canvas.height);
                ctx.fillStyle = '#ff4444';
                ctx.font = '10px Minipixel';
                ctx.textAlign = 'center';
                ctx.fillText('DEPURAR: Clic nunha mÃ¡scara para borrala', this.director.canvas.width / 2, 15);
                break;
            }
            case 'engadirMascara': {
                ctx.fillStyle = 'rgba(0,255,0,0.12)';
                ctx.fillRect(0, 0, this.director.canvas.width, this.director.canvas.height);
                ctx.fillStyle = '#44ff44';
                ctx.font = '10px Minipixel';
                ctx.textAlign = 'center';
                ctx.fillText('DEPURAR: Clic nunha celda baleira', this.director.canvas.width / 2, 15);
                break;
            }
            case 'descobrirMascara': {
                ctx.fillStyle = 'rgba(0,100,255,0.12)';
                ctx.fillRect(0, 0, this.director.canvas.width, this.director.canvas.height);
                ctx.fillStyle = '#44aaff';
                ctx.font = '10px Minipixel';
                ctx.textAlign = 'center';
                ctx.fillText('DEPURAR: Clic nunha mÃ¡scara para ver a carta oculta', this.director.canvas.width / 2, 15);
                break;
            }
            case 'seleccionarTipoMascara': {
                const mascaras = this.depurarListaMascaras();
                const numCols = 2;
                const anchoColumna = 120;
                const altoFila = 18;
                const recheo = 10;
                const tituloAlto = 20;
                const numFilas = Math.ceil(mascaras.length / numCols);
                const anchoPanel = numCols * anchoColumna + recheo * 2;
                const altoPanel = tituloAlto + numFilas * altoFila + recheo * 2;
                const panelX = (this.director.canvas.width - anchoPanel) / 2;
                const panelY = (this.director.canvas.height - altoPanel) / 2;

                ctx.fillStyle = 'rgba(0,0,0,0.92)';
                ctx.fillRect(panelX, panelY, anchoPanel, altoPanel);
                ctx.strokeStyle = '#ff0';
                ctx.lineWidth = 1;
                ctx.strokeRect(panelX, panelY, anchoPanel, altoPanel);

                ctx.fillStyle = '#ff0';
                ctx.font = '10px Minipixel';
                ctx.textAlign = 'center';
                ctx.fillText('Selecciona tipo de mÃ¡scara', panelX + anchoPanel / 2, panelY + 15);

                ctx.textAlign = 'left';
                ctx.font = '9px Minipixel';
                mascaras.forEach((m, i) => {
                    const c = i % numCols;
                    const f = Math.floor(i / numCols);
                    const celdaX = panelX + recheo + c * anchoColumna;
                    const celdaY = panelY + tituloAlto + recheo + f * altoFila;
                    ctx.fillStyle = '#333';
                    ctx.fillRect(celdaX, celdaY, anchoColumna - 4, altoFila - 2);
                    ctx.fillStyle = '#fff';
                    ctx.fillText(m, celdaX + 5, celdaY + 13);
                });
                break;
            }
            case 'engadirCarta': {
                const cartasDisponibles = this.depurarCartasDisponibles();
                if (cartasDisponibles.length === 0) break;
                const cartaAnchoDep = 30;
                const cartaAltoDep = 47;
                const ocoDep = 4;
                const numCols = 10;
                const recheo = 10;
                const tituloAlto = 20;
                const numFilas = Math.ceil(cartasDisponibles.length / numCols);
                const anchoPanel = numCols * (cartaAnchoDep + ocoDep) - ocoDep + recheo * 2;
                const altoPanel = tituloAlto + numFilas * (cartaAltoDep + ocoDep) - ocoDep + recheo * 2;
                const panelX = (this.director.canvas.width - anchoPanel) / 2;
                const panelY = (this.director.canvas.height - altoPanel) / 2;

                ctx.fillStyle = 'rgba(0,0,0,0.92)';
                ctx.fillRect(panelX, panelY, anchoPanel, altoPanel);
                ctx.strokeStyle = '#ff0';
                ctx.lineWidth = 1;
                ctx.strokeRect(panelX, panelY, anchoPanel, altoPanel);

                ctx.fillStyle = '#ff0';
                ctx.font = '10px Minipixel';
                ctx.textAlign = 'center';
                ctx.fillText('Selecciona unha carta', panelX + anchoPanel / 2, panelY + 15);

                const assets = this.director.assets;
                cartasDisponibles.forEach((carta, i) => {
                    const c = i % numCols;
                    const f = Math.floor(i / numCols);
                    const celdaX = panelX + recheo + c * (cartaAnchoDep + ocoDep);
                    const celdaY = panelY + tituloAlto + recheo + f * (cartaAltoDep + ocoDep);
                    const imx = assets[carta.id.toString()];
                    if (imx) ctx.drawImage(imx, celdaX, celdaY, cartaAnchoDep, cartaAltoDep);
                    if (carta.orixe === 'descarte') {
                        ctx.strokeStyle = '#f44';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(celdaX, celdaY, cartaAnchoDep, cartaAltoDep);
                    }
                });
                break;
            }
        }

        ctx.restore();
    }

    montarFilaInicial() {
        const mascarasNivel = this.adConxuntoMascarasNivel();
        let conxuntoValidoAtopado = false;

        while (!conxuntoValidoAtopado) {
            let conxuntoActual = [];
            for(let i=0; i<4; i++) conxuntoActual.push(this.baralla.roubar());
            conxuntoActual.sort((a, b) => this.adValorCarta(a) - this.adValorCarta(b));

            let correcto = true;
            let mascarasSeleccionadas = [];
            for(let i=0; i<4; i++) {
                const m = mascarasNivel[Math.floor(Math.random() * mascarasNivel.length)];
                if (!this.eConxuntoValido(m, conxuntoActual[i])) {
                    correcto = false;
                    break;
                }
                mascarasSeleccionadas.push(m);
            }

            if (correcto) {
                for(let c = 0; c < 4; c++) {
                    this.taboleiro[0][c] = conxuntoActual[c];
                    this.taboleiroMascaras[0][c] = mascarasSeleccionadas[c];
                    this.mascarasEnXogo++;
                }
                conxuntoValidoAtopado = true;
            } else {
                this.baralla.cartas.unshift(...conxuntoActual);
            }
        }
    }


    // Note: To keep this block readable, make sure you copy/paste your existing logic here for:
    // - setupTutorialRow(), setupRandomStartingRow(), maybeSpawnMasks()
    // - triggerFlushAction(), animateDiscardToDeck(), animateHandToDeck(), performFlushShuffle(), drawMultipleCards()
    // - dispararPenalizacion()
    // - triggerMaskWipe(), triggerShakeAnimation(), triggerSlideAnimation(), triggerDiscardAnimation(), disparaAnimDesprazamento()
    // - checkBattleWin(maskName, playerCardId, boardCardId, row, col, depth=0)

    // ... (Your massive switch statements and setup functions go exactly here without changes) ...



}