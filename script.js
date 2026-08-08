// Variáveis globais
let metronomes = [];
let nextId = 1;
let globalChannel = 'C';
let globalVolume = 0.7; // Volume fixo do sistema
let clickMuted = false; // Mute do click (pad continua tocando)
let selectedTimbre = 'click';
let globalAccentEnabled = true; // Controle global de acentuação
let doubleClickActive = false; // Double Click: BPM dobrado
let audioContext = null;
let intervals = {};
let savedSetlists = [];
let sharedSetlists = [];
let firebaseApp = null;
let firebaseAuth = null;
let firestoreDb = null;
let googleProvider = null;
let currentUser = null;
let firebaseConfigured = false;
let authInitialized = false;
let metronomeSortable = null;
let authReadyResolver = null;
const authReadyPromise = new Promise(resolve => {
    authReadyResolver = resolve;
});

// Variáveis para Tap Tempo
let tapTimes = [];
let tapTimeout = null;

// ── CIFRA ──────────────────────────────────────────────────────
let cifraPanelId = null;      // id do metrônomo com painel aberto
let cifraSemitones = 0;       // semitons deslocados da tonalidade base
let cifraBaseNote  = 'C';     // tom original da cifra quando foi salva

// ── BIBLIOTECA DE CIFRAS ───────────────────────────────────────
// Cache em memória: { 'chave-normalizada': { name, cifra, cifraBaseNote, updatedAt } }
let cifraLibrary = {};

// Normaliza o nome da música para uma chave de busca/documento segura
function cifraKeyFromName(name) {
    return (name || '')
        .trim()
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 120) || 'sem_nome';
}

// Retorna a referência da coleção de cifras do usuário no Firestore
function getCifraLibraryCollection() {
    if (!isCloudAvailable()) return null;
    return firestoreDb.collection('users').doc(currentUser.uid).collection('cifras');
}

// Carrega a biblioteca do localStorage (rápido, sempre disponível)
function cifraLibraryLoadLocal() {
    try {
        const raw = localStorage.getItem('cifra-library');
        if (raw) cifraLibrary = JSON.parse(raw);
    } catch(e) { cifraLibrary = {}; }

    // Migra entradas do formato antigo (chave = nome em minúsculas, sem campo 'name')
    let migrated = false;
    Object.keys(cifraLibrary).forEach(oldKey => {
        const entry = cifraLibrary[oldKey];
        if (entry && entry.cifra && !entry.name) {
            const newKey = cifraKeyFromName(oldKey);
            const displayName = oldKey.replace(/[_\s]+/g, ' ')
                .split(' ')
                .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');
            const newEntry = { ...entry, name: displayName, cloudSynced: false };
            delete cifraLibrary[oldKey];
            cifraLibrary[newKey] = newEntry;
            migrated = true;
        }
    });
    if (migrated) cifraLibraryPersistLocal();
}

function cifraLibraryPersistLocal() {
    try { localStorage.setItem('cifra-library', JSON.stringify(cifraLibrary)); } catch(e) {}
}

// Carrega a biblioteca: localStorage primeiro (instantâneo), depois sincroniza com Firestore se logado
async function cifraLibraryLoad() {
    cifraLibraryLoadLocal();

    if (isCloudAvailable()) {
        try {
            // Migra entradas locais antigas que ainda não têm dono na nuvem
            await cifraLibraryMigrateLocalToCloud();

            const collection = getCifraLibraryCollection();
            const snapshot = await collection.get();
            snapshot.forEach(doc => {
                const data = doc.data() || {};
                if (data.nameKey) {
                    cifraLibrary[data.nameKey] = {
                        name: data.name || '',
                        cifra: data.cifra || '',
                        cifraBaseNote: data.cifraBaseNote || '',
                        updatedAt: data.updatedAt || ''
                    };
                }
            });
            cifraLibraryPersistLocal();
        } catch (e) {
            console.log('Erro ao sincronizar biblioteca de cifras:', e);
        }
    }
}

// Envia entradas que só existem localmente (sem flag cloudSynced) para o Firestore
async function cifraLibraryMigrateLocalToCloud() {
    const collection = getCifraLibraryCollection();
    if (!collection) return;

    const entries = Object.entries(cifraLibrary).filter(([, v]) => v && v.cifra && !v.cloudSynced);
    for (const [key, entry] of entries) {
        try {
            await collection.doc(key).set({
                name: entry.name || '',
                nameKey: key,
                cifra: entry.cifra,
                cifraBaseNote: entry.cifraBaseNote || '',
                updatedAt: new Date().toISOString()
            }, { merge: true });
            entry.cloudSynced = true;
        } catch (e) {
            console.log('Erro ao migrar cifra para nuvem:', key, e);
        }
    }
}

// Salva uma cifra na biblioteca (localStorage sempre + Firestore se logado)
async function cifraLibrarySave(name, cifra, baseNote, semitones) {
    if (!name || !cifra) return;
    const key = cifraKeyFromName(name);
    const entry = {
        name: name.trim(),
        cifra,
        cifraBaseNote: baseNote || '',
        cifraSemitones: 0,
        updatedAt: new Date().toISOString(),
        cloudSynced: false
    };
    cifraLibrary[key] = entry;
    cifraLibraryPersistLocal();

    const collection = getCifraLibraryCollection();
    if (collection) {
        try {
            await collection.doc(key).set({
                name: entry.name,
                nameKey: key,
                cifra: entry.cifra,
                cifraBaseNote: entry.cifraBaseNote,
                cifraSemitones: 0,
                updatedAt: entry.updatedAt
            }, { merge: true });
            entry.cloudSynced = true;
            cifraLibraryPersistLocal();
        } catch (e) {
            console.log('Erro ao salvar cifra na nuvem:', e);
        }
    }
}

function cifraLibraryGet(name) {
    if (!name) return null;
    const key = cifraKeyFromName(name);
    // Busca exata primeiro
    if (cifraLibrary[key]) return cifraLibrary[key];

    // Fallback: busca parcial (nome digitado contido no nome salvo ou vice-versa)
    const entries = Object.entries(cifraLibrary);
    const partial = entries.find(([k]) => k.includes(key) || key.includes(k));
    return partial ? partial[1] : null;
}

// Retorna todas as entradas, ordenadas por nome
function cifraLibraryGetAll() {
    return Object.entries(cifraLibrary)
        .filter(([, v]) => v && v.cifra)
        .map(([key, v]) => ({ key, ...v }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
}

// Exclui uma cifra da biblioteca (localStorage + Firestore)
async function cifraLibraryDelete(key) {
    delete cifraLibrary[key];
    cifraLibraryPersistLocal();

    const collection = getCifraLibraryCollection();
    if (collection) {
        try {
            await collection.doc(key).delete();
        } catch (e) {
            console.log('Erro ao excluir cifra da nuvem:', e);
        }
    }
}

// ── MODAL DA BIBLIOTECA DE CIFRAS ───────────────────────────────
function openCifraLibraryModal() {
    const modal = document.getElementById('cifraLibraryModal');
    if (!modal) return;
    const search = document.getElementById('cifraLibrarySearch');
    if (search) search.value = '';
    modal.style.display = 'flex';
    renderCifraLibraryModal();
}

function closeCifraLibraryModal() {
    const modal = document.getElementById('cifraLibraryModal');
    if (modal) modal.style.display = 'none';
}

function renderCifraLibraryModal() {
    const listEl   = document.getElementById('cifraLibraryList');
    const statusEl = document.getElementById('cifraLibraryStatus');
    const searchEl = document.getElementById('cifraLibrarySearch');
    if (!listEl) return;

    const query = (searchEl?.value || '').trim().toLowerCase();
    let entries = cifraLibraryGetAll();
    if (query) {
        entries = entries.filter(e => (e.name || '').toLowerCase().includes(query));
    }

    if (statusEl) {
        statusEl.textContent = isCloudAvailable()
            ? '☁️ Sincronizado com a nuvem'
            : '💾 Salvo apenas neste navegador';
    }

    if (entries.length === 0) {
        listEl.innerHTML = '<p class="cifra-library-empty">Nenhuma cifra encontrada.</p>';
        return;
    }

    listEl.innerHTML = entries.map(e => {
        const date = e.updatedAt ? new Date(e.updatedAt).toLocaleDateString('pt-BR') : '';
        const tone = e.cifraBaseNote ? `Tom: ${escapeHtml(e.cifraBaseNote)}` : '';
        const meta = [tone, date].filter(Boolean).join(' • ');
        return `
            <div class="cifra-library-item">
                <div class="cifra-library-item-info">
                    <strong>${escapeHtml(e.name)}</strong>
                    <small>${meta}</small>
                </div>
                <div class="cifra-library-item-actions">
                    <button class="btn-load" onclick="cifraLibraryApplyToCurrent('${e.key}')">Usar nesta música</button>
                    <button class="btn-delete" onclick="cifraLibraryConfirmDelete('${e.key}')" title="Excluir">×</button>
                </div>
            </div>
        `;
    }).join('');
}

// Aplica a cifra da biblioteca à música atualmente aberta no painel
function cifraLibraryApplyToCurrent(key) {
    if (cifraPanelId === null) {
        alert('Abra a cifra de uma música primeiro (clique no ícone 🎵 na lista).');
        return;
    }
    const entry = cifraLibrary[key];
    if (!entry) return;

    const m = metronomes.find(m => m.id === cifraPanelId);
    const textarea = document.getElementById('cifraTextarea');
    if (m && textarea) {
        textarea.value = entry.cifra;
        m.cifra = entry.cifra;
        m.cifraBaseNote  = entry.cifraBaseNote || '';
        m.cifraSemitones = 0;

        // Detecta/atualiza tom e pad
        const detected = cifraDetectBaseNote(m.cifra) || m.cifraBaseNote;
        if (detected) {
            cifraBaseNote = detected;
            cifraSemitones = 0;
            m.cifraBaseNote = detected;
            const padMatch = PAD_NOTES.find(n => (CIFRA_ENHARMONIC[n] || n) === detected) || detected;
            setPadNote(cifraPanelId, padMatch);
        }
        cifraUpdateTransposeUI();
        if (cifraMode === 'view') cifraRenderPreview();
        _saveCurrentCifra();
    }
    closeCifraLibraryModal();
}

async function cifraLibraryConfirmDelete(key) {
    const entry = cifraLibrary[key];
    const name = entry ? entry.name : key;
    if (!confirm(`Excluir a cifra de "${name}" da biblioteca?`)) return;
    await cifraLibraryDelete(key);
    renderCifraLibraryModal();
}
// ── FIM MODAL BIBLIOTECA ─────────────────────────────────────────
// ── FIM BIBLIOTECA ─────────────────────────────────────────────
let cifraMode = 'edit';       // 'edit' | 'view'

const CIFRA_NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const CIFRA_ENHARMONIC = {
    'Db':'C#','Eb':'D#','Gb':'F#','Ab':'G#','Bb':'A#',
    'Dbm':'C#m','Ebm':'D#m','Gbm':'F#m','Abm':'G#m','Bbm':'A#m'
};

// Regex que detecta um acorde no texto (ex: Am, G, F#m7, Bb/D, C#maj7, F#7M, F#m7(11))
const CHORD_REGEX = /\b([A-G](?:#|b)?(?:m(?:aj)?|M|min|dim|aug|sus|add)?\d*(?:m(?:aj)?|M|min|dim|aug|sus|add)?\d*(?:\([#b]?\d+\))?(?:\/[A-G](?:#|b)?)?)\b/g;

function cifraNormalizeChord(chord) {
    return CIFRA_ENHARMONIC[chord] || chord;
}

function cifraTransposeChord(chord, semitones) {
    // Separa baixo se tiver barra: Am/E
    const slashIdx = chord.indexOf('/');
    let base = chord, bass = '';
    if (slashIdx !== -1) {
        base = chord.slice(0, slashIdx);
        bass = chord.slice(slashIdx); // inclui a barra
    }

    // Transpõe a nota raiz
    const rootMatch = base.match(/^([A-G](?:#|b)?)(.*)/);
    if (!rootMatch) return chord;
    const rootNorm = cifraNormalizeChord(rootMatch[1]);
    const idx = CIFRA_NOTES.indexOf(rootNorm);
    if (idx === -1) return chord;
    const newRoot = CIFRA_NOTES[(idx + semitones + 120) % 12];
    const transposedBase = newRoot + rootMatch[2];

    // Transpõe o baixo se existir
    if (bass) {
        const bassNote = bass.slice(1); // remove a barra
        const bassNorm = cifraNormalizeChord(bassNote);
        const bassIdx = CIFRA_NOTES.indexOf(bassNorm);
        if (bassIdx !== -1) {
            const newBass = CIFRA_NOTES[(bassIdx + semitones + 120) % 12];
            return transposedBase + '/' + newBass;
        }
    }
    return transposedBase;
}

// ── ANÁLISE HARMÔNICA ──────────────────────────────────────────
// Campo harmônico maior: graus I II III IV V VI VII
// Ex: C maior → C Dm Em F G Am Bdim
const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MAJOR_CHORD_QUALITY   = ['', 'm', 'm', '', '', 'm', 'dim'];

// Monta o campo harmônico de uma tônica maior
function buildMajorField(tonicIdx) {
    return MAJOR_SCALE_INTERVALS.map((interval, degree) => {
        const noteIdx = (tonicIdx + interval) % 12;
        return {
            root: CIFRA_NOTES[noteIdx],
            quality: MAJOR_CHORD_QUALITY[degree],
            degree
        };
    });
}

// Extrai a raiz de um acorde (remove qualidade: m, maj, dim, aug, sus, números, /baixo)
function extractChordRoot(chord) {
    const m = chord.match(/^([A-G](?:#|b)?)/);
    return m ? m[1] : null;
}

// Extrai qualidade simplificada: '' (maior) ou 'm' (menor/dim)
function extractChordQuality(chord) {
    // Remove a raiz e o baixo
    const withoutBass = chord.split('/')[0];
    const withoutRoot = withoutBass.replace(/^[A-G](?:#|b)?/, '');
    if (/^m(?!aj)/i.test(withoutRoot) || /dim/.test(withoutRoot)) return 'm';
    return '';
}

// Extrai todos os acordes únicos de uma cifra (só tríades)
function extractChordsFromCifra(text) {
    if (!text) return [];
    const chordSet = new Set();
    const lines = text.split('\n');

    lines.forEach(line => {
        const trimmed = line.trim();
        // Ignora linhas de letra (maioria minúsculas) e seções
        if (/^\[/.test(trimmed)) return;
        const words = trimmed.split(/\s+/).filter(Boolean);
        const chordCount = words.filter(w =>
            /^[A-G](?:#|b)?(?:m(?:aj)?|M|min|dim|aug|sus|add)?\d*(?:m(?:aj)?|M|min|dim|aug|sus|add)?\d*(?:\([#b]?\d+\))?(?:\/[A-G](?:#|b)?)?$/.test(w)
        ).length;
        if (words.length === 0 || chordCount / words.length < 0.5) return;

        words.forEach(w => {
            const rootRaw = extractChordRoot(w);
            if (!rootRaw) return;
            const root    = cifraNormalizeChord(rootRaw);
            const quality = extractChordQuality(w);
            chordSet.add(root + quality);
        });
    });

    return [...chordSet];
}

// Pontua o quanto um conjunto de acordes pertence a um campo harmônico
function scoreField(chords, field) {
    let score = 0;
    let diatonic = 0;

    chords.forEach(chord => {
        const root    = cifraNormalizeChord(extractChordRoot(chord) || '');
        const quality = extractChordQuality(chord);

        const match = field.find(f => f.root === root && f.quality === quality);
        if (match) {
            diatonic++;
            // Peso maior para I, IV, V, VI (graus mais importantes)
            const weights = [3, 1, 1, 2, 2, 2, 0.5];
            score += weights[match.degree] || 1;
        }
        // Dominantes secundárias: acorde maior que não é diatônico pode ser V/x
        // Não penaliza, apenas não pontua
    });

    // Bônus proporcional: campo que cobre mais acordes da cifra
    const coverage = chords.length > 0 ? diatonic / chords.length : 0;
    score *= (0.5 + coverage);

    return score;
}

// Detecta o tom da cifra por análise harmônica
// Retorna a nota raiz MAIOR do campo (ex: música em Am → retorna 'C')
function cifraDetectKeyByHarmony(text) {
    const chords = extractChordsFromCifra(text);
    if (chords.length === 0) return null;

    let bestScore = -1;
    let bestTonic = null;

    CIFRA_NOTES.forEach((note, idx) => {
        const field = buildMajorField(idx);
        const score = scoreField(chords, field);
        if (score > bestScore) {
            bestScore = score;
            bestTonic = note;
        }
    });

    return bestTonic;
}

function cifraDetectBaseNote(text) {
    if (!text) return null;

    // 1. PRIORIDADE MÁXIMA: linha "Tom: Xx" escrita pelo usuário
    //    Esta é a única fonte confiável — detecção harmônica falha em muitos casos
    const match = text.match(/^Tom:\s*([A-G](?:#|b)?m?)/im);
    if (match) {
        const raw = match[1].replace(/m$/, '');
        return cifraNormalizeChord(raw) || raw;
    }

    // 2. Fallback: análise harmônica (apenas quando não há linha Tom:)
    const harmonic = cifraDetectKeyByHarmony(text);
    if (harmonic) return harmonic;

    return null;
}
// ── FIM ANÁLISE HARMÔNICA ──────────────────────────────────────

function cifraGetPadKey(id) {
    const ps = getPadState(id);
    return ps ? (ps.note || 'A') : 'A';
}

let cifraFontSize  = 14;      // tamanho da fonte em px
let cifraTheme     = 'dark';  // 'dark' | 'light'

function cifraZoom(dir) {
    cifraFontSize = Math.min(28, Math.max(10, cifraFontSize + dir));
    const textarea = document.getElementById('cifraTextarea');
    const preview  = document.getElementById('cifraPreview');
    const fsContent = document.getElementById('cifraFsContent');
    if (textarea)  textarea.style.fontSize  = cifraFontSize + 'px';
    if (preview)   preview.style.fontSize   = cifraFontSize + 'px';
    if (fsContent) fsContent.style.fontSize = cifraFontSize + 'px';

    document.querySelectorAll('#cifraZoomLabel, #cifraFsZoomLabel').forEach(el => {
        el.textContent = cifraFontSize + 'px';
    });
}

function cifraToggleTheme() {
    cifraTheme = cifraTheme === 'dark' ? 'light' : 'dark';
    cifraApplyTheme();
}

function cifraApplyTheme() {
    const panel = document.getElementById('cifraPanel');
    const inner = panel ? panel.querySelector('.cifra-panel-inner') : null;
    const fs    = document.getElementById('cifraFullscreen');

    const icon = cifraTheme === 'light' ? '☀️' : '🌙';

    // Atualiza só o ícone (span interno), preservando o texto do botão
    const themeBtn = document.getElementById('cifraThemeBtn');
    if (themeBtn) themeBtn.textContent = icon;

    const fsThemeBtn = document.getElementById('cifraFsThemeBtn');
    if (fsThemeBtn) {
        const span = fsThemeBtn.querySelector('span');
        if (span) span.textContent = icon;
    }

    [inner, fs].forEach(target => {
        if (!target) return;
        if (cifraTheme === 'light') target.classList.add('cifra-light');
        else target.classList.remove('cifra-light');
    });
}

function cifraUpdateTransposeUI() {
    const m = metronomes.find(m => m.id === cifraPanelId);
    if (!m) return;
    const ps     = getPadState(m.id);
    const curKey = ps ? (ps.note || 'A') : 'A';

    document.querySelectorAll('#cifraCurKey, #cifraFsCurKey').forEach(el => {
        el.textContent = curKey;
    });
    const padEl = document.getElementById('cifraPadKey');
    if (padEl) padEl.textContent = curKey;
}

function cifraTranspose(dir) {
    cifraSemitones = (cifraSemitones + dir + 120) % 12;

    // Atualizar o pad para acompanhar: move 1 semitom na direção escolhida
    if (cifraPanelId !== null) {
        const ps = getPadState(cifraPanelId);
        if (ps) {
            const curNote  = ps.note || 'A';
            const curNorm  = cifraNormalizeChord(curNote);
            const curIdx   = CIFRA_NOTES.indexOf(curNorm);
            if (curIdx !== -1) {
                const newNote  = CIFRA_NOTES[(curIdx + dir + 120) % 12];
                const padMatch = PAD_NOTES.find(n => (CIFRA_ENHARMONIC[n] || n) === newNote) || newNote;
                setPadNote(cifraPanelId, padMatch);
            }
        }
    }

    cifraUpdateTransposeUI();
    if (cifraMode === 'view') cifraRenderPreview();
    cifraRenderFullscreen();
}

// Converte texto de cifra em HTML com acordes transpostos e seções destacadas
// (lógica pura, reaproveitada pela visualização e pela impressão)
function cifraTextToHtml(rawText, semitones) {
    const lines = rawText.split('\n');
    let html = '';

    // Regex local (sem flag g persistente) para evitar problemas de lastIndex
    const chordPattern = /[A-G](#|b)?(?:m(?:aj)?|M|min|dim|aug|sus|add)?\d*(?:m(?:aj)?|M|min|dim|aug|sus|add)?\d*(?:\([#b]?\d+\))?(?:\/[A-G](#|b)?)?/g;

    const transposeInline = (text) => {
        return text.replace(chordPattern, (m) => {
            return `<span class="cifra-chord">${escapeHtml(cifraTransposeChord(m, semitones))}</span>`;
        });
    };

    lines.forEach(line => {
        const trimmed = line.trim();

        if (trimmed === '') {
            html += '<div class="cifra-empty-line">&nbsp;</div>';
            return;
        }

        // Linha "Tom: Xx" — transpõe a nota do tom
        if (/^Tom:\s*/i.test(trimmed)) {
            const transposed = trimmed.replace(/^(Tom:\s*)([A-G](?:#|b)?m?)/i, (_, prefix, note) => {
                const rootMatch = note.match(/^([A-G](?:#|b)?)/);
                if (!rootMatch) return prefix + note;
                const root = cifraNormalizeChord(rootMatch[1]);
                const idx  = CIFRA_NOTES.indexOf(root);
                const quality = note.slice(rootMatch[1].length); // 'm' ou ''
                if (idx === -1) return prefix + note;
                const newRoot = CIFRA_NOTES[(idx + semitones + 120) % 12];
                return prefix + newRoot + quality;
            });
            html += `<div class="cifra-lyric-line">${escapeHtml(transposed)}</div>`;
            return;
        }

        // Linha de seção: [Intro], [Verso] etc. — com possíveis acordes depois
        if (/^\[.+\]/.test(trimmed)) {
            const secMatch = trimmed.match(/^(\[.+?\])\s*(.*)/);
            const secLabel = secMatch[1];
            const rest     = secMatch[2] || '';
            let secHtml    = `<span class="cifra-section-label">${escapeHtml(secLabel)}</span>`;
            if (rest) {
                secHtml += ' ' + transposeInline(escapeHtml(rest)).replace(
                    /&amp;|&lt;|&gt;/g, m => ({'&amp;':'&','&lt;':'<','&gt;':'>'}[m])
                );
                // Mais simples: transpõe direto no texto sem escapar antes
                secHtml = `<span class="cifra-section-label">${escapeHtml(secLabel)}</span> ` + transposeInline(rest);
            }
            html += `<div class="cifra-section">${secHtml}</div>`;
            return;
        }

        // Linha de acordes vs linha de letra
        const words = trimmed.split(/\s+/).filter(Boolean);
        const chordCount = words.filter(w => /^[A-G](#|b)?(?:m(?:aj)?|M|min|dim|aug|sus|add)?\d*(?:m(?:aj)?|M|min|dim|aug|sus|add)?\d*(?:\([#b]?\d+\))?(?:\/[A-G](#|b)?)?$/.test(w)).length;
        const isChordLine = words.length > 0 && chordCount / words.length >= 0.6;

        if (isChordLine) {
            html += `<div class="cifra-chord-line">${transposeInline(line)}</div>`;
        } else {
            html += `<div class="cifra-lyric-line">${escapeHtml(line)}</div>`;
        }
    });

    return html || '<p class="cifra-empty-msg">Sem conteúdo para exibir.</p>';
}

function cifraRenderPreview() {
    const textarea = document.getElementById('cifraTextarea');
    const preview  = document.getElementById('cifraPreview');
    if (!textarea || !preview) return;
    preview.innerHTML = cifraTextToHtml(textarea.value, cifraSemitones);
}

// Abre uma janela limpa com a cifra formatada e dispara a impressão
function printCifra() {
    const textarea = document.getElementById('cifraTextarea');
    if (!textarea || !textarea.value.trim()) {
        alert('Não há cifra para imprimir nesta música.');
        return;
    }

    const m = metronomes.find(m => m.id === cifraPanelId);
    const title = m && m.name ? m.name : 'Cifra';
    const tone  = document.getElementById('cifraCurKey')?.textContent || '';
    const contentHtml = cifraTextToHtml(textarea.value, cifraSemitones);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Não foi possível abrir a janela de impressão. Verifique se o navegador bloqueou pop-ups.');
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>${escapeHtml(title)} - Cifra</title>
            <style>
                @page { margin: 18mm 16mm; }
                body {
                    font-family: 'Courier New', Consolas, monospace;
                    font-size: 13px;
                    line-height: 1.7;
                    color: #111;
                    background: #fff;
                    margin: 0;
                    padding: 0;
                }
                .print-header {
                    font-family: Arial, sans-serif;
                    margin-bottom: 18px;
                    border-bottom: 2px solid #111;
                    padding-bottom: 10px;
                }
                .print-header h1 {
                    font-size: 22px;
                    margin: 0 0 4px 0;
                }
                .print-header .tone {
                    font-size: 13px;
                    color: #444;
                }
                .cifra-section {
                    font-weight: bold;
                    text-transform: uppercase;
                    font-size: 12px;
                    letter-spacing: 0.05em;
                    margin-top: 14px;
                    margin-bottom: 2px;
                    color: #555;
                }
                .cifra-chord {
                    font-weight: bold;
                    color: #1a1a1a;
                }
                .cifra-chord-line { white-space: pre; color: #333; }
                .cifra-lyric-line { white-space: pre; }
                .cifra-empty-line { height: 8px; }
                @media print {
                    body { -webkit-print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <div class="print-header">
                <h1>${escapeHtml(title)}</h1>
                ${tone ? `<div class="tone">Tom: ${escapeHtml(tone)}</div>` : ''}
            </div>
            ${contentHtml}
        </body>
        </html>
    `);
    printWindow.document.close();

    // Espera o conteúdo renderizar antes de chamar o print
    printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
    };
}

// ── MODO TELA CHEIA (PALCO) ──────────────────────────────────────
let cifraFsColumns = false;     // true = 2 colunas
let cifraFsScrollRAF = null;       // requestAnimationFrame handle
let cifraFsScrollSpeed = 1;        // multiplicador de velocidade (0.5, 1, 1.5, 2)
let cifraFsScrollAccum = 0;        // acumulador de pixels fracionários
let cifraFsScrollLastTs = null;    // timestamp do último frame

// ── Auto-scroll do painel lateral ──────────────────────────────────
let cifraPanelScrollRAF    = null;
let cifraPanelScrollSpeed  = 1;
let cifraPanelScrollAccum  = 0;
let cifraPanelScrollLastTs = null;

// Divide o texto da cifra em duas metades equilibradas, preferindo cortar
// em uma linha vazia (entre seções) para não partir uma estrofe no meio
function cifraSplitInHalf(rawText) {
    const lines = rawText.split('\n');
    const total = lines.length;
    const target = Math.ceil(total / 2);

    // Procura a linha vazia mais próxima do ponto-alvo (até 8 linhas de tolerância)
    let cutAt = target;
    let bestDist = Infinity;
    for (let i = Math.max(1, target - 8); i <= Math.min(total - 1, target + 8); i++) {
        if (lines[i].trim() === '') {
            const dist = Math.abs(i - target);
            if (dist < bestDist) { bestDist = dist; cutAt = i; }
        }
    }

    return [lines.slice(0, cutAt).join('\n'), lines.slice(cutAt).join('\n')];
}

function cifraRenderFullscreen() {
    const content  = document.getElementById('cifraFsContent');
    const textarea = document.getElementById('cifraTextarea');
    if (!content || !textarea) return;

    content.style.fontSize = cifraFontSize + 'px';

    const rawText = textarea.value.trim();

    if (!rawText) {
        const m = metronomes.find(m => m.id === cifraPanelId);
        const nome = m && m.name ? `"${m.name}"` : 'esta música';
        content.innerHTML = `
            <div class="cifra-fs-empty">
                <div class="cifra-fs-empty-icon">🎵</div>
                <h3>Nenhuma cifra cadastrada</h3>
                <p>A música ${escapeHtml(nome)} ainda não tem cifra salva.</p>
                <p>Feche o modo tela cheia, abra o painel de cifra e adicione a letra e os acordes.</p>
            </div>
        `;
        return;
    }

    if (cifraFsColumns) {
        const [firstHalf, secondHalf] = cifraSplitInHalf(textarea.value);
        content.innerHTML = `
            <div class="cifra-fs-col">${cifraTextToHtml(firstHalf, cifraSemitones)}</div>
            <div class="cifra-fs-col">${cifraTextToHtml(secondHalf, cifraSemitones)}</div>
        `;
    } else {
        content.innerHTML = cifraTextToHtml(textarea.value, cifraSemitones);
    }
}

// Atualiza nome/posição/BPM/compasso/tom e os botões anterior/próxima
function cifraFsUpdateInfoBar() {
    const m = metronomes.find(m => m.id === cifraPanelId);
    if (!m) return;

    const idx = metronomes.findIndex(x => x.id === cifraPanelId);
    const prev = idx > 0 ? metronomes[idx - 1] : null;
    const next = idx < metronomes.length - 1 ? metronomes[idx + 1] : null;

    document.getElementById('cifraFsTitle').textContent = m.name || 'Sem nome';
    document.getElementById('cifraFsPosition').textContent = `${idx + 1} de ${metronomes.length} na lista`;
    document.getElementById('cifraFsBpm').textContent = m.bpm;
    document.getElementById('cifraFsTimeSig').textContent = m.timeSignature || '4/4';

    document.getElementById('cifraFsPrevName').textContent = prev ? (prev.name || 'Sem nome') : '—';
    document.getElementById('cifraFsNextName').textContent = next ? (next.name || 'Sem nome') : '—';
    document.getElementById('cifraFsPrevBtn').disabled = !prev;
    document.getElementById('cifraFsNextBtn').disabled = !next;

    cifraFsUpdatePlayUI();
}

// Sincroniza o botão de play do fullscreen com o estado real do metrônomo
function cifraFsUpdatePlayUI() {
    const m = metronomes.find(m => m.id === cifraPanelId);
    if (!m) return;

    const icon   = document.getElementById('cifraFsPlayIcon');
    const label  = document.getElementById('cifraFsPlayLabel');
    const sub    = document.getElementById('cifraFsPlaySub');
    const status = document.getElementById('cifraFsPlayStatus');
    const dot    = document.getElementById('cifraFsPlayDot');
    const btn    = document.getElementById('cifraFsPlayBtn');

    if (m.isPlaying) {
        icon.textContent = '⏸';
        label.textContent = 'Pause';
        sub.textContent = 'Pausar metrônomo';
        status.textContent = 'Tocando';
        dot.classList.add('cifra-fs-dot-on');
        btn.classList.add('cifra-fs-play-btn-on');
    } else {
        icon.textContent = '▶';
        label.textContent = 'Play';
        sub.textContent = 'Iniciar metrônomo';
        status.textContent = 'Parado';
        dot.classList.remove('cifra-fs-dot-on');
        btn.classList.remove('cifra-fs-play-btn-on');
    }
}

function cifraFsTogglePlay() {
    if (cifraPanelId === null) return;
    toggleMetronome(cifraPanelId);
    cifraFsUpdatePlayUI();
}

// Navega para a música anterior/próxima da lista, mantendo o fullscreen aberto
function cifraFsGoTo(targetId) {
    _saveCurrentCifra();

    // Verifica se a música atual estava tocando, para transferir o play pra próxima
    const previousId = cifraPanelId;
    const wasPlaying = previousId !== null && metronomes.some(x => x.id === previousId && x.isPlaying);

    cifraPanelId = targetId;

    const m = metronomes.find(x => x.id === targetId);
    const textarea = document.getElementById('cifraTextarea');
    if (textarea) textarea.value = (m && m.cifra) ? m.cifra : '';

    const xRoot = (n) => (n || '').match(/^([A-G](?:#|b)?)/)?.[1] || n;
    // Restaura tom base e semitons salvos ao navegar entre músicas
    if (m && m.cifraBaseNote) {
        cifraBaseNote  = cifraNormalizeChord(xRoot(m.cifraBaseNote)) || m.cifraBaseNote;
        cifraSemitones = 0;
        m.cifraSemitones = 0;
        const padMatch = PAD_NOTES.find(n => (CIFRA_ENHARMONIC[n] || n) === cifraBaseNote) || cifraBaseNote;
        setPadNote(targetId, padMatch);
    } else {
        const ps2      = getPadState(targetId);
        const padNote2 = cifraNormalizeChord(xRoot(ps2 ? ps2.note || 'C' : 'C')) || 'C';
        const detected = cifraDetectBaseNote(m ? m.cifra : '');
        cifraBaseNote  = detected || padNote2;
        cifraSemitones = 0;
        if (m) m.cifraBaseNote = cifraBaseNote;
        if (m) m.cifraSemitones = 0;
        const padMatch = PAD_NOTES.find(n => (CIFRA_ENHARMONIC[n] || n) === cifraBaseNote) || cifraBaseNote;
        setPadNote(targetId, padMatch);
    }

    document.getElementById('cifraPanelTitle').textContent = m ? (m.name || 'Sem nome') : 'Cifra';
    cifraRenderFullscreen();
    cifraUpdateTransposeUI();
    cifraFsUpdateInfoBar();
    renderMetronomes();

    // Se a música anterior estava tocando, inicia a nova automaticamente no novo BPM
    // (startMetronome já para qualquer outro metrônomo tocando antes de iniciar este)
    if (wasPlaying) {
        startMetronome(targetId);
    }
}

function cifraFsPrev() {
    const idx = metronomes.findIndex(x => x.id === cifraPanelId);
    if (idx > 0) cifraFsGoTo(metronomes[idx - 1].id);
}

function cifraFsNext() {
    const idx = metronomes.findIndex(x => x.id === cifraPanelId);
    if (idx < metronomes.length - 1) cifraFsGoTo(metronomes[idx + 1].id);
}

// Alterna o layout da cifra entre 1 e 2 colunas
function cifraFsToggleColumns() {
    cifraFsColumns = !cifraFsColumns;
    const content = document.getElementById('cifraFsContent');
    if (content) content.classList.toggle('cifra-fs-two-columns', cifraFsColumns);
    document.querySelectorAll('#cifraFsColumnsBtn, #cifraFsColumnsBtn2').forEach(btn => {
        btn.classList.toggle('cifra-fs-bottom-btn-active', cifraFsColumns);
        btn.classList.toggle('cifra-fs-sidebar-btn-active', cifraFsColumns);
    });
    cifraRenderFullscreen();
}

// Auto-scroll suave do conteúdo da cifra
function cifraFsStopAutoscroll() {
    if (cifraFsScrollRAF) {
        cancelAnimationFrame(cifraFsScrollRAF);
        cifraFsScrollRAF = null;
    }
    cifraFsScrollLastTs = null;
    cifraFsScrollAccum  = 0;
}

function cifraFsToggleAutoscroll() {
    const checkbox = document.getElementById('cifraFsAutoscroll');
    const content  = document.getElementById('cifraFsContent');
    if (!checkbox || !content) return;

    // Lê a velocidade atual do select no momento de ativar
    cifraFsUpdateScrollSpeed();

    if (checkbox.checked) {
        cifraFsStopAutoscroll();

        // Pixels por segundo: base 30px/s × multiplicador
        const PX_PER_SEC = 30;

        function step(ts) {
            if (!cifraFsScrollLastTs) cifraFsScrollLastTs = ts;
            const delta = ts - cifraFsScrollLastTs;
            cifraFsScrollLastTs = ts;

            // Acumula pixels fracionários para não perder sub-pixel
            cifraFsScrollAccum += (PX_PER_SEC * cifraFsScrollSpeed * delta) / 1000;
            const pixels = Math.floor(cifraFsScrollAccum);
            if (pixels >= 1) {
                content.scrollTop += pixels;
                cifraFsScrollAccum -= pixels;
            }

            // Para ao chegar no fim
            if (content.scrollTop + content.clientHeight >= content.scrollHeight - 2) {
                checkbox.checked = false;
                cifraFsStopAutoscroll();
                return;
            }

            cifraFsScrollRAF = requestAnimationFrame(step);
        }

        cifraFsScrollRAF = requestAnimationFrame(step);
    } else {
        cifraFsStopAutoscroll();
    }
}

function cifraFsUpdateScrollSpeed() {
    const select = document.getElementById('cifraFsScrollSpeed');
    if (select) cifraFsScrollSpeed = parseFloat(select.value) || 1;
}

// ── Auto-scroll do painel lateral ──────────────────────────────────
function cifraPanelStopScroll() {
    if (cifraPanelScrollRAF) {
        cancelAnimationFrame(cifraPanelScrollRAF);
        cifraPanelScrollRAF = null;
    }
    cifraPanelScrollLastTs = null;
    cifraPanelScrollAccum  = 0;
}

function cifraTogglePanelScroll() {
    const checkbox = document.getElementById('cifraScrollToggle');
    const content  = document.getElementById('cifraPreview');
    if (!checkbox || !content) return;

    cifraUpdatePanelScrollSpeed();

    if (checkbox.checked) {
        cifraPanelStopScroll();
        const PX_PER_SEC = 30;

        function step(ts) {
            if (!cifraPanelScrollLastTs) cifraPanelScrollLastTs = ts;
            const delta = ts - cifraPanelScrollLastTs;
            cifraPanelScrollLastTs = ts;

            cifraPanelScrollAccum += (PX_PER_SEC * cifraPanelScrollSpeed * delta) / 1000;
            const pixels = Math.floor(cifraPanelScrollAccum);
            if (pixels >= 1) {
                content.scrollTop += pixels;
                cifraPanelScrollAccum -= pixels;
            }

            if (content.scrollTop + content.clientHeight >= content.scrollHeight - 2) {
                checkbox.checked = false;
                cifraPanelStopScroll();
                return;
            }

            cifraPanelScrollRAF = requestAnimationFrame(step);
        }

        cifraPanelScrollRAF = requestAnimationFrame(step);
    } else {
        cifraPanelStopScroll();
    }
}

function cifraUpdatePanelScrollSpeed() {
    const select = document.getElementById('cifraScrollSpeedPanel');
    if (select) cifraPanelScrollSpeed = parseFloat(select.value) || 1;
}

function openCifraFullscreen() {
    if (cifraPanelId === null) return;
    const fs = document.getElementById('cifraFullscreen');
    if (!fs) return;

    cifraRenderFullscreen();
    cifraUpdateTransposeUI();
    cifraFsUpdateInfoBar();
    cifraApplyTheme();

    fs.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeCifraFullscreen() {
    const fs = document.getElementById('cifraFullscreen');
    if (fs) fs.style.display = 'none';
    document.body.style.overflow = '';

    cifraFsStopAutoscroll();
    const checkbox = document.getElementById('cifraFsAutoscroll');
    if (checkbox) checkbox.checked = false;
}

// Fecha com a tecla Esc, navega com as setas
document.addEventListener('keydown', (e) => {
    const fs = document.getElementById('cifraFullscreen');
    if (!fs || fs.style.display !== 'flex') return;

    if (e.key === 'Escape') closeCifraFullscreen();
    if (e.key === 'ArrowRight') cifraFsNext();
    if (e.key === 'ArrowLeft') cifraFsPrev();
});
// ── FIM MODO TELA CHEIA ──────────────────────────────────────────

function setCifraMode(mode) {
    cifraMode = mode;
    const textarea  = document.getElementById('cifraTextarea');
    const preview   = document.getElementById('cifraPreview');
    const editBtn   = document.getElementById('cifraModeEdit');
    const scrollBar = document.getElementById('cifraScrollBar');
    // cifraSaveBtn permanece sempre visível — não esconder
    if (!textarea || !preview) return;

    if (mode === 'edit') {
        textarea.style.display = 'block';
        preview.style.display  = 'none';
        if (editBtn)   editBtn.style.display = 'none';
        if (scrollBar) scrollBar.classList.remove('visible');
        // Para o scroll ao entrar em edição
        cifraPanelStopScroll();
        const chk = document.getElementById('cifraScrollToggle');
        if (chk) chk.checked = false;
    } else {
        textarea.style.display = 'none';
        preview.style.display  = 'block';
        if (editBtn)   editBtn.style.display = '';
        if (scrollBar) scrollBar.classList.add('visible');
    }
}

function openCifraPanel(id) {
    // Se clicar no mesmo já aberto, fecha
    if (cifraPanelId === id) {
        closeCifraPanel();
        return;
    }

    // Salva cifra do painel anterior antes de trocar
    if (cifraPanelId !== null) _saveCurrentCifra();

    cifraPanelId = id;

    const m = metronomes.find(m => m.id === id);
    const panel = document.getElementById('cifraPanel');
    const container = document.getElementById('mainContainer');

    // Título
    document.getElementById('cifraPanelTitle').textContent = m ? (m.name || 'Sem nome') : 'Cifra';

    // Preenche textarea com cifra salva
    const textarea = document.getElementById('cifraTextarea');
    textarea.value = (m && m.cifra) ? m.cifra : '';

    // Restaura tom: usa o que foi salvo. Detect só se nunca definido.
    const extractRoot = (n) => (n || '').match(/^([A-G](?:#|b)?)/)?.[1] || n;
    // Restaura o tom base e os semitons salvos.
    if (m && m.cifraBaseNote) {
        cifraBaseNote  = cifraNormalizeChord(extractRoot(m.cifraBaseNote)) || m.cifraBaseNote;
        cifraSemitones = 0;
        m.cifraSemitones = 0;
        const padMatch = PAD_NOTES.find(n => (CIFRA_ENHARMONIC[n] || n) === cifraBaseNote) || cifraBaseNote;
        setPadNote(id, padMatch);
    } else {
        const ps      = getPadState(id);
        const padRaw  = ps ? (ps.note || 'C') : 'C';
        const padNote = cifraNormalizeChord(extractRoot(padRaw)) || 'C';
        const detected = cifraDetectBaseNote(m ? m.cifra : '');
        cifraBaseNote  = detected || padNote;
        cifraSemitones = 0;
        if (m) m.cifraBaseNote = cifraBaseNote;
        if (m) m.cifraSemitones = 0;
        const padMatch = PAD_NOTES.find(n => (CIFRA_ENHARMONIC[n] || n) === cifraBaseNote) || cifraBaseNote;
        setPadNote(id, padMatch);
    }

    // Se a cifra já tem conteúdo, abre direto em visualização (com scroll disponível)
    // Se está vazia, abre em edição para o usuário digitar
    if (m && m.cifra) {
        cifraRenderPreview();
        setCifraMode('view');
    } else {
        setCifraMode('edit');
    }

    // Transpor UI
    cifraUpdateTransposeUI();

    // Aplicar zoom e tema
    cifraZoom(0);
    cifraApplyTheme();

    // Mostrar painel com animação de expand (flex-basis)
    const wrapper = document.querySelector('.container-split-wrapper');
    panel.style.display = 'block';
    initCifraResize();

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (wrapper) wrapper.classList.add('is-split');
            panel.classList.add('cifra-open');
        });
    });

    // Destacar botão ativo
    renderMetronomes();
}

function _saveCurrentCifra() {
    if (cifraPanelId === null) return;
    const m = metronomes.find(m => m.id === cifraPanelId);
    const textarea = document.getElementById('cifraTextarea');
    if (m && textarea) {
        m.cifra         = textarea.value;
        m.cifraBaseNote = cifraBaseNote;
        m.cifraSemitones = 0;
        saveLastConfig();
    }
}

async function saveCifraPanel() {
    const m = metronomes.find(m => m.id === cifraPanelId);
    const textarea = document.getElementById('cifraTextarea');

    if (m && textarea) {
        m.cifra = textarea.value;

        // Detect automático SOMENTE na primeira vez (cifraBaseNote ainda vazio).
        // Se o usuário já definiu o tom via −/+, NUNCA sobrescreve — nem ao editar o texto.
        if (!cifraBaseNote) {
            const ps       = getPadState(cifraPanelId);
            const detected = cifraDetectBaseNote(m.cifra);
            cifraBaseNote  = detected || (ps ? ps.note || 'C' : 'C');
            cifraSemitones = 0;
            m.cifraSemitones = 0;
            const padMatch = PAD_NOTES.find(n => (CIFRA_ENHARMONIC[n] || n) === cifraBaseNote) || cifraBaseNote;
            setPadNote(cifraPanelId, padMatch);
            cifraUpdateTransposeUI();
        }
    }

    _saveCurrentCifra();
    cifraSemitones = 0;
    if (m) m.cifraSemitones = 0;

    if (m && m.name && m.cifra) {
        await cifraLibrarySave(m.name, m.cifra, m.cifraBaseNote, cifraSemitones);
        if (document.getElementById('cifraLibraryModal')?.style.display === 'flex') {
            renderCifraLibraryModal();
        }
    }

    // Renderiza preview e entra em modo visualizar
    cifraRenderPreview();
    setCifraMode('view');
}

function closeCifraPanel() {
    _saveCurrentCifra();
    cifraPanelStopScroll();
    const chk = document.getElementById('cifraScrollToggle');
    if (chk) chk.checked = false;
    cifraPanelId = null;
    cifraSemitones = 0;
    const panel = document.getElementById('cifraPanel');
    const wrapper = document.querySelector('.container-split-wrapper');

    if (panel) panel.classList.remove('cifra-open');
    if (wrapper) wrapper.classList.remove('is-split');

    setTimeout(() => {
        if (panel && !panel.classList.contains('cifra-open')) {
            panel.style.display = 'none';
            panel.style.width = '';
            panel.style.flexBasis = '';
        }
    }, 320);

    renderMetronomes();
}

// ── RESIZE DO PAINEL DE CIFRA ──────────────────────────────────
function initCifraResize() {
    const handle = document.getElementById('cifraResizeHandle');
    const panel  = document.getElementById('cifraPanel');
    if (!handle || !panel) return;

    let startX, startWidth;

    handle.addEventListener('mousedown', (e) => {
        startX     = e.clientX;
        // getBoundingClientRect é mais confiável que offsetWidth quando height:0
        startWidth = panel.getBoundingClientRect().width || Math.round(window.innerWidth * 0.41);
        handle.classList.add('dragging');
        panel.classList.add('cifra-no-transition');
        document.getElementById('mainContainer')?.classList.add('cifra-no-transition');
        document.body.style.cursor    = 'ew-resize';
        document.body.style.userSelect = 'none';

        function onMove(e) {
            const delta = startX - e.clientX;
            // Garante no mínimo 380px para a lista de metrônomos (grid comprimido), teto de 900px
            const maxAllowed = Math.min(900, Math.max(320, window.innerWidth - 380));
            const newWidth = Math.min(maxAllowed, Math.max(460, startWidth + delta));
            panel.style.width = newWidth + 'px';
            panel.style.flexBasis = newWidth + 'px';
            const inner = panel.querySelector('.cifra-panel-inner');
            if (inner) inner.style.width = newWidth + 'px';
        }

        function onUp() {
            handle.classList.remove('dragging');
            panel.classList.remove('cifra-no-transition');
            document.getElementById('mainContainer')?.classList.remove('cifra-no-transition');
            document.body.style.cursor    = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup',   onUp);
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup',   onUp);
        e.preventDefault();
    });

    // Touch support
    handle.addEventListener('touchstart', (e) => {
        startX     = e.touches[0].clientX;
        startWidth = panel.getBoundingClientRect().width || Math.round(window.innerWidth * 0.41);
        panel.classList.add('cifra-no-transition');
        document.getElementById('mainContainer')?.classList.add('cifra-no-transition');

        function onMove(e) {
            const delta = startX - e.touches[0].clientX;
            const maxAllowed = Math.min(900, Math.max(320, window.innerWidth - 380));
            const newWidth = Math.min(maxAllowed, Math.max(460, startWidth + delta));
            panel.style.width = newWidth + 'px';
            panel.style.flexBasis = newWidth + 'px';
            const inner = panel.querySelector('.cifra-panel-inner');
            if (inner) inner.style.width = newWidth + 'px';
        }

        function onEnd() {
            panel.classList.remove('cifra-no-transition');
            document.getElementById('mainContainer')?.classList.remove('cifra-no-transition');
            handle.removeEventListener('touchmove', onMove);
            handle.removeEventListener('touchend',  onEnd);
        }

        handle.addEventListener('touchmove', onMove);
        handle.addEventListener('touchend',  onEnd);
        e.preventDefault();
    }, { passive: false });
}
// ── FIM CIFRA ──────────────────────────────────────────────────

// ── PAD CONTÍNUO ──────────────────────────────────────────────
// Usa arquivos MP3 da pasta /pads/ — 12 tons, um por nota.
// Nomes: Pad_-_A.mp3, Pad_-_Ab.mp3, Pad_-_Bb.mp3, etc.

const padState = {};

// Mapa nota → nome do arquivo (usa notação b para bemóis)
const PAD_FILE_MAP = {
    'C':  'Pad - C.mp3',
    'Db': 'Pad - Db.mp3',
    'D':  'Pad - D.mp3',
    'Eb': 'Pad - Eb.mp3',
    'E':  'Pad - E.mp3',
    'F':  'Pad - F.mp3',
    'Gb': 'Pad - Gb.mp3',
    'G':  'Pad - G.mp3',
    'Ab': 'Pad - Ab.mp3',
    'A':  'Pad - A.mp3',
    'Bb': 'Pad - Bb.mp3',
    'B':  'Pad - B.mp3',
};

const PAD_NOTES = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

// Nomes de exibição no select (usa bemóis, mais comum na música)
const PAD_NOTE_LABELS = {
    'C':'C', 'Db':'C#', 'D':'D', 'Eb':'D#',
    'E':'E', 'F':'F', 'Gb':'F#', 'G':'G',
    'Ab':'G#', 'A':'A', 'Bb':'A#', 'B':'B'
};

function getPadState(id) {
    if (!padState[id]) {
        padState[id] = {
            note: 'A',
            enabled: false,
            volume: 0.7,
            audioEl: null,
            gainNode: null,
            sourceConnected: false,
            stopTimeoutId: null,
            customStopTimeoutId: null,
        };
    }
    return padState[id];
}

function clearPadStopTimeout(ps, isCustom = false) {
    const timeoutKey = isCustom ? 'customStopTimeoutId' : 'stopTimeoutId';
    if (ps[timeoutKey]) {
        clearTimeout(ps[timeoutKey]);
        ps[timeoutKey] = null;
    }
}

function getPadAudioPath(note) {
    return 'pads/' + (PAD_FILE_MAP[note] || PAD_FILE_MAP['A']);
}

// Pré-carrega o elemento de áudio para a nota (sem tocar ainda)
function loadPadAudio(id) {
    const ps = getPadState(id);
    const path = getPadAudioPath(ps.note);

    // Se já tem o mesmo arquivo carregado, não recarrega
    if (ps.audioEl && ps.audioEl.dataset.note === ps.note) return;

    // Para e descarta o anterior
    if (ps.audioEl) {
        clearPadStopTimeout(ps);
        ps.audioEl.pause();
        ps.audioEl = null;
        ps.gainNode = null;
        ps.sourceConnected = false;
    }

    const el = new Audio(path);
    el.loop = true;
    el.dataset.note = ps.note;
    ps.audioEl = el;
}

const PAD_FADE_IN_S  = 1.5;
const PAD_FADE_OUT_S = 1.5;

function startPad(id) {
    const ps = getPadState(id);
    if (!ps.enabled) return;

    // Cancela qualquer stop/fade pendente antes de iniciar
    clearPadStopTimeout(ps, false);
    clearPadStopTimeout(ps, true);

    if (ps.customAudioEl) {
        startCustomPad(id);
    } else {
        loadPadAudio(id);
        if (!ps.audioEl) return;
        clearPadStopTimeout(ps);

        if (!ps.sourceConnected && audioContext) {
            try {
                const src = audioContext.createMediaElementSource(ps.audioEl);
                const gainNode = audioContext.createGain();
                gainNode.gain.value = 0;
                src.connect(gainNode);
                gainNode.connect(audioContext.destination);
                ps.gainNode = gainNode;
                ps.sourceConnected = true;
            } catch(e) { console.warn('Pad audio connect error:', e); }
        }

        if (ps.gainNode) {
            ps.gainNode.gain.cancelScheduledValues(audioContext.currentTime);
            ps.gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            ps.gainNode.gain.linearRampToValueAtTime(ps.volume, audioContext.currentTime + PAD_FADE_IN_S);
        }

        ps.audioEl.currentTime = 0;
        ps.audioEl.play().catch(e => console.warn('Pad play error:', e));
    }
    updatePadIndicator(id, true);
}

function stopPad(id, fadeOut = true) {
    const ps = getPadState(id);

    function doStop(audioEl, gainNode, isCustom = false) {
        if (!audioEl) return;
        clearPadStopTimeout(ps, isCustom);
        if (fadeOut && gainNode && audioContext) {
            gainNode.gain.cancelScheduledValues(audioContext.currentTime);
            gainNode.gain.setValueAtTime(gainNode.gain.value, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + PAD_FADE_OUT_S);
            const timeoutId = setTimeout(() => {
                audioEl.pause();
                audioEl.currentTime = 0;
                if (isCustom) {
                    ps.customStopTimeoutId = null;
                } else {
                    ps.stopTimeoutId = null;
                }
            }, PAD_FADE_OUT_S * 1000);
            if (isCustom) {
                ps.customStopTimeoutId = timeoutId;
            } else {
                ps.stopTimeoutId = timeoutId;
            }
        } else {
            audioEl.pause();
            audioEl.currentTime = 0;
        }
    }

    doStop(ps.customAudioEl, ps.customGainNode, true);
    doStop(ps.audioEl, ps.gainNode, false);
    updatePadIndicator(id, false);
}

function startCustomPad(id) {
    const ps = getPadState(id);
    if (!ps.customAudioEl) return;
    clearPadStopTimeout(ps, true);

    if (!ps.customSourceConnected && audioContext) {
        try {
            const src = audioContext.createMediaElementSource(ps.customAudioEl);
            const gainNode = audioContext.createGain();
            gainNode.gain.value = 0;
            src.connect(gainNode);
            gainNode.connect(audioContext.destination);
            ps.customGainNode = gainNode;
            ps.customSourceConnected = true;
        } catch(e) { console.warn('Custom pad connect error:', e); }
    }

    if (ps.customGainNode) {
        ps.customGainNode.gain.cancelScheduledValues(audioContext.currentTime);
        ps.customGainNode.gain.setValueAtTime(0, audioContext.currentTime);
        ps.customGainNode.gain.linearRampToValueAtTime(ps.volume, audioContext.currentTime + PAD_FADE_IN_S);
    }

    ps.customAudioEl.currentTime = 0;
    ps.customAudioEl.play().catch(e => console.warn('Custom pad play error:', e));
}

function padHandleFile(id, file) {
    if (!file || !file.type.startsWith('audio')) return;
    const ps = getPadState(id);

    // Descarta arquivo anterior
    if (ps.customAudioEl) {
        clearPadStopTimeout(ps, true);
        ps.customAudioEl.pause();
        ps.customAudioEl = null;
        ps.customGainNode = null;
        ps.customSourceConnected = false;
    }

    const url = URL.createObjectURL(file);
    const el = new Audio(url);
    el.loop = true;
    ps.customAudioEl = el;

    // Atualiza UI
    const drop = document.getElementById('pad-drop-' + id);
    const info = document.getElementById('pad-file-info-' + id);
    const nameEl = document.getElementById('pad-file-name-' + id);
    if (drop) drop.style.display = 'none';
    if (info) info.style.display = 'flex';
    if (nameEl) nameEl.textContent = file.name;

    // Se o metrônomo está tocando, inicia já
    const metro = metronomes.find(m => m.id === id);
    if (metro && metro.isPlaying && ps.enabled) {
        // Para o pad padrão primeiro
        if (ps.audioEl) { ps.audioEl.pause(); ps.audioEl.currentTime = 0; }
        startCustomPad(id);
    }
}

function padRemoveFile(id) {
    const ps = getPadState(id);
    if (ps.customAudioEl) {
        clearPadStopTimeout(ps, true);
        ps.customAudioEl.pause();
        ps.customAudioEl = null;
        ps.customGainNode = null;
        ps.customSourceConnected = false;
    }

    const drop = document.getElementById('pad-drop-' + id);
    const info = document.getElementById('pad-file-info-' + id);
    if (drop) drop.style.display = 'block';
    if (info) info.style.display = 'none';

    // Retoma pad padrão se estiver tocando
    const metro = metronomes.find(m => m.id === id);
    if (metro && metro.isPlaying && ps.enabled) startPad(id);
}

function updatePadIndicator(id, isPlaying) {
    const trigger = document.getElementById('pad-trigger-' + id);
    if (!trigger) return;
    if (isPlaying) {
        trigger.style.borderColor = '#a78bfa';
        trigger.style.boxShadow = '0 0 0 1px rgba(167,139,250,0.35), 0 0 18px rgba(167,139,250,0.18)';
    } else {
        trigger.style.borderColor = '';
        trigger.style.boxShadow = '';
    }
}

function togglePadPanel(id) {
    document.querySelectorAll('.pad-panel').forEach(p => {
        if (p.dataset.padId != id) p.classList.remove('pad-panel-open');
    });
    const panel = document.getElementById('pad-panel-' + id);
    if (panel) panel.classList.toggle('pad-panel-open');
}

function setPadNote(id, note) {
    const ps = getPadState(id);
    const wasPlaying = (!!ps.audioEl && !ps.audioEl.paused) || (!!ps.customAudioEl && !ps.customAudioEl.paused);

    // Para o atual com fade rápido se estiver tocando
    if (wasPlaying) stopPad(id);

    ps.note = note;
    ps.audioEl = null;      // força recarga do novo arquivo
    ps.gainNode = null;
    ps.sourceConnected = false;

    loadPadAudio(id);

    // Retoma se estava tocando
    const metro = metronomes.find(m => m.id === id);
    if (wasPlaying && metro && metro.isPlaying && ps.enabled) {
        startPad(id);
    }

    updatePadNoteUI(id);

    // Persiste a mudança de tom
    saveLastConfig();
}

function togglePadEnabled(id) {
    const ps = getPadState(id);
    setPadEnabled(id, !ps.enabled);
}

function setPadEnabled(id, enabled) {
    const ps = getPadState(id);
    ps.enabled = enabled;

    syncPadEnabledUI(id);

    const metro = metronomes.find(m => m.id === id);
    if (metro && metro.isPlaying) {
        if (enabled) startPad(id);
        else stopPad(id);
    }

    saveLastConfig();
}

function syncPadEnabledUI(id) {
    const ps = getPadState(id);
    const toggleBtn = document.getElementById('pad-toggle-' + id);
    if (toggleBtn) {
        toggleBtn.textContent = ps.enabled ? 'ON' : 'OFF';
        toggleBtn.className = 'pad-toggle-btn' + (ps.enabled ? ' pad-toggle-on' : '');
    }

    const statusChip = document.getElementById('pad-status-' + id);
    if (statusChip) {
        statusChip.textContent = ps.enabled ? 'ON' : 'OFF';
        statusChip.className = 'pad-status-chip' + (ps.enabled ? ' pad-status-on' : '');
    }
}

function setPadVolume(id, val) {
    const ps = getPadState(id);
    ps.volume = val / 100;
    document.getElementById('pad-vol-val-' + id).textContent = val + '%';
    if (ps.gainNode && audioContext) {
        ps.gainNode.gain.setTargetAtTime(ps.volume, audioContext.currentTime, 0.05);
    }
    if (ps.customGainNode && audioContext) {
        ps.customGainNode.gain.setTargetAtTime(ps.volume, audioContext.currentTime, 0.05);
    }

    saveLastConfig();
}

function buildPadNoteOptions() {
    return PAD_NOTES.map(n =>
        `<option value="${n}">${PAD_NOTE_LABELS[n]}</option>`
    ).join('');
}

function buildPadNoteGrid(id, selectedNote) {
    return PAD_NOTES.map(note => `
        <button class="pad-note-btn${selectedNote === note ? ' pad-note-btn-active' : ''}"
                type="button"
                data-pad-id="${id}"
                data-note="${note}"
                onclick="setPadNote(${id}, '${note}')">
            ${PAD_NOTE_LABELS[note]}
        </button>
    `).join('');
}

function updatePadNoteUI(id) {
    const ps = getPadState(id);
    const triggerLabel = document.getElementById('pad-current-note-' + id);
    if (triggerLabel) {
        triggerLabel.textContent = PAD_NOTE_LABELS[ps.note] || ps.note;
    }

    document.querySelectorAll(`.pad-note-btn[data-pad-id="${id}"]`).forEach(btn => {
        btn.classList.toggle('pad-note-btn-active', btn.dataset.note === ps.note);
    });
}

function buildPadHTML(id) {
    const ps = getPadState(id);
    const noteGrid = buildPadNoteGrid(id, ps.note);

    return `
    <div class="pad-cell">
        <div class="pad-select-row">
            <button class="pad-trigger-btn"
                    id="pad-trigger-${id}"
                    onclick="togglePadPanel(${id})"
                    title="Selecionar tom do pad">
                <span class="pad-trigger-note" id="pad-current-note-${id}">${PAD_NOTE_LABELS[ps.note]}</span>
            </button>
            <button class="pad-toggle-btn${ps.enabled ? ' pad-toggle-on' : ''}"
                    id="pad-toggle-${id}"
                    onclick="togglePadEnabled(${id})"
                    title="Ativar/desativar pad">${ps.enabled ? 'ON' : 'OFF'}</button>
        </div>

        <div class="pad-panel" id="pad-panel-${id}" data-pad-id="${id}">
            <div class="pad-panel-inner">

                <div class="pad-panel-toprow">
                    <span class="pad-panel-title">🎹 Pad Contínuo <span class="pad-stereo-badge">⟷ STEREO</span></span>
                    <button class="pad-panel-close" onclick="togglePadPanel(${id})">✕</button>
                </div>

                <div class="pad-section-label">Tom</div>
                <div class="pad-note-grid">
                    ${noteGrid}
                </div>

                <div class="pad-section-label">Volume</div>
                <div class="pad-vol-row">
                    <input type="range" min="0" max="100" value="${Math.round(ps.volume * 100)}"
                           oninput="setPadVolume(${id}, this.value)" style="flex:1">
                    <span class="pad-vol-val" id="pad-vol-val-${id}">${Math.round(ps.volume * 100)}%</span>
                </div>

                <div class="pad-section-label" style="margin-top:10px">Arquivo Personalizado</div>
                <div id="pad-drop-${id}" class="pad-drop-zone"
                     onclick="document.getElementById('pad-file-input-${id}').click()"
                     ondragover="event.preventDefault();this.classList.add('pad-drop-hover')"
                     ondragleave="this.classList.remove('pad-drop-hover')"
                     ondrop="event.preventDefault();this.classList.remove('pad-drop-hover');padHandleFile(${id}, event.dataTransfer.files[0])">
                    <input type="file" id="pad-file-input-${id}" accept="audio/*" style="display:none"
                           onchange="padHandleFile(${id}, this.files[0])">
                    <span class="pad-drop-icon">🎵</span>
                    <span class="pad-drop-copy">
                        <span class="pad-drop-title">Usar arquivo proprio</span>
                        <span class="pad-drop-subtitle">MP3 ou WAV para este pad</span>
                    </span>
                </div>
                <div id="pad-file-info-${id}" class="pad-file-info" style="display:none">
                    <span class="pad-file-name" id="pad-file-name-${id}">—</span>
                    <button onclick="padRemoveFile(${id})" class="pad-file-remove" title="Remover arquivo">✕</button>
                </div>

            </div>
        </div>
    </div>
    `;
}
// ── FIM PAD ───────────────────────────────────────────────────

// Variável para lembrar último metrônomo usado com espaço
let lastSpacebarMetronome = null;

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getInitials(name) {
    const cleanName = (name || 'Minha Conta').trim();
    const parts = cleanName.split(/\s+/).filter(Boolean).slice(0, 2);
    if (parts.length === 0) return 'ML';
    return parts.map(part => part[0].toUpperCase()).join('');
}

function buildAvatarMarkup(user, fallbackText) {
    if (user && user.photoURL) {
        return `<img src="${escapeHtml(user.photoURL)}" alt="${escapeHtml(user.displayName || 'Usuário')}">`;
    }
    return escapeHtml(fallbackText);
}

function getFirebaseConfig() {
    return window.METRONOME_FIREBASE_CONFIG || {};
}

function isFirebaseConfigValid(config) {
    const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
    return requiredKeys.every(key => {
        const value = config[key];
        return typeof value === 'string' && value.trim() !== '';
    });
}

function isCloudAvailable() {
    return firebaseConfigured && !!firebaseAuth && !!firestoreDb && !!currentUser;
}

function getSetlistsCollection() {
    if (!isCloudAvailable()) return null;
    return firestoreDb.collection('users').doc(currentUser.uid).collection('setlists');
}

function getSyncStatusText() {
    if (isCloudAvailable()) return 'Setlists sincronizados na nuvem';
    if (firebaseConfigured) return 'Entre com Google para sincronizar na nuvem';
    return 'Setlists locais neste navegador';
}

function setAccountAvatar(el, user, fallbackText) {
    if (!el) return;
    el.innerHTML = buildAvatarMarkup(user, fallbackText);
}

function updateAccountUI() {
    const buttonLabel = document.getElementById('accountButtonLabel');
    const buttonStatus = document.getElementById('accountButtonStatus');
    const syncBadge = document.getElementById('accountSyncBadge');
    const panelTitle = document.getElementById('accountPanelTitle');
    const panelSubtitle = document.getElementById('accountPanelSubtitle');
    const userInfo = document.getElementById('accountUserInfo');
    const userName = document.getElementById('accountUserName');
    const userEmail = document.getElementById('accountUserEmail');
    const loginButton = document.getElementById('accountLoginButton');
    const logoutButton = document.getElementById('accountLogoutButton');
    const syncButton = document.getElementById('accountSyncButton');
    const dropdownNote = document.getElementById('accountDropdownNote');
    const syncStatus = document.getElementById('setlistSyncStatus');
    const accountAvatar = document.getElementById('accountAvatar');
    const accountUserAvatar = document.getElementById('accountUserAvatar');

    if (syncStatus) syncStatus.textContent = getSyncStatusText();

    if (!firebaseConfigured) {
        if (buttonLabel) buttonLabel.textContent = 'Minha Conta';
        if (buttonStatus) buttonStatus.textContent = 'Configure o Firebase';
        if (syncBadge) {
            syncBadge.textContent = 'Local';
            syncBadge.className = 'account-sync-badge warning';
        }
        if (panelTitle) panelTitle.textContent = 'Ative login com Google';
        if (panelSubtitle) panelSubtitle.textContent = 'Preencha a configuração do Firebase para liberar cadastro, login e setlists na nuvem.';
        if (dropdownNote) dropdownNote.textContent = 'Enquanto isso, o app continua salvando tudo localmente neste navegador.';
        if (loginButton) {
            loginButton.textContent = 'Firebase não configurado';
            loginButton.disabled = true;
        }
        if (logoutButton) logoutButton.hidden = true;
        if (syncButton) syncButton.hidden = true;
        if (userInfo) userInfo.hidden = true;
        setAccountAvatar(accountAvatar, null, 'ML');
        setAccountAvatar(accountUserAvatar, null, 'ML');
        return;
    }

    if (!currentUser) {
        if (buttonLabel) buttonLabel.textContent = 'Minha Conta';
        if (buttonStatus) buttonStatus.textContent = 'Login com Google';
        if (syncBadge) {
            syncBadge.textContent = 'Local';
            syncBadge.className = 'account-sync-badge';
        }
        if (panelTitle) panelTitle.textContent = 'Cadastro e login com Google';
        if (panelSubtitle) panelSubtitle.textContent = 'Entre para salvar seus setlists na nuvem e acessar em qualquer dispositivo.';
        if (dropdownNote) dropdownNote.textContent = 'Sem login, os setlists continuam salvos só no navegador atual.';
        if (loginButton) {
            loginButton.textContent = 'Entrar com Google';
            loginButton.disabled = false;
            loginButton.hidden = false;
        }
        if (logoutButton) logoutButton.hidden = true;
        if (syncButton) {
            syncButton.hidden = false;
            syncButton.textContent = 'Atualizar setlists';
        }
        if (userInfo) userInfo.hidden = true;
        setAccountAvatar(accountAvatar, null, 'ML');
        setAccountAvatar(accountUserAvatar, null, 'ML');
        return;
    }

    const displayName = currentUser.displayName || 'Minha Conta';
    const fallbackText = getInitials(displayName);
    if (buttonLabel) buttonLabel.textContent = displayName;
    if (buttonStatus) buttonStatus.textContent = 'Google conectado';
    if (syncBadge) {
        syncBadge.textContent = 'Nuvem';
        syncBadge.className = 'account-sync-badge cloud';
    }
    if (panelTitle) panelTitle.textContent = 'Minha Conta';
    if (panelSubtitle) panelSubtitle.textContent = 'Seus setlists novos passam a ser salvos automaticamente na nuvem.';
    if (dropdownNote) dropdownNote.textContent = 'Os setlists locais existentes sao enviados para a nuvem no primeiro login.';
    if (loginButton) loginButton.hidden = true;
    if (logoutButton) logoutButton.hidden = false;
    if (syncButton) {
        syncButton.hidden = false;
        syncButton.textContent = 'Atualizar setlists da nuvem';
    }
    if (userInfo) userInfo.hidden = false;
    if (userName) userName.textContent = displayName;
    if (userEmail) userEmail.textContent = currentUser.email || 'Conta Google conectada';
    setAccountAvatar(accountAvatar, currentUser, fallbackText);
    setAccountAvatar(accountUserAvatar, currentUser, fallbackText);
}

async function initializeFirebase() {
    const config = getFirebaseConfig();
    if (!window.firebase || !isFirebaseConfigValid(config)) {
        firebaseConfigured = false;
        authInitialized = true;
        updateAccountUI();
        if (authReadyResolver) authReadyResolver();
        return;
    }

    try {
        firebaseApp = window.firebase.apps && window.firebase.apps.length
            ? window.firebase.app()
            : window.firebase.initializeApp(config);
        firebaseAuth = window.firebase.auth();
        firestoreDb = window.firebase.firestore();
        googleProvider = new window.firebase.auth.GoogleAuthProvider();
        firebaseConfigured = true;

        firebaseAuth.onAuthStateChanged(async user => {
            currentUser = user || null;
            updateAccountUI();
            if (currentUser) {
                await migrateLocalSetlistsToCloud();
            }
            await loadSavedSetlists();
            renderSetlistManager();
            await cifraLibraryLoad();

            if (!authInitialized) {
                authInitialized = true;
                if (authReadyResolver) authReadyResolver();
            }
        });
    } catch (error) {
        console.error('Erro ao inicializar Firebase:', error);
        firebaseConfigured = false;
        authInitialized = true;
        updateAccountUI();
        if (authReadyResolver) authReadyResolver();
    }
}

// Detectar se storage está disponível
const hasClaudeStorage = typeof window.storage !== 'undefined';

// Funções de storage com fallback para localStorage
async function storageSet(key, value, shared = false) {
    if (hasClaudeStorage) {
        try {
            return await window.storage.set(key, value, shared);
        } catch (e) {
            console.log('Erro storage:', e);
            return null;
        }
    } else {
        localStorage.setItem(key, value);
        return { key, value, shared };
    }
}

async function storageGet(key, shared = false) {
    if (hasClaudeStorage) {
        try {
            return await window.storage.get(key, shared);
        } catch (e) {
            return null;
        }
    } else {
        const value = localStorage.getItem(key);
        return value ? { key, value, shared } : null;
    }
}

async function storageDelete(key, shared = false) {
    if (hasClaudeStorage) {
        try {
            return await window.storage.delete(key, shared);
        } catch (e) {
            return null;
        }
    } else {
        localStorage.removeItem(key);
        return { key, deleted: true, shared };
    }
}

async function storageList(prefix, shared = false) {
    if (hasClaudeStorage) {
        try {
            return await window.storage.list(prefix, shared);
        } catch (e) {
            return { keys: [] };
        }
    } else {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                keys.push(key);
            }
        }
        return { keys };
    }
}

async function signInWithGoogle() {
    if (!firebaseConfigured || !firebaseAuth || !googleProvider) {
        alert('Configure o Firebase para habilitar o login com Google.');
        return;
    }

    try {
        await firebaseAuth.signInWithPopup(googleProvider);
        if (typeof toggleAccountMenu === 'function') toggleAccountMenu(false);
    } catch (error) {
        console.error('Erro no login com Google:', error);
        alert('Nao foi possivel entrar com Google agora. Tente novamente.');
    }
}

async function signOutUser() {
    if (!firebaseAuth) return;

    try {
        await firebaseAuth.signOut();
        if (typeof toggleAccountMenu === 'function') toggleAccountMenu(false);
        alert('Voce saiu da sua conta.');
    } catch (error) {
        console.error('Erro ao sair:', error);
        alert('Nao foi possivel sair da conta agora.');
    }
}

async function refreshCloudSetlists() {
    await loadSavedSetlists();
    renderSetlistManager();
    updateAccountUI();

    if (isCloudAvailable()) {
        alert('Setlists da nuvem atualizados.');
    } else {
        alert('Lista local atualizada.');
    }
}

async function migrateLocalSetlistsToCloud() {
    const collection = getSetlistsCollection();
    if (!collection) return;

    try {
        const localResult = await storageList('setlist-', false);
        const localKeys = (localResult && localResult.keys) ? localResult.keys : [];
        if (localKeys.length === 0) return;

        const existingSnapshot = await collection.get();
        const importedKeys = new Set();
        existingSnapshot.forEach(doc => {
            const data = doc.data() || {};
            if (data.importedFromLocalKey) {
                importedKeys.add(data.importedFromLocalKey);
            }
        });

        for (const key of localKeys) {
            if (importedKeys.has(key)) continue;
            const localEntry = await storageGet(key, false);
            if (!localEntry || !localEntry.value) continue;

            const data = JSON.parse(localEntry.value);
            data.importedFromLocalKey = key;
            data.ownerUid = currentUser.uid;
            data.syncedAt = new Date().toISOString();
            await collection.add(data);
        }
    } catch (error) {
        console.error('Erro ao migrar setlists locais:', error);
    }
}

// Inicializar
async function init() {
    try {
        console.log('🚀 Iniciando metrônomo...');
        cifraLibraryLoadLocal();
        
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('✅ Contexto de áudio criado');
        } catch (e) {
            console.log('❌ Erro ao criar contexto de áudio:', e);
        }

        document.addEventListener('click', function() {
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume();
            }
        }, { once: true });

        await initializeFirebase();
        await authReadyPromise;
        updateAccountUI();

        // Remover controle de volume (agora é fixo)
        // const volumeSlider = document.getElementById('volumeSlider');
        // if (volumeSlider) {
        //     volumeSlider.addEventListener('input', function() {
        //         globalVolume = this.value / 100;
        //     });
        // }

        document.addEventListener('keydown', function(e) {
            if (document.activeElement.tagName === 'INPUT' || 
                document.activeElement.tagName === 'SELECT' ||
                document.activeElement.tagName === 'TEXTAREA') {
                return;
            }

            const key = e.key;
            
            // Espaço para play/pause do metrônomo atual (último tocado ou primeiro)
            if (key === ' ' || key === 'Spacebar') {
                e.preventDefault(); // Prevenir scroll da página
                
                // Verificar se há metrônomo tocando
                const playingMetronome = metronomes.find(m => m.isPlaying);
                
                if (playingMetronome) {
                    // Se há um tocando, pausar e lembrar qual era
                    lastSpacebarMetronome = playingMetronome.id;
                    toggleMetronome(playingMetronome.id);
                } else if (lastSpacebarMetronome) {
                    // Se lembrar do último, tocar ele novamente
                    const lastMetronome = metronomes.find(m => m.id === lastSpacebarMetronome);
                    if (lastMetronome) {
                        toggleMetronome(lastSpacebarMetronome);
                    } else {
                        // Se o último não existe mais, tocar o primeiro
                        lastSpacebarMetronome = metronomes[0].id;
                        toggleMetronome(metronomes[0].id);
                    }
                } else if (metronomes.length > 0) {
                    // Se não lembra de nenhum, tocar o primeiro e lembrar
                    lastSpacebarMetronome = metronomes[0].id;
                    toggleMetronome(metronomes[0].id);
                }
                return;
            }
            
            // Teclas numéricas para metrônomos específicos
            const num = parseInt(key);
            if (num >= 1 && num <= 9) {
                if (metronomes[num - 1]) {
                    toggleMetronome(metronomes[num - 1].id);
                }
            } else if (key === '0' && metronomes[9]) {
                toggleMetronome(metronomes[9].id);
            }
        });

        await loadSavedSetlists();
        await loadSharedSetlists();

        console.log('📦 Carregando última configuração...');
        const lastConfig = await loadLastConfig();
        console.log('lastConfig:', lastConfig);
        
        if (lastConfig && Array.isArray(lastConfig) && lastConfig.length > 0) {
            metronomes = lastConfig;
            nextId = Math.max(...metronomes.map(m => m.id)) + 1;
            console.log('✅ Configuração carregada:', metronomes.length, 'metrônomos');
        } else {
            console.log('➕ Criando metrônomos padrão...');
            addMetronome();
            addMetronome();
            addMetronome();
            console.log('✅ Metrônomos criados:', metronomes.length);
        }
        
        console.log('🎨 Renderizando interface...');
        renderMetronomes();
        renderSetlistManager();
        console.log('✅ Inicialização completa!');
    } catch (error) {
        console.error('💥 ERRO FATAL na inicialização:', error);
        console.error('Stack:', error.stack);
        // Tentar inicializar de forma básica
        try {
            addMetronome();
            addMetronome();
            addMetronome();
            renderMetronomes();
        } catch (e2) {
            console.error('💥 Falha total:', e2);
        }
    }
}

// Função Tap Tempo
function tapTempo() {
    const now = Date.now();
    tapTimes.push(now);
    
    // Limpar tap timeout anterior
    if (tapTimeout) {
        clearTimeout(tapTimeout);
    }
    
    // Resetar após 2 segundos sem tap
    tapTimeout = setTimeout(() => {
        tapTimes = [];
        document.getElementById('tapBpmDisplay').textContent = '--';
    }, 2000);
    
    // Precisa de pelo menos 2 taps para calcular
    if (tapTimes.length >= 2) {
        // Calcular intervalos entre taps
        const intervals = [];
        for (let i = 1; i < tapTimes.length; i++) {
            intervals.push(tapTimes[i] - tapTimes[i - 1]);
        }
        
        // Média dos intervalos
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        
        // Converter para BPM (60000ms = 1 minuto)
        let bpm = Math.round(60000 / avgInterval);
        
        // Limitar entre 40-300
        bpm = Math.max(40, Math.min(300, bpm));
        
        // Mostrar BPM calculado
        document.getElementById('tapBpmDisplay').textContent = bpm;
        
        // Aplicar no metrônomo ativo ou primeiro
        const activeMetronome = metronomes.find(m => m.isPlaying) || metronomes[0];
        if (activeMetronome) {
            updateMetronome(activeMetronome.id, 'bpm', bpm);
        }
    }
    
    // Manter apenas últimos 4 taps
    if (tapTimes.length > 4) {
        tapTimes.shift();
    }
    
    // Feedback visual
    const btn = document.getElementById('tapTempoBtn');
    btn.style.transform = 'scale(0.95)';
    setTimeout(() => {
        btn.style.transform = 'scale(1)';
    }, 100);
}

async function saveLastConfig() {
    try {
        const config = {
            metronomes: metronomes.map(m => {
                const ps = padState[m.id];
                return {
                    id: m.id,
                    name: m.name,
                    bpm: m.bpm,
                    timeSignature: m.timeSignature,
                    beats: m.beats,
                    cifra: m.cifra || '',
                    cifraBaseNote: m.cifraBaseNote || '',
                    cifraSemitones: 0,
                    padNote: ps ? ps.note : 'A',
                    padEnabled: ps ? ps.enabled : false,
                    padVolume: ps ? ps.volume : 0.7
                };
            }),
            globalAccentEnabled: globalAccentEnabled
        };
        await storageSet('last-config', JSON.stringify(config), false);
    } catch (error) {
        console.log('Erro ao salvar:', error);
    }
}

async function loadLastConfig() {
    try {
        const result = await storageGet('last-config', false);
        if (result && result.value) {
            const config = JSON.parse(result.value);
            
            // Suportar formato antigo (array) e novo (objeto)
            if (Array.isArray(config)) {
                return config.map(m => ({
                    ...m,
                    isPlaying: false,
                    currentBeat: 0
                }));
            } else {
                // Formato novo com globalAccentEnabled
                globalAccentEnabled = config.globalAccentEnabled !== undefined ? config.globalAccentEnabled : true;
                
                // Atualizar UI do botão
                const btn = document.getElementById('globalAccentToggle');
                if (btn) {
                    btn.className = globalAccentEnabled ? 'global-accent-toggle enabled' : 'global-accent-toggle disabled';
                    btn.title = globalAccentEnabled ? 'Desabilitar acentuação global' : 'Habilitar acentuação global';
                }
                
                const loadedMetronomes = config.metronomes.map(m => ({
                    ...m,
                    isPlaying: false,
                    currentBeat: 0
                }));
                // Restaurar padState
                config.metronomes.forEach(m => {
                    const ps = getPadState(m.id);
                    ps.note    = m.padNote    !== undefined ? m.padNote    : 'A';
                    ps.enabled = m.padEnabled !== undefined ? m.padEnabled : false;
                    ps.volume  = m.padVolume  !== undefined ? m.padVolume  : 0.7;
                });
                return loadedMetronomes;
            }
        }
    } catch (error) {
        console.log('Sem config anterior');
    }
    return null;
}

async function saveSetlist() {
    const name = prompt('Digite um nome para este setlist:');
    if (!name) return;

    try {
        const setlistData = {
            name: name,
            date: new Date().toISOString(),
            metronomes: metronomes.map(m => {
                const ps = padState[m.id];
                return {
                    id: m.id,
                    name: m.name,
                    bpm: m.bpm,
                    timeSignature: m.timeSignature,
                    beats: m.beats,
                    cifra: m.cifra || '',
                    cifraBaseNote: m.cifraBaseNote || '',
                    cifraSemitones: 0,
                    padNote: ps ? ps.note : 'A',
                    padEnabled: ps ? ps.enabled : false,
                    padVolume: ps ? ps.volume : 0.7
                };
            }),
            globalSettings: {
                channel: globalChannel,
                volume: globalVolume,
                timbre: selectedTimbre,
                accentEnabled: globalAccentEnabled
            }
        };

        if (isCloudAvailable()) {
            setlistData.ownerUid = currentUser.uid;
            setlistData.syncedAt = new Date().toISOString();
            await getSetlistsCollection().add(setlistData);
        } else {
            const setlistId = 'setlist-' + Date.now();
            await storageSet(setlistId, JSON.stringify(setlistData), false);
        }
        
        alert('Setlist "' + name + '" salvo!');
        await loadSavedSetlists();
        renderSetlistManager();
        updateAccountUI();
    } catch (error) {
        alert('Erro: ' + error.message);
    }
}

async function shareSetlist() {
    if (!hasClaudeStorage) {
        alert('⚠️ "Exportar JSON" para compartilhar manualmente.');
        return;
    }
    
    const name = prompt('Nome para compartilhar:');
    if (!name) return;

    try {
        const setlistData = {
            name: name,
            author: prompt('Seu nome (opcional):') || 'Anônimo',
            date: new Date().toISOString(),
            metronomes: metronomes.map(m => ({
                id: m.id,
                name: m.name,
                bpm: m.bpm,
                timeSignature: m.timeSignature,
                beats: m.beats
            })),
            globalSettings: {
                channel: globalChannel,
                volume: globalVolume,
                timbre: selectedTimbre,
                accentEnabled: globalAccentEnabled
            }
        };

        const shareId = 'shared-' + Date.now();
        await storageSet(shareId, JSON.stringify(setlistData), true);
        
        alert('Setlist compartilhado!');
        await loadSharedSetlists();
        renderSetlistManager();
    } catch (error) {
        alert('Erro: ' + error.message);
    }
}

async function loadSavedSetlists() {
    try {
        savedSetlists = [];

        if (isCloudAvailable()) {
            const snapshot = await getSetlistsCollection().orderBy('date', 'desc').get();
            snapshot.forEach(doc => {
                savedSetlists.push({
                    key: 'cloud:' + doc.id,
                    source: 'cloud',
                    data: doc.data()
                });
            });
        }

        // Só carrega local se não estiver logado na nuvem
        if (!isCloudAvailable()) {
            const result = await storageList('setlist-', false);
            if (result && result.keys) {
                for (const key of result.keys) {
                    const data = await storageGet(key, false);
                    if (data && data.value) {
                        savedSetlists.push({
                            key: key,
                            source: 'local',
                            data: JSON.parse(data.value)
                        });
                    }
                }
            }
        }

        savedSetlists.sort((a, b) => new Date(b.data.date) - new Date(a.data.date));
    } catch (error) {
        console.log('Erro ao listar setlists:', error);
    }
}

async function loadSharedSetlists() {
    if (!hasClaudeStorage) {
        sharedSetlists = [];
        return;
    }
    
    try {
        const result = await storageList('shared-', true);
        if (result && result.keys) {
            sharedSetlists = [];
            for (const key of result.keys) {
                const data = await storageGet(key, true);
                if (data && data.value) {
                    sharedSetlists.push({
                        key: key,
                        data: JSON.parse(data.value)
                    });
                }
            }
            sharedSetlists.sort((a, b) => new Date(b.data.date) - new Date(a.data.date));
        }
    } catch (error) {
        console.log('Erro setlists compartilhados:', error);
    }
}

async function loadSetlist(key, isShared = false) {
    try {
        let setlistData = null;

        if (!isShared && key.startsWith('cloud:') && isCloudAvailable()) {
            const docId = key.replace('cloud:', '');
            const doc = await getSetlistsCollection().doc(docId).get();
            if (doc.exists) {
                setlistData = doc.data();
            }
        } else {
            const result = await storageGet(key, isShared);
            if (result && result.value) {
                setlistData = JSON.parse(result.value);
            }
        }

        if (setlistData) {
            
            // Para tudo e limpa intervals antes de trocar os dados
            metronomes.forEach(m => {
                if (intervals[m.id]) {
                    clearInterval(intervals[m.id]);
                    delete intervals[m.id];
                }
                stopPad(m.id);
            });
            metronomes.forEach(m => { m.isPlaying = false; });
            
            metronomes = setlistData.metronomes.map(m => ({
                ...m,
                isPlaying: false,
                currentBeat: 0
            }));
            nextId = Math.max(...metronomes.map(m => m.id)) + 1;
            
            if (setlistData.globalSettings) {
                globalChannel = setlistData.globalSettings.channel || 'C';
                globalVolume = setlistData.globalSettings.volume || 0.7;
                selectedTimbre = setlistData.globalSettings.timbre || 'click';
                globalAccentEnabled = setlistData.globalSettings.accentEnabled !== undefined ? 
                    setlistData.globalSettings.accentEnabled : true;
                
                // Atualizar botão de acentuação global
                const accentBtn = document.getElementById('globalAccentToggle');
                if (accentBtn) {
                    accentBtn.className = globalAccentEnabled ? 'global-accent-toggle enabled' : 'global-accent-toggle disabled';
                    accentBtn.title = globalAccentEnabled ? 'Desabilitar acentuação global' : 'Habilitar acentuação global';
                }
                
                // Não precisa mais atualizar volumeSlider
                const timbreSelect = document.getElementById('timbreSelect');
                if (timbreSelect) timbreSelect.value = selectedTimbre;
                
                document.querySelectorAll('.channel-btn').forEach(btn => {
                    btn.className = 'channel-btn inactive';
                });
                const activeBtn = Array.from(document.querySelectorAll('.channel-btn'))
                    .find(btn => btn.textContent === globalChannel);
                if (activeBtn) activeBtn.className = 'channel-btn active';
            }
            
            // Restaurar padState de cada metrônomo
            setlistData.metronomes.forEach(m => {
                const id = m.id;
                const ps = getPadState(id);
                ps.note    = m.padNote    !== undefined ? m.padNote    : 'A';
                ps.enabled = m.padEnabled !== undefined ? m.padEnabled : false;
                ps.volume  = m.padVolume  !== undefined ? m.padVolume  : 0.7;
            });

            renderMetronomes();
            alert('Setlist carregado!');
        }
    } catch (error) {
        alert('Erro ao carregar: ' + error.message);
    }
}

async function deleteSetlist(key) {
    if (!confirm('Deletar este setlist?')) return;
    
    try {
        if (key.startsWith('cloud:') && isCloudAvailable()) {
            const docId = key.replace('cloud:', '');
            await getSetlistsCollection().doc(docId).delete();
        } else {
            await storageDelete(key, false);
        }
        await loadSavedSetlists();
        renderSetlistManager();
        alert('Setlist deletado!');
    } catch (error) {
        alert('Erro: ' + error.message);
    }
}

function exportSetlist() {
    const setlistData = {
        name: prompt('Nome do setlist:') || 'Meu Setlist',
        date: new Date().toISOString(),
        metronomes: metronomes.map(m => {
            const ps = padState[m.id];
            return {
                name: m.name,
                bpm: m.bpm,
                timeSignature: m.timeSignature,
                beats: m.beats,
                padNote:    ps ? ps.note    : 'A',
                padEnabled: ps ? ps.enabled : false,
                padVolume:  ps ? ps.volume  : 0.7
            };
        }),

        globalSettings: {
            channel: globalChannel,
            volume: globalVolume,
            timbre: selectedTimbre,
            accentEnabled: globalAccentEnabled
        }
    };
    
    const json = JSON.stringify(setlistData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = setlistData.name.replace(/[^a-z0-9]/gi, '-').toLowerCase() + '.json';
    a.click();
    URL.revokeObjectURL(url);
}

function importSetlist() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const setlistData = JSON.parse(event.target.result);
                
                metronomes.forEach(m => {
                    if (m.isPlaying) stopMetronome(m.id);
                });
                
                metronomes = setlistData.metronomes.map((m, index) => ({
                    id: index + 1,
                    name: m.name,
                    bpm: m.bpm,
                    timeSignature: m.timeSignature,
                    beats: m.beats,
                    isPlaying: false,
                    currentBeat: 0
                }));
                nextId = metronomes.length + 1;

                // Restaura configurações de pad de cada faixa
                setlistData.metronomes.forEach((m, index) => {
                    const id = index + 1;
                    const ps = getPadState(id);
                    ps.note    = m.padNote    !== undefined ? m.padNote    : 'A';
                    ps.enabled = m.padEnabled !== undefined ? m.padEnabled : false;
                    ps.volume  = m.padVolume  !== undefined ? m.padVolume  : 0.7;
                });
                
                if (setlistData.globalSettings) {
                    globalChannel = setlistData.globalSettings.channel || 'C';
                    globalVolume = setlistData.globalSettings.volume || 0.7;
                    selectedTimbre = setlistData.globalSettings.timbre || 'click';
                    globalAccentEnabled = setlistData.globalSettings.accentEnabled !== undefined ? 
                        setlistData.globalSettings.accentEnabled : true;
                    
                    // Atualizar botão de acentuação global
                    const accentBtn = document.getElementById('globalAccentToggle');
                    if (accentBtn) {
                        accentBtn.className = globalAccentEnabled ? 'global-accent-toggle enabled' : 'global-accent-toggle disabled';
                        accentBtn.title = globalAccentEnabled ? 'Desabilitar acentuação global' : 'Habilitar acentuação global';
                    }
                    
                    const timbreSelect = document.getElementById('timbreSelect');
                    if (timbreSelect) timbreSelect.value = selectedTimbre;
                }
                
                renderMetronomes();
                alert('Setlist importado!');
            } catch (error) {
                alert('Erro ao importar: ' + error.message);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function renderSetlistManager() {
    const container = document.getElementById('setlistManager');
    if (!container) return;
    
    let html = '<div class="setlist-section">';
    html += '<h3>💾 Meus Setlists</h3>';
    
    if (savedSetlists.length === 0) {
        html += '<p class="empty-message">Nenhum setlist salvo</p>';
    } else {
        savedSetlists.forEach(setlist => {
            const date = new Date(setlist.data.date).toLocaleDateString('pt-BR');
            const storageLabel = setlist.source === 'cloud' ? 'Nuvem' : 'Local';
            html += `
                <div class="setlist-item">
                    <div class="setlist-info">
                        <strong>${escapeHtml(setlist.data.name)}</strong>
                        <small>${setlist.data.metronomes.length} músicas • ${date} • ${storageLabel}</small>
                    </div>
                    <div class="setlist-actions">
                        <button onclick="loadSetlist('${setlist.key}')" class="btn-load">Carregar</button>
                        <button onclick="deleteSetlist('${setlist.key}')" class="btn-delete">×</button>
                    </div>
                </div>
            `;
        });
    }
    html += '</div>';
    
    html += '<div class="setlist-section">';
    html += '<h3>🌐 Setlists Compartilhados</h3>';
    
    if (!hasClaudeStorage) {
        html += '<p class="empty-message">⚠️ "Exportar/Importar JSON"</p>';
    } else if (sharedSetlists.length === 0) {
        html += '<p class="empty-message">Nenhum compartilhado</p>';
    } else {
        sharedSetlists.slice(0, 10).forEach(setlist => {
            const date = new Date(setlist.data.date).toLocaleDateString('pt-BR');
            html += `
                <div class="setlist-item shared">
                    <div class="setlist-info">
                        <strong>${escapeHtml(setlist.data.name)}</strong>
                        <small>Por ${escapeHtml(setlist.data.author)} • ${setlist.data.metronomes.length} músicas • ${date}</small>
                    </div>
                    <div class="setlist-actions">
                        <button onclick="loadSetlist('${setlist.key}', true)" class="btn-load">Carregar</button>
                    </div>
                </div>
            `;
        });
    }
    html += '</div>';
    
    container.innerHTML = html;
    updateAccountUI();
}

function setGlobalChannel(channel) {
    globalChannel = channel;
    document.querySelectorAll('.channel-btn').forEach(btn => {
        btn.className = 'channel-btn inactive';
    });
    event.target.className = 'channel-btn active';
    saveLastConfig();
}

function toggleGlobalAccent() {
    globalAccentEnabled = !globalAccentEnabled;
    
    const btn = document.getElementById('globalAccentToggle');
    if (btn) {
        if (globalAccentEnabled) {
            btn.className = 'global-accent-toggle enabled';
            btn.title = 'Desabilitar acentuação.';
        } else {
            btn.className = 'global-accent-toggle disabled';
            btn.title = 'Habilitar acentuação.';
        }
    }
    
    saveLastConfig();
}

function addMetronome() {
    if (metronomes.length >= 10) return;

    metronomes.push({
        id: nextId++,
        name: 'Música ' + (metronomes.length + 1),
        bpm: 120,
        timeSignature: '4/4',
        beats: 4,
        cifra: '',
        isPlaying: false,
        currentBeat: 0
    });

    renderMetronomes();
    saveLastConfig();
}

function removeMetronome(id) {
    if (metronomes.length <= 1) return;
    if (cifraPanelId === id) {
        closeCifraFullscreen();
        closeCifraPanel();
    }
    stopMetronome(id);
    metronomes = metronomes.filter(m => m.id !== id);
    renderMetronomes();
    saveLastConfig();
}

function updateMetronome(id, field, value) {
    const metronome = metronomes.find(m => m.id === id);
    if (!metronome) return;

    if (field === 'bpm') {
        value = Math.max(40, Math.min(doubleClickActive ? 600 : 300, parseInt(value) || 120));
    }
    if (field === 'timeSignature') {
        const parts = value.split('/');
        metronome.beats = parseInt(parts[0]) || 4;
    }

    metronome[field] = value;

    // Sincroniza título do painel de cifra se o nome mudou
    if (field === 'name' && cifraPanelId === id) {
        const titleEl = document.getElementById('cifraPanelTitle');
        if (titleEl) titleEl.textContent = value || 'Sem nome';
    }

    // Busca cifra na biblioteca ao digitar o nome
    if (field === 'name' && value && value.trim().length >= 3) {
        const found = cifraLibraryGet(value);
        if (found && found.cifra && !metronome.cifra) {
            // Só auto-preenche se a música ainda não tem cifra
            metronome.cifra = found.cifra;
            metronome.cifraBaseNote = found.cifraBaseNote || '';
            metronome.cifraSemitones = 0;
            // Se o painel desta música está aberto, atualiza o textarea
            if (cifraPanelId === id) {
                const textarea = document.getElementById('cifraTextarea');
                if (textarea) {
                    textarea.value = found.cifra;
                    // Notifica visualmente
                    textarea.style.borderLeft = '3px solid #4ade80';
                    setTimeout(() => { textarea.style.borderLeft = ''; }, 2000);
                }
            }
        }
    }

    if (metronome.isPlaying && (field === 'bpm' || field === 'timeSignature')) {
        restartMetronomeInterval(id);
    }

    // Atualiza somente o que mudou no DOM, sem recriar tudo
    if (field === 'bpm') {
        const item = document.querySelector('[data-id="' + id + '"]');
        if (item) {
            const bpmInput = item.querySelector('.bpm-input');
            if (bpmInput) bpmInput.value = metronome.bpm;
        }
    }
    if (field === 'timeSignature' || field === 'beats') {
        // Precisa recriar só os beat indicators
        const item = document.querySelector('[data-id="' + id + '"]');
        if (item) {
            const container = item.querySelector('.beat-indicators');
            if (container) {
                let html = '';
                for (let i = 0; i < metronome.beats; i++) {
                    html += '<div class="beat-dot"></div>';
                }
                container.innerHTML = html;
            }
        }
    }

    saveLastConfig();
}

function toggleMetronome(id) {
    const metronome = metronomes.find(m => m.id === id);
    if (!metronome) return;

    if (metronome.isPlaying) {
        stopMetronome(id);
    } else {
        // Força limpeza do estado antes de iniciar
        metronome.isPlaying = false;
        startMetronome(id);
    }
}

function startMetronome(id) {
    const metronome = metronomes.find(m => m.id === id);
    if (!metronome) return;

    // Para outros metrônomos que estejam tocando
    metronomes.forEach(m => {
        if (m.id !== id && m.isPlaying) {
            stopPad(m.id, false);
            stopMetronome(m.id);
            updateMetronomeItemUI(m.id);
        }
    });

    // Garante que não há interval duplicado rodando para este id
    if (intervals[id]) {
        clearInterval(intervals[id]);
        delete intervals[id];
    }

    // Para o pad anterior sem fade antes de reiniciar
    stopPad(id, false);

    metronome.isPlaying = true;
    metronome.currentBeat = 0;

    const interval = 60000 / metronome.bpm;

    startPad(id);

    playSound(metronome);
    updateBeatIndicator(id, 0);

    intervals[id] = setInterval(() => {
        metronome.currentBeat = (metronome.currentBeat + 1) % metronome.beats;
        playSound(metronome);
        updateBeatIndicator(id, metronome.currentBeat);
    }, interval);

    updateMetronomeItemUI(id);

    // Auto-navega a cifra se o painel já estiver aberto para outra música com cifra
    if (cifraPanelId !== null && cifraPanelId !== id) {
        const fs = document.getElementById('cifraFullscreen');
        const inFullscreen = fs && fs.style.display === 'flex';
        if (!inFullscreen && metronome.cifra) {
            // Só troca a cifra exibida se a nova música também tiver cifra salva
            openCifraPanel(id);
        }
        // Se a nova música não tem cifra, mantém o painel aberto onde estava
    }
}

function restartMetronomeInterval(id) {
    const metronome = metronomes.find(m => m.id === id);
    if (!metronome || !metronome.isPlaying) return;

    if (intervals[id]) {
        clearInterval(intervals[id]);
    }

    const interval = 60000 / metronome.bpm;
    intervals[id] = setInterval(() => {
        metronome.currentBeat = (metronome.currentBeat + 1) % metronome.beats;
        playSound(metronome);
        updateBeatIndicator(id, metronome.currentBeat);
    }, interval);

    updateMetronomeItemUI(id);
}

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

    // Parar pad imediatamente (sem fade) para evitar conflito ao trocar metrônomo
    stopPad(id, false);

    updateMetronomeItemUI(id);
}

function toggleClickMute() {
    clickMuted = !clickMuted;
    const btn = document.getElementById('clickMuteBtn');
    if (clickMuted) {
        btn.textContent = '🔇 Click';
        btn.classList.add('click-muted');
        btn.title = 'Click mutado — clique para ativar';
    } else {
        btn.textContent = '🔊 Click';
        btn.classList.remove('click-muted');
        btn.title = 'Mutar o click';
    }
}

function toggleDoubleClick() {
    doubleClickActive = !doubleClickActive;
    const btn = document.getElementById('doubleClickBtn');

    metronomes.forEach(m => {
        if (doubleClickActive) {
            // Guarda o BPM original e dobra
            m._originalBpm = m.bpm;
            m.bpm = m._originalBpm * 2; // sem limite — originalBpm já é <= 300
        } else {
            // Restaura o BPM original
            if (m._originalBpm !== undefined) {
                m.bpm = m._originalBpm;
                delete m._originalBpm;
            }
        }
        // Reinicia o intervalo se estiver tocando
        if (m.isPlaying) {
            restartMetronomeInterval(m.id);
        }
    });

    if (doubleClickActive) {
        btn.classList.add('double-click-active');
        btn.title = 'Double Click ativo — clique para desativar';
    } else {
        btn.classList.remove('double-click-active');
        btn.title = 'Double Click: dobra o BPM de todos os metrônomos';
    }

    renderMetronomes();

    // Atualizar o atributo max dos inputs de BPM conforme o modo
    document.querySelectorAll('.bpm-input').forEach(input => {
        input.max = doubleClickActive ? 600 : 300;
    });
}

function changeTimbre(timbre) {
    selectedTimbre = timbre;
    saveLastConfig();
}

function playSound(metronome) {
    if (!audioContext) return;

    // Usar globalAccentEnabled ao invés de verificar metrônomo individual
    const isFirstBeat = globalAccentEnabled && metronome.currentBeat === 0;

    switch (selectedTimbre) {
        case 'click':
            playClickSound(isFirstBeat);
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

    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(2000, audioContext.currentTime);
    filterNode.Q.setValueAtTime(0.5, audioContext.currentTime);

    setupPanAndVolume(pannerNode, gainNode, isFirstBeat, 0.12, 0.15, 0.12);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.12);
}

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

    filterNode.type = 'bandpass';
    filterNode.frequency.setValueAtTime(1200, audioContext.currentTime);
    filterNode.Q.setValueAtTime(2, audioContext.currentTime);

    setupPanAndVolume(pannerNode, gainNode, isFirstBeat, 0.1, 0.18, 0.14);

    oscillator1.start(audioContext.currentTime);
    oscillator2.start(audioContext.currentTime);
    oscillator1.stop(audioContext.currentTime + 0.1);
    oscillator2.stop(audioContext.currentTime + 0.1);
}

function playMultitrackSound(isFirstBeat) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const pannerNode = audioContext.createStereoPanner();
    const filterNode = audioContext.createBiquadFilter();

    oscillator.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(pannerNode);
    pannerNode.connect(audioContext.destination);

    const frequency = isFirstBeat ? 880 : 440;
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.type = 'triangle';

    filterNode.type = 'highpass';
    filterNode.frequency.setValueAtTime(300, audioContext.currentTime);
    filterNode.Q.setValueAtTime(0.7, audioContext.currentTime);

    setupPanAndVolume(pannerNode, gainNode, isFirstBeat, 0.15, 0.16, 0.13);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
}

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

function setupPanAndVolume(pannerNode, gainNode, isFirstBeat, duration, firstVolume = 0.25, secondVolume = 0.18) {
    let panValue = 0;
    if (globalChannel === 'L') panValue = -1;
    if (globalChannel === 'R') panValue = 1;
    pannerNode.pan.setValueAtTime(panValue, audioContext.currentTime);

    const volume = clickMuted ? 0 : (isFirstBeat ? firstVolume : secondVolume) * globalVolume;
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
}

function updateBeatIndicator(id, currentBeat) {
    const indicators = document.querySelectorAll('[data-id="' + id + '"] .beat-dot');
    indicators.forEach((dot, index) => {
        dot.className = 'beat-dot';
        if (index === currentBeat) {
            // Usar globalAccentEnabled para determinar se mostra accent ou active
            dot.className = 'beat-dot ' + ((index === 0 && globalAccentEnabled) ? 'accent' : 'active');
        }
    });
}

function updateMetronomeItemUI(id) {
    const metronome = metronomes.find(m => m.id === id);
    if (!metronome) return;

    // Sincroniza o botão de play do modo tela cheia, se estiver aberto para esta música
    const fs = document.getElementById('cifraFullscreen');
    if (fs && fs.style.display === 'flex' && cifraPanelId === id) {
        cifraFsUpdatePlayUI();
    }

    const item = document.querySelector('[data-id="' + id + '"]');
    if (!item) return;
    const btn = item.querySelector('.play-btn');
    if (btn) {
        btn.className = 'play-btn ' + (metronome.isPlaying ? 'pause' : 'play');
        btn.textContent = metronome.isPlaying ? '⏸' : '▶';
    }
    if (metronome.isPlaying) {
        item.classList.add('playing');
    } else {
        item.classList.remove('playing');
    }
}

function renderMetronomes() {
    const list = document.getElementById('metronomeList');
    if (!list) return;

    if (metronomeSortable) {
        metronomeSortable.destroy();
        metronomeSortable = null;
    }
    
    list.innerHTML = '';

    metronomes.forEach((m, index) => {
        const item = document.createElement('div');
        item.className = 'metronome-item' + (m.isPlaying ? ' playing' : '');
        item.setAttribute('data-id', m.id);
        item.title = 'Arraste pelo número para reordenar esta música';

        let beatIndicators = '';
        for (let i = 0; i < m.beats; i++) {
            let dotClass = 'beat-dot';
            if (m.isPlaying && i === m.currentBeat) {
                // Usar globalAccentEnabled para determinar se mostra accent ou active
                dotClass += ((i === 0 && globalAccentEnabled) ? ' accent' : ' active');
            }
            beatIndicators += '<div class="' + dotClass + '"></div>';
        }

        item.innerHTML = `
            <div class="item-number" title="Arraste para reordenar" aria-label="Arraste para reordenar">${index + 1}</div>
            <div class="name-row">
                <input type="text" class="music-input" placeholder="Nome da música..." 
                       value="${m.name}" onchange="updateMetronome(${m.id}, 'name', this.value)">
                <div class="bmp-container">
                    <input type="number" class="bpm-input" min="40" max="300" 
                           value="${m.bpm}" onchange="updateMetronome(${m.id}, 'bpm', this.value)">
                    <span class="bpm-label">BPM</span>
                </div>
            </div>
            <div class="controls-row">
                <button class="play-btn ${m.isPlaying ? 'pause' : 'play'}" 
                        onclick="toggleMetronome(${m.id})">
                    ${m.isPlaying ? '⏸' : '▶'}
                </button>
                ${buildPadHTML(m.id)}
                <select class="time-select" onchange="updateMetronome(${m.id}, 'timeSignature', this.value)">
                    <option value="2/4" ${m.timeSignature === '2/4' ? 'selected' : ''}>2/4</option>
                    <option value="3/4" ${m.timeSignature === '3/4' ? 'selected' : ''}>3/4</option>
                    <option value="4/4" ${m.timeSignature === '4/4' ? 'selected' : ''}>4/4</option>
                    <option value="5/4" ${m.timeSignature === '5/4' ? 'selected' : ''}>5/4</option>
                    <option value="6/8" ${m.timeSignature === '6/8' ? 'selected' : ''}>6/8</option>
                    <option value="7/8" ${m.timeSignature === '7/8' ? 'selected' : ''}>7/8</option>
                    <option value="9/8" ${m.timeSignature === '9/8' ? 'selected' : ''}>9/8</option>
                    <option value="12/8" ${m.timeSignature === '12/8' ? 'selected' : ''}>12/8</option>
                </select>
                <div class="beat-indicators">
                    ${beatIndicators}
                </div>
            </div>
            <div class="remove-cell">
                <div class="action-btns">
                    <button class="cifra-btn-item${(cifraPanelId === m.id) ? ' cifra-btn-item-active' : ''}" 
                            onclick="openCifraPanel(${m.id})"
                            title="Abrir cifra">🎵</button>
                    ${metronomes.length > 1 ? 
                        `<button class="remove-btn" onclick="removeMetronome(${m.id})">×</button>` : ''
                    }
                </div>
            </div>
        `;

        list.appendChild(item);
        updatePadNoteUI(m.id);
        syncPadEnabledUI(m.id);
        updatePadIndicator(m.id, m.isPlaying && getPadState(m.id).enabled);
    });

    initMetronomeSortable(list);
}

function initMetronomeSortable(list) {
    if (typeof Sortable === 'undefined') {
        console.error('SortableJS não foi carregado.');
        return;
    }

    metronomeSortable = new Sortable(list, {
        animation: 180,
        handle: '.item-number',
        draggable: '.metronome-item',
        scroll: true,
        bubbleScroll: true,
        scrollSensitivity: 70,
        scrollSpeed: 24,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        onMove: event => {
            document.querySelectorAll('#metronomeList .metronome-item')
                .forEach(item => item.classList.remove('sortable-target'));

            if (event.related) event.related.classList.add('sortable-target');

            const originalEvent = event.originalEvent;
            if (originalEvent) {
                const edge = 90;
                if (originalEvent.clientY < edge) {
                    window.scrollBy(0, -12);
                } else if (originalEvent.clientY > window.innerHeight - edge) {
                    window.scrollBy(0, 12);
                }
            }
        },
        onEnd: () => {
            document.querySelectorAll('#metronomeList .metronome-item')
                .forEach(item => item.classList.remove('sortable-target'));
            const ids = Array.from(list.querySelectorAll('.metronome-item'))
                .map(element => Number(element.dataset.id));
            const byId = new Map(metronomes.map(metronome => [metronome.id, metronome]));
            const reordered = ids.map(id => byId.get(id)).filter(Boolean);
            const hasChanged = reordered.some((metronome, index) => metronome.id !== metronomes[index]?.id);

            if (hasChanged) {
                metronomes = reordered;
                renderMetronomes();
                saveLastConfig();
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', init);
