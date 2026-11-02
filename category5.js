let cat5Questions = [];
let cat5Index = 0;
let cat5Answers = {};
let cat5Snapshots = {};

let cat5Config = {
    total: 33,
    maxWrong: 4,
    categoryName: 'ABC',
    fileName: 'ABC.txt'
};

window.addEventListener('DOMContentLoaded', () => {
    const savedCat = localStorage.getItem('lao_quiz_selected_category') || 'ABC.txt';
    setCat5Rules(savedCat);
    
    initCat5Webcam();
    loadCat5Questions();
});

function setCat5Rules(filename) {
    cat5Config.fileName = filename;
    const upper = filename.toUpperCase();
    if (upper.includes('ABC')) {
        cat5Config = { total: 33, maxWrong: 4, categoryName: 'ABC', fileName: filename };
    } else if (upper.includes('AB')) {
        cat5Config = { total: 28, maxWrong: 4, categoryName: 'AB', fileName: filename };
    } else if (upper.includes('B')) {
        cat5Config = { total: 25, maxWrong: 3, categoryName: 'B', fileName: filename };
    } else if (upper.includes('C') || upper.includes('D') || upper.includes('CDBC')) {
        cat5Config = { total: 30, maxWrong: 3, categoryName: 'C / D / BC', fileName: filename };
    } else {
        cat5Config = { total: 20, maxWrong: 3, categoryName: 'A', fileName: filename };
    }
    
    const badge = document.getElementById('cat5-category-badge');
    if (badge) badge.innerText = `ປະເພດ: ${cat5Config.categoryName} (${cat5Config.total} ข้อ)`;
}

// 🎥 เปิดกล้องเว็บแคป
function initCat5Webcam() {
    const video = document.getElementById('cat5-webcam-video');
    if (!video) return;

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false })
        .then(stream => {
            video.srcObject = stream;
            video.play().catch(e => console.log(e));
        })
        .catch(err => console.log("Webcam error:", err));
    }
}

// 📸 ถ่ายรูปนักเรียนเมื่อตอบคำถามและเก็บลงในแคช
function captureCat5Snapshot(qNum) {
    const video = document.getElementById('cat5-webcam-video');
    const canvas = document.getElementById('cat5-snapshot-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = 160;
    canvas.height = 120;

    let dataURL = null;
    if (video && video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
        try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            dataURL = canvas.toDataURL('image/png');
        } catch (e) {
            console.log(e);
        }
    }

    if (!dataURL) {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(`Q ${qNum}`, 40, 60);
        dataURL = canvas.toDataURL('image/png');
    }

    cat5Snapshots[qNum] = dataURL;
    renderCat5MiniGallery();
}

function renderCat5MiniGallery() {
    const gallery = document.getElementById('cat5-snapshots-gallery');
    if (!gallery) return;
    gallery.innerHTML = '';

    Object.keys(cat5Snapshots).forEach(qNum => {
        gallery.innerHTML += `
            <div style="background: rgba(255,255,255,0.05); border-radius: 4px; padding: 1px; text-align: center;">
                <img src="${cat5Snapshots[qNum]}" style="width: 100%; height: 26px; object-fit: cover; border-radius: 2px;">
            </div>
        `;
    });
}

async function loadCat5Questions() {
    try {
        const response = await fetch(cat5Config.fileName);
        if (!response.ok) throw new Error('ไม่พบไฟล์ข้อสอบ');
        const textData = await response.text();
        let allParsed = parseCsvInsideTxt(textData);

        shuffleArray(allParsed);
        cat5Questions = allParsed.slice(0, cat5Config.total);
        cat5Index = 0;
        cat5Answers = {};
        cat5Snapshots = {};

        const gallery = document.getElementById('cat5-snapshots-gallery');
        if (gallery) gallery.innerHTML = '';

        renderCat5Question();
    } catch (e) {
        console.error(e);
        document.getElementById('cat5-question-text').innerText = 'เกิดข้อผิดพลาดในการโหลดไฟล์ข้อสอบ (' + cat5Config.fileName + ')';
    }
}

