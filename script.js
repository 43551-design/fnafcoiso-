/* ============================================================
   ECHOES OF SILENCE — script.js
   Survival horror browser game
   5 nights, camera system, animatronic AI, springlock suit
   ============================================================ */

// ============================================================
// AUDIO MANAGER — Procedural audio via Web Audio API
// ============================================================
class AudioManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.initialized = false;
        this.activeSounds = new Map();
        this.ambientNodes = [];
    }

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.6;
            this.masterGain.connect(this.ctx.destination);
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // Generate noise buffer
    createNoiseBuffer(duration = 1, type = 'white') {
        const sampleRate = this.ctx.sampleRate;
        const length = sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0;
        for (let i = 0; i < length; i++) {
            const white = Math.random() * 2 - 1;
            if (type === 'brown') {
                lastOut = (lastOut + (0.02 * white)) / 1.02;
                data[i] = lastOut * 3.5;
            } else if (type === 'pink') {
                data[i] = white * 0.5 * (1 - i / length);
            } else {
                data[i] = white;
            }
        }
        return buffer;
    }

    // Wind ambience
    playWind() {
        if (!this.initialized) return;
        const buffer = this.createNoiseBuffer(4, 'brown');
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 200;

        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.15;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 80;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        lfo.start();

        const gain = this.ctx.createGain();
        gain.gain.value = 0.08;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        source.start();

        this.ambientNodes.push({ source, lfo, gain });
        return { source, gain };
    }

    // Footstep sound
    playFootstep(intensity = 0.3) {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 60 + Math.random() * 30;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(intensity, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 300;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    }

    // Door sound
    playDoorSound(closing = true) {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        const freq = closing ? 120 : 90;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.3);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

        const noiseBuffer = this.createNoiseBuffer(0.3);
        const noiseSrc = this.ctx.createBufferSource();
        noiseSrc.buffer = noiseBuffer;
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 800;

        osc.connect(gain);
        gain.connect(this.masterGain);
        noiseSrc.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        osc.start();
        noiseSrc.start();
        osc.stop(this.ctx.currentTime + 0.3);
        noiseSrc.stop(this.ctx.currentTime + 0.3);
    }

    // Flashlight click
    playFlashlightClick() {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 2000;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    }

    // Camera switch sound
    playCameraSwitch() {
        if (!this.initialized) return;
        const buffer = this.createNoiseBuffer(0.15);
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 2000;
        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        src.start();
        src.stop(this.ctx.currentTime + 0.15);
    }

    // Monitor open/close
    playMonitorToggle(opening = true) {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        if (opening) {
            osc.frequency.setValueAtTime(300, this.ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(600, this.ctx.currentTime + 0.1);
        } else {
            osc.frequency.setValueAtTime(600, this.ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(200, this.ctx.currentTime + 0.1);
        }
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    }

    // Jumpscare sound
    playJumpscare() {
        if (!this.initialized) return;
        const osc1 = this.ctx.createOscillator();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.1);
        osc1.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.5);

        const osc2 = this.ctx.createOscillator();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(1200, this.ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.8);

        const buffer = this.createNoiseBuffer(1);
        const noiseSrc = this.ctx.createBufferSource();
        noiseSrc.buffer = buffer;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.0);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);

        osc1.connect(gain);
        osc2.connect(gain);
        noiseSrc.connect(noiseGain);
        gain.connect(this.masterGain);
        noiseGain.connect(this.masterGain);

        osc1.start();
        osc2.start();
        noiseSrc.start();
        osc1.stop(this.ctx.currentTime + 1.0);
        osc2.stop(this.ctx.currentTime + 1.0);
        noiseSrc.stop(this.ctx.currentTime + 1.0);
    }

    // Springlock sound
    playSpringlockTick() {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = 800 + Math.random() * 400;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.08);
    }

    // Springlock failure
    playSpringlockFailure() {
        if (!this.initialized) return;
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                if (!this.initialized) return;
                const osc = this.ctx.createOscillator();
                osc.type = 'sawtooth';
                osc.frequency.value = 200 + Math.random() * 600;
                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
                osc.connect(gain);
                gain.connect(this.masterGain);
                osc.start();
                osc.stop(this.ctx.currentTime + 0.2);
            }, i * 80);
        }
    }

    // The Thing ambient
    playThingAmbient() {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 40;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + 2);
        gain.gain.linearRampToValueAtTime(0.1, this.ctx.currentTime + 8);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 10);

        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.5;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 10;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        lfo.start();
        osc.stop(this.ctx.currentTime + 10);
        lfo.stop(this.ctx.currentTime + 10);
    }

    // Power down sound
    playPowerDown() {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 2);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 2);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 2);
    }

    // Distant sound (metal, chain, etc)
    playDistantSound() {
        if (!this.initialized) return;
        const types = ['sine', 'triangle', 'square'];
        const type = types[Math.floor(Math.random() * types.length)];
        const osc = this.ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = 80 + Math.random() * 200;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.04, this.ctx.currentTime + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.5);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 1.5);
    }

    // Movement detected beep
    playMovementBeep() {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 1000;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }

    // QTE key press
    playQTEKey(success = true) {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = success ? 880 : 220;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    stopAll() {
        this.ambientNodes.forEach(n => {
            try {
                n.source.stop();
                if (n.lfo) n.lfo.stop();
            } catch (e) { }
        });
        this.ambientNodes = [];
    }
}

// ============================================================
// ROOM — Map node
// ============================================================
class Room {
    constructor(id, name, x, y) {
        this.id = id;
        this.name = name;
        this.x = x; // Map position for minimap
        this.y = y;
        this.connections = [];
        this.enemies = [];
        this.cameraGlitch = false;
        this.cameraOffline = false;
        this.ambientEvent = null;
    }

    connectTo(room) {
        if (!this.connections.includes(room)) {
            this.connections.push(room);
            room.connections.push(this);
        }
    }
}

// ============================================================
// MAP MANAGER — Cemetery layout
// ============================================================
class MapManager {
    constructor() {
        this.rooms = new Map();
        this.playerRoom = null;
        this.buildMap();
    }

    buildMap() {
        // Create all rooms with minimap coordinates
        const rooms = [
            new Room('cam01', 'ENTRANCE', 0.5, 0.05),
            new Room('cam02', 'GRAVEYARD EAST', 0.2, 0.2),
            new Room('cam03', 'GRAVEYARD WEST', 0.8, 0.2),
            new Room('cam04', 'MAUSOLEUM', 0.5, 0.35),
            new Room('cam05', 'CHAPEL', 0.25, 0.5),
            new Room('cam06', 'STORAGE', 0.2, 0.65),
            new Room('cam07', 'FOREST PATH', 0.5, 0.1),
            new Room('cam08', 'CRYPT', 0.75, 0.5),
            new Room('cam09', 'BACK GATE', 0.5, 0.78),
            new Room('cam10', 'SERVICE AREA', 0.8, 0.65),
            new Room('cam11', 'OLD HOUSE', 0.1, 0.35),
            new Room('cam12', 'CENTRAL PATH', 0.5, 0.2),
        ];

        rooms.forEach(r => this.rooms.set(r.id, r));

        // Player area
        this.playerRoom = new Room('player', 'SECURITY OFFICE', 0.5, 0.93);
        this.rooms.set('player', this.playerRoom);

        const r = id => this.rooms.get(id);

        // Build connections per the map layout
        r('cam01').connectTo(r('cam07'));
        r('cam07').connectTo(r('cam12'));
        r('cam12').connectTo(r('cam02'));
        r('cam12').connectTo(r('cam03'));
        r('cam12').connectTo(r('cam04'));
        r('cam02').connectTo(r('cam11'));
        r('cam04').connectTo(r('cam05'));
        r('cam04').connectTo(r('cam08'));
        r('cam05').connectTo(r('cam06'));
        r('cam08').connectTo(r('cam10'));
        r('cam06').connectTo(r('cam09'));
        r('cam10').connectTo(r('cam09'));
        // Back gate connects to player area (left and right paths)
        r('cam09').connectTo(this.playerRoom);
        // Old house connects to chapel for alternate route
        r('cam11').connectTo(r('cam05'));
        // Additional path: entrance to east/west directly
        r('cam01').connectTo(r('cam12'));
    }

    getRoom(id) {
        return this.rooms.get(id);
    }

    getCameraRooms() {
        const cams = [];
        this.rooms.forEach((room, id) => {
            if (id !== 'player') cams.push(room);
        });
        return cams;
    }

    // Find path between rooms using BFS
    findPath(fromId, toId) {
        const start = this.rooms.get(fromId);
        const end = this.rooms.get(toId);
        if (!start || !end) return [];

        const visited = new Set();
        const queue = [[start]];
        visited.add(start.id);

        while (queue.length > 0) {
            const path = queue.shift();
            const current = path[path.length - 1];
            if (current.id === end.id) return path;

            for (const neighbor of current.connections) {
                if (!visited.has(neighbor.id)) {
                    visited.add(neighbor.id);
                    queue.push([...path, neighbor]);
                }
            }
        }
        return [];
    }

    // Get adjacent rooms
    getNeighbors(roomId) {
        const room = this.rooms.get(roomId);
        return room ? room.connections : [];
    }
}

// ============================================================
// ENEMY — Base animatronic AI
// ============================================================
class Enemy {
    constructor(name, startRoom, config) {
        this.name = name;
        this.currentRoom = startRoom;
        this.targetRoom = 'player';
        this.movementChance = config.movementChance || 0.3;
        this.aggression = config.aggression || 0.3;
        this.movementCooldown = config.movementCooldown || 5000;
        this.attackChance = config.attackChance || 0.5;
        this.preferredPaths = config.preferredPaths || [];
        this.canBacktrack = config.canBacktrack !== undefined ? config.canBacktrack : true;
        this.active = false;
        this.lastMoveTime = 0;
        this.previousRoom = null;
        this.atDoor = null; // 'left' or 'right' or null
        this.isInPlayerArea = false;
        this.visible = true;
        this.hiding = false;
        this.lookingAtCamera = false;
        this.color = config.color || '#cc3333';
        this.jumpscareColor = config.jumpscareColor || '#cc3333';
        this.bodyParts = config.bodyParts || [];
        this.moveVariance = 0.3; // Randomness in move timing
        this.waitingAtDoorSince = 0;
    }

    update(now, mapManager, nightConfig, game) {
        if (!this.active) return;

        const elapsed = now - this.lastMoveTime;
        const cooldown = this.movementCooldown / nightConfig.enemySpeed;
        const variance = cooldown * this.moveVariance * (Math.random() - 0.5);

        if (elapsed < cooldown + variance) return;

        // Decide action
        const roll = Math.random();
        const moveThreshold = this.movementChance * nightConfig.aggression * 2;

        if (roll < moveThreshold) {
            this.moveTowardsPlayer(mapManager, nightConfig, game);
        } else if (roll < moveThreshold + 0.1 && this.canBacktrack && this.previousRoom) {
            // Occasionally backtrack
            // Don't do it if close to player
        }

        // Random behaviors
        this.lookingAtCamera = Math.random() < 0.3;
        this.hiding = Math.random() < 0.1;

        this.lastMoveTime = now;
    }

    moveTowardsPlayer(mapManager, nightConfig, game) {
        const room = mapManager.getRoom(this.currentRoom);
        if (!room) return;

        // If at player area already
        if (this.currentRoom === 'player') {
            this.isInPlayerArea = true;
            return;
        }

        // Find path to player
        const path = mapManager.findPath(this.currentRoom, 'player');
        if (path.length < 2) return;

        // Check preferred paths
        let nextRoom = path[1];

        // Check if player area neighbor (adjacent to player = at door)
        if (nextRoom.id === 'player') {
            // Check if we should attack
            const attackRoll = Math.random();
            if (attackRoll < this.attackChance * nightConfig.aggression) {
                // Determine which door
                this.atDoor = Math.random() < 0.5 ? 'left' : 'right';
                this.waitingAtDoorSince = Date.now();
                return;
            }
        }

        // Move to next room
        this.previousRoom = this.currentRoom;
        this.currentRoom = nextRoom.id;
        this.atDoor = null;
        this.isInPlayerArea = false;

        // Notify camera system
        if (game && game.cameraSystem) {
            game.cameraSystem.notifyMovement(this.previousRoom, this.currentRoom, this.name);
        }
    }

