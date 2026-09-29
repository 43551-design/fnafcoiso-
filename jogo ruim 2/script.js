/**
 * ============================================================================
 * NIGHTMARE IN PIXEL - JOGO DE TERROR PIXEL ART (FNAF 4 & THE THING)
 * ============================================================================
 * Desenvolvido em HTML5 Canvas, CSS e JavaScript puro (Sem bibliotecas externas).
 * 
 * DIRETRIZES DO PROJETO:
 * - Estética Pixel Art de terror limpa (SEM ruído, SEM scanlines, SEM estática).
 * - A imagem original de The Thing (assets/the-thing.jpg) é preservada nítida
 *   e contrastante como uma figura estranha que invadiu o mundo pixelizado.
 * - Mecânica de Five Nights at Freddy's 4:
 *     - Porta Esquerda (Nightmare Bonnie)
 *     - Porta Direita (Nightmare Chica)
 *     - Cama (Freddles & Nightmare Freddy)
 *     - Armário (Nightmare Foxy)
 *     - Quarto / Roupa Springlock (Springtrap)
 * - Evento Secreto The Thing (20% de chance, QTE de 5 teclas, frase icônica).
 * - Roupa Springlock quando animatrônico entra na sala (Contador de 20s).
 * - Áudio sintetizado proceduralmente em tempo real com Web Audio API.
 * ============================================================================
 */

/* ============================================================================
 * CONFIGURAÇÃO DO JOGO - PARÂMETROS EDITÁVEIS
 * ============================================================================ */
const CONFIG = {
  // Duração de cada hora da noite em segundos (Total = 6 horas: 12 AM até 6 AM)
  // Altere para valores menores (ex: 15) para testes rápidos ou 45-60 para jogo completo.
  HOUR_DURATION_SECONDS: 35,

  // Chance de The Thing aparecer durante a noite (0.20 = 20%)
  THE_THING_CHANCE: 0.20,

  // Tempo máximo para resolver a sequência de teclas do The Thing (segundos)
  THE_THING_TIME_LIMIT: 9.0,

  // Quantidade de teclas na sequência do The Thing
  THE_THING_KEY_COUNT: 5,

  // Teclas possíveis sorteadas para o QTE do The Thing
  THE_THING_AVAILABLE_KEYS: ['W', 'A', 'S', 'D', 'Q', 'E', 'SPACE'],

  // Tempo máximo dentro da roupa Springlock antes da falha fatal (segundos)
  SPRINGLOCK_TIMER: 20,

  // Tempo que o animatrônico fica procurando no quarto durante o Springlock (segundos)
  SPRINGLOCK_SEARCH_DURATION_MIN: 7,
  SPRINGLOCK_SEARCH_DURATION_MAX: 13,

  // Multiplicador de velocidade geral da IA dos animatrônicos
  ANIMATRONIC_SPEED: 1.0,

  // Níveis de agressividade da IA por hora (12 AM, 1 AM, 2 AM, 3 AM, 4 AM, 5 AM)
  // Ordem: [Bonnie, Chica, Freddy, Foxy, Springtrap]
  AI_HOURLY_LEVELS: [
    [1, 1, 1, 0, 1], // 12 AM
    [2, 2, 2, 1, 2], // 1 AM
    [3, 3, 3, 2, 3], // 2 AM
    [4, 4, 4, 3, 4], // 3 AM
    [6, 5, 5, 4, 5], // 4 AM
    [8, 7, 7, 6, 7]  // 5 AM
  ]
};

/* ============================================================================
 * GERENCIADOR DE ÁUDIO PROCEDURAL (WEB AUDIO API)
 * ============================================================================ */
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.ambientGain = null;
    this.ambientOsc = null;
    this.isMuted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.startAmbientDrone();
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  startAmbientDrone() {
    if (!this.ctx || this.ambientOsc) return;

    try {
      this.ambientOsc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      this.ambientGain = this.ctx.createGain();

      this.ambientOsc.type = 'sawtooth';
      this.ambientOsc.frequency.setValueAtTime(42, this.ctx.currentTime); // Tom grave e tenso

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(110, this.ctx.currentTime);

      this.ambientGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

      this.ambientOsc.connect(filter);
      filter.connect(this.ambientGain);
      this.ambientGain.connect(this.ctx.destination);
      this.ambientOsc.start();
    } catch (e) {
      console.warn("Áudio não pôde iniciar automaticamente:", e);
    }
  }

  setAmbientVolume(vol, duration = 0.5) {
    if (!this.ambientGain || !this.ctx) return;
    this.ambientGain.gain.linearRampToValueAtTime(Math.max(0, vol), this.ctx.currentTime + duration);
  }

  // Clique mecânico da lanterna
  playFlashlightClick(isOn) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isOn ? 1800 : 1200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.04);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  // Som pesado de porta fechando ou abrindo
  playDoorThud(isClosing) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(isClosing ? 140 : 90, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  // Som de respiração misteriosa no corredor (Panorâmico: esquerda/direita)
  playBreathing(panValue = 0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 1.2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(450, now);
    filter.Q.setValueAtTime(3.0, now);

    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (panner) panner.pan.setValueAtTime(panValue, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.4);
    gain.gain.linearRampToValueAtTime(0.001, now + 1.2);

    noise.connect(filter);
    if (panner) {
      filter.connect(panner);
      panner.connect(gain);
    } else {
      filter.connect(gain);
    }
    gain.connect(this.ctx.destination);

    noise.start(now);
  }

  // Passos pesados e mecânicos de Springtrap
  playHeavyStep() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(70, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.2);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  // Pequenos ruídos dos Freddles fugindo
  playFreddleScatter() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const start = now + i * 0.08;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600 + Math.random() * 400, start);
      osc.frequency.exponentialRampToValueAtTime(150, start + 0.12);

      gain.gain.setValueAtTime(0.08, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(start);
      osc.stop(start + 0.12);
    }
  }

  // Catraca mecânica e batimentos da roupa Springlock
  playSpringlockTick() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.04);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Falha fatal violenta das molas (Springlock Failure)
  playSpringlockFailure() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Estalo de metal rompendo
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.7);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.7);
  }

  // Som de tecla correta no QTE do The Thing
  playKeySuccess() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Som de tecla errada no QTE do The Thing
  playKeyError() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.linearRampToValueAtTime(90, now + 0.2);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  // Jumpscare estridente e assustador
  playJumpscareScreech() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(120, now);
    osc1.frequency.linearRampToValueAtTime(750, now + 0.2);
    osc1.frequency.linearRampToValueAtTime(300, now + 1.2);

    osc2.type = 'square';
    osc2.frequency.setValueAtTime(280, now);
    osc2.frequency.linearRampToValueAtTime(620, now + 0.3);
    osc2.frequency.linearRampToValueAtTime(180, now + 1.2);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 1.4);
    osc2.stop(now + 1.4);
  }

  // Sino de vitória das 6:00 AM
  playWinChime() {
    if (!this.ctx) return;
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25];
    const now = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const start = now + idx * 0.25;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.25, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.9);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(start);
      osc.stop(start + 0.9);
    });
  }
}

/* ============================================================================
 * MOTOR GRÁFICO PIXEL ART (RENDERIZADOR NO CANVAS)
 * ============================================================================ */
class PixelRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    
    // Desativa suavização para garantir visual 100% pixel art nítido
    this.ctx.imageSmoothingEnabled = false;
  }

  clear() {
    this.ctx.fillStyle = '#050407';
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  // Renderiza a sala dependendo do ponto de vista do jogador
  renderView(view, state) {
    this.clear();

    switch (view) {
      case 'CENTER':
        this.drawCenterRoom(state);
        break;
      case 'LEFT_DOOR':
        this.drawLeftDoorway(state);
        break;
      case 'RIGHT_DOOR':
        this.drawRightDoorway(state);
        break;
      case 'BED':
        this.drawBedView(state);
        break;
      case 'CLOSET':
        this.drawClosetView(state);
        break;
      case 'SPRINGLOCK':
        this.drawSpringlockInside(state);
        break;
    }

    // Aplica iluminação pixelizada ou escuridão
    this.applyLighting(view, state);
  }

  // Vista Central do Quarto
  drawCenterRoom(state) {
    const ctx = this.ctx;
    
    // Parede de fundo com papel de parede listrado retrô
    for (let x = 0; x < this.width; x += 16) {
      ctx.fillStyle = (x % 32 === 0) ? '#1c1524' : '#140f1a';
      ctx.fillRect(x, 0, 16, 230);
    }

    // Rodapé
    ctx.fillStyle = '#2b1b14';
    ctx.fillRect(0, 226, this.width, 10);
    ctx.fillStyle = '#1a0e08';
    ctx.fillRect(0, 234, this.width, 2);

    // Chão de tábuas de madeira pixel art
    for (let y = 236; y < this.height; y += 18) {
      ctx.fillStyle = (Math.floor(y / 18) % 2 === 0) ? '#281a13' : '#1f130c';
      ctx.fillRect(0, y, this.width, 18);
      // Linhas das tábuas
      ctx.fillStyle = '#110a06';
      ctx.fillRect(0, y + 17, this.width, 1);
    }

    // Porta Esquerda (Entrada no quarto)
    ctx.fillStyle = '#0d0912';
    ctx.fillRect(20, 50, 90, 180);
    ctx.strokeStyle = '#38251b';
    ctx.lineWidth = 6;
    ctx.strokeRect(18, 48, 94, 184);

    // Porta Direita (Entrada no quarto)
    ctx.fillStyle = '#0d0912';
    ctx.fillRect(this.width - 110, 50, 90, 180);
    ctx.strokeStyle = '#38251b';
    ctx.lineWidth = 6;
    ctx.strokeRect(this.width - 112, 48, 94, 184);

    // Armário Central
    ctx.fillStyle = '#3a2215';
    ctx.fillRect(230, 40, 180, 196);
    ctx.fillStyle = '#24130a';
    ctx.fillRect(236, 46, 82, 184);
    ctx.fillRect(322, 46, 82, 184);
    
    // Frestas do armário
    ctx.fillStyle = '#090503';
    for (let y = 60; y < 220; y += 12) {
      ctx.fillRect(246, y, 62, 4);
      ctx.fillRect(332, y, 62, 4);
    }
    // Puxadores do armário
    ctx.fillStyle = '#c9a038';
    ctx.fillRect(312, 130, 4, 12);
    ctx.fillRect(324, 130, 4, 12);

    // Relógio Digital Retrô na parede esquerda
    ctx.fillStyle = '#111';
    ctx.fillRect(140, 40, 60, 28);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.strokeRect(140, 40, 60, 28);
    ctx.fillStyle = '#e53e3e';
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillText(state.hourText, 146, 58);

    // Mesa de cabeceira com abajur
    ctx.fillStyle = '#3a2215';
    ctx.fillRect(435, 160, 60, 76);
    // Base do abajur
    ctx.fillStyle = '#7a7a85';
    ctx.fillRect(460, 135, 10, 25);
    // Cúpula do abajur
    ctx.fillStyle = '#a68b56';
    ctx.beginPath();
    ctx.moveTo(450, 135);
    ctx.lineTo(480, 135);
    ctx.lineTo(475, 115);
    ctx.lineTo(455, 115);
    ctx.closePath();
    ctx.fill();

    // Pequeno ventilador na mesa (girando em pixel art)
    const fanPhase = Math.floor(Date.now() / 80) % 4;
    ctx.fillStyle = '#222';
    ctx.fillRect(440, 145, 14, 15);
    ctx.fillStyle = '#667';
    if (fanPhase === 0) {
      ctx.fillRect(442, 148, 10, 2);
    } else if (fanPhase === 1) {
      ctx.fillRect(446, 144, 2, 10);
    } else if (fanPhase === 2) {
      ctx.fillRect(442, 152, 10, 2);
    } else {
      ctx.fillRect(444, 146, 6, 6);
    }
  }

  // Vista da Porta Esquerda (Corredor)
  drawLeftDoorway(state) {
    const ctx = this.ctx;

    // Corredor escuro em perspectiva
    ctx.fillStyle = '#0a080d';
    ctx.fillRect(0, 0, this.width, this.height);

    // Paredes do corredor convergindo
    ctx.fillStyle = '#18121f';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(180, 80);
    ctx.lineTo(180, 280);
    ctx.lineTo(0, this.height);
    ctx.closePath();
    ctx.fill();

    // Piso do corredor
    ctx.fillStyle = '#150f0c';
    ctx.beginPath();
    ctx.moveTo(0, this.height);
    ctx.lineTo(180, 280);
    ctx.lineTo(460, 280);
    ctx.lineTo(this.width, this.height);
    ctx.closePath();
    ctx.fill();

    // Se a porta estiver FECHADA pelo jogador:
    if (state.leftDoorClosed) {
      ctx.fillStyle = '#3a2417';
      ctx.fillRect(110, 20, 420, 320);
      ctx.strokeStyle = '#1d120a';
      ctx.lineWidth = 10;
      ctx.strokeRect(110, 20, 420, 320);
      // Painéis e tranca da porta
      ctx.fillStyle = '#26170d';
      ctx.fillRect(140, 50, 160, 110);
      ctx.fillRect(340, 50, 160, 110);
      ctx.fillRect(140, 190, 160, 120);
      ctx.fillRect(340, 190, 160, 120);
      ctx.fillStyle = '#9b8036';
      ctx.fillRect(125, 175, 12, 18);
      return;
    }

    // Se Bonnie estiver no corredor e a lanterna estiver LIGADA:
    if (state.flashlightOn && state.bonnieDistance <= 1) {
      this.drawNightmareBonnie(state.bonnieDistance);
    }
  }

  // Vista da Porta Direita (Corredor)
  drawRightDoorway(state) {
    const ctx = this.ctx;

    ctx.fillStyle = '#0a080d';
    ctx.fillRect(0, 0, this.width, this.height);

    // Parede direita em perspectiva
    ctx.fillStyle = '#18121f';
    ctx.beginPath();
    ctx.moveTo(this.width, 0);
    ctx.lineTo(460, 80);
    ctx.lineTo(460, 280);
    ctx.lineTo(this.width, this.height);
    ctx.closePath();
    ctx.fill();

    // Piso do corredor
    ctx.fillStyle = '#150f0c';
    ctx.beginPath();
    ctx.moveTo(0, this.height);
    ctx.lineTo(180, 280);
    ctx.lineTo(460, 280);
    ctx.lineTo(this.width, this.height);
    ctx.closePath();
    ctx.fill();

    // Se a porta estiver FECHADA pelo jogador:
    if (state.rightDoorClosed) {
      ctx.fillStyle = '#3a2417';
      ctx.fillRect(110, 20, 420, 320);
      ctx.strokeStyle = '#1d120a';
      ctx.lineWidth = 10;
      ctx.strokeRect(110, 20, 420, 320);
      ctx.fillStyle = '#26170d';
      ctx.fillRect(140, 50, 160, 110);
      ctx.fillRect(340, 50, 160, 110);
      ctx.fillRect(140, 190, 160, 120);
      ctx.fillRect(340, 190, 160, 120);
      ctx.fillStyle = '#9b8036';
      ctx.fillRect(505, 175, 12, 18);
      return;
    }

    // Se Chica estiver no corredor e lanterna LIGADA:
    if (state.flashlightOn && state.chicaDistance <= 1) {
      this.drawNightmareChica(state.chicaDistance);
    }
  }

  // Vista da Cama (Olhando para trás)
  drawBedView(state) {
    const ctx = this.ctx;

    // Parede de trás
    ctx.fillStyle = '#140f1c';
    ctx.fillRect(0, 0, this.width, 210);

    // Piso
    ctx.fillStyle = '#1d120a';
    ctx.fillRect(0, 210, this.width, 150);

    // Cabeceira da cama de madeira
    ctx.fillStyle = '#42281a';
    ctx.fillRect(140, 80, 360, 140);
    ctx.strokeStyle = '#22140c';
    ctx.lineWidth = 6;
    ctx.strokeRect(140, 80, 360, 140);

    // Colchão e edredom amarrotado
    ctx.fillStyle = '#4a5363';
    ctx.fillRect(120, 190, 400, 150);
    ctx.fillStyle = '#333b49';
    // Dobras dos lençóis em pixel art
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(150 + i * 50, 220 + (i % 2) * 15, 40, 8);
    }

    // Travesseiros
    ctx.fillStyle = '#cfd6e0';
    ctx.fillRect(170, 155, 130, 45);
    ctx.fillRect(340, 155, 130, 45);
    ctx.fillStyle = '#9aa5b5';
    ctx.fillRect(175, 190, 120, 8);
    ctx.fillRect(345, 190, 120, 8);

    // Desenha Freddles na cama
    if (state.freddlesCount > 0) {
      const positions = [
        { x: 210, y: 175 },
        { x: 320, y: 185 },
        { x: 420, y: 175 }
      ];

      for (let i = 0; i < Math.min(state.freddlesCount, 3); i++) {
        this.drawSingleFreddle(positions[i].x, positions[i].y);
      }
    }
  }

  // Vista do Armário
  drawClosetView(state) {
    const ctx = this.ctx;

    // Fundo do quarto próximo ao armário
    ctx.fillStyle = '#16101c';
    ctx.fillRect(0, 0, this.width, this.height);

    // Moldura do armário em close-up
    ctx.fillStyle = '#3d2518';
    ctx.fillRect(120, 20, 400, 340);
    ctx.strokeStyle = '#20120a';
    ctx.lineWidth = 8;
    ctx.strokeRect(120, 20, 400, 340);

    // Se o armário estiver fechado pelo jogador:
    if (state.closetDoorClosed) {
      ctx.fillStyle = '#2c190f';
      ctx.fillRect(130, 30, 185, 320);
      ctx.fillRect(325, 30, 185, 320);
      ctx.fillStyle = '#140b06';
      // Ranhuras
      for (let y = 60; y < 320; y += 16) {
        ctx.fillRect(145, y, 155, 6);
        ctx.fillRect(340, y, 155, 6);
      }
      ctx.fillStyle = '#c9a038';
      ctx.fillRect(305, 180, 8, 20);
      ctx.fillRect(327, 180, 8, 20);
      return;
    }

    // Interior escuro do armário
    ctx.fillStyle = '#060408';
    ctx.fillRect(130, 30, 380, 320);

    // Estágios de Nightmare Foxy dentro do armário:
    if (state.foxyStage === 0) {
      // Estágio 0: Pelúcia inofensiva de Foxy no centro
      this.drawFoxyPlushie(320, 230);
    } else if (state.foxyStage === 1) {
      // Estágio 1: Olhos laranjas brilhando na escuridão
      this.drawGlowingEyes(320, 150, '#ff9900');
    } else if (state.foxyStage >= 2) {
      // Estágio 2+: Nightmare Foxy com mandíbula metálica feroz
      this.drawNightmareFoxyHead(320, 160);
    }
  }

  // Vista dentro da Roupa Springlock
  drawSpringlockInside(state) {
    const ctx = this.ctx;

    // Fundo do quarto visto pelas frestas
    this.drawCenterRoom(state);

    // Se Springtrap estiver no quarto procurando pelo jogador:
    if (state.springtrapSearching) {
      this.drawSpringtrapInRoom(state.springtrapX);
    }
  }

  // Desenho Pixel Art de Nightmare Bonnie
  drawNightmareBonnie(distance) {
    const ctx = this.ctx;
    const scale = distance === 0 ? 1.5 : 1.0;
    const cx = 280;
    const cy = 180;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // Orelhas de coelho rasgadas
    ctx.fillStyle = '#39365c';
    ctx.fillRect(-45, -130, 18, 55);
    ctx.fillRect(25, -135, 18, 60);
    // Partes internas da orelha expostas (endosqueleto)
    ctx.fillStyle = '#7a7a94';
    ctx.fillRect(-40, -110, 8, 30);
    ctx.fillRect(30, -115, 8, 35);

    // Cabeça
    ctx.fillStyle = '#44416e';
    ctx.fillRect(-50, -80, 100, 80);

    // Focinho
    ctx.fillStyle = '#59558c';
    ctx.fillRect(-35, -35, 70, 35);

    // Nariz preto
    ctx.fillStyle = '#111';
    ctx.fillRect(-8, -32, 16, 10);

    // Olhos aterrorizantes de Nightmare Bonnie (Fundo preto, íris roxa/magenta brilhante)
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(-35, -65, 25, 20);
    ctx.fillRect(10, -65, 25, 20);

    ctx.fillStyle = '#ff0055';
    ctx.fillRect(-26, -58, 8, 8);
    ctx.fillRect(18, -58, 8, 8);

    ctx.fillStyle = '#fff';
    ctx.fillRect(-24, -56, 3, 3);
    ctx.fillRect(20, -56, 3, 3);

    // Dentes de agulha afiados (dupla fileira aterrorizante)
    ctx.fillStyle = '#e2e8f0';
    for (let x = -30; x <= 26; x += 7) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 3, 10);
      ctx.lineTo(x + 6, 0);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(x, -6);
      ctx.lineTo(x + 3, -16);
      ctx.lineTo(x + 6, -6);
      ctx.fill();
    }

    // Gravata borboleta vermelha rasgada
    ctx.fillStyle = '#a81313';
    ctx.fillRect(-15, 18, 30, 14);

    ctx.restore();
  }

  // Desenho Pixel Art de Nightmare Chica
  drawNightmareChica(distance) {
    const ctx = this.ctx;
    const scale = distance === 0 ? 1.5 : 1.0;
    const cx = 360;
    const cy = 180;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // Cabeça amarela/mostarda de galinha
    ctx.fillStyle = '#b8860b';
    ctx.fillRect(-50, -80, 100, 80);

    // Tufos de penas no topo
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(-15, -100, 10, 22);
    ctx.fillRect(5, -105, 10, 27);

    // Olhos arregalados ameaçadores
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(-38, -65, 26, 22);
    ctx.fillRect(12, -65, 26, 22);

    ctx.fillStyle = '#ff4400';
    ctx.fillRect(-28, -58, 9, 9);
    ctx.fillRect(20, -58, 9, 9);

    ctx.fillStyle = '#ffff66';
    ctx.fillRect(-26, -56, 4, 4);
    ctx.fillRect(22, -56, 4, 4);

    // Bico monstruoso escancarado
    ctx.fillStyle = '#d97706';
    ctx.fillRect(-45, -30, 90, 28);

    // Múltiplas fileiras de dentes afiados de metal
    ctx.fillStyle = '#f7fafc';
    for (let x = -38; x <= 32; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, -2);
      ctx.lineTo(x + 4, 12);
      ctx.lineTo(x + 8, -2);
      ctx.fill();
    }

    // Nightmare Cupcake no ombro de Chica!
    ctx.fillStyle = '#78350f';
    ctx.fillRect(45, 10, 32, 22);
    ctx.fillStyle = '#ec4899';
    ctx.fillRect(43, -10, 36, 22);
    // Olhos do cupcake
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(48, -4, 6, 6);
    ctx.fillRect(66, -4, 6, 6);
    // Vela do cupcake
    ctx.fillStyle = '#cbd5e0';
    ctx.fillRect(58, -22, 5, 12);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(57, -29, 7, 7);

    ctx.restore();
  }

  // Mini Freddles na cama
  drawSingleFreddle(x, y) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);

    // Cartola mini
    ctx.fillStyle = '#111';
    ctx.fillRect(-8, -32, 16, 12);
    ctx.fillRect(-12, -20, 24, 4);

    // Cabeça
    ctx.fillStyle = '#5c3a21';
    ctx.fillRect(-18, -18, 36, 30);

    // Orelhas de urso
    ctx.fillRect(-22, -28, 10, 10);
    ctx.fillRect(12, -28, 10, 10);

    // Olhos prateados brilhantes
    ctx.fillStyle = '#fff';
    ctx.fillRect(-12, -12, 6, 6);
    ctx.fillRect(6, -12, 6, 6);

    // Dentes
    ctx.fillStyle = '#f7fafc';
    for (let dx = -10; dx <= 6; dx += 4) {
      ctx.fillRect(dx, 4, 3, 5);
    }

    // Garras
    ctx.fillStyle = '#718096';
    ctx.fillRect(-22, 14, 5, 8);
    ctx.fillRect(17, 14, 5, 8);

    ctx.restore();
  }

  // Pelúcia de Foxy (Estágio 0 do armário)
  drawFoxyPlushie(x, y) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);

    // Cabeça de pelúcia
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(-20, -35, 40, 35);
    // Orelhas pontudas
    ctx.fillRect(-26, -48, 12, 16);
    ctx.fillRect(14, -48, 12, 16);
    // Tapa-olho
    ctx.fillStyle = '#111';
    ctx.fillRect(-14, -26, 12, 12);
    // Olho botão dourado
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(4, -26, 10, 10);
    // Focinho
    ctx.fillStyle = '#e28743';
    ctx.fillRect(-12, -14, 24, 14);
    // Corpo
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(-16, 0, 32, 35);
    // Gancho fofo de feltro
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-24, 12, 8, 14);

    ctx.restore();
  }

  // Olhos brilhando na escuridão
  drawGlowingEyes(x, y, color) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.fillRect(x - 30, y, 14, 8);
    ctx.fillRect(x + 16, y, 14, 8);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 26, y + 2, 6, 4);
    ctx.fillRect(x + 20, y + 2, 6, 4);
  }

  // Cabeça de Nightmare Foxy no armário
  drawNightmareFoxyHead(x, y) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);

    // Orelhas longas com fios expostos
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(-45, -95, 20, 45);
    ctx.fillRect(25, -95, 20, 45);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-40, -85, 8, 25);
    ctx.fillRect(30, -85, 8, 25);

    // Cabeça angular
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(-55, -60, 110, 75);

    // Olhos
    ctx.fillStyle = '#000';
    ctx.fillRect(-40, -45, 26, 20);
    ctx.fillRect(14, -45, 26, 20);

    // Tapa-olho levantado revelando endosqueleto
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(20, -40, 12, 12);
    ctx.fillStyle = '#fff';
    ctx.fillRect(23, -37, 5, 5);

    // Focinho comprido com dentes pontiagudos
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(-35, -15, 70, 45);

    ctx.fillStyle = '#f8fafc';
    for (let dx = -30; dx <= 24; dx += 9) {
      ctx.beginPath();
      ctx.moveTo(dx, 0);
      ctx.lineTo(dx + 4, 16);
      ctx.lineTo(dx + 8, 0);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(dx, 30);
      ctx.lineTo(dx + 4, 16);
      ctx.lineTo(dx + 8, 30);
      ctx.fill();
    }

    ctx.restore();
  }

  // Springtrap patrulhando o quarto (visível através do visor da roupa)
  drawSpringtrapInRoom(xPos) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(xPos, 130);

    // Orelha direita quebrada pela metade
    ctx.fillStyle = '#4d5320';
    ctx.fillRect(-25, -75, 12, 35);
    ctx.fillStyle = '#854d0e';
    ctx.fillRect(15, -55, 12, 16); // Orelha cotoco quebrada
    // Fios saindo
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(18, -62, 2, 7);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(22, -60, 2, 6);

    // Cabeça apodrecida esverdeada
    ctx.fillStyle = '#596128';
    ctx.fillRect(-32, -45, 64, 52);

    // Olhos humanos assustadores dentro da máscara
    ctx.fillStyle = '#111';
    ctx.fillRect(-22, -32, 16, 16);
    ctx.fillRect(6, -32, 16, 16);

    ctx.fillStyle = '#fef08a';
    ctx.fillRect(-17, -27, 8, 8);
    ctx.fillRect(11, -27, 8, 8);
    ctx.fillStyle = '#000';
    ctx.fillRect(-15, -25, 4, 4);
    ctx.fillRect(13, -25, 4, 4);

    // Mandíbula e sorriso macabro com dentes quadrados apodrecidos
    ctx.fillStyle = '#3f451b';
    ctx.fillRect(-26, -5, 52, 24);
    ctx.fillStyle = '#fef3c7';
    for (let dx = -20; dx <= 16; dx += 8) {
      ctx.fillRect(dx, 0, 6, 6);
      ctx.fillRect(dx, 10, 6, 6);
    }

    // Corpo decrépito
    ctx.fillStyle = '#4c5321';
    ctx.fillRect(-28, 22, 56, 75);

    // Fenda no peito revelando órgãos/endosqueleto
    ctx.fillStyle = '#1f130a';
    ctx.fillRect(-10, 36, 20, 35);
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(-6, 42, 12, 24);

    // Pernas mecânicas
    ctx.fillStyle = '#373c17';
    ctx.fillRect(-22, 97, 14, 40);
    ctx.fillRect(8, 97, 14, 40);

    ctx.restore();
  }

  // Aplicação da iluminação e escuridão pixelizada
  applyLighting(view, state) {
    const ctx = this.ctx;

    // Se a lanterna estiver desligada, o ambiente fica predominantemente escuro
    if (!state.flashlightOn) {
      ctx.fillStyle = 'rgba(2, 2, 4, 0.88)';
      ctx.fillRect(0, 0, this.width, this.height);
      return;
    }

    // Lanterna ligada: Cone de luz no centro da visão
    const grad = ctx.createRadialGradient(
      this.width / 2, this.height / 2, 40,
      this.width / 2, this.height / 2, 280
    );
    grad.addColorStop(0, 'rgba(255, 250, 220, 0.08)');
    grad.addColorStop(0.5, 'rgba(10, 10, 15, 0.45)');
    grad.addColorStop(1, 'rgba(2, 2, 4, 0.94)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);
  }
}

/* ============================================================================
 * CONTROLADOR PRINCIPAL DO JOGO (GAME ENGINE)
 * ============================================================================ */
class NightmareGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.renderer = new PixelRenderer(this.canvas);
    this.sound = new SoundEngine();

    // Elementos do DOM
    this.hud = document.getElementById('game-hud');
    this.hudTime = document.getElementById('hud-time');
    this.hudNight = document.getElementById('hud-night');
    this.hudRoomName = document.getElementById('hud-room-name');
    this.hudStatus = document.getElementById('hud-status');

    this.alertBanner = document.getElementById('inside-alert-banner');
    this.btnEnterSpringlock = document.getElementById('btn-enter-springlock');
    this.btnExitSpringlock = document.getElementById('btn-exit-springlock');
    this.springlockHud = document.getElementById('springlock-hud');
    this.springlockCountdown = document.getElementById('springlock-countdown');
    this.springlockMsg = document.getElementById('springlock-msg');

    this.theThingOverlay = document.getElementById('the-thing-overlay');
    this.theThingFigureWrap = document.getElementById('the-thing-figure-wrap');
    this.theThingSequenceEl = document.getElementById('the-thing-sequence');
    this.theThingTimerFill = document.getElementById('the-thing-timer-fill');

    this.screenMenu = document.getElementById('screen-menu');
    this.screenGameOver = document.getElementById('screen-gameover');
    this.screenWin = document.getElementById('screen-win');
    this.gameoverReason = document.getElementById('gameover-reason');
    this.gameoverTime = document.getElementById('gameover-time-survived');

    this.eventToast = document.getElementById('event-toast');
    this.eventToastText = document.getElementById('event-toast-text');
    this.mobileControls = document.getElementById('mobile-controls');

    // Botões de ação
    this.touchBtnLight = document.getElementById('touch-btn-light');
    this.touchBtnDoor = document.getElementById('touch-btn-door');

    // Estado da Noite
    this.currentNight = 1;
    this.currentHour = 0; // 0 = 12 AM, 1 = 1 AM, ..., 6 = 6 AM (Vitória)
    this.hourProgress = 0;
    this.isNightActive = false;
    this.gameLoopInterval = null;

    // Estado do Jogador
    this.currentView = 'CENTER'; // 'CENTER', 'LEFT_DOOR', 'RIGHT_DOOR', 'BED', 'CLOSET', 'SPRINGLOCK'
    this.flashlightOn = false;
    this.leftDoorClosed = false;
    this.rightDoorClosed = false;
    this.closetDoorClosed = false;

    // Estado dos Animatrônicos
    // Distâncias: 3 (longe), 2 (corredor), 1 (na porta), 0 (entrando / jumpscare)
    this.bonnieDistance = 3;
    this.chicaDistance = 3;
    this.freddlesCount = 0;
    this.freddlesTimer = 0;
    this.foxyStage = 0; // 0 = Pelúcia, 1 = Olhos, 2 = Cabeça, 3 = Jumpscare
    this.foxyTimer = 0;

    // Springtrap & Roupa Springlock
    this.springtrapInRoom = false;
    this.inSpringlockSuit = false;
    this.springlockTimer = CONFIG.SPRINGLOCK_TIMER;
    this.springtrapSearchTimer = 0;
    this.springtrapSafeToExit = false;
    this.springtrapX = 180;

    // Evento Secreto: The Thing
    this.theThingScheduledHour = -1;
    this.theThingActive = false;
    this.theThingSequence = [];
    this.theThingCurrentIndex = 0;
    this.theThingTimeRemaining = CONFIG.THE_THING_TIME_LIMIT;
    this.theThingZoom = 0.85;

    this.setupEventListeners();
  }

  // Configuração dos controles de teclado, toque e cliques
  setupEventListeners() {
    // Menu inicial
    document.getElementById('btn-start-game').addEventListener('click', () => {
      this.sound.init();
      this.startNight(1);
    });

    document.getElementById('btn-test-thing').addEventListener('click', () => {
      this.sound.init();
      this.startNight(1);
      // Força a ativação imediata do The Thing para teste
      setTimeout(() => this.triggerTheThingEvent(), 1200);
    });

    document.getElementById('btn-restart').addEventListener('click', () => {
      this.startNight(this.currentNight);
    });

    document.getElementById('btn-play-again').addEventListener('click', () => {
      this.startNight(1);
    });

    // Springlock Buttons
    this.btnEnterSpringlock.addEventListener('click', () => this.enterSpringlockSuit());
    this.btnExitSpringlock.addEventListener('click', () => this.exitSpringlockSuit());

    // Teclado
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));

    // Controles Touch de Navegação
    document.getElementById('touch-btn-left').addEventListener('click', () => this.switchView('LEFT_DOOR'));
    document.getElementById('touch-btn-right').addEventListener('click', () => this.switchView('RIGHT_DOOR'));
    document.getElementById('touch-btn-bed').addEventListener('click', () => this.switchView('BED'));
    document.getElementById('touch-btn-closet').addEventListener('click', () => this.switchView('CLOSET'));
    document.getElementById('touch-btn-center').addEventListener('click', () => this.switchView('CENTER'));

    // Botão Touch Lanterna (Hold / Click)
    this.touchBtnLight.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.setFlashlight(true);
      this.touchBtnLight.classList.add('active');
    });
    window.addEventListener('pointerup', () => {
      if (this.flashlightOn && !this.theThingActive) {
        this.setFlashlight(false);
        this.touchBtnLight.classList.remove('active');
      }
    });

    // Botão Touch Fechar Porta (Hold)
    this.touchBtnDoor.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.setDoorClosed(true);
      this.touchBtnDoor.classList.add('active');
    });
    window.addEventListener('pointerup', () => {
      this.setDoorClosed(false);
      this.touchBtnDoor.classList.remove('active');
    });

    // Botões Virtuais do The Thing para Mobile
    document.querySelectorAll('.qte-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-key');
        this.handleQTEInput(key);
      });
    });
  }

  // Início da Noite
  startNight(nightNumber) {
    this.currentNight = nightNumber;
    this.currentHour = 0;
    this.hourProgress = 0;
    this.isNightActive = true;

    // Reseta estado do jogador
    this.currentView = 'CENTER';
    this.flashlightOn = false;
    this.leftDoorClosed = false;
    this.rightDoorClosed = false;
    this.closetDoorClosed = false;

    // Reseta animatrônicos
    this.bonnieDistance = 3;
    this.chicaDistance = 3;
    this.freddlesCount = 0;
    this.freddlesTimer = 0;
    this.foxyStage = 0;
    this.foxyTimer = 0;

    // Reseta Springtrap & Springlock
    this.springtrapInRoom = false;
    this.inSpringlockSuit = false;
    this.springlockTimer = CONFIG.SPRINGLOCK_TIMER;
    this.springtrapSafeToExit = false;

    // Agendamento do evento The Thing (20% de chance uma vez por noite)
    if (Math.random() < CONFIG.THE_THING_CHANCE) {
      // Sorteia uma hora entre 1 AM e 4 AM
      this.theThingScheduledHour = Math.floor(Math.random() * 4) + 1;
    } else {
      this.theThingScheduledHour = -1;
    }
    this.theThingActive = false;

    // Oculta telas de menu/gameover
    this.screenMenu.classList.add('hidden');
    this.screenGameOver.classList.add('hidden');
    this.screenWin.classList.add('hidden');
    this.theThingOverlay.classList.add('hidden');
    this.springlockHud.classList.add('hidden');
    this.alertBanner.classList.add('hidden');

    this.hud.classList.remove('hidden');
    this.mobileControls.classList.remove('hidden');

    this.sound.setAmbientVolume(0.04);
    this.updateHUD();

    if (this.gameLoopInterval) clearInterval(this.gameLoopInterval);
    this.lastTime = performance.now();
    this.gameLoopInterval = setInterval(() => this.update(), 50); // Loop de 20 ticks por segundo
  }

  // Ciclo de atualização principal (Game Loop)
  update() {
    if (!this.isNightActive) return;

    const dt = 0.05; // 50ms = 0.05 segundos

    // Se o evento The Thing estiver ativo, congela o restante do jogo e atualiza apenas o QTE
    if (this.theThingActive) {
      this.updateTheThing(dt);
      this.render();
      return;
    }

    // Se o jogador estiver na roupa Springlock, processa a sobrevivência
    if (this.inSpringlockSuit) {
      this.updateSpringlock(dt);
      this.render();
      return;
    }

    // Atualização do Relógio da Noite
    this.hourProgress += dt;
    if (this.hourProgress >= CONFIG.HOUR_DURATION_SECONDS) {
      this.hourProgress = 0;
      this.currentHour++;

      if (this.currentHour >= 6) {
        this.triggerWin();
        return;
      }

      // Verifica se o The Thing deve aparecer nesta hora
      if (this.currentHour === this.theThingScheduledHour) {
        this.theThingScheduledHour = -1;
        this.triggerTheThingEvent();
        return;
      }

      this.updateHUD();
    }

    // Atualização da IA dos animatrônicos
    this.updateAnimatronics(dt);

    // Renderiza a cena atual
    this.render();
  }

  // Atualização da IA dos 5 Animatrônicos
  updateAnimatronics(dt) {
    const hourIdx = Math.min(this.currentHour, 5);
    const [aiBonnie, aiChica, aiFreddy, aiFoxy, aiSpringtrap] = CONFIG.AI_HOURLY_LEVELS[hourIdx];

    // 1. Nightmare Bonnie (Porta Esquerda)
    if (Math.random() < (aiBonnie * 0.015 * CONFIG.ANIMATRONIC_SPEED)) {
      if (!this.leftDoorClosed) {
        if (this.bonnieDistance > 1) {
          this.bonnieDistance--;
          if (this.bonnieDistance === 1) {
            this.sound.playBreathing(-0.8); // Som de respiração na esquerda
          }
        } else if (this.bonnieDistance === 1 && this.currentView !== 'LEFT_DOOR') {
          // Bonnie entrou na sala!
          this.triggerJumpscare('Nightmare Bonnie');
          return;
        }
      } else {
        // Se a porta estiver fechada, Bonnie se afasta
        this.bonnieDistance = 3;
        this.sound.playHeavyStep();
      }
    }

    // 2. Nightmare Chica (Porta Direita)
    if (Math.random() < (aiChica * 0.015 * CONFIG.ANIMATRONIC_SPEED)) {
      if (!this.rightDoorClosed) {
        if (this.chicaDistance > 1) {
          this.chicaDistance--;
          if (this.chicaDistance === 1) {
            this.sound.playBreathing(0.8); // Som de respiração na direita
          }
        } else if (this.chicaDistance === 1 && this.currentView !== 'RIGHT_DOOR') {
          // Chica entrou na sala!
          this.triggerJumpscare('Nightmare Chica');
          return;
        }
      } else {
        this.chicaDistance = 3;
        this.sound.playHeavyStep();
      }
    }

    // 3. Nightmare Freddy (Freddles na cama)
    this.freddlesTimer += dt;
    if (this.freddlesTimer > (7 - aiFreddy * 0.5)) {
      this.freddlesTimer = 0;
      if (this.freddlesCount < 3) {
        this.freddlesCount++;
      } else if (this.freddlesCount >= 3 && this.currentView !== 'BED') {
        // Cama cheia de Freddles por tempo demais!
        this.triggerJumpscare('Nightmare Freddy');
        return;
      }
    }

    // 4. Nightmare Foxy (Armário)
    this.foxyTimer += dt;
    if (this.foxyTimer > (8 - aiFoxy * 0.6)) {
      this.foxyTimer = 0;
      if (!this.closetDoorClosed) {
        if (this.foxyStage < 3) {
          this.foxyStage++;
        } else if (this.foxyStage >= 3 && this.currentView !== 'CLOSET') {
          this.triggerJumpscare('Nightmare Foxy');
          return;
        }
      }
    }

    // 5. Springtrap (Pode invadir o quarto e exigir a roupa Springlock)
    if (Math.random() < (aiSpringtrap * 0.008 * CONFIG.ANIMATRONIC_SPEED) && !this.springtrapInRoom) {
      this.springtrapInRoom = true;
      this.sound.playHeavyStep();
      this.showAlertBanner(true);
    }
  }

  // Transição de visão
  switchView(newView) {
    if (this.inSpringlockSuit || this.theThingActive || !this.isNightActive) return;

    this.currentView = newView;
    this.flashlightOn = false; // Desliga lanterna ao trocar de visão

    // Ações ao olhar para pontos específicos
    if (newView === 'BED' && this.freddlesCount > 0 && this.flashlightOn) {
      this.disperseFreddles();
    }

    if (newView === 'CLOSET' && this.foxyStage > 0 && this.closetDoorClosed) {
      this.foxyStage = 0;
    }

    this.updateHUD();
    this.render();
  }

  // Controle da Lanterna
  setFlashlight(isOn) {
    if (this.inSpringlockSuit || this.theThingActive || !this.isNightActive) return;

    // Se estiver na porta e Bonnie/Chica estiver a distância 1 (respiração), ligar lanterna causa jumpscare imediato!
    if (isOn) {
      if (this.currentView === 'LEFT_DOOR' && this.bonnieDistance === 1 && !this.leftDoorClosed) {
        this.triggerJumpscare('Nightmare Bonnie');
        return;
      }
      if (this.currentView === 'RIGHT_DOOR' && this.chicaDistance === 1 && !this.rightDoorClosed) {
        this.triggerJumpscare('Nightmare Chica');
        return;
      }
    }

    this.flashlightOn = isOn;
    this.sound.playFlashlightClick(isOn);

    // Efeitos da lanterna
    if (isOn && this.currentView === 'BED' && this.freddlesCount > 0) {
      this.disperseFreddles();
    }

    this.updateHUD();
    this.render();
  }

  // Espantar os Freddles da cama
  disperseFreddles() {
    this.freddlesCount = 0;
    this.freddlesTimer = 0;
    this.sound.playFreddleScatter();
  }

  // Controle de Fechamento de Portas / Armário
  setDoorClosed(isClosed) {
    if (this.inSpringlockSuit || this.theThingActive || !this.isNightActive) return;

    if (this.currentView === 'LEFT_DOOR') {
      this.leftDoorClosed = isClosed;
      this.sound.playDoorThud(isClosed);
      if (isClosed && this.bonnieDistance <= 1) {
        // Bonnie bloqueado!
        this.bonnieDistance = 3;
      }
    } else if (this.currentView === 'RIGHT_DOOR') {
      this.rightDoorClosed = isClosed;
      this.sound.playDoorThud(isClosed);
      if (isClosed && this.chicaDistance <= 1) {
        // Chica bloqueada!
        this.chicaDistance = 3;
      }
    } else if (this.currentView === 'CLOSET') {
      this.closetDoorClosed = isClosed;
      this.sound.playDoorThud(isClosed);
      if (isClosed) {
        // Foxy recua para a pelúcia
        this.foxyStage = 0;
      }
    }
    this.render();
  }

  // Mostra ou oculta o alerta de "ANIMATRONIC INSIDE"
  showAlertBanner(show) {
    if (show) {
      this.alertBanner.classList.remove('hidden');
    } else {
      this.alertBanner.classList.add('hidden');
    }
  }

  /* ==========================================================================
   * MECÂNICA DA ROUPA SPRINGLOCK
   * ========================================================================== */
  enterSpringlockSuit() {
    if (!this.springtrapInRoom || this.inSpringlockSuit || this.theThingActive) return;

    this.inSpringlockSuit = true;
    this.currentView = 'SPRINGLOCK';
    this.flashlightOn = false;
    this.springlockTimer = CONFIG.SPRINGLOCK_TIMER;
    this.springtrapSafeToExit = false;
    this.springtrapSearchTimer = CONFIG.SPRINGLOCK_SEARCH_DURATION_MIN + Math.random() * (CONFIG.SPRINGLOCK_SEARCH_DURATION_MAX - CONFIG.SPRINGLOCK_SEARCH_DURATION_MIN);
    this.springtrapX = 140;

    this.showAlertBanner(false);
    this.springlockHud.classList.remove('hidden');
    this.btnExitSpringlock.classList.add('hidden');
    this.springlockMsg.textContent = "PERMANEÇA IMÓVEL...";

    this.sound.playSpringlockTick();
    this.updateHUD();
  }

  updateSpringlock(dt) {
    // Contador da roupa diminui 20 -> 0
    this.springlockTimer -= dt;
    this.springlockCountdown.textContent = Math.ceil(Math.max(0, this.springlockTimer));

    // Som de catraca / tensão a cada segundo
    if (Math.floor(this.springlockTimer) !== Math.floor(this.springlockTimer + dt)) {
      this.sound.playSpringlockTick();
    }

    // Animatrônico patrulhando a sala
    if (this.springtrapSearchTimer > 0) {
      this.springtrapSearchTimer -= dt;
      this.springtrapX += Math.sin(Date.now() / 300) * 1.5;

      if (this.springtrapSearchTimer <= 0) {
        // Animatrônico foi embora! O jogador agora está seguro
        this.springtrapInRoom = false;
        this.springtrapSafeToExit = true;
        this.springlockMsg.textContent = "SAFE! O animatrônico saiu.";
        this.btnExitSpringlock.classList.remove('hidden');
      }
    }

    // Se o contador chegar a 0: SPRINGLOCK FAILURE!
    if (this.springlockTimer <= 0) {
      this.triggerSpringlockFailure();
    }
  }

  exitSpringlockSuit() {
    if (!this.inSpringlockSuit || !this.springtrapSafeToExit) return;

    this.inSpringlockSuit = false;
    this.currentView = 'CENTER';
    this.springlockHud.classList.add('hidden');
    this.btnExitSpringlock.classList.add('hidden');

    this.sound.playDoorThud(false);
    this.showToast("VOCÊ SOBREVIVEU À ROUPA SPRINGLOCK!");
    this.updateHUD();
    this.render();
  }

  triggerSpringlockFailure() {
    this.isNightActive = false;
    this.sound.playSpringlockFailure();

    // Efeito de tela vermelha e blackout
    document.getElementById('game-container').classList.add('shake-heavy');

    setTimeout(() => {
      this.triggerGameOver("SPRINGLOCK FAILURE", "A roupa falhou e as travas de mola se soltaram.");
    }, 900);
  }

  /* ==========================================================================
   * EVENTO SECRETO: THE THING
   * ========================================================================== */
  triggerTheThingEvent() {
    if (this.theThingActive || !this.isNightActive) return;

    this.theThingActive = true;
    this.flashlightOn = false;

    // Pausa o som ambiente e cria silêncio tenso
    this.sound.setAmbientVolume(0, 0.2);

    // Gera sequência aleatória de 5 teclas: W, A, S, D, Q, E, SPACE
    this.theThingSequence = [];
    const pool = CONFIG.THE_THING_AVAILABLE_KEYS;
    for (let i = 0; i < CONFIG.THE_THING_KEY_COUNT; i++) {
      const randomKey = pool[Math.floor(Math.random() * pool.length)];
      this.theThingSequence.push(randomKey);
    }

    this.theThingCurrentIndex = 0;
    this.theThingTimeRemaining = CONFIG.THE_THING_TIME_LIMIT;
    this.theThingZoom = 0.85;

    // Configura o visual da tela
    this.renderTheThingSequence();
    this.theThingFigureWrap.style.transform = `translate(-50%, -50%) scale(${this.theThingZoom})`;
    this.theThingOverlay.classList.remove('hidden');

    // Tremor sutil inicial
    document.getElementById('game-container').classList.add('shake-light');
    setTimeout(() => {
      document.getElementById('game-container').classList.remove('shake-light');
    }, 400);
  }

  renderTheThingSequence() {
    this.theThingSequenceEl.innerHTML = '';
    this.theThingSequence.forEach((key, index) => {
      const box = document.createElement('div');
      box.className = 'qte-key-box';
      box.id = `qte-key-${index}`;
      box.textContent = key === 'SPACE' ? 'ESPAÇO' : key;

      if (index === this.theThingCurrentIndex) {
        box.classList.add('active');
      } else if (index < this.theThingCurrentIndex) {
        box.classList.add('correct');
      }

      this.theThingSequenceEl.appendChild(box);

      if (index < this.theThingSequence.length - 1) {
        const arrow = document.createElement('span');
        arrow.className = 'qte-arrow';
        arrow.textContent = '→';
        this.theThingSequenceEl.appendChild(arrow);
      }
    });
  }

  handleQTEInput(pressedKey) {
    if (!this.theThingActive) return;

    const expectedKey = this.theThingSequence[this.theThingCurrentIndex];

    if (pressedKey.toUpperCase() === expectedKey.toUpperCase()) {
      // Tecla correta!
      this.sound.playKeySuccess();
      const currentBox = document.getElementById(`qte-key-${this.theThingCurrentIndex}`);
      if (currentBox) {
        currentBox.classList.remove('active');
        currentBox.classList.add('correct');
      }

      this.theThingCurrentIndex++;

      if (this.theThingCurrentIndex >= this.theThingSequence.length) {
        // Completou toda a sequência com sucesso!
        this.survivedTheThing();
      } else {
        const nextBox = document.getElementById(`qte-key-${this.theThingCurrentIndex}`);
        if (nextBox) nextBox.classList.add('active');
      }
    } else {
      // Tecla errada! Reinicia a sequência e aproxima The Thing
      this.sound.playKeyError();
      this.theThingCurrentIndex = 0;
      this.renderTheThingSequence();

      // The Thing se aproxima e tela treme
      this.theThingZoom = Math.min(1.4, this.theThingZoom + 0.12);
      this.theThingFigureWrap.style.transform = `translate(-50%, -50%) scale(${this.theThingZoom})`;

      const container = document.getElementById('game-container');
      container.classList.add('shake-light');
      setTimeout(() => container.classList.remove('shake-light'), 300);
    }
  }

  updateTheThing(dt) {
    this.theThingTimeRemaining -= dt;

    // Atualiza barra de progresso do timer
    const pct = Math.max(0, (this.theThingTimeRemaining / CONFIG.THE_THING_TIME_LIMIT) * 100);
    this.theThingTimerFill.style.width = `${pct}%`;

    // Zoom lento e contínuo
    this.theThingZoom += dt * 0.015;
    this.theThingFigureWrap.style.transform = `translate(-50%, -50%) scale(${this.theThingZoom})`;

    // Se o tempo acabar: THE THING FOUND YOU!
    if (this.theThingTimeRemaining <= 0) {
      this.theThingActive = false;
      this.theThingOverlay.classList.add('hidden');
      this.triggerJumpscare('The Thing');
    }
  }

  survivedTheThing() {
    this.theThingActive = false;
    this.sound.playKeySuccess();

    // Feedback na tela
    this.showToast("YOU SURVIVED THE THING");

    // Fade-out do The Thing
    this.theThingOverlay.style.opacity = '0';
    setTimeout(() => {
      this.theThingOverlay.classList.add('hidden');
      this.theThingOverlay.style.opacity = '1';
      this.sound.setAmbientVolume(0.04);
    }, 600);
  }

  showToast(message) {
    this.eventToastText.textContent = message;
    this.eventToast.classList.remove('hidden');
    setTimeout(() => {
      this.eventToast.classList.add('hidden');
    }, 2500);
  }

  /* ==========================================================================
   * ENTRADAS DO TECLADO
   * ========================================================================== */
  handleKeyDown(e) {
    const key = e.key.toUpperCase();

    // Se The Thing estiver ativo, direciona tudo para o QTE
    if (this.theThingActive) {
      let qteKey = key;
      if (e.code === 'Space') qteKey = 'SPACE';
      if (['W', 'A', 'S', 'D', 'Q', 'E', 'SPACE'].includes(qteKey)) {
        e.preventDefault();
        this.handleQTEInput(qteKey);
      }
      return;
    }

    if (!this.isNightActive) return;

    // Controles normais do FNAF 4
    switch (e.code) {
      case 'KeyA': // Olhar para esquerda
        this.switchView('LEFT_DOOR');
        break;
      case 'KeyD': // Olhar para direita
        this.switchView('RIGHT_DOOR');
        break;
      case 'KeyW': // Olhar para a cama
        this.switchView('BED');
        break;
      case 'KeyS': // Olhar para o armário
        this.switchView('CLOSET');
        break;
      case 'KeyE': // Voltar ao centro / Entrar ou Sair da Springlock
        if (this.inSpringlockSuit && this.springtrapSafeToExit) {
          this.exitSpringlockSuit();
        } else if (this.springtrapInRoom && !this.inSpringlockSuit) {
          this.enterSpringlockSuit();
        } else {
          this.switchView('CENTER');
        }
        break;
      case 'Space': // Lanterna
        e.preventDefault();
        if (!e.repeat) this.setFlashlight(true);
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
      case 'KeyC': // Fechar porta ou armário
        e.preventDefault();
        this.setDoorClosed(true);
        break;
    }
  }

  handleKeyUp(e) {
    if (this.theThingActive || !this.isNightActive) return;

    switch (e.code) {
      case 'Space':
        this.setFlashlight(false);
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
      case 'KeyC':
        this.setDoorClosed(false);
        break;
    }
  }

  /* ==========================================================================
   * JUMPSCARE E GAME OVER
   * ========================================================================== */
  triggerJumpscare(attackerName) {
    this.isNightActive = false;
    this.sound.playJumpscareScreech();

    const container = document.getElementById('game-container');
    container.classList.add('shake-heavy');

    setTimeout(() => {
      container.classList.remove('shake-heavy');
      this.triggerGameOver(
        attackerName === 'The Thing' ? "THE THING FOUND YOU" : "GAME OVER",
        `Você foi atacado por ${attackerName}!`
      );
    }, 1200);
  }

  triggerGameOver(title, reason) {
    if (this.gameLoopInterval) clearInterval(this.gameLoopInterval);

    document.getElementById('gameover-title').textContent = title;
    this.gameoverReason.textContent = reason;
    this.gameoverTime.textContent = `SOBREVIVEU ATÉ: ${this.getHourText(this.currentHour)}`;

    this.hud.classList.add('hidden');
    this.mobileControls.classList.add('hidden');
    this.theThingOverlay.classList.add('hidden');
    this.springlockHud.classList.add('hidden');
    this.alertBanner.classList.add('hidden');

    this.screenGameOver.classList.remove('hidden');
  }

  /* ==========================================================================
   * VITÓRIA (6 AM)
   * ========================================================================== */
  triggerWin() {
    this.isNightActive = false;
    if (this.gameLoopInterval) clearInterval(this.gameLoopInterval);

    this.sound.playWinChime();

    this.hud.classList.add('hidden');
    this.mobileControls.classList.add('hidden');
    this.theThingOverlay.classList.add('hidden');
    this.springlockHud.classList.add('hidden');
    this.alertBanner.classList.add('hidden');

    this.screenWin.classList.remove('hidden');
  }

  /* ==========================================================================
   * ATUALIZAÇÃO DO HUD E RENDERIZAÇÃO
   * ========================================================================== */
  getHourText(h) {
    if (h === 0) return '12 AM';
    return `${h} AM`;
  }

  updateHUD() {
    this.hudTime.textContent = this.getHourText(this.currentHour);
    this.hudNight.textContent = `NIGHT: ${this.currentNight}`;

    const viewNames = {
      'CENTER': 'QUARTO PRINCIPAL',
      'LEFT_DOOR': 'PORTA ESQUERDA',
      'RIGHT_DOOR': 'PORTA DIREITA',
      'BED': 'CAMA (ATRÁS)',
      'CLOSET': 'ARMÁRIO',
      'SPRINGLOCK': 'DENTRO DA SPRINGLOCK'
    };
    this.hudRoomName.textContent = viewNames[this.currentView] || '';
    this.hudStatus.textContent = `LUZ: ${this.flashlightOn ? 'LIGADA' : 'DESLIGADA'}`;
  }

  render() {
    const gameState = {
      hourText: this.getHourText(this.currentHour),
      flashlightOn: this.flashlightOn,
      leftDoorClosed: this.leftDoorClosed,
      rightDoorClosed: this.rightDoorClosed,
      closetDoorClosed: this.closetDoorClosed,
      bonnieDistance: this.bonnieDistance,
      chicaDistance: this.chicaDistance,
      freddlesCount: this.freddlesCount,
      foxyStage: this.foxyStage,
      springtrapSearching: this.springtrapInRoom,
      springtrapX: this.springtrapX
    };

    this.renderer.renderView(this.currentView, gameState);
  }
}

// Inicializa o jogo quando a página estiver carregada
window.addEventListener('DOMContentLoaded', () => {
  window.game = new NightmareGame();
});
