
        // Variáveis globais
        let metronomes = [];
        let nextId = 1;
        let globalChannel = 'C';
        let globalVolume = 0.5;
        let selectedTimbre = 'click';
        let audioContext = null;
        let intervals = {};

        // Inicializar
        function init() {
            // Criar contexto de áudio
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.log('Erro ao criar contexto de áudio:', e);
            }

            // Ativar áudio no primeiro clique
            document.addEventListener('click', function() {
                if (audioContext && audioContext.state === 'suspended') {
                    audioContext.resume();
                }
            }, { once: true });

            // Controle de volume e timbre
            document.getElementById('volumeSlider').addEventListener('input', function() {
                globalVolume = this.value / 100;
            });

            // Atalhos de teclado
            document.addEventListener('keydown', function(e) {
                if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') {
                    return;
                }

                const key = e.key;
                const num = parseInt(key);
                if (num >= 1 && num <= 9) {
                    if (metronomes[num - 1]) {
                        toggleMetronome(metronomes[num - 1].id);
                    }
                } else if (key === '0' && metronomes[9]) {
                    toggleMetronome(metronomes[9].id);
                }
            });

            // Adicionar metrônomos iniciais
            addMetronome();
            addMetronome();
            addMetronome();
        }

        // Definir canal global
        function setGlobalChannel(channel) {
            globalChannel = channel;
            document.querySelectorAll('.channel-btn').forEach(btn => {
                btn.className = 'channel-btn inactive';
            });
            event.target.className = 'channel-btn active';
        }

        // Adicionar metrônomo
        function addMetronome() {
            if (metronomes.length >= 10) return;

            const newMetronome = {
                id: nextId++,
                name: 'Música ' + (metronomes.length + 1),
                bpm: 120,
                timeSignature: '4/4',
                beats: 4,
                isPlaying: false,
                currentBeat: 0
            };

            metronomes.push(newMetronome);
            renderMetronomes();
        }

        // Remover metrônomo
        function removeMetronome(id) {
            if (metronomes.length <= 1) return;

            stopMetronome(id);
            metronomes = metronomes.filter(m => m.id !== id);
            renderMetronomes();
        }

        // Atualizar metrônomo
        function updateMetronome(id, field, value) {
            const metronome = metronomes.find(m => m.id === id);
            if (!metronome) return;

            if (field === 'bpm') {
                value = Math.max(60, Math.min(200, parseInt(value) || 120));
            }
            if (field === 'timeSignature') {
                const parts = value.split('/');
                metronome.beats = parseInt(parts[0]) || 4;
            }

            metronome[field] = value;

            if (metronome.isPlaying && (field === 'bpm' || field === 'timeSignature')) {
                stopMetronome(id);
                startMetronome(id);
            }

            renderMetronomes();
        }

        // Toggle play/pause
        function toggleMetronome(id) {
            const metronome = metronomes.find(m => m.id === id);
            if (!metronome) return;

            if (metronome.isPlaying) {
                stopMetronome(id);
            } else {
                startMetronome(id);
            }
        }

        // Iniciar metrônomo
        function startMetronome(id) {
            const metronome = metronomes.find(m => m.id === id);
            if (!metronome || metronome.isPlaying) return;

            // Parar todos os outros metrônomos (comportamento solo)
            metronomes.forEach(m => {
                if (m.id !== id && m.isPlaying) {
                    stopMetronome(m.id);
                }
            });

            metronome.isPlaying = true;
            metronome.currentBeat = 0;

            const interval = 60000 / metronome.bpm;

            // Tocar primeiro beat
            playSound(metronome);
            updateBeatIndicator(id, 0);

            intervals[id] = setInterval(() => {
                metronome.currentBeat = (metronome.currentBeat + 1) % metronome.beats;
                playSound(metronome);
                updateBeatIndicator(id, metronome.currentBeat);
            }, interval);

            renderMetronomes();
        }

        // Parar metrônomo
        function stopMetronome(id) {
            const metronome = metronomes.find(m => m.id === id);
            if (!metronome) return;

            if (intervals[id]) {
                clearInterval(intervals[id]);
                delete intervals[id];
            }

            metronome.isPlaying = false;
            metronome.currentBeat = 0;
            updateBeatIndicator(id, -1);
            renderMetronomes();
        }

        // Mudar timbre
        function changeTimbre(timbre) {
            selectedTimbre = timbre;
        }

        // Tocar som com diferentes timbres
        function playSound(metronome) {
            if (!audioContext) return;

            const isFirstBeat = metronome.currentBeat === 0;

            switch (selectedTimbre) {
                case 'click':
                    playClickSound(isFirstBeat); // Original que você gosta
                    break;
                case 'soft':
                    playSoftClickSound(isFirstBeat);
                    break;
                case 'electronic':
                    playElectronicSound(isFirstBeat);
                    break;
                case 'multitrack':
                    playMultitrackSound(isFirstBeat);
                    break;
                case 'warm':
                    playWarmToneSound(isFirstBeat);
                    break;
                default:
                    playClickSound(isFirstBeat);
            }
        }

        // Click original (mantido como estava - você gosta dele)
        function playClickSound(isFirstBeat) {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            const pannerNode = audioContext.createStereoPanner();

            oscillator.connect(gainNode);
            gainNode.connect(pannerNode);
            pannerNode.connect(audioContext.destination);

            const frequency = isFirstBeat ? 1200 : 800;
            oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
            oscillator.type = 'square';

            setupPanAndVolume(pannerNode, gainNode, isFirstBeat, 0.08, 0.25, 0.18);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.08);
        }

        // Soft Click - mais suave e confortável
        function playSoftClickSound(isFirstBeat) {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            const pannerNode = audioContext.createStereoPanner();
            const filterNode = audioContext.createBiquadFilter();

            oscillator.connect(filterNode);
            filterNode.connect(gainNode);
            gainNode.connect(pannerNode);
            pannerNode.connect(audioContext.destination);

            const frequency = isFirstBeat ? 800 : 600;
            oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
            oscillator.type = 'sine';

            // Filtro suave para não machucar o ouvido
            filterNode.type = 'lowpass';
            filterNode.frequency.setValueAtTime(2000, audioContext.currentTime);
            filterNode.Q.setValueAtTime(0.5, audioContext.currentTime);

            setupPanAndVolume(pannerNode, gainNode, isFirstBeat, 0.12, 0.15, 0.12);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.12);
        }

        // Electronic - estilo profissional e suave
        function playElectronicSound(isFirstBeat) {
            const oscillator1 = audioContext.createOscillator();
            const oscillator2 = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            const pannerNode = audioContext.createStereoPanner();
            const filterNode = audioContext.createBiquadFilter();

            oscillator1.connect(filterNode);
            oscillator2.connect(filterNode);
            filterNode.connect(gainNode);
            gainNode.connect(pannerNode);
            pannerNode.connect(audioContext.destination);

            if (isFirstBeat) {
                oscillator1.frequency.setValueAtTime(1000, audioContext.currentTime);
                oscillator2.frequency.setValueAtTime(2000, audioContext.currentTime);
            } else {
                oscillator1.frequency.setValueAtTime(400, audioContext.currentTime);
                oscillator2.frequency.setValueAtTime(800, audioContext.currentTime);
            }

            oscillator1.type = 'sine';
            oscillator2.type = 'triangle';

            // Filtro suave e profissional
            filterNode.type = 'bandpass';
            filterNode.frequency.setValueAtTime(1200, audioContext.currentTime);
            filterNode.Q.setValueAtTime(2, audioContext.currentTime);

            setupPanAndVolume(pannerNode, gainNode, isFirstBeat, 0.1, 0.18, 0.14);

            oscillator1.start(audioContext.currentTime);
            oscillator2.start(audioContext.currentTime);
            oscillator1.stop(audioContext.currentTime + 0.1);
            oscillator2.stop(audioContext.currentTime + 0.1);
        }

        // Estilo Multitrack - usado em gravações profissionais
        function playMultitrackSound(isFirstBeat) {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            const pannerNode = audioContext.createStereoPanner();
            const filterNode = audioContext.createBiquadFilter();
            const reverbNode = audioContext.createConvolver();

            oscillator.connect(filterNode);
            filterNode.connect(gainNode);
            gainNode.connect(pannerNode);
            pannerNode.connect(audioContext.destination);

            const frequency = isFirstBeat ? 880 : 440;
            oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
            oscillator.type = 'triangle';

            // Som mais aberto e natural para multitracks
            filterNode.type = 'highpass';
            filterNode.frequency.setValueAtTime(300, audioContext.currentTime);
            filterNode.Q.setValueAtTime(0.7, audioContext.currentTime);

            setupPanAndVolume(pannerNode, gainNode, isFirstBeat, 0.15, 0.16, 0.13);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.15);
        }

        // Warm Tone - som mais quente e musical
        function playWarmToneSound(isFirstBeat) {
            const oscillator1 = audioContext.createOscillator();
            const oscillator2 = audioContext.createOscillator();
            const oscillator3 = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            const pannerNode = audioContext.createStereoPanner();
            const filterNode = audioContext.createBiquadFilter();

            oscillator1.connect(filterNode);
            oscillator2.connect(filterNode);
            oscillator3.connect(filterNode);
            filterNode.connect(gainNode);
            gainNode.connect(pannerNode);
            pannerNode.connect(audioContext.destination);

            const baseFreq = isFirstBeat ? 440 : 330;
            oscillator1.frequency.setValueAtTime(baseFreq, audioContext.currentTime);
            oscillator2.frequency.setValueAtTime(baseFreq * 1.5, audioContext.currentTime);
            oscillator3.frequency.setValueAtTime(baseFreq * 2, audioContext.currentTime);

            oscillator1.type = 'sine';
            oscillator2.type = 'triangle';
            oscillator3.type = 'sine';

            // Tom mais quente e musical
            filterNode.type = 'lowpass';
            filterNode.frequency.setValueAtTime(1500, audioContext.currentTime);
            filterNode.Q.setValueAtTime(1, audioContext.currentTime);

            setupPanAndVolume(pannerNode, gainNode, isFirstBeat, 0.18, 0.14, 0.11);

            oscillator1.start(audioContext.currentTime);
            oscillator2.start(audioContext.currentTime);
            oscillator3.start(audioContext.currentTime);
            oscillator1.stop(audioContext.currentTime + 0.18);
            oscillator2.stop(audioContext.currentTime + 0.18);
            oscillator3.stop(audioContext.currentTime + 0.18);
        }

        // Configurar pan e volume (função helper atualizada)
        function setupPanAndVolume(pannerNode, gainNode, isFirstBeat, duration, firstVolume = 0.25, secondVolume = 0.18) {
            // Pan L/R/Center
            let panValue = 0;
            if (globalChannel === 'L') panValue = -1;
            if (globalChannel === 'R') panValue = 1;
            pannerNode.pan.setValueAtTime(panValue, audioContext.currentTime);

            // Envelope de volume suave para não machucar o ouvido
            const volume = (isFirstBeat ? firstVolume : secondVolume) * globalVolume;
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
        }

        // Atualizar indicadores de beat
        function updateBeatIndicator(id, currentBeat) {
            const indicators = document.querySelectorAll('[data-id="' + id + '"] .beat-dot');
            indicators.forEach((dot, index) => {
                dot.className = 'beat-dot';
                if (index === currentBeat) {
                    if (index === 0) {
                        dot.className = 'beat-dot accent';
                    } else {
                        dot.className = 'beat-dot active';
                    }
                }
            });
        }

        // Renderizar lista de metrônomos
        function renderMetronomes() {
            const list = document.getElementById('metronomeList');
            list.innerHTML = '';

            metronomes.forEach((m, index) => {
                const item = document.createElement('div');
                item.className = 'metronome-item' + (m.isPlaying ? ' playing' : '');
                item.setAttribute('data-id', m.id);

                let beatIndicators = '';
                for (let i = 0; i < m.beats; i++) {
                    let dotClass = 'beat-dot';
                    if (m.isPlaying && i === m.currentBeat) {
                        dotClass += (i === 0) ? ' accent' : ' active';
                    }
                    beatIndicators += '<div class="' + dotClass + '"></div>';
                }

                item.innerHTML = `
                    <div class="item-number">${index + 1}</div>
                    
                    <div>
                        <input type="text" class="music-input" placeholder="Nome da música..." 
                               value="${m.name}" onchange="updateMetronome(${m.id}, 'name', this.value)">
                    </div>
                    
                    <div class="bmp-container">
                        <input type="number" class="bpm-input" min="60" max="200" 
                               value="${m.bpm}" onchange="updateMetronome(${m.id}, 'bpm', this.value)">
                        <span class="bpm-label">BPM</span>
                    </div>
                    
                    <div>
                        <button class="play-btn ${m.isPlaying ? 'pause' : 'play'}" 
                                onclick="toggleMetronome(${m.id})">
                            ${m.isPlaying ? '⏸' : '▶'}
                        </button>
                    </div>
                    
                    <div>
                        <select class="time-select" onchange="updateMetronome(${m.id}, 'timeSignature', this.value)">
                            <option value="2/4" ${m.timeSignature === '2/4' ? 'selected' : ''}>2/4</option>
                            <option value="3/4" ${m.timeSignature === '3/4' ? 'selected' : ''}>3/4</option>
                            <option value="4/4" ${m.timeSignature === '4/4' ? 'selected' : ''}>4/4</option>
                            <option value="6/8" ${m.timeSignature === '6/8' ? 'selected' : ''}>6/8</option>
                        </select>
                    </div>
                    
                    <div class="beat-indicators">
                        ${beatIndicators}
                    </div>
                    
                    <div>
                        ${metronomes.length > 1 ? 
                            `<button class="remove-btn" onclick="removeMetronome(${m.id})">×</button>` : ''
                        }
                    </div>
                `;

                list.appendChild(item);
            });
        }

        // Inicializar quando página carregar
        document.addEventListener('DOMContentLoaded', init);