function parseCsvInsideTxt(text) {
    const questions = [];
    const lines = text.split(/\r?\n/);

    lines.forEach((line) => {
        if (!line.trim()) return;

        let parts = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            let char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                parts.push(current.trim().replace(/^"|"$/g, ''));
                current = '';
            } else {
                current += char;
            }
        }
        parts.push(current.trim().replace(/^"|"$/g, ''));

        if (parts.length < 6) return;

        const qText = parts[0];
        let ansNum = 1;
        try { ansNum = parseInt(parts[1]) || 1; } catch(e) { ansNum = 1; }
        const ansIndex = ansNum - 1;

        let options = [];
        for (let i = 2; i <= 5; i++) {
            if (parts[i]) {
                let opt = parts[i];
                if (opt && opt !== '-') options.push(opt);
            }
        }

        let imagePath = null;
        for (let i = 0; i < parts.length; i++) {
            let p = parts[i].trim().replace(/^"|"$/g, '');
            let lowerP = p.toLowerCase();
            if (lowerP.endsWith('.png') || lowerP.endsWith('.jpg') || lowerP.endsWith('.jpeg')) {
                imagePath = p;
                break;
            }
        }

        if (qText && options.length > 0) {
            questions.push({
                id: questions.length + 1,
                question: qText,
                image: imagePath,
                options: options,
                answer: ansIndex
            });
        }
    });

    return questions;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function renderCat5SidebarGrid() {
    const container = document.getElementById('cat5-grid-container');
    if (!container) return;
    container.innerHTML = '';

    cat5Questions.forEach((_, idx) => {
        const btn = document.createElement('button');
        btn.className = 'cat5-grid-btn';
        btn.innerText = (idx + 1);
        btn.style.cssText = "padding: 6px; font-weight: bold; font-size: 0.85rem; border-radius: 4px; border: 1px solid #475569; cursor: pointer; background: #ffffff; color: #0f172a; text-align: center;";

        if (idx === cat5Index) {
            btn.style.backgroundColor = '#fef08a';
            btn.style.color = '#000000';
        }
        if (cat5Answers[idx] !== undefined) {
            btn.style.backgroundColor = '#22c55e';
            btn.style.color = '#ffffff';
        }

        btn.onclick = () => {
            cat5Index = idx;
            renderCat5Question();
        };
        container.appendChild(btn);
    });

    const answeredCount = Object.keys(cat5Answers).length;
    document.getElementById('cat5-answered-text').innerText = `ຕອບແລ້ວ ${answeredCount} ຈາກ ${cat5Questions.length} ຂໍ້`;

    updateSubmitButtonVisibility();
}

function updateSubmitButtonVisibility() {
    const answeredCount = Object.keys(cat5Answers).length;
    const submitBtn = document.getElementById('cat5-submit-btn');
    if (!submitBtn) return;

    if (answeredCount >= cat5Questions.length) {
        submitBtn.style.display = 'flex';
    } else {
        submitBtn.style.display = 'none';
    }
}

function renderCat5Question() {
    if (cat5Questions.length === 0) return;
    const q = cat5Questions[cat5Index];

    document.getElementById('cat5-question-text').innerText = q.question;
    
    const imgBox = document.getElementById('cat5-image-container');
    imgBox.innerHTML = q.image ? `<img src="${q.image}" alt="Sign" class="cat5-question-img">` : '';

    const optList = document.getElementById('cat5-options-list');
    optList.innerHTML = '';
    const letters = ['ກ', 'ຂ', 'ຄ', 'ງ'];
    const userAns = cat5Answers[cat5Index];

    q.options.forEach((opt, idx) => {
        let optStyle = "display: flex; align-items: center; padding: 12px 14px; border-radius: 8px; margin-bottom: 8px; cursor: pointer; font-size: 1.1rem; font-weight: bold; color: #ffffff; background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.2);";
        
        if (userAns !== undefined) {
            if (idx === q.answer) {
                optStyle = "display: flex; align-items: center; padding: 12px 14px; border-radius: 8px; margin-bottom: 8px; font-size: 1.1rem; font-weight: bold; color: #ffffff; background-color: #16a34a !important; border: 1.5px solid #22c55e !important;";
            } else if (idx === userAns) {
                optStyle = "display: flex; align-items: center; padding: 12px 14px; border-radius: 8px; margin-bottom: 8px; font-size: 1.1rem; font-weight: bold; color: #ffffff; background-color: #dc2626 !important; border: 1.5px solid #ef4444 !important;";
            }
        }

        optList.innerHTML += `
            <div onclick="cat5SelectOption(${idx})" style="${optStyle}">
                <span style="color: #ffffff; margin-right: 10px; font-size: 1.25rem;">${letters[idx]}.</span>
                <span>${opt}</span>
            </div>
        `;
    });

    renderCat5SidebarGrid();
}

function cat5SelectOption(optIdx) {
    if (cat5Answers[cat5Index] !== undefined) return;

    cat5Answers[cat5Index] = optIdx;
    captureCat5Snapshot(cat5Index + 1);

    // 🎯 บันทึกและผสานข้อผิดลงหมวด 4 ทันทีที่ตอบผิด พร้อมซิงค์เรียลไทม์
    const q = cat5Questions[cat5Index];
    const keyName = 'lao_quiz_wrong_' + cat5Config.fileName;
    let existingWrong = JSON.parse(localStorage.getItem(keyName) || '[]');

    if (optIdx !== q.answer) {
        if (!existingWrong.some(e => e.question === q.question)) {
            existingWrong.push(q);
            localStorage.setItem(keyName, JSON.stringify(existingWrong));
        }
    }

    renderCat5Question();

    setTimeout(() => {
        if (cat5Index < cat5Questions.length - 1) {
            cat5Index++;
            renderCat5Question();
        }
    }, 400);
}

function cat5PrevQuestion() {
    if (cat5Index > 0) {
        cat5Index--;
        renderCat5Question();
    }
}

function cat5NextQuestion() {
    if (cat5Index < cat5Questions.length - 1) {
        cat5Index++;
        renderCat5Question();
    }
}

function cat5SubmitExam() {
    cat5EvaluateAndShowResults();
}

function cat5EvaluateAndShowResults() {
    let wrongCount = 0;
    let wrongList = [];

    cat5Questions.forEach((q, idx) => {
        const userAns = cat5Answers[idx];
        if (userAns !== q.answer) {
            wrongCount++;
            wrongList.push(q);
        }
    });

    // 🎯 ผสานข้อมูลข้อผิดทั้งหมดลงในคีย์หมวด 4 อย่างสมบูรณ์
    const keyName = 'lao_quiz_wrong_' + cat5Config.fileName;
    let existingWrong = JSON.parse(localStorage.getItem(keyName) || '[]');
    
    wrongList.forEach(w => {
        if (!existingWrong.some(ew => ew.question === w.question)) {
            existingWrong.push(w);
        }
    });
    localStorage.setItem(keyName, JSON.stringify(existingWrong));

    const isPassed = wrongCount <= cat5Config.maxWrong;

    const examGrid = document.querySelector('.cat5-exam-grid');
    const topHeader = document.querySelector('.cat5-top-header');
    const bottomBar = document.querySelector('.cat5-bottom-bar');
    
    if (examGrid) examGrid.style.display = 'none';
    if (topHeader) topHeader.style.display = 'none';
    if (bottomBar) bottomBar.style.display = 'none';
    
    const resultScreen = document.getElementById('cat5-result-screen');
    if (resultScreen) resultScreen.style.display = 'flex';

    document.getElementById('cat5-result-summary').innerText = `ຕອບຜິດ ${wrongCount} ຂໍ້ ในທັງໝົດ ${cat5Questions.length} ຂໍ້`;
    
    const badge = document.getElementById('cat5-status-badge');
    badge.innerText = isPassed ? 'ຜ່ານ' : 'ຕົກ';
    badge.style.color = isPassed ? '#22c55e' : '#ef4444';

    renderCat5ResultGallery();
}

function renderCat5ResultGallery() {
    const gallery = document.getElementById('cat5-result-gallery');
    if (!gallery) return;
    gallery.innerHTML = '';

    Object.keys(cat5Snapshots).forEach(qNum => {
        gallery.innerHTML += `
            <div style="background: rgba(255,255,255,0.05); border-radius: 3px; padding: 1px; text-align: center;">
                <img src="${cat5Snapshots[qNum]}" style="width: 100%; height: 35px; object-fit: cover; border-radius: 2px;">
            </div>
        `;
    });
}

function cat5RestartExam() {
    const resultScreen = document.getElementById('cat5-result-screen');
    if (resultScreen) resultScreen.style.display = 'none';

    const examGrid = document.querySelector('.cat5-exam-grid');
    const topHeader = document.querySelector('.cat5-top-header');
    const bottomBar = document.querySelector('.cat5-bottom-bar');
    
    if (examGrid) examGrid.style.display = 'grid';
    if (topHeader) topHeader.style.display = 'flex';
    if (bottomBar) bottomBar.style.display = 'flex';

    cat5Snapshots = {};
    cat5Answers = {};
    loadCat5Questions();
}