    // Try to enter player area through a door
    tryEnterPlayerArea(game) {
        if (!this.atDoor) return false;

        const doorClosed = this.atDoor === 'left' ? game.leftDoorClosed : game.rightDoorClosed;
        if (doorClosed) {
            // Door is closed — enemy is blocked
            // After a while they may leave
            if (Date.now() - this.waitingAtDoorSince > 8000 + Math.random() * 7000) {
                this.atDoor = null;
                // Move back
                if (this.previousRoom) {
                    this.currentRoom = this.previousRoom;
                }
            }
            return false;
        }

        // Door is open — enter!
        this.isInPlayerArea = true;
        this.currentRoom = 'player';
        this.atDoor = null;
        return true;
    }

    resetPosition(startRoom) {
        this.currentRoom = startRoom;
        this.previousRoom = null;
        this.atDoor = null;
        this.isInPlayerArea = false;
        this.active = false;
        this.lastMoveTime = 0;
        this.waitingAtDoorSince = 0;
    }
}

// ============================================================
// TWISTED ANIMATRONICS
// ============================================================
class TwistedFreddy extends Enemy {
    constructor() {
        super('TWISTED FREDDY', 'cam01', {
            movementChance: 0.35,
            aggression: 0.3,
            movementCooldown: 6000,
            attackChance: 0.4,
            preferredPaths: ['cam01', 'cam12', 'cam04', 'cam05', 'cam06', 'cam09'],
            canBacktrack: true,
            color: '#8B4513',
            jumpscareColor: '#5C3317',
            bodyParts: ['head', 'torso', 'arms', 'jaw']
        });
    }
}

class TwistedBonnie extends Enemy {
    constructor() {
        super('TWISTED BONNIE', 'cam03', {
            movementChance: 0.4,
            aggression: 0.35,
            movementCooldown: 5000,
            attackChance: 0.45,
            preferredPaths: ['cam03', 'cam12', 'cam04', 'cam08', 'cam10', 'cam09'],
            canBacktrack: true,
            color: '#4444aa',
            jumpscareColor: '#3333aa',
            bodyParts: ['head', 'ears', 'torso', 'claws']
        });
    }
}

class TwistedChica extends Enemy {
    constructor() {
        super('TWISTED CHICA', 'cam02', {
            movementChance: 0.3,
            aggression: 0.25,
            movementCooldown: 7000,
            attackChance: 0.35,
            preferredPaths: ['cam02', 'cam11', 'cam05', 'cam06', 'cam09'],
            canBacktrack: true,
            color: '#ccaa33',
            jumpscareColor: '#aa8822',
            bodyParts: ['head', 'beak', 'torso', 'wings']
        });
    }
}

class TwistedFoxy extends Enemy {
    constructor() {
        super('TWISTED FOXY', 'cam07', {
            movementChance: 0.2,
            aggression: 0.4,
            movementCooldown: 10000,
            attackChance: 0.6,
            preferredPaths: ['cam07', 'cam12', 'cam04', 'cam08', 'cam10', 'cam09'],
            canBacktrack: false,
            color: '#cc4444',
            jumpscareColor: '#aa2222',
            bodyParts: ['hook', 'eye', 'jaw', 'torso', 'tail']
        });
        this.hiding = true;
        this.hidingTimer = 0;
        this.rushMode = false;
    }

    update(now, mapManager, nightConfig, game) {
        if (!this.active) return;

        const elapsed = now - this.lastMoveTime;

        // Foxy has special hiding behavior
        if (this.hiding) {
            this.hidingTimer += elapsed;
            // After hiding for a while, start rushing
            const hideTime = (15000 + Math.random() * 20000) / nightConfig.enemySpeed;
            if (this.hidingTimer > hideTime) {
                this.hiding = false;
                this.rushMode = true;
                this.hidingTimer = 0;
            }
            this.lastMoveTime = now;
            return;
        }

        if (this.rushMode) {
            // Move faster
            const rushCooldown = 2000 / nightConfig.enemySpeed;
            if (elapsed < rushCooldown) return;

            this.moveTowardsPlayer(mapManager, nightConfig, game);
            this.lastMoveTime = now;

            // After a few moves, go back to hiding
            if (Math.random() < 0.2) {
                this.rushMode = false;
                this.hiding = true;
                this.hidingTimer = 0;
            }
            return;
        }

        super.update(now, mapManager, nightConfig, game);
    }
}

class Springtrap extends Enemy {
    constructor() {
        super('SPRINGTRAP', 'cam08', {
            movementChance: 0.45,
            aggression: 0.4,
            movementCooldown: 5500,
            attackChance: 0.5,
            preferredPaths: ['cam08', 'cam04', 'cam12', 'cam02', 'cam11', 'cam05', 'cam06', 'cam09'],
            canBacktrack: true,
            color: '#6B8E23',
            jumpscareColor: '#556B2F',
            bodyParts: ['head', 'endoskeleton', 'torso', 'wires', 'skull']
        });
        this.intelligence = 0.5;
        this.avoidedCameras = new Set();
        this.lastRouteChangeTime = 0;
    }

    update(now, mapManager, nightConfig, game) {
        if (!this.active) return;

        const elapsed = now - this.lastMoveTime;
        const cooldown = this.movementCooldown / nightConfig.enemySpeed;
        const variance = cooldown * 0.4 * (Math.random() - 0.5);

        if (elapsed < cooldown + variance) return;

        // Springtrap is smarter
        const roll = Math.random();
        const intelligence = this.intelligence * nightConfig.aggression;

        // Decide: move toward player, change route, wait, or backtrack
        if (roll < intelligence) {
            // Smart move — check if player is watching this camera
            if (game && game.cameraSystem && game.monitorOpen) {
                const watchedCam = game.cameraSystem.currentCameraId;
                // If player is watching the room we'd move to, wait
                const path = mapManager.findPath(this.currentRoom, 'player');
                if (path.length >= 2 && path[1].id === watchedCam) {
                    // Wait or take alternate route
                    if (Math.random() < 0.5) {
                        this.takeAlternateRoute(mapManager, game);
                    }
                    this.lastMoveTime = now;
                    return;
                }
            }

            // Move toward player when they have monitor open
            if (game && game.monitorOpen && Math.random() < 0.6) {
                this.moveTowardsPlayer(mapManager, nightConfig, game);
            } else {
                this.moveTowardsPlayer(mapManager, nightConfig, game);
            }
        } else if (roll < intelligence + 0.15 && this.canBacktrack) {
            // Backtrack to confuse
            if (this.previousRoom) {
                const temp = this.currentRoom;
                this.currentRoom = this.previousRoom;
                this.previousRoom = temp;
                this.atDoor = null;
            }
        }
        // else wait

        this.lastMoveTime = now;
    }

    takeAlternateRoute(mapManager, game) {
        const room = mapManager.getRoom(this.currentRoom);
        if (!room) return;

        const options = room.connections.filter(r => {
            if (r.id === this.previousRoom) return false;
            if (game && game.cameraSystem && r.id === game.cameraSystem.currentCameraId) return false;
            return true;
        });

        if (options.length > 0) {
            const next = options[Math.floor(Math.random() * options.length)];
            this.previousRoom = this.currentRoom;
            this.currentRoom = next.id;
        }
    }
}

// ============================================================
// THE THING — Ultra-rare event
// ============================================================
class TheThing {
    constructor() {
        this.chance = 0.005; // 0.5%
        this.triggeredThisNight = false;
        this.active = false;
        this.sequence = [];
        this.currentIndex = 0;
        this.timeLimit = 12000; // 12 seconds
        this.startTime = 0;
        this.attempts = 0;
        this.maxAttempts = 3;
        this.possibleKeys = ['W', 'A', 'S', 'D', 'Q', 'E', 'SPACE'];
    }

    tryTrigger() {
        if (this.triggeredThisNight) return false;
        if (Math.random() < this.chance) {
            this.triggeredThisNight = true;
            return true;
        }
        return false;
    }

    generateSequence() {
        this.sequence = [];
        for (let i = 0; i < 5; i++) {
            this.sequence.push(this.possibleKeys[Math.floor(Math.random() * this.possibleKeys.length)]);
        }
        this.currentIndex = 0;
        this.startTime = Date.now();
        this.attempts = 0;
    }

    checkInput(key) {
        const expected = this.sequence[this.currentIndex];
        const normalizedKey = key.toUpperCase();
        const normalizedExpected = expected === 'SPACE' ? ' ' : expected;

        if (normalizedKey === expected || (expected === 'SPACE' && normalizedKey === ' ')) {
            this.currentIndex++;
            if (this.currentIndex >= this.sequence.length) {
                return 'complete';
            }
            return 'correct';
        } else {
            this.attempts++;
            this.currentIndex = 0;
            this.timeLimit -= 2000; // Reduce time on failure
            if (this.attempts >= this.maxAttempts) {
                return 'failed';
            }
            return 'wrong';
        }
    }

    getTimeRemaining() {
        return Math.max(0, this.timeLimit - (Date.now() - this.startTime));
    }

    reset() {
        this.triggeredThisNight = false;
        this.active = false;
        this.sequence = [];
        this.currentIndex = 0;
        this.timeLimit = 12000;
        this.attempts = 0;
    }
}

// ============================================================
// SPRINGLOCK SUIT
// ============================================================
class SpringlockSuit {
    constructor() {
        this.active = false;
        this.timer = 20;
        this.maxTimer = 20;
        this.tickInterval = null;
        this.safe = false;
    }

    enter(game) {
        this.active = true;
        this.timer = this.maxTimer;
        this.safe = false;

        const el = document.getElementById('springlock-hud');
        el.classList.remove('hidden');
        document.getElementById('springlock-countdown').textContent = this.timer;
        document.getElementById('springlock-msg').textContent = 'REMAIN STILL...';
        document.getElementById('btn-exit-springlock').classList.add('hidden');
        document.getElementById('inside-alert-banner').classList.add('hidden');

        this.tickInterval = setInterval(() => {
            this.timer--;
            document.getElementById('springlock-countdown').textContent = this.timer;
            game.audio.playSpringlockTick();

            if (this.safe && this.timer > 0) {
                this.showSafe(game);
                return;
            }

            if (this.timer <= 0) {
                this.failure(game);
            }
        }, 1000);
    }

    showSafe(game) {
        clearInterval(this.tickInterval);
        document.getElementById('springlock-msg').textContent = 'SAFE — EXIT NOW';
        document.getElementById('btn-exit-springlock').classList.remove('hidden');
    }

    exit(game) {
        this.active = false;
        clearInterval(this.tickInterval);
        document.getElementById('springlock-hud').classList.add('hidden');
    }

    failure(game) {
        this.active = false;
        clearInterval(this.tickInterval);
        document.getElementById('springlock-hud').classList.add('hidden');
        game.audio.playSpringlockFailure();
        game.gameOver('SPRINGLOCK FAILURE');
    }

    markSafe() {
        this.safe = true;
    }

    reset() {
        this.active = false;
        this.timer = this.maxTimer;
        this.safe = false;
        clearInterval(this.tickInterval);
    }
}

// ============================================================
// POWER SYSTEM
// ============================================================
class PowerSystem {
    constructor() {
        this.power = 100;
        this.maxPower = 100;
        this.drainRate = 0.1; // per second base
        this.depleted = false;
    }

    update(dt, nightConfig, game) {
        if (this.depleted) return;

        let drain = this.drainRate * nightConfig.powerDrain;

        // Additional drain for active systems
        if (game.leftDoorClosed) drain += 0.15;
        if (game.rightDoorClosed) drain += 0.15;
        if (game.flashlightOn) drain += 0.1;
        if (game.monitorOpen) drain += 0.12;
        if (game.leftLightOn) drain += 0.08;
        if (game.rightLightOn) drain += 0.08;

        this.power -= drain * dt;

        if (this.power <= 0) {
            this.power = 0;
            this.depleted = true;
            game.onPowerDepleted();
        }

        this.updateUI();
    }

    updateUI() {
        const pct = Math.max(0, Math.round(this.power));
        document.getElementById('power-value').textContent = pct;
        document.getElementById('monitor-power-value').textContent = pct;

        const fill = document.getElementById('hud-power-fill');
        fill.style.width = pct + '%';
        fill.classList.remove('low', 'critical');
        if (pct <= 20) fill.classList.add('critical');
        else if (pct <= 40) fill.classList.add('low');
    }

    reset() {
        this.power = 100;
        this.depleted = false;
    }
}

// ============================================================
// CAMERA SYSTEM
// ============================================================
class CameraSystem {
    constructor(mapManager) {
        this.mapManager = mapManager;
        this.cameras = mapManager.getCameraRooms();
        this.currentCameraId = 'cam01';
        this.glitchTimers = new Map();
        this.movementAlerts = [];
    }

    getCurrentCamera() {
        return this.mapManager.getRoom(this.currentCameraId);
    }

    switchCamera(camId) {
        if (this.mapManager.getRoom(camId)) {
            this.currentCameraId = camId;
        }
    }

    notifyMovement(fromRoom, toRoom, enemyName) {
        this.movementAlerts.push({
            from: fromRoom,
            to: toRoom,
            enemy: enemyName,
            time: Date.now(),
            shown: false
        });
    }

    getRecentAlerts() {
        const now = Date.now();
        this.movementAlerts = this.movementAlerts.filter(a => now - a.time < 5000);
        return this.movementAlerts.filter(a => !a.shown);
    }

    // Random camera glitches
    updateGlitches(nightConfig) {
        this.cameras.forEach(cam => {
            if (Math.random() < 0.002 * nightConfig.aggression) {
                cam.cameraGlitch = true;
                setTimeout(() => { cam.cameraGlitch = false; }, 1000 + Math.random() * 3000);
            }
            if (Math.random() < 0.0005 * nightConfig.aggression) {
                cam.cameraOffline = true;
                setTimeout(() => { cam.cameraOffline = false; }, 3000 + Math.random() * 5000);
            }
        });
    }

    getEnemiesInRoom(roomId, enemies) {
        return enemies.filter(e => e.active && e.currentRoom === roomId && !e.isInPlayerArea);
    }

    reset() {
        this.currentCameraId = 'cam01';
        this.movementAlerts = [];
        this.cameras.forEach(cam => {
            cam.cameraGlitch = false;
            cam.cameraOffline = false;
        });
    }
}

// ============================================================
// 3D RENDERER — Simple Canvas-based 3D rendering
// ============================================================
class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.w = this.canvas.width;
        this.h = this.canvas.height;
    }

    clear() {
        this.ctx.fillStyle = '#0a0a0c';
        this.ctx.fillRect(0, 0, this.w, this.h);
    }

    // Draw the player's security office view
    drawOffice(game) {
        this.clear();
        const ctx = this.ctx;
        const w = this.w;
        const h = this.h;

        // Floor
        const floorGrad = ctx.createLinearGradient(0, h * 0.6, 0, h);
        floorGrad.addColorStop(0, '#1a1a1e');
        floorGrad.addColorStop(1, '#0e0e12');
        ctx.fillStyle = floorGrad;
        ctx.fillRect(0, h * 0.55, w, h * 0.45);

        // Floor grid lines for depth
        ctx.strokeStyle = 'rgba(40,40,50,0.3)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 12; i++) {
            const y = h * 0.55 + (h * 0.45 * i / 12);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        // Walls
        const wallGrad = ctx.createLinearGradient(0, 0, 0, h * 0.6);
        wallGrad.addColorStop(0, '#111115');
        wallGrad.addColorStop(1, '#1a1a20');
        ctx.fillStyle = wallGrad;
        ctx.fillRect(0, 0, w, h * 0.6);

        // Wall texture lines
        ctx.strokeStyle = 'rgba(30,30,38,0.5)';
        for (let i = 0; i < 8; i++) {
            const y = h * 0.6 * i / 8;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        // Ceiling
        ctx.fillStyle = '#0c0c10';
        ctx.fillRect(0, 0, w, h * 0.08);

        // Left hallway opening
        this.drawHallway(ctx, w * 0.02, h * 0.15, w * 0.12, h * 0.55, game.leftDoorClosed, game.leftLightOn, 'left');

        // Right hallway opening
        this.drawHallway(ctx, w * 0.86, h * 0.15, w * 0.12, h * 0.55, game.rightDoorClosed, game.rightLightOn, 'right');

        // Desk / Control panel in center
        this.drawDesk(ctx, w * 0.3, h * 0.65, w * 0.4, h * 0.2);

        // Monitor on desk (when not open)
        if (!game.monitorOpen) {
            this.drawMonitorOnDesk(ctx, w * 0.42, h * 0.45, w * 0.16, h * 0.2);
        }

        // Flashlight effect
        if (game.flashlightOn) {
            this.drawFlashlightBeam(ctx, w, h);
        }

        // Draw enemies at doors if any
        game.enemies.forEach(enemy => {
            if (enemy.atDoor === 'left' && game.leftLightOn) {
                this.drawEnemyAtDoor(ctx, w * 0.05, h * 0.15, w * 0.1, h * 0.5, enemy);
            }
            if (enemy.atDoor === 'right' && game.rightLightOn) {
                this.drawEnemyAtDoor(ctx, w * 0.88, h * 0.15, w * 0.1, h * 0.5, enemy);
            }
            if (enemy.isInPlayerArea && !game.springlockSuit.active) {
                this.drawEnemyInRoom(ctx, w, h, enemy);
            }
        });

        // Ambient dim light
        const ambGrad = ctx.createRadialGradient(w / 2, h * 0.4, 50, w / 2, h * 0.4, w * 0.5);
        ambGrad.addColorStop(0, 'rgba(40,38,30,0.08)');
        ambGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = ambGrad;
        ctx.fillRect(0, 0, w, h);

        // Vignette
        const vigGrad = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7);
        vigGrad.addColorStop(0, 'transparent');
        vigGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = vigGrad;
        ctx.fillRect(0, 0, w, h);

        // Power out effect
        if (game.powerSystem.depleted) {
            ctx.fillStyle = 'rgba(0,0,0,0.85)';
            ctx.fillRect(0, 0, w, h);
        }
    }

    drawHallway(ctx, x, y, hallW, hallH, doorClosed, lightOn, side) {
        // Dark hallway
        const grad = ctx.createLinearGradient(x, y, x + hallW, y);
        if (side === 'left') {
            grad.addColorStop(0, '#050508');
            grad.addColorStop(1, '#111115');
        } else {
            grad.addColorStop(0, '#111115');
            grad.addColorStop(1, '#050508');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, hallW, hallH);

        // Hallway frame
        ctx.strokeStyle = '#2a2a30';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, hallW, hallH);

        // Door if closed
        if (doorClosed) {
            const doorGrad = ctx.createLinearGradient(x, y, x, y + hallH);
            doorGrad.addColorStop(0, '#3a3530');
            doorGrad.addColorStop(0.5, '#2a2520');
            doorGrad.addColorStop(1, '#1a1510');
            ctx.fillStyle = doorGrad;
            ctx.fillRect(x + 2, y + 2, hallW - 4, hallH - 4);

            // Door details
            ctx.strokeStyle = '#4a4540';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 8, y + 8, hallW - 16, hallH * 0.4);
            ctx.strokeRect(x + 8, y + hallH * 0.5, hallW - 16, hallH * 0.4);

            // Handle
            ctx.fillStyle = '#6a6560';
            const hx = side === 'left' ? x + hallW - 14 : x + 8;
            ctx.fillRect(hx, y + hallH * 0.45, 6, 12);
        }

        // Light effect if on
        if (lightOn && !doorClosed) {
            const lightGrad = ctx.createRadialGradient(
                x + hallW / 2, y + 20, 5,
                x + hallW / 2, y + hallH / 2, hallH
            );
            lightGrad.addColorStop(0, 'rgba(200,180,120,0.25)');
            lightGrad.addColorStop(0.5, 'rgba(200,180,120,0.08)');
            lightGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = lightGrad;
            ctx.fillRect(x, y, hallW, hallH);
        }
    }

    drawDesk(ctx, x, y, deskW, deskH) {
        // Desk top
        const deskGrad = ctx.createLinearGradient(x, y, x, y + deskH);
        deskGrad.addColorStop(0, '#2a2826');
        deskGrad.addColorStop(1, '#1e1c1a');
        ctx.fillStyle = deskGrad;
        ctx.fillRect(x, y, deskW, deskH);
        ctx.strokeStyle = '#3a3836';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, deskW, deskH);

        // Some desk details
        ctx.fillStyle = '#333130';
        ctx.fillRect(x + 10, y + 10, 30, 6);
        ctx.fillRect(x + 10, y + 22, 30, 6);

        // Fan
        const fanX = x + deskW - 40;
        const fanY = y + 5;
        ctx.fillStyle = '#444';
        ctx.beginPath();
        ctx.arc(fanX, fanY + 15, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.stroke();
        // Fan blades (rotating)
        const angle = (Date.now() / 200) % (Math.PI * 2);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
            const a = angle + (i * Math.PI * 2 / 3);
            ctx.beginPath();
            ctx.moveTo(fanX, fanY + 15);
            ctx.lineTo(fanX + Math.cos(a) * 10, fanY + 15 + Math.sin(a) * 10);
            ctx.stroke();
        }
    }

    drawMonitorOnDesk(ctx, x, y, monW, monH) {
        // Monitor body
        ctx.fillStyle = '#1a1a20';
        ctx.fillRect(x, y, monW, monH);
        ctx.strokeStyle = '#333340';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, monW, monH);

        // Screen
        ctx.fillStyle = '#0a1518';
        ctx.fillRect(x + 4, y + 4, monW - 8, monH - 16);

        // Screen text
        ctx.fillStyle = '#336666';
        ctx.font = `${Math.max(8, monW * 0.06)}px "Share Tech Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('PULL UP', x + monW / 2, y + monH / 2 - 4);
        ctx.fillText('MONITOR', x + monW / 2, y + monH / 2 + 8);
        ctx.textAlign = 'left';

        // Stand
        ctx.fillStyle = '#222228';
        ctx.fillRect(x + monW / 2 - 8, y + monH - 12, 16, 12);
        ctx.fillRect(x + monW / 2 - 16, y + monH, 32, 4);
    }

    drawFlashlightBeam(ctx, w, h) {
        const beamGrad = ctx.createRadialGradient(w / 2, h * 0.5, 20, w / 2, h * 0.3, w * 0.35);
        beamGrad.addColorStop(0, 'rgba(255,240,200,0.12)');
        beamGrad.addColorStop(0.5, 'rgba(255,240,200,0.04)');
        beamGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = beamGrad;
        ctx.fillRect(0, 0, w, h);
    }

    drawEnemyAtDoor(ctx, x, y, areaW, areaH, enemy) {
        // Simple silhouette
        const centerX = x + areaW / 2;
        const bottomY = y + areaH;

        ctx.fillStyle = enemy.color;
        ctx.globalAlpha = 0.7;

        // Head
        ctx.beginPath();
        ctx.arc(centerX, y + areaH * 0.15, areaW * 0.25, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#ff3333';
        ctx.beginPath();
        ctx.arc(centerX - 6, y + areaH * 0.13, 3, 0, Math.PI * 2);
        ctx.arc(centerX + 6, y + areaH * 0.13, 3, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.fillStyle = enemy.color;
        ctx.fillRect(centerX - areaW * 0.2, y + areaH * 0.25, areaW * 0.4, areaH * 0.5);

        ctx.globalAlpha = 1;
    }

    drawEnemyInRoom(ctx, w, h, enemy) {
        // Enemy inside the office — large and close
        const centerX = w / 2 + (Math.random() - 0.5) * 40;
        ctx.globalAlpha = 0.85;

        // Dark looming figure
        ctx.fillStyle = enemy.color;
        // Head
        ctx.beginPath();
        ctx.arc(centerX, h * 0.2, w * 0.08, 0, Math.PI * 2);
        ctx.fill();

        // Glowing eyes
        ctx.fillStyle = '#ff2222';
        ctx.beginPath();
        ctx.arc(centerX - w * 0.025, h * 0.18, 5, 0, Math.PI * 2);
        ctx.arc(centerX + w * 0.025, h * 0.18, 5, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.fillStyle = enemy.color;
        ctx.beginPath();
        ctx.moveTo(centerX - w * 0.1, h * 0.28);
        ctx.lineTo(centerX + w * 0.1, h * 0.28);
        ctx.lineTo(centerX + w * 0.12, h * 0.8);
        ctx.lineTo(centerX - w * 0.12, h * 0.8);
        ctx.closePath();
        ctx.fill();

        // Jaw / teeth
        ctx.fillStyle = '#222';
        ctx.fillRect(centerX - w * 0.04, h * 0.24, w * 0.08, h * 0.03);
        ctx.fillStyle = '#ddd';
        for (let i = 0; i < 5; i++) {
            ctx.fillRect(centerX - w * 0.035 + i * w * 0.016, h * 0.245, w * 0.008, h * 0.015);
        }

        ctx.globalAlpha = 1;
    }

    // Draw camera view of a room
    drawCameraView(cameraCanvas, room, enemies, game) {
        const ctx = cameraCanvas.getContext('2d');
        const w = cameraCanvas.width;
        const h = cameraCanvas.height;

        ctx.fillStyle = '#080a0a';
        ctx.fillRect(0, 0, w, h);

        if (room.cameraOffline) return;

        // Draw room scene based on room id
        this.drawRoomScene(ctx, w, h, room);

        // Draw enemies in this room
        const roomEnemies = enemies.filter(e => e.active && e.currentRoom === room.id);
        roomEnemies.forEach((enemy, idx) => {
            this.drawEnemyInCamera(ctx, w, h, enemy, idx, roomEnemies.length);
        });

        // Camera glitch effect
        if (room.cameraGlitch) {
            this.drawGlitchEffect(ctx, w, h);
        }

        // Night vision tint
        ctx.fillStyle = 'rgba(0,20,10,0.15)';
        ctx.fillRect(0, 0, w, h);

        // Slight grain
        if (Math.random() < 0.3) {
            ctx.fillStyle = `rgba(${Math.random() * 30},${Math.random() * 30},${Math.random() * 30},0.05)`;
            for (let i = 0; i < 20; i++) {
                const gx = Math.random() * w;
                const gy = Math.random() * h;
                ctx.fillRect(gx, gy, 2, 2);
            }
        }
    }

    drawRoomScene(ctx, w, h, room) {
        // Each room has a distinct visual scene
        const scenes = {
            'cam01': () => this.drawEntrance(ctx, w, h),
            'cam02': () => this.drawGraveyard(ctx, w, h, 'east'),
            'cam03': () => this.drawGraveyard(ctx, w, h, 'west'),
            'cam04': () => this.drawMausoleum(ctx, w, h),
            'cam05': () => this.drawChapel(ctx, w, h),
            'cam06': () => this.drawStorage(ctx, w, h),
            'cam07': () => this.drawForestPath(ctx, w, h),
            'cam08': () => this.drawCrypt(ctx, w, h),
            'cam09': () => this.drawBackGate(ctx, w, h),
            'cam10': () => this.drawServiceArea(ctx, w, h),
            'cam11': () => this.drawOldHouse(ctx, w, h),
            'cam12': () => this.drawCentralPath(ctx, w, h),
        };

        if (scenes[room.id]) {
            scenes[room.id]();
        }
    }

    // Room scene renderers
    drawEntrance(ctx, w, h) {
        // Ground
        ctx.fillStyle = '#141816';
        ctx.fillRect(0, h * 0.6, w, h * 0.4);

        // Iron gate
        ctx.strokeStyle = '#3a3a3a';
        ctx.lineWidth = 3;
        for (let i = 0; i < 8; i++) {
            const x = w * 0.15 + i * (w * 0.7 / 8);
            ctx.beginPath();
            ctx.moveTo(x, h * 0.1);
            ctx.lineTo(x, h * 0.65);
            ctx.stroke();
        }
        // Top bar
        ctx.beginPath();
        ctx.moveTo(w * 0.1, h * 0.1);
        ctx.lineTo(w * 0.9, h * 0.1);
        ctx.stroke();
        // Bottom bar
        ctx.beginPath();
        ctx.moveTo(w * 0.1, h * 0.65);
        ctx.lineTo(w * 0.9, h * 0.65);
        ctx.stroke();

        // Sign
        ctx.fillStyle = '#2a2520';
        ctx.fillRect(w * 0.3, h * 0.02, w * 0.4, h * 0.06);
        ctx.fillStyle = '#888';
        ctx.font = `${Math.max(10, w * 0.025)}px "Share Tech Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('CEMETERY', w / 2, h * 0.06);
        ctx.textAlign = 'left';

        // Path
        ctx.fillStyle = '#1a1c1a';
        ctx.beginPath();
        ctx.moveTo(w * 0.35, h * 0.65);
        ctx.lineTo(w * 0.65, h * 0.65);
        ctx.lineTo(w * 0.6, h);
        ctx.lineTo(w * 0.4, h);
        ctx.closePath();
        ctx.fill();

        // Sky
        ctx.fillStyle = '#0a0c10';
        ctx.fillRect(0, 0, w, h * 0.1);
    }

    drawGraveyard(ctx, w, h, side) {
        // Ground
        const groundGrad = ctx.createLinearGradient(0, h * 0.5, 0, h);
        groundGrad.addColorStop(0, '#161a16');
        groundGrad.addColorStop(1, '#0e100e');
        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, h * 0.5, w, h * 0.5);

        // Sky
        ctx.fillStyle = '#0a0c12';
        ctx.fillRect(0, 0, w, h * 0.35);

        // Trees silhouettes
        const treeCount = side === 'east' ? 3 : 4;
        ctx.fillStyle = '#0c0e0c';
        for (let i = 0; i < treeCount; i++) {
            const tx = w * (0.1 + i * 0.25) + (side === 'west' ? w * 0.05 : 0);
            // Trunk
            ctx.fillRect(tx - 3, h * 0.2, 6, h * 0.35);
            // Canopy
            ctx.beginPath();
            ctx.arc(tx, h * 0.2, 25 + Math.random() * 10, 0, Math.PI * 2);
            ctx.fill();
        }

        // Gravestones
        ctx.fillStyle = '#2a2a2a';
        const stoneCount = 5 + (side === 'east' ? 1 : 0);
        for (let i = 0; i < stoneCount; i++) {
            const sx = w * (0.08 + i * 0.16);
            const sy = h * 0.48 + (i % 2) * h * 0.08;
            const sw = 18 + Math.random() * 8;
            const sh = 28 + Math.random() * 12;

            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(sx - sw / 2, sy - sh, sw, sh);
            // Rounded top
            ctx.beginPath();
            ctx.arc(sx, sy - sh, sw / 2, Math.PI, 0);
            ctx.fill();

            // Cross on some
            if (i % 3 === 0) {
                ctx.strokeStyle = '#3a3a3a';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(sx, sy - sh - sw / 2 + 4);
                ctx.lineTo(sx, sy - 8);
                ctx.moveTo(sx - 5, sy - sh * 0.5);
                ctx.lineTo(sx + 5, sy - sh * 0.5);
                ctx.stroke();
            }
        }

        // Fog
        ctx.fillStyle = 'rgba(20,22,20,0.3)';
        ctx.fillRect(0, h * 0.55, w, h * 0.15);
    }

    drawMausoleum(ctx, w, h) {
        // Ground
        ctx.fillStyle = '#141614';
        ctx.fillRect(0, h * 0.6, w, h * 0.4);

        // Building
        ctx.fillStyle = '#222426';
        ctx.fillRect(w * 0.2, h * 0.15, w * 0.6, h * 0.5);

        // Roof
        ctx.fillStyle = '#1a1c1e';
        ctx.beginPath();
        ctx.moveTo(w * 0.15, h * 0.15);
        ctx.lineTo(w * 0.5, h * 0.02);
        ctx.lineTo(w * 0.85, h * 0.15);
        ctx.closePath();
        ctx.fill();

        // Door
        ctx.fillStyle = '#0a0a0c';
        ctx.fillRect(w * 0.4, h * 0.3, w * 0.2, h * 0.35);

        // Columns
        ctx.fillStyle = '#2a2c2e';
        ctx.fillRect(w * 0.22, h * 0.15, w * 0.04, h * 0.5);
        ctx.fillRect(w * 0.74, h * 0.15, w * 0.04, h * 0.5);

        // Steps
        ctx.fillStyle = '#1e2020';
        ctx.fillRect(w * 0.25, h * 0.63, w * 0.5, h * 0.04);
        ctx.fillRect(w * 0.28, h * 0.67, w * 0.44, h * 0.04);
    }

    drawChapel(ctx, w, h) {
        ctx.fillStyle = '#121412';
        ctx.fillRect(0, h * 0.55, w, h * 0.45);

        // Chapel building
        ctx.fillStyle = '#1e201e';
        ctx.fillRect(w * 0.15, h * 0.2, w * 0.7, h * 0.4);

        // Steeple
        ctx.fillStyle = '#1a1c1a';
        ctx.beginPath();
        ctx.moveTo(w * 0.4, h * 0.2);
        ctx.lineTo(w * 0.5, h * 0.02);
        ctx.lineTo(w * 0.6, h * 0.2);
        ctx.closePath();
        ctx.fill();

        // Cross on top
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(w * 0.5, h * 0.01);
        ctx.lineTo(w * 0.5, h * 0.08);
        ctx.moveTo(w * 0.47, h * 0.035);
        ctx.lineTo(w * 0.53, h * 0.035);
        ctx.stroke();

        // Window
        ctx.fillStyle = '#0a1520';
        ctx.beginPath();
        ctx.arc(w * 0.5, h * 0.3, w * 0.06, Math.PI, 0);
        ctx.fillRect(w * 0.44, h * 0.3, w * 0.12, h * 0.12);
        ctx.fill();

        // Door
        ctx.fillStyle = '#141614';
        ctx.fillRect(w * 0.43, h * 0.42, w * 0.14, h * 0.18);
    }

    drawStorage(ctx, w, h) {
        ctx.fillStyle = '#141414';
        ctx.fillRect(0, h * 0.55, w, h * 0.45);

        // Shed
        ctx.fillStyle = '#1c1a18';
        ctx.fillRect(w * 0.1, h * 0.25, w * 0.8, h * 0.35);

        // Roof
        ctx.fillStyle = '#161412';
        ctx.beginPath();
        ctx.moveTo(w * 0.05, h * 0.25);
        ctx.lineTo(w * 0.5, h * 0.12);
        ctx.lineTo(w * 0.95, h * 0.25);
        ctx.closePath();
        ctx.fill();

        // Shelves
        ctx.strokeStyle = '#2a2826';
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
            const sy = h * 0.3 + i * h * 0.07;
            ctx.beginPath();
            ctx.moveTo(w * 0.15, sy);
            ctx.lineTo(w * 0.45, sy);
            ctx.stroke();
        }

        // Boxes
        ctx.fillStyle = '#252320';
        ctx.fillRect(w * 0.55, h * 0.4, w * 0.12, h * 0.1);
        ctx.fillRect(w * 0.7, h * 0.35, w * 0.1, h * 0.15);
        ctx.fillRect(w * 0.6, h * 0.32, w * 0.08, h * 0.08);
    }

    drawForestPath(ctx, w, h) {
        // Path
        ctx.fillStyle = '#0e100e';
        ctx.fillRect(0, h * 0.5, w, h * 0.5);

        // Dense trees
        ctx.fillStyle = '#080a08';
        for (let i = 0; i < 12; i++) {
            const tx = Math.random() * w;
            const th = 40 + Math.random() * 60;
            const tw = 20 + Math.random() * 15;
            ctx.fillRect(tx - 3, h * 0.15 + Math.random() * h * 0.2, 6, h * 0.4);
            ctx.beginPath();
            ctx.moveTo(tx - tw, h * 0.15 + Math.random() * h * 0.15);
            ctx.lineTo(tx, h * 0.05 + Math.random() * h * 0.1);
            ctx.lineTo(tx + tw, h * 0.15 + Math.random() * h * 0.15);
            ctx.closePath();
            ctx.fill();
        }

        // Dirt path
        ctx.fillStyle = '#141814';
        ctx.beginPath();
        ctx.moveTo(w * 0.3, 0);
        ctx.lineTo(w * 0.7, 0);
        ctx.lineTo(w * 0.6, h);
        ctx.lineTo(w * 0.4, h);
        ctx.closePath();
        ctx.fill();

        // Fog
        ctx.fillStyle = 'rgba(15,18,15,0.4)';
        ctx.fillRect(0, h * 0.4, w, h * 0.2);
    }

    drawCrypt(ctx, w, h) {
        // Underground feel
        ctx.fillStyle = '#0e0e10';
        ctx.fillRect(0, 0, w, h);

        // Stone walls
        ctx.fillStyle = '#1a1a1c';
        ctx.fillRect(0, 0, w * 0.08, h);
        ctx.fillRect(w * 0.92, 0, w * 0.08, h);

        // Stone blocks
        ctx.strokeStyle = '#222224';
        ctx.lineWidth = 1;
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 6; col++) {
                const bx = w * 0.1 + col * (w * 0.8 / 6);
                const by = row * (h / 8);
                ctx.strokeRect(bx, by, w * 0.8 / 6, h / 8);
            }
        }

        // Archway
        ctx.fillStyle = '#080808';
        ctx.beginPath();
        ctx.arc(w * 0.5, h * 0.4, w * 0.2, Math.PI, 0);
        ctx.fillRect(w * 0.3, h * 0.4, w * 0.4, h * 0.4);
        ctx.fill();

        // Coffin shapes
        ctx.fillStyle = '#1a1816';
        ctx.fillRect(w * 0.15, h * 0.7, w * 0.25, h * 0.08);
        ctx.fillRect(w * 0.6, h * 0.7, w * 0.25, h * 0.08);

        // Candle
        ctx.fillStyle = '#cc9933';
        ctx.fillRect(w * 0.48, h * 0.33, 4, 8);
        ctx.fillStyle = '#ffcc44';
        ctx.beginPath();
        ctx.arc(w * 0.485, h * 0.32, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    drawBackGate(ctx, w, h) {
        ctx.fillStyle = '#121412';
        ctx.fillRect(0, h * 0.55, w, h * 0.45);

        // Gate
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(w * 0.3, h * 0.1);
        ctx.lineTo(w * 0.3, h * 0.6);
        ctx.moveTo(w * 0.7, h * 0.1);
        ctx.lineTo(w * 0.7, h * 0.6);
        ctx.stroke();

        // Fence bars
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
            const x = w * 0.35 + i * (w * 0.3 / 6);
            ctx.beginPath();
            ctx.moveTo(x, h * 0.12);
            ctx.lineTo(x, h * 0.58);
            ctx.stroke();
        }

        // Top bar
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(w * 0.28, h * 0.12);
        ctx.lineTo(w * 0.72, h * 0.12);
        ctx.stroke();

        // Path leading to player area
        ctx.fillStyle = '#141816';
        ctx.beginPath();
        ctx.moveTo(w * 0.35, h * 0.6);
        ctx.lineTo(w * 0.65, h * 0.6);
        ctx.lineTo(w * 0.55, h);
        ctx.lineTo(w * 0.45, h);
        ctx.closePath();
        ctx.fill();
    }

    drawServiceArea(ctx, w, h) {
        ctx.fillStyle = '#141416';
        ctx.fillRect(0, h * 0.55, w, h * 0.45);

        // Utility building
        ctx.fillStyle = '#1a1a1c';
        ctx.fillRect(w * 0.2, h * 0.2, w * 0.6, h * 0.4);

        // Door
        ctx.fillStyle = '#0e0e10';
        ctx.fillRect(w * 0.42, h * 0.35, w * 0.16, h * 0.25);

        // Pipes
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(w * 0.82, h * 0.25);
        ctx.lineTo(w * 0.82, h * 0.55);
        ctx.lineTo(w * 0.9, h * 0.55);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(w * 0.86, h * 0.3);
        ctx.lineTo(w * 0.86, h * 0.55);
        ctx.stroke();

        // Electrical box
        ctx.fillStyle = '#252528';
        ctx.fillRect(w * 0.12, h * 0.3, w * 0.06, h * 0.12);
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        ctx.strokeRect(w * 0.12, h * 0.3, w * 0.06, h * 0.12);
    }

    drawOldHouse(ctx, w, h) {
        ctx.fillStyle = '#121210';
        ctx.fillRect(0, h * 0.55, w, h * 0.45);

        // House
        ctx.fillStyle = '#1a1816';
        ctx.fillRect(w * 0.15, h * 0.25, w * 0.7, h * 0.35);

        // Roof
        ctx.fillStyle = '#161412';
        ctx.beginPath();
        ctx.moveTo(w * 0.1, h * 0.25);
        ctx.lineTo(w * 0.5, h * 0.08);
        ctx.lineTo(w * 0.9, h * 0.25);
        ctx.closePath();
        ctx.fill();

        // Windows
        ctx.fillStyle = '#0a0c14';
        ctx.fillRect(w * 0.22, h * 0.32, w * 0.12, h * 0.1);
        ctx.fillRect(w * 0.66, h * 0.32, w * 0.12, h * 0.1);

        // Broken window detail
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(w * 0.24, h * 0.35);
        ctx.lineTo(w * 0.3, h * 0.39);
        ctx.stroke();

        // Door
        ctx.fillStyle = '#141210';
        ctx.fillRect(w * 0.43, h * 0.35, w * 0.14, h * 0.25);
        // Door slightly open
        ctx.fillStyle = '#060608';
        ctx.fillRect(w * 0.43, h * 0.35, w * 0.03, h * 0.25);

        // Porch
        ctx.fillStyle = '#1a1816';
        ctx.fillRect(w * 0.2, h * 0.58, w * 0.6, h * 0.04);
    }

    drawCentralPath(ctx, w, h) {
        ctx.fillStyle = '#101210';
        ctx.fillRect(0, h * 0.45, w, h * 0.55);

        // Crossroads path
        ctx.fillStyle = '#181a18';
        // Vertical path
        ctx.fillRect(w * 0.4, 0, w * 0.2, h);
        // Horizontal path
        ctx.fillRect(0, h * 0.35, w, h * 0.15);

        // Center marker / fountain
        ctx.fillStyle = '#1e1e20';
        ctx.beginPath();
        ctx.arc(w * 0.5, h * 0.42, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#2a2a2c';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Statue silhouette
        ctx.fillStyle = '#2a2a2c';
        ctx.fillRect(w * 0.48, h * 0.25, w * 0.04, h * 0.17);
        ctx.beginPath();
        ctx.arc(w * 0.5, h * 0.24, 8, 0, Math.PI * 2);
        ctx.fill();

        // Lantern posts
        ctx.fillStyle = '#222';
        ctx.fillRect(w * 0.25, h * 0.3, 3, h * 0.2);
        ctx.fillRect(w * 0.75, h * 0.3, 3, h * 0.2);

        // Dim light glow
        ctx.fillStyle = 'rgba(50,40,20,0.15)';
        ctx.beginPath();
        ctx.arc(w * 0.252, h * 0.3, 15, 0, Math.PI * 2);
        ctx.fill();
    }

    drawEnemyInCamera(ctx, w, h, enemy, idx, total) {
        // Position enemy in camera view
        const offsetX = total > 1 ? (idx / (total - 1) - 0.5) * w * 0.3 : 0;
        const cx = w * 0.5 + offsetX;
        const baseY = h * 0.25;

        ctx.globalAlpha = enemy.hiding ? 0.15 : 0.85;

        // Shadow beneath
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(cx, h * 0.72, 20, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        if (enemy.hiding && enemy instanceof TwistedFoxy) {
            // Only show parts
            const parts = enemy.bodyParts;
            const partIdx = Math.floor(Math.random() * parts.length);
            if (parts[partIdx] === 'eye' || parts[partIdx] === 'hook') {
                // Just glowing eye
                ctx.fillStyle = '#ff3333';
                ctx.beginPath();
                ctx.arc(cx + 15, baseY + 10, 3, 0, Math.PI * 2);
                ctx.fill();
                // Faint glow
                ctx.fillStyle = 'rgba(255,50,50,0.1)';
                ctx.beginPath();
                ctx.arc(cx + 15, baseY + 10, 12, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            return;
        }

        // Full enemy silhouette
        const bodyColor = enemy.color;

        // Head
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.arc(cx, baseY, 18, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        if (enemy.lookingAtCamera) {
            ctx.fillStyle = '#ff3333';
            ctx.beginPath();
            ctx.arc(cx - 6, baseY - 2, 3, 0, Math.PI * 2);
            ctx.arc(cx + 6, baseY - 2, 3, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = '#882222';
            ctx.beginPath();
            ctx.arc(cx - 5, baseY - 2, 2, 0, Math.PI * 2);
            ctx.arc(cx + 5, baseY - 2, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Body
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.moveTo(cx - 16, baseY + 18);
        ctx.lineTo(cx + 16, baseY + 18);
        ctx.lineTo(cx + 20, h * 0.7);
        ctx.lineTo(cx - 20, h * 0.7);
        ctx.closePath();
        ctx.fill();

        // Arms
        ctx.fillRect(cx - 28, baseY + 20, 10, h * 0.25);
        ctx.fillRect(cx + 18, baseY + 20, 10, h * 0.25);

        // Damage details
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            const dx = cx - 10 + Math.random() * 20;
            const dy = baseY + 25 + Math.random() * (h * 0.3);
            ctx.beginPath();
            ctx.moveTo(dx, dy);
            ctx.lineTo(dx + 5 + Math.random() * 5, dy + 3 + Math.random() * 5);
            ctx.stroke();
        }

        // Special features per enemy
        if (enemy instanceof TwistedFreddy) {
            // Top hat
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(cx - 10, baseY - 28, 20, 12);
            ctx.fillRect(cx - 14, baseY - 16, 28, 4);
        } else if (enemy instanceof TwistedBonnie) {
            // Ears
            ctx.fillStyle = bodyColor;
            ctx.fillRect(cx - 8, baseY - 35, 6, 20);
            ctx.fillRect(cx + 2, baseY - 35, 6, 20);
        } else if (enemy instanceof TwistedChica) {
            // Beak
            ctx.fillStyle = '#cc8833';
            ctx.beginPath();
            ctx.moveTo(cx - 4, baseY + 5);
            ctx.lineTo(cx + 4, baseY + 5);
            ctx.lineTo(cx, baseY + 14);
            ctx.closePath();
            ctx.fill();
        } else if (enemy instanceof TwistedFoxy) {
            // Hook
            ctx.strokeStyle = '#aaa';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx + 28, baseY + h * 0.15, 6, 0, Math.PI);
            ctx.stroke();
            // Eye patch
            ctx.fillStyle = '#111';
            ctx.fillRect(cx + 3, baseY - 5, 8, 6);
        } else if (enemy instanceof Springtrap) {
            // Wires / exposed endoskeleton
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 1;
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.moveTo(cx - 12 + i * 8, baseY + 20);
                ctx.bezierCurveTo(
                    cx - 12 + i * 8 + 5, baseY + 30,
                    cx - 12 + i * 8 - 5, baseY + 40,
                    cx - 12 + i * 8 + 3, baseY + 50
                );
                ctx.stroke();
            }
            // Skull peek
            ctx.fillStyle = '#888';
            ctx.beginPath();
            ctx.arc(cx, baseY, 10, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
    }

    drawGlitchEffect(ctx, w, h) {
        // Horizontal glitch lines
        for (let i = 0; i < 3; i++) {
            const y = Math.random() * h;
            const sliceH = 2 + Math.random() * 8;
            const shift = (Math.random() - 0.5) * 20;

            const imageData = ctx.getImageData(0, y, w, sliceH);
            ctx.putImageData(imageData, shift, y);
        }

        // Brief color shift
        ctx.fillStyle = `rgba(${Math.random() * 50},${Math.random() * 100},${Math.random() * 50},0.08)`;
        ctx.fillRect(0, 0, w, h);
    }

    // Draw jumpscare
    drawJumpscare(canvas, enemy, progress) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);

        // Camera shake
        const shakeX = (Math.random() - 0.5) * 20 * (1 - progress);
        const shakeY = (Math.random() - 0.5) * 20 * (1 - progress);
        ctx.save();
        ctx.translate(shakeX, shakeY);

        // Enemy rushing at camera
        const scale = 0.5 + progress * 3;
        const alpha = Math.min(1, progress * 3);
        ctx.globalAlpha = alpha;

        const cx = w / 2;
        const cy = h / 2;

        // Large head
        ctx.fillStyle = enemy.jumpscareColor;
        ctx.beginPath();
        ctx.arc(cx, cy - h * 0.1 * scale, 40 * scale, 0, Math.PI * 2);
        ctx.fill();

        // Wide open mouth
        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath();
        ctx.arc(cx, cy + 5 * scale, 25 * scale, 0, Math.PI);
        ctx.fill();

        // Teeth
        ctx.fillStyle = '#ddd';
        for (let i = 0; i < 8; i++) {
            const tx = cx - 20 * scale + i * 5.5 * scale;
            ctx.fillRect(tx, cy - 2 * scale, 3 * scale, 8 * scale);
        }

        // Glowing eyes
        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 20 * scale;
        ctx.beginPath();
        ctx.arc(cx - 14 * scale, cy - 15 * scale, 6 * scale, 0, Math.PI * 2);
        ctx.arc(cx + 14 * scale, cy - 15 * scale, 6 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Body
        ctx.fillStyle = enemy.jumpscareColor;
        ctx.fillRect(cx - 35 * scale, cy + 20 * scale, 70 * scale, h);

        // Flash effect at start
        if (progress < 0.15) {
            ctx.fillStyle = `rgba(255,255,255,${0.5 - progress * 3})`;
            ctx.fillRect(0, 0, w, h);
        }

        ctx.globalAlpha = 1;
        ctx.restore();

        // Fade to black at end
        if (progress > 0.7) {
            ctx.fillStyle = `rgba(0,0,0,${(progress - 0.7) * 3.3})`;
            ctx.fillRect(0, 0, w, h);
        }
    }

    // Draw minimap
    drawMinimap(canvas, mapManager, enemies, currentCamId) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        ctx.fillStyle = '#0a0a0e';
        ctx.fillRect(0, 0, w, h);

        const rooms = [];
        const padding = 20;
        const drawW = w - padding * 2;
        const drawH = h - padding * 2;

        // Draw connections first
        ctx.strokeStyle = '#2a2a30';
        ctx.lineWidth = 1;
        mapManager.rooms.forEach(room => {
            const rx = padding + room.x * drawW;
            const ry = padding + room.y * drawH;
            room.connections.forEach(conn => {
                const cx2 = padding + conn.x * drawW;
                const cy2 = padding + conn.y * drawH;
                ctx.beginPath();
                ctx.moveTo(rx, ry);
                ctx.lineTo(cx2, cy2);
                ctx.stroke();
            });
        });

        // Draw rooms
        mapManager.rooms.forEach(room => {
            const rx = padding + room.x * drawW;
            const ry = padding + room.y * drawH;
            const isCurrentCam = room.id === currentCamId;
            const isPlayer = room.id === 'player';
            const hasEnemy = enemies.some(e => e.active && e.currentRoom === room.id);

            // Node
            let nodeColor = '#2a2a30';
            let nodeSize = 6;

            if (isPlayer) {
                nodeColor = '#33aaaa';
                nodeSize = 8;
            } else if (isCurrentCam) {
                nodeColor = '#33aaaa';
                nodeSize = 7;
            } else if (hasEnemy) {
                nodeColor = '#cc3333';
                nodeSize = 7;
            }

            // Glow for selected
            if (isCurrentCam || isPlayer) {
                ctx.fillStyle = isPlayer ? 'rgba(51,170,170,0.15)' : 'rgba(51,170,170,0.1)';
                ctx.beginPath();
                ctx.arc(rx, ry, nodeSize + 6, 0, Math.PI * 2);
                ctx.fill();
            }

            // Enemy indicator glow
            if (hasEnemy) {
                ctx.fillStyle = 'rgba(204,51,51,0.15)';
                ctx.beginPath();
                ctx.arc(rx, ry, nodeSize + 5, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.fillStyle = nodeColor;
            ctx.beginPath();
            ctx.arc(rx, ry, nodeSize, 0, Math.PI * 2);
            ctx.fill();

            // Label
            ctx.fillStyle = isCurrentCam ? '#33aaaa' : (hasEnemy ? '#cc6666' : '#555560');
            ctx.font = '8px "Share Tech Mono", monospace';
            ctx.textAlign = 'center';
            const label = isPlayer ? 'YOU' : room.id.toUpperCase().replace('CAM', 'C');
            ctx.fillText(label, rx, ry - nodeSize - 3);
        });

        // Draw enemy positions as small dots
        enemies.forEach(e => {
            if (!e.active) return;
            const room = mapManager.getRoom(e.currentRoom);
            if (!room) return;
            const rx = padding + room.x * drawW;
            const ry = padding + room.y * drawH;

            ctx.fillStyle = e.color;
            ctx.beginPath();
            ctx.arc(rx + 10, ry + 3, 3, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.textAlign = 'left';
    }
}

// ============================================================
// UI MANAGER
// ============================================================
class UI {
    constructor() {
        this.elements = {};
        this.cacheElements();
    }

    cacheElements() {
        const ids = [
            'game-container', 'gameCanvas', 'player-view', 'camera-view',
            'hud-time', 'hud-night', 'hud-alert', 'hud-power-fill',
            'power-value', 'monitor-power-value', 'monitor-time-value',
            'camera-feed', 'cameraCanvas', 'camera-label', 'camera-static',
            'camera-offline', 'movement-detected', 'camera-timestamp',
            'camera-buttons', 'minimapCanvas',
            'btn-open-camera', 'btn-close-camera',
            'btn-left-door', 'btn-right-door',
            'btn-left-light', 'btn-right-light',
            'btn-flashlight',
            'left-door-panel', 'right-door-panel',
            'left-door-status', 'right-door-status',
            'inside-alert-banner', 'btn-enter-springlock',
            'springlock-hud', 'springlock-countdown', 'springlock-msg',
            'btn-exit-springlock',
            'the-thing-overlay', 'thing-figure-wrap', 'thing-img',
            'thing-sequence', 'thing-timer-fill', 'thing-virtual-keys',
            'jumpscare-overlay', 'jumpscareCanvas',
            'event-toast', 'event-toast-text',
            'screen-menu', 'screen-night-intro', 'night-intro-number',
            'screen-gameover', 'gameover-title', 'gameover-reason', 'gameover-time',
            'btn-retry',
            'screen-win', 'win-message', 'win-subtitle', 'btn-next-night',
            'screen-final-win', 'btn-new-game',
            'btn-start-night'
        ];

        ids.forEach(id => {
            this.elements[id] = document.getElementById(id);
        });
    }

    el(id) {
        return this.elements[id];
    }

    show(id) {
        const el = this.el(id);
        if (el) el.classList.remove('hidden');
    }

    hide(id) {
        const el = this.el(id);
        if (el) el.classList.add('hidden');
    }

    showToast(text, duration = 3000) {
        const toast = this.el('event-toast');
        const textEl = this.el('event-toast-text');
        textEl.textContent = text;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), duration);
    }

    updateTime(timeStr) {
        this.el('hud-time').textContent = timeStr;
        this.el('monitor-time-value').textContent = timeStr;
    }

    updateNight(n) {
        this.el('hud-night').textContent = `NIGHT ${n}`;
    }

    showMotionAlert(duration = 2500) {
        const alert = this.el('hud-alert');
        alert.classList.remove('hidden');
        setTimeout(() => alert.classList.add('hidden'), duration);
    }

    buildCameraButtons(cameras, onSelect) {
        const container = this.el('camera-buttons');
        container.innerHTML = '';
        cameras.forEach(cam => {
            const btn = document.createElement('button');
            btn.className = 'cam-btn';
            btn.dataset.camId = cam.id;
            const camNum = cam.id.replace('cam', '');
            btn.textContent = `CAM ${camNum} — ${cam.name}`;
            btn.addEventListener('click', () => onSelect(cam.id));
            container.appendChild(btn);
        });
    }

    highlightCameraButton(camId) {
        const container = this.el('camera-buttons');
        container.querySelectorAll('.cam-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.camId === camId);
        });
    }

    markEnemyCameras(enemies) {
        const container = this.el('camera-buttons');
        container.querySelectorAll('.cam-btn').forEach(btn => {
            const hasEnemy = enemies.some(e => e.active && e.currentRoom === btn.dataset.camId);
            btn.classList.toggle('has-enemy', hasEnemy);
        });
    }
}

// ============================================================
// NIGHT MANAGER
// ============================================================
class NightManager {
    constructor() {
        this.currentNight = 1;
        this.maxNight = 5;
        this.nightDuration = 420; // 7 minutes in seconds (420s)
        this.elapsedTime = 0;
        this.timeOfNight = '12 AM';
        this.nightConfigs = {
            1: { enemySpeed: 0.7, aggression: 0.25, reactionTime: 5, powerDrain: 0.7 },
            2: { enemySpeed: 0.9, aggression: 0.35, reactionTime: 4, powerDrain: 0.9 },
            3: { enemySpeed: 1.1, aggression: 0.50, reactionTime: 3, powerDrain: 1.1 },
            4: { enemySpeed: 1.35, aggression: 0.65, reactionTime: 2.5, powerDrain: 1.3 },
            5: { enemySpeed: 1.6, aggression: 0.80, reactionTime: 2, powerDrain: 1.5 }
        };
    }

    getConfig() {
        return this.nightConfigs[this.currentNight] || this.nightConfigs[1];
    }

    update(dt) {
        this.elapsedTime += dt;
        this.updateTimeDisplay();
    }

    updateTimeDisplay() {
        const progress = Math.min(1, this.elapsedTime / this.nightDuration);
        const hour = Math.floor(progress * 6); // 0 to 6

        const hours = ['12 AM', '1 AM', '2 AM', '3 AM', '4 AM', '5 AM', '6 AM'];
        this.timeOfNight = hours[Math.min(hour, 6)];
    }

    isNightComplete() {
        return this.elapsedTime >= this.nightDuration;
    }

    isFinalNight() {
        return this.currentNight >= this.maxNight;
    }

    getProgressionMultiplier() {
        // Difficulty increases within the night
        const progress = Math.min(1, this.elapsedTime / this.nightDuration);
        return 1 + progress * 0.5;
    }

    reset() {
        this.elapsedTime = 0;
        this.timeOfNight = '12 AM';
    }
}

// ============================================================
// GAME — Main controller
// ============================================================
class Game {
    constructor() {
        this.state = 'menu'; // menu, intro, playing, gameover, win, finalwin, jumpscare, thing
        this.audio = new AudioManager();
        this.ui = new UI();
        this.mapManager = new MapManager();
        this.cameraSystem = new CameraSystem(this.mapManager);
        this.nightManager = new NightManager();
        this.powerSystem = new PowerSystem();
        this.springlockSuit = new SpringlockSuit();
        this.theThing = new TheThing();

        // Renderer
        this.renderer = new Renderer(this.ui.el('gameCanvas'));
        this.cameraRenderer = null; // Initialized when camera opens

        // Enemies
        this.enemies = [
            new TwistedFreddy(),
            new TwistedBonnie(),
            new TwistedChica(),
            new TwistedFoxy(),
            new Springtrap()
        ];

        // Player state
        this.monitorOpen = false;
        this.flashlightOn = false;
        this.leftDoorClosed = false;
        this.rightDoorClosed = false;
        this.leftLightOn = false;
        this.rightLightOn = false;

        // Timing
        this.lastFrameTime = 0;
        this.lastEnemyCheckTime = 0;
        this.lastThingCheckTime = 0;
        this.lastAmbientEventTime = 0;
        this.jumpscareStartTime = 0;
        this.jumpscareEnemy = null;
        this.jumpscareDuration = 1200;

        // Ambient event tracking
        this.ambientEventCooldown = 15000;

        // Animation
        this.animationId = null;

        // Night unlocked
        this.maxUnlockedNight = 1;

        this.init();
    }

    init() {
        this.bindEvents();
        this.ui.buildCameraButtons(this.cameraSystem.cameras, (camId) => this.selectCamera(camId));
        this.showMenu();
    }

    bindEvents() {
        // Menu
        this.ui.el('btn-start-night').addEventListener('click', () => this.startNight());
        this.ui.el('btn-retry').addEventListener('click', () => this.startNight());
        this.ui.el('btn-next-night').addEventListener('click', () => this.nextNight());
        this.ui.el('btn-new-game').addEventListener('click', () => this.newGame());

        // Camera
        this.ui.el('btn-open-camera').addEventListener('click', () => this.openMonitor());
        this.ui.el('btn-close-camera').addEventListener('click', () => this.closeMonitor());

        // Doors
        this.ui.el('btn-left-door').addEventListener('click', () => this.toggleLeftDoor());
        this.ui.el('btn-right-door').addEventListener('click', () => this.toggleRightDoor());

        // Lights
        this.ui.el('btn-left-light').addEventListener('click', () => this.toggleLeftLight());
        this.ui.el('btn-right-light').addEventListener('click', () => this.toggleRightLight());

        // Flashlight
        this.ui.el('btn-flashlight').addEventListener('click', () => this.toggleFlashlight());

        // Springlock
        this.ui.el('btn-enter-springlock').addEventListener('click', () => this.enterSpringlock());
        this.ui.el('btn-exit-springlock').addEventListener('click', () => this.exitSpringlock());

        // Keyboard
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));

        // QTE virtual buttons
        document.querySelectorAll('.qte-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.key;
                if (this.state === 'thing') {
                    this.handleThingInput(key === 'SPACE' ? ' ' : key);
                }
            });
        });

        // Initialize audio on first user interaction
        const initAudio = () => {
            this.audio.init();
            this.audio.resume();
            document.removeEventListener('click', initAudio);
            document.removeEventListener('keydown', initAudio);
        };
        document.addEventListener('click', initAudio);
        document.addEventListener('keydown', initAudio);

        // Window resize
        window.addEventListener('resize', () => {
            this.renderer.resize();
            if (this.cameraRenderer) {
                // Resize camera canvas
                const camCanvas = this.ui.el('cameraCanvas');
                const feed = this.ui.el('camera-feed');
                camCanvas.width = feed.clientWidth;
                camCanvas.height = feed.clientHeight;
            }
        });
    }

    handleKeyDown(e) {
        if (this.state === 'thing') {
            e.preventDefault();
            this.handleThingInput(e.key.toUpperCase() === ' ' ? ' ' : e.key.toUpperCase());
            return;
        }

        if (this.state !== 'playing') return;

        switch (e.key.toLowerCase()) {
            case 'tab':
            case 'c':
                e.preventDefault();
                this.toggleMonitor();
                break;
            case 'q':
                this.toggleLeftDoor();
                break;
            case 'e':
                if (this.springlockSuit.active) {
                    this.exitSpringlock();
                } else if (document.getElementById('inside-alert-banner').classList.contains('hidden') === false) {
                    this.enterSpringlock();
                } else {
                    this.toggleRightDoor();
                }
                break;
            case 'a':
                this.toggleLeftLight();
                break;
            case 'd':
                this.toggleRightLight();
                break;
            case 'f':
                this.toggleFlashlight();
                break;
            case ' ':
                e.preventDefault();
                if (document.getElementById('inside-alert-banner').classList.contains('hidden') === false) {
                    this.enterSpringlock();
                }
                break;
            case '1': case '2': case '3': case '4': case '5':
            case '6': case '7': case '8': case '9':
                if (this.monitorOpen) {
                    const camNum = e.key.padStart(2, '0');
                    this.selectCamera('cam' + camNum);
                }
                break;
            case '0':
                if (this.monitorOpen) {
                    this.selectCamera('cam10');
                }
                break;
        }
    }

    handleKeyUp(e) {
        // Lights are toggle in this implementation
    }

    // ===== STATE MANAGEMENT =====
    showMenu() {
        this.state = 'menu';
        this.hideAllScreens();
        this.ui.show('screen-menu');

        // Update button text based on unlocked nights
        const btn = this.ui.el('btn-start-night');
        btn.textContent = `START NIGHT ${this.nightManager.currentNight}`;
    }

    hideAllScreens() {
        ['screen-menu', 'screen-night-intro', 'screen-gameover', 'screen-win', 'screen-final-win',
            'player-view', 'camera-view', 'inside-alert-banner', 'springlock-hud',
            'the-thing-overlay', 'jumpscare-overlay'].forEach(id => this.ui.hide(id));
    }

    startNight() {
        this.audio.init();
        this.audio.resume();
        this.hideAllScreens();

        // Reset systems
        this.resetGameState();

        // Show night intro
        this.state = 'intro';
        this.ui.el('night-intro-number').textContent = this.nightManager.currentNight === 5 ?
            'NIGHT 5 — NIGHTMARE' : `NIGHT ${this.nightManager.currentNight}`;
        this.ui.show('screen-night-intro');

        // After intro, start playing
        setTimeout(() => {
            this.ui.hide('screen-night-intro');
            this.state = 'playing';
            this.ui.show('player-view');
            this.ui.updateNight(this.nightManager.currentNight);
            this.ui.updateTime('12 AM');

            // Activate enemies based on night
            this.activateEnemiesForNight();

            // Start ambient
            this.audio.playWind();

            // Start game loop
            this.lastFrameTime = performance.now();
            this.gameLoop(this.lastFrameTime);
        }, 3500);
    }

    resetGameState() {
        this.nightManager.reset();
        this.powerSystem.reset();
        this.springlockSuit.reset();
        this.theThing.reset();
        this.cameraSystem.reset();

        this.monitorOpen = false;
        this.flashlightOn = false;
        this.leftDoorClosed = false;
        this.rightDoorClosed = false;
        this.leftLightOn = false;
        this.rightLightOn = false;
        this.lastEnemyCheckTime = 0;
        this.lastThingCheckTime = 0;
        this.lastAmbientEventTime = 0;

        // Reset enemy positions
        this.enemies[0].resetPosition('cam01'); // Freddy
        this.enemies[1].resetPosition('cam03'); // Bonnie
        this.enemies[2].resetPosition('cam02'); // Chica
        this.enemies[3].resetPosition('cam07'); // Foxy
        this.enemies[4].resetPosition('cam08'); // Springtrap

        // Reset door visuals
        this.updateDoorVisuals();

        // Stop audio
        this.audio.stopAll();

        // Cancel animation
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    activateEnemiesForNight() {
        const night = this.nightManager.currentNight;

        // Night 1: Freddy and Bonnie
        this.enemies[0].active = true; // Freddy always
        this.enemies[1].active = true; // Bonnie always

        // Night 2: Add Chica
        this.enemies[2].active = night >= 2;

        // Night 3: Add Foxy and Springtrap
        this.enemies[3].active = night >= 3;
        this.enemies[4].active = night >= 3;

        // Adjust enemy stats based on night
        const config = this.nightManager.getConfig();
        this.enemies.forEach(enemy => {
            if (!enemy.active) return;
            enemy.lastMoveTime = performance.now();
        });
    }

    // ===== GAME LOOP =====
    gameLoop(timestamp) {
        if (this.state !== 'playing') return;

        const dt = (timestamp - this.lastFrameTime) / 1000; // seconds
        this.lastFrameTime = timestamp;

        const config = this.nightManager.getConfig();

        // Update night timer
        this.nightManager.update(dt);
        this.ui.updateTime(this.nightManager.timeOfNight);

        // Check night complete
        if (this.nightManager.isNightComplete()) {
            this.nightComplete();
            return;
        }

        // Update power
        this.powerSystem.update(dt, config, this);

        // Update enemies
        const now = performance.now();
        this.enemies.forEach(enemy => {
            enemy.update(now, this.mapManager, config, this);
        });

        // Check enemy at doors
        this.checkEnemyAtDoors(now);

        // Check for enemies in player area
        this.checkEnemiesInPlayerArea();

        // Update camera glitches
        this.cameraSystem.updateGlitches(config);

        // Check camera alerts
        this.checkCameraAlerts();

        // The Thing check (once every 30 seconds)
        if (now - this.lastThingCheckTime > 30000) {
            this.lastThingCheckTime = now;
            if (this.theThing.tryTrigger()) {
                this.triggerTheThing();
                return;
            }
        }

        // Ambient events
        if (now - this.lastAmbientEventTime > this.ambientEventCooldown) {
            this.lastAmbientEventTime = now;
            this.triggerAmbientEvent();
        }

        // Render
        if (this.monitorOpen) {
            this.renderCameraView();
            this.renderMinimap();
        } else {
            this.renderer.drawOffice(this);
        }

        // Update camera button enemy indicators
        this.ui.markEnemyCameras(this.enemies);

        this.animationId = requestAnimationFrame((t) => this.gameLoop(t));
    }

    // ===== CAMERA SYSTEM =====
    openMonitor() {
        if (this.state !== 'playing' || this.springlockSuit.active) return;
        this.monitorOpen = true;
        this.ui.show('camera-view');
        this.ui.hide('player-view');
        this.audio.playMonitorToggle(true);

        // Initialize camera canvas size
        const camCanvas = this.ui.el('cameraCanvas');
        const feed = this.ui.el('camera-feed');
        camCanvas.width = feed.clientWidth || 800;
        camCanvas.height = feed.clientHeight || 450;

        this.ui.highlightCameraButton(this.cameraSystem.currentCameraId);
        this.updateCameraLabel();
    }

    closeMonitor() {
        this.monitorOpen = false;
        this.ui.hide('camera-view');
        this.ui.show('player-view');
        this.audio.playMonitorToggle(false);
    }

    toggleMonitor() {
        if (this.monitorOpen) this.closeMonitor();
        else this.openMonitor();
    }

    selectCamera(camId) {
        const room = this.mapManager.getRoom(camId);
        if (!room) return;
        this.cameraSystem.switchCamera(camId);
        this.ui.highlightCameraButton(camId);
        this.updateCameraLabel();
        this.audio.playCameraSwitch();
    }

    updateCameraLabel() {
        const room = this.cameraSystem.getCurrentCamera();
        if (room) {
            const camNum = room.id.replace('cam', '');
            this.ui.el('camera-label').textContent = `CAM ${camNum} — ${room.name}`;
        }
        // Update timestamp
        const now = new Date();
        this.ui.el('camera-timestamp').textContent =
            `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    }

    renderCameraView() {
        const room = this.cameraSystem.getCurrentCamera();
        if (!room) return;

        const camCanvas = this.ui.el('cameraCanvas');

        // Camera offline
        if (room.cameraOffline) {
            this.ui.show('camera-offline');
            this.ui.hide('camera-static');
            return;
        } else {
            this.ui.hide('camera-offline');
        }

        // Camera glitch
        if (room.cameraGlitch) {
            this.ui.show('camera-static');
        } else {
            this.ui.hide('camera-static');
        }

        // Render camera scene
        this.renderer.drawCameraView(camCanvas, room, this.enemies, this);

        // Movement detected
        const alerts = this.cameraSystem.getRecentAlerts();
        const relevantAlert = alerts.find(a => a.to === room.id || a.from === room.id);
        if (relevantAlert && !relevantAlert.shown) {
            this.ui.show('movement-detected');
            relevantAlert.shown = true;
            this.audio.playMovementBeep();
            setTimeout(() => this.ui.hide('movement-detected'), 2500);
        }

        // Update timestamp
        this.updateCameraLabel();
    }

    renderMinimap() {
        const minimapCanvas = this.ui.el('minimapCanvas');
        this.renderer.drawMinimap(minimapCanvas, this.mapManager, this.enemies, this.cameraSystem.currentCameraId);
    }

    // ===== DOORS & LIGHTS =====
    toggleLeftDoor() {
        if (this.state !== 'playing' || this.powerSystem.depleted) return;
        this.leftDoorClosed = !this.leftDoorClosed;
        this.audio.playDoorSound(this.leftDoorClosed);
        this.updateDoorVisuals();
    }

    toggleRightDoor() {
        if (this.state !== 'playing' || this.powerSystem.depleted) return;
        this.rightDoorClosed = !this.rightDoorClosed;
        this.audio.playDoorSound(this.rightDoorClosed);
        this.updateDoorVisuals();
    }

    toggleLeftLight() {
        if (this.state !== 'playing' || this.powerSystem.depleted) return;
        this.leftLightOn = !this.leftLightOn;
        if (this.leftLightOn) this.rightLightOn = false;
        this.audio.playFlashlightClick();
        this.updateLightVisuals();
    }

    toggleRightLight() {
        if (this.state !== 'playing' || this.powerSystem.depleted) return;
        this.rightLightOn = !this.rightLightOn;
        if (this.rightLightOn) this.leftLightOn = false;
        this.audio.playFlashlightClick();
        this.updateLightVisuals();
    }

    toggleFlashlight() {
        if (this.state !== 'playing' || this.powerSystem.depleted) return;
        this.flashlightOn = !this.flashlightOn;
        this.audio.playFlashlightClick();
        const btn = this.ui.el('btn-flashlight');
        btn.classList.toggle('active', this.flashlightOn);
    }

    updateDoorVisuals() {
        const leftPanel = this.ui.el('left-door-panel');
        const rightPanel = this.ui.el('right-door-panel');
        const leftStatus = this.ui.el('left-door-status');
        const rightStatus = this.ui.el('right-door-status');

        leftPanel.classList.toggle('closed', this.leftDoorClosed);
        rightPanel.classList.toggle('closed', this.rightDoorClosed);
        leftStatus.textContent = this.leftDoorClosed ? 'CLOSED' : 'OPEN';
        leftStatus.classList.toggle('closed-status', this.leftDoorClosed);
        rightStatus.textContent = this.rightDoorClosed ? 'CLOSED' : 'OPEN';
        rightStatus.classList.toggle('closed-status', this.rightDoorClosed);
    }

    updateLightVisuals() {
        this.ui.el('btn-left-light').classList.toggle('active', this.leftLightOn);
        this.ui.el('btn-right-light').classList.toggle('active', this.rightLightOn);
    }

    // ===== ENEMY CHECKS =====
    checkEnemyAtDoors(now) {
        this.enemies.forEach(enemy => {
            if (!enemy.active || !enemy.atDoor) return;

            // Try to enter
            const entered = enemy.tryEnterPlayerArea(this);
            if (entered) {
                // Show alert
                this.ui.show('inside-alert-banner');
                this.ui.showMotionAlert();
                this.audio.playFootstep(0.5);
            }
        });
    }

    checkEnemiesInPlayerArea() {
        const insideEnemies = this.enemies.filter(e => e.active && e.isInPlayerArea);

        if (insideEnemies.length === 0) {
            this.ui.hide('inside-alert-banner');
            if (this.springlockSuit.active) {
                this.springlockSuit.markSafe();
            }
            return;
        }

        if (this.springlockSuit.active) {
            // In the suit — enemies might leave
            insideEnemies.forEach(enemy => {
                if (Math.random() < 0.02) { // Small chance each frame to leave
                    enemy.isInPlayerArea = false;
                    enemy.currentRoom = 'cam09'; // Back to back gate
                    enemy.atDoor = null;
                }
            });
            return;
        }

        // Not in suit — if monitor is closed and enemy is visible, jumpscare
        if (!this.monitorOpen && !this.springlockSuit.active) {
            // Give a short reaction window
            const firstInside = insideEnemies[0];
            const config = this.nightManager.getConfig();

            // Check if player reacts (springlock button visible)
            if (!document.getElementById('inside-alert-banner').classList.contains('hidden')) {
                // Player has time to react
                // But if enemy has been inside for a while...
                if (!firstInside._insideTime) firstInside._insideTime = performance.now();

                const insideElapsed = (performance.now() - firstInside._insideTime) / 1000;
                if (insideElapsed > config.reactionTime) {
                    // Jumpscare!
                    this.triggerJumpscare(firstInside);
                }
            }
        }
    }

    // ===== SPRINGLOCK SUIT =====
    enterSpringlock() {
        if (this.state !== 'playing' || this.springlockSuit.active) return;
        this.springlockSuit.enter(this);
        if (this.monitorOpen) this.closeMonitor();
    }

    exitSpringlock() {
        if (!this.springlockSuit.active || !this.springlockSuit.safe) return;
        this.springlockSuit.exit(this);

        // Reset enemy inside state
        this.enemies.forEach(e => {
            if (e.isInPlayerArea) {
                e.isInPlayerArea = false;
                e.currentRoom = 'cam09';
                e._insideTime = null;
            }
        });
    }

    // ===== POWER DEPLETION =====
    onPowerDepleted() {
        this.audio.playPowerDown();
        this.leftDoorClosed = false;
        this.rightDoorClosed = false;
        this.leftLightOn = false;
        this.rightLightOn = false;
        this.flashlightOn = false;
        this.updateDoorVisuals();
        this.updateLightVisuals();
        if (this.monitorOpen) this.closeMonitor();
    }

    // ===== JUMPSCARE =====
    triggerJumpscare(enemy) {
        this.state = 'jumpscare';
        this.jumpscareEnemy = enemy;
        this.jumpscareStartTime = performance.now();

        this.hideAllScreens();
        this.ui.show('jumpscare-overlay');

        const jumpCanvas = this.ui.el('jumpscareCanvas');
        jumpCanvas.width = this.renderer.w;
        jumpCanvas.height = this.renderer.h;

        this.audio.playJumpscare();

        const animateJumpscare = (ts) => {
            const elapsed = ts - this.jumpscareStartTime;
            const progress = Math.min(1, elapsed / this.jumpscareDuration);

            this.renderer.drawJumpscare(jumpCanvas, enemy, progress);

            if (progress < 1) {
                requestAnimationFrame(animateJumpscare);
            } else {
                setTimeout(() => this.gameOver(`${enemy.name} GOT YOU`), 500);
            }
        };

        requestAnimationFrame(animateJumpscare);
    }

    // ===== GAME OVER =====
    gameOver(reason) {
        this.state = 'gameover';
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.audio.stopAll();

        this.hideAllScreens();
        this.ui.el('gameover-reason').textContent = reason;
        this.ui.el('gameover-time').textContent = `SURVIVED UNTIL: ${this.nightManager.timeOfNight}`;
        this.ui.show('screen-gameover');
    }

    // ===== NIGHT COMPLETE =====
    nightComplete() {
        this.state = 'win';
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.audio.stopAll();

        this.hideAllScreens();

        if (this.nightManager.isFinalNight()) {
            this.ui.show('screen-final-win');
        } else {
            this.ui.el('win-message').textContent = 'NIGHT COMPLETE';
            this.ui.el('win-subtitle').textContent = `Night ${this.nightManager.currentNight} survived`;
            this.ui.show('screen-win');
            this.maxUnlockedNight = Math.max(this.maxUnlockedNight, this.nightManager.currentNight + 1);
        }
    }

    nextNight() {
        this.nightManager.currentNight++;
        this.startNight();
    }

    newGame() {
        this.nightManager.currentNight = 1;
        this.showMenu();
    }

    // ===== THE THING =====
    triggerTheThing() {
        this.state = 'thing';
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        if (this.monitorOpen) this.closeMonitor();

        this.audio.playThingAmbient();
        this.theThing.active = true;
        this.theThing.generateSequence();

        this.hideAllScreens();
        this.ui.show('the-thing-overlay');

        // Build sequence display
        this.buildThingSequenceUI();

        // Start timer
        this.updateThingTimer();
    }

    buildThingSequenceUI() {
        const container = this.ui.el('thing-sequence');
        container.innerHTML = '';
        this.theThing.sequence.forEach((key, idx) => {
            if (idx > 0) {
                const arrow = document.createElement('span');
                arrow.className = 'qte-arrow';
                arrow.textContent = '→';
                arrow.style.color = '#555';
                arrow.style.margin = '0 4px';
                arrow.style.fontSize = '18px';
                container.appendChild(arrow);
            }
            const el = document.createElement('div');
            el.className = 'qte-key';
            el.textContent = key === 'SPACE' ? 'SP' : key;
            el.dataset.idx = idx;
            if (idx === 0) el.classList.add('current');
            container.appendChild(el);
        });
    }

    updateThingTimer() {
        if (this.state !== 'thing') return;

        const remaining = this.theThing.getTimeRemaining();
        const pct = (remaining / this.theThing.timeLimit) * 100;
        this.ui.el('thing-timer-fill').style.width = Math.max(0, pct) + '%';

        if (remaining <= 0) {
            this.thingFailed();
            return;
        }

        requestAnimationFrame(() => this.updateThingTimer());
    }

    handleThingInput(key) {
        if (this.state !== 'thing') return;

        const result = this.theThing.checkInput(key);
        const keys = this.ui.el('thing-sequence').querySelectorAll('.qte-key');

        switch (result) {
            case 'correct':
                this.audio.playQTEKey(true);
                keys.forEach((k, i) => {
                    k.classList.remove('current');
                    if (i < this.theThing.currentIndex) k.classList.add('success');
                    if (i === this.theThing.currentIndex) k.classList.add('current');
                });
                break;

            case 'complete':
                this.audio.playQTEKey(true);
                keys.forEach(k => { k.classList.remove('current'); k.classList.add('success'); });
                this.thingSuccess();
                break;

            case 'wrong':
                this.audio.playQTEKey(false);
                keys.forEach(k => {
                    k.classList.remove('current', 'success');
                    k.classList.add('fail');
                });
                setTimeout(() => {
                    keys.forEach((k, i) => {
                        k.classList.remove('fail');
                        if (i === 0) k.classList.add('current');
                    });
                }, 400);
                break;

            case 'failed':
                this.thingFailed();
                break;
        }
    }

    thingSuccess() {
        this.theThing.active = false;
        this.ui.hide('the-thing-overlay');
        this.state = 'playing';
        this.ui.show('player-view');
        this.ui.showToast('YOU SURVIVED THE THING', 4000);
        this.lastFrameTime = performance.now();
        this.gameLoop(this.lastFrameTime);
    }

    thingFailed() {
        this.theThing.active = false;
        this.ui.hide('the-thing-overlay');
        this.gameOver('THE THING FOUND YOU');
    }

    // ===== AMBIENT EVENTS =====
    triggerAmbientEvent() {
        if (this.state !== 'playing') return;

        const events = [
            () => this.audio.playDistantSound(),
            () => this.audio.playFootstep(0.1),
            () => {
                if (this.monitorOpen && Math.random() < 0.3) {
                    this.ui.showMotionAlert();
                }
            },
            () => this.audio.playDistantSound(),
        ];

        const event = events[Math.floor(Math.random() * events.length)];
        event();
    }

    // ===== CAMERA ALERTS =====
    checkCameraAlerts() {
        const alerts = this.cameraSystem.getRecentAlerts();
        if (alerts.length > 0 && !this.monitorOpen) {
            // Chance to show motion detected on HUD
            if (Math.random() < 0.4) {
                this.ui.showMotionAlert();
                this.audio.playMovementBeep();
            }
        }
    }
}

// ============================================================
// INITIALIZE
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});
