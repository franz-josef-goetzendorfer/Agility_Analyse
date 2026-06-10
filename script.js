let allRuns = [];
let currentRunId = null;
let videoFileCache = {};

const faultColors = {
    "Info": "#3498db",
    "Fehler": "#f39c12",
    "Stangenfehler": "#e74c3c",
    "Kontaktzonenfehler": "#e67e22",
    "Verweigerung": "#9b59b6",
    "Führung": "#1abc9c"
};

// --- Initialization ---
window.onload = () => {
    try {
        allRuns = JSON.parse(localStorage.getItem('dogSportData') || '[]');
    } catch {
        allRuns = [];
        localStorage.setItem('dogSportData', '[]');
    }
    updateFilterOptions();
    renderHistory();
    setupKeyboardShortcuts();
    setupDrawingCanvas();
    setupScrubber();
};

// --- UI Management ---
function showNewRunForm() {
    document.getElementById('newRunForm').classList.remove('hidden');
    document.getElementById('analysisArea').classList.add('hidden');
    document.getElementById('runDate').valueAsDate = new Date();
}

function hideNewRunForm() {
    document.getElementById('newRunForm').classList.add('hidden');
    document.getElementById('analysisArea').classList.remove('hidden');
}

// --- Data & Run Management ---
function saveAllRuns() {
    localStorage.setItem('dogSportData', JSON.stringify(allRuns));
}

function saveNewRun() {
    const file = document.getElementById('videoUpload').files[0];
    if (!file) return alert("Bitte eine Videodatei auswählen.");

    const newRun = {
        id: Date.now(),
        date: document.getElementById('runDate').value,
        event: document.getElementById('runEvent').value || "Unbenanntes Event",
        dog: document.getElementById('runDog').value,
        type: document.getElementById('runType').value,
        subType: document.getElementById('runType').value === 'Turnier' ? document.getElementById('runSubType').value : '',
        notes: []
    };

    allRuns.unshift(newRun);
    videoFileCache[newRun.id] = file;
    saveAllRuns();
    updateFilterOptions();
    loadRun(newRun.id);
    hideNewRunForm();
}

function loadRun(id) {
    const run = allRuns.find(r => r.id === id);
    if (!run) return;

    const file = videoFileCache[id];
    if (!file) {
        requestVideoForRun(id);
        return;
    }
    
    currentRunId = id;
    document.getElementById('analysisArea').classList.remove('hidden');
    document.getElementById('newRunForm').classList.add('hidden');

    document.getElementById('displayTitle').innerText = run.event;
    document.getElementById('displayMeta').innerText = `${run.date} - ${run.dog} (${run.subType || run.type})`;
    
    const video = document.getElementById('mainVideo');
    video.src = URL.createObjectURL(file);
    
    renderNotes();
    renderHistory();
}

function requestVideoForRun(id) {
    if (!allRuns.find(r => r.id === id)) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            videoFileCache[id] = file;
            loadRun(id);
        }
    };
    alert("Bitte wählen Sie die Videodatei für diesen Lauf aus. Das Video wird für diese Sitzung zwischengespeichert.");
    input.click();
}

function deleteCurrentRun() {
    if (confirm("Diesen Lauf und alle zugehörigen Notizen wirklich löschen?")) {
        allRuns = allRuns.filter(r => r.id !== currentRunId);
        delete videoFileCache[currentRunId];
        currentRunId = null;
        saveAllRuns();
        document.getElementById('analysisArea').classList.add('hidden');
        updateFilterOptions();
        renderHistory();
    }
}

// --- History & Filtering ---
function renderHistory() {
    const fDate = document.getElementById('filterDate').value;
    const fEvent = document.getElementById('filterEvent').value;

    const filtered = allRuns.filter(r => 
        (!fDate || r.date === fDate) && (!fEvent || r.event === fEvent)
    );

    const listDiv = document.getElementById('analysisList');
    listDiv.innerHTML = filtered.map(r => `
        <div class="analysis-item ${currentRunId === r.id ? 'active' : ''}" onclick="loadRun(${r.id})">
            <strong>${r.event}</strong><br>
            <span class="meta">${r.date} | ${r.dog} | ${r.subType || r.type}</span>
        </div>
    `).join('') || '<p style="padding: 15px; text-align: center;">Keine Läufe gefunden.</p>';
}

function updateFilterOptions() {
    const dates = [...new Set(allRuns.map(r => r.date))].sort((a,b) => b.localeCompare(a));
    const events = [...new Set(allRuns.map(r => r.event))].sort();

    const dSelect = document.getElementById('filterDate');
    dSelect.innerHTML = '<option value="">Alle Daten</option>' + dates.map(d => `<option value="${d}">${d}</option>`).join('');

    const eSelect = document.getElementById('filterEvent');
    eSelect.innerHTML = '<option value="">Alle Events</option>' + events.map(e => `<option value="${e}">${e}</option>`).join('');
}

// --- Notes Management ---
function addNote() {
    const text = document.getElementById('noteText').value;
    if (!text || !currentRunId) return;

    const run = allRuns.find(r => r.id === currentRunId);
    run.notes.push({
        time: document.getElementById('mainVideo').currentTime,
        text: text,
        type: document.getElementById('faultType').value,
    });

    saveAllRuns();
    document.getElementById('noteText').value = "";
    renderNotes();
}

function renderNotes() {
    const run = allRuns.find(r => r.id === currentRunId);
    if (!run) return;
    
    const notesDiv = document.getElementById('notesList');
    notesDiv.innerHTML = [...run.notes]
        .sort((a,b) => a.time - b.time)
        .map(n => `
            <div class="note-item" style="border-left-color: ${faultColors[n.type] || '#777'}" onclick="jumpTo(${n.time})">
                <span><strong>${Math.floor(n.time)}s:</strong> ${n.text}</span>
                <span class="fault-type" style="background-color: ${faultColors[n.type] || '#777'}">${n.type}</span>
            </div>
        `).join('');
    updateTimelineMarkers();
}

function jumpTo(time) {
    const video = document.getElementById('mainVideo');
    video.currentTime = time;
    video.play();
}

// --- Video Features ---
function updateVideo() {
    if (!currentRunId) return alert("Bitte zuerst einen Lauf laden.");
    document.getElementById('updateVideoInput').click();
}

function handleVideoUpdate(event) {
    const file = event.target.files[0];
    if (file && currentRunId) {
        videoFileCache[currentRunId] = file;
        const video = document.getElementById('mainVideo');
        video.src = URL.createObjectURL(file);
        video.play();
    }
    event.target.value = '';
}

function updateOnTimeUpdate() {
    updateTimelineMarkers();
    updateScrubHandle();
}

function updateTimelineMarkers() {
    const run = allRuns.find(r => r.id === currentRunId);
    const video = document.getElementById('mainVideo');
    const markersDiv = document.getElementById('timelineMarkers');
    if (!run || !video || !video.duration || video.duration === Infinity) {
        markersDiv.innerHTML = '';
        return;
    }
    
    markersDiv.innerHTML = run.notes.map(n => {
        const percent = (n.time / video.duration) * 100;
        return `<div class="note-marker" style="left: ${percent}%; background-color: ${faultColors[n.type] || '#777'}"></div>`;
    }).join('');
}

// --- Scrubber Logic ---
let isScrubbing = false;

function setupScrubber() {
    const scrubContainer = document.getElementById('scrub-container');
    const scrubHandle = document.getElementById('scrub-handle');
    const video = document.getElementById('mainVideo');

    const startScrub = (e) => {
        isScrubbing = true;
        video.pause();
        document.body.style.cursor = 'grabbing';
        updateVideoTime(e);
    };

    const stopScrub = () => {
        if (isScrubbing) {
            isScrubbing = false;
            document.body.style.cursor = 'default';
        }
    };

    const scrub = (e) => {
        if (isScrubbing) {
            e.preventDefault();
            updateVideoTime(e);
        }
    };

    const updateVideoTime = (e) => {
        const rect = scrubContainer.getBoundingClientRect();
        const position = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, position / rect.width));
        video.currentTime = percentage * video.duration;
    };

    scrubHandle.addEventListener('mousedown', startScrub);
    document.addEventListener('mouseup', stopScrub);
    document.addEventListener('mousemove', scrub);
    scrubContainer.addEventListener('click', (e) => {
        if (e.target !== scrubHandle) {
             updateVideoTime(e);
        }
    });
}

function updateScrubHandle() {
    const video = document.getElementById('mainVideo');
    const scrubHandle = document.getElementById('scrub-handle');
    if (video.duration) {
        const percentage = (video.currentTime / video.duration) * 100;
        scrubHandle.style.left = `${percentage}%`;
    }
}

// --- Keyboard Shortcuts ---
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        const activeEl = document.activeElement;
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(activeEl.tagName)) return;

        // Ensure the video is paused for frame-by-frame seeking
        const video = document.getElementById('mainVideo');
        if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
            video.pause();
        }

        switch (e.code) {
            case 'Space':
                e.preventDefault();
                video.paused ? video.play() : video.pause();
                break;
            case 'KeyN':
                e.preventDefault();
                document.getElementById('noteText').focus();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                // Jump back by 1/30th of a second (one frame at 30fps)
                video.currentTime -= (1/30);
                break;
            case 'ArrowRight':
                e.preventDefault();
                // Jump forward by 1/30th of a second (one frame at 30fps)
                video.currentTime += (1/30);
                break;
        }
    });
}

// --- Drawing Canvas ---
let drawing = false;
let canvas, ctx;

function setupDrawingCanvas() {
    canvas = document.getElementById('drawingCanvas');
    ctx = canvas.getContext('2d');
    let currentPos = { x: 0, y: 0 };

    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    const startDrawing = (e) => {
        drawing = true;
        currentPos = getPos(e);
    };
    
    const draw = (e) => {
        if (!drawing) return;
        e.preventDefault();
        const newPos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(currentPos.x, currentPos.y);
        ctx.lineTo(newPos.x, newPos.y);
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
        currentPos = newPos;
    };

    const stopDrawing = () => {
        drawing = false;
    };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);
}

function toggleDrawing() {
    const video = document.getElementById('mainVideo');
    canvas.classList.toggle('hidden');
    if (!canvas.classList.contains('hidden')) {
        video.pause();
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        clearDrawing();
    }
}

function clearDrawing() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// --- Data Portability ---
function exportData() {
    if (allRuns.length === 0) return alert("Keine Daten zum Exportieren vorhanden.");
    const dataStr = JSON.stringify(allRuns, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hundesport_analyse_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedRuns = JSON.parse(e.target.result);
            if (Array.isArray(importedRuns) && confirm(`${importedRuns.length} Läufe gefunden. Möchten Sie die aktuellen Daten überschreiben?`)) {
                allRuns = importedRuns;
                saveAllRuns();
                videoFileCache = {};
                currentRunId = null;
                document.getElementById('analysisArea').classList.add('hidden');
                updateFilterOptions();
                renderHistory();
                alert("Daten erfolgreich importiert. Bitte wählen Sie die Videos für die Läufe bei Bedarf neu aus.");
            }
        } catch (err) {
            alert("Fehler: Die Datei konnte nicht gelesen werden. Stellen Sie sicher, dass es eine gültige Export-Datei ist.");
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}
