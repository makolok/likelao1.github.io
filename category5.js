let cat5Questions = [];
let cat5Index = 0;
let cat5Answers = {};
let cat5Snapshots = {};
let cat5Config = { total: 20, categoryName: 'A', fileName: 'A.txt' };

// ⏱️ ระบบเวลานับถอยหลัง 35 นาที
let totalSecondsLeft = 35 * 60;
let timerInterval = null;

// 🛡️ ตัวแปรป้องกันการส่ง Discord ซ้ำซ้อนในหมวด 5
let cat5HasSentDiscord = false;

const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1569554833038377013/B5QYG-dl3mJfGDvr9n-NTFgczn-3SeYsMlAOMlBhZVgxJn5q-CaBR7IrF-fN9w40bN8H';

function sendDiscordNotification(message) {
    if (cat5HasSentDiscord) return;
    cat5HasSentDiscord = true;

    const payload = { content: message };
    fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).catch(e => console.log("Discord error:", e));
}

// 📌 ฟังก์ชันตรวจสอบเกณฑ์การสอบผ่าน (แยกตามประเภทใบขับขี่)
function checkIsPassed(wrongCount) {
    const upper = cat5Config.fileName.toUpperCase().trim();
    if (upper === 'AB.TXT' || upper === 'AB' || upper === 'ABC.TXT' || upper === 'ABC') {
        return wrongCount <= 4;
    }
    return wrongCount <= 3;
}

function getTotalCompletedRounds() {
    const filename = cat5Config.fileName;
    const r2 = parseInt(localStorage.getItem(`lao_quiz_rounds_quiz_${filename}`)) || 0;
    const r3 = parseInt(localStorage.getItem(`lao_quiz_rounds_random_${filename}`)) || 0;
    const r5 = parseInt(localStorage.getItem(`lao_quiz_rounds_cat5_${filename}`)) || 0;
    return { r2, r3, r5, total: r2 + r3 + r5 };
}

function getCat5PassedRounds() {
    const filename = cat5Config.fileName;
    return parseInt(localStorage.getItem(`lao_quiz_passed_rounds_cat5_${filename}`)) || 0;
}

window.addEventListener('DOMContentLoaded', () => {
    const savedCat = localStorage.getItem('lao_quiz_selected_category') || 'A.txt';
    setCat5Rules(savedCat);
    initCat5Webcam();
    startCat5Timer();
    initOrResumeBank();
});

function startCat5Timer() {
    const timerEl = document.getElementById('cat5-timer');
    if (!timerEl) return;

    const savedTime = localStorage.getItem('cat5_timer_seconds_' + cat5Config.fileName);
    if (savedTime !== null) {
        totalSecondsLeft = parseInt(savedTime, 10);
    }

    timerInterval = setInterval(() => {
        if (totalSecondsLeft > 0) {
            totalSecondsLeft--;
            localStorage.setItem('cat5_timer_seconds_' + cat5Config.fileName, totalSecondsLeft);
            
            let minutes = Math.floor(totalSecondsLeft / 60);
            let seconds = totalSecondsLeft % 60;
            timerEl.innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            clearInterval(timerInterval);
            alert('⏰ หมดเวลาการสอบแล้ว!');
            cat5SubmitExam();
        }
    }, 1000);
}

function setCat5Rules(filename) {
    cat5Config.fileName = filename;
    const upper = filename.toUpperCase().trim();
    
    if (upper === 'ABC.TXT' || upper === 'ABC') {
        cat5Config = { total: 33, categoryName: 'ABC', fileName: filename };
    } else if (upper === 'AB.TXT' || upper === 'AB') {
        cat5Config = { total: 28, categoryName: 'AB', fileName: filename };
    } else if (upper === 'B.TXT' || upper === 'B') {
        cat5Config = { total: 25, categoryName: 'B', fileName: filename };
    } else if (upper.includes('CDBC') || upper.includes('C') || upper.includes('D')) {
        cat5Config = { total: 30, categoryName: 'C / D / BC', fileName: filename };
    } else {
        cat5Config = { total: 20, categoryName: 'A', fileName: filename };
    }
}

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

async function initOrResumeBank() {
    try {
        cat5HasSentDiscord = false; // รีเซ็ตสถานะการส่งเมื่อเริ่มชุดใหม่
        let masterBankKey = 'cat5_master_bank_' + cat5Config.fileName;
        let currentBatchKey = 'cat5_current_batch_' + cat5Config.fileName;
        
        let masterBank = JSON.parse(localStorage.getItem(masterBankKey));
        
        if (!masterBank || masterBank.length === 0) {
            const response = await fetch(cat5Config.fileName);
            if (!response.ok) throw new Error('ไม่พบไฟล์ข้อสอบ');
            const textData = await response.text();
            masterBank = parseCsvInsideTxt(textData);
            shuffleArray(masterBank);
            localStorage.setItem(masterBankKey, JSON.stringify(masterBank));
        }

        let currentBatch = JSON.parse(localStorage.getItem(currentBatchKey));
        
        if (!currentBatch || currentBatch.length === 0) {
            if (masterBank.length === 0) {
                showFinalCompleteScreen();
                return;
            }
            
            let takeCount = Math.min(cat5Config.total, masterBank.length);
            currentBatch = masterBank.splice(0, takeCount);
            
            localStorage.setItem(masterBankKey, JSON.stringify(masterBank));
            localStorage.setItem(currentBatchKey, JSON.stringify(currentBatch));
            localStorage.removeItem('cat5_answers_' + cat5Config.fileName);
            localStorage.removeItem('cat5_index_' + cat5Config.fileName);
            localStorage.removeItem('cat5_timer_seconds_' + cat5Config.fileName);
        }

        cat5Questions = currentBatch;
        
        const savedAnswers = localStorage.getItem('cat5_answers_' + cat5Config.fileName);
        const savedIndex = localStorage.getItem('cat5_index_' + cat5Config.fileName);
        if (savedAnswers) cat5Answers = JSON.parse(savedAnswers);
        if (savedIndex) cat5Index = parseInt(savedIndex) || 0;

        updateHeaderBadge();
        renderCat5Question();

    } catch (e) {
        console.error(e);
        document.getElementById('cat5-question-text').innerText = 'เกิดข้อผิดพลาดในการโหลดไฟล์ข้อสอบ (' + cat5Config.fileName + ')';
    }
}

function updateHeaderBadge() {
    let masterBank = JSON.parse(localStorage.getItem('cat5_master_bank_' + cat5Config.fileName) || '[]');
    let totalRemainingInSystem = masterBank.length + cat5Questions.length;
    
    const badge = document.getElementById('cat5-bank-header-badge');
    if (badge) {
        badge.innerText = `[ເຫຼືອ: ${totalRemainingInSystem}]`;
    }
    
    const passedRounds = getCat5PassedRounds();
    const filename = cat5Config.fileName;
    const completedRounds = parseInt(localStorage.getItem(`lao_quiz_rounds_cat5_${filename}`)) || 0;

    const passedEl = document.getElementById('cat5-passed-rounds-count');
    const completedEl = document.getElementById('cat5-completed-rounds-count');

    if (passedEl) passedEl.innerText = passedRounds;
    if (completedEl) completedEl.innerText = completedRounds;
}

function saveProgressToStorage() {
    localStorage.setItem('cat5_answers_' + cat5Config.fileName, JSON.stringify(cat5Answers));
    localStorage.setItem('cat5_index_' + cat5Config.fileName, cat5Index);
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

            const timerEl = document.getElementById('cat5-timer');
            const timeString = timerEl ? timerEl.innerText : '';
            if (timeString) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(4, 4, 52, 16); 
                ctx.fillStyle = '#ef4444'; 
                ctx.font = 'bold 10px sans-serif';
                ctx.fillText(timeString, 8, 16);
            }

            dataURL = canvas.toDataURL('image/png');
        } catch (e) { console.log(e); }
    }

    if (!dataURL) {
        ctx.fillStyle = '#000000';
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
            <div style="background: rgba(0,0,0,0.05); border-radius: 4px; padding: 1px; text-align: center; position: relative;">
                <img src="${cat5Snapshots[qNum]}" style="width: 100%; height: 26px; object-fit: cover; border-radius: 2px;" title="ข้อที่ ${qNum}">
            </div>
        `;
    });
}

function renderCat5SidebarGrid() {
    const container = document.getElementById('cat5-grid-container');
    if (!container) return;
    container.innerHTML = '';
    
    const laoLetters = ['ກ', 'ຂ', 'ຄ', 'ງ'];

    cat5Questions.forEach((_, idx) => {
        const btn = document.createElement('button');
        btn.className = 'cat5-grid-btn';
        
        if (cat5Answers[idx] !== undefined) {
            const ansIdx = cat5Answers[idx];
            btn.innerText = laoLetters[ansIdx] || (idx + 1);
        } else {
            btn.innerText = (idx + 1);
        }

        btn.style.cssText = "padding: 6px; font-weight: bold; font-size: 0.85rem; border-radius: 4px; border: 2.5px solid #000000; cursor: pointer; background: #ffffff; color: #000000; text-align: center;";
        
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
            saveProgressToStorage();
            renderCat5Question();
        };
        container.appendChild(btn);
    });
    
    const answeredCount = Object.keys(cat5Answers).length;
    document.getElementById('cat5-answered-text').innerText = `ຕອບແລ້ວ ${answeredCount} ທັງໝົດ ${cat5Questions.length} ຂໍ້`;
    updateBackSubmitButtonState();
}

function updateBackSubmitButtonState() {
    const answeredCount = Object.keys(cat5Answers).length;
    const isCompleted = answeredCount >= cat5Questions.length;
    const btnImg = document.getElementById('cat5-back-submit-img');
    if (!btnImg) return;

    if (isCompleted) {
        btnImg.src = 'send.png';
        btnImg.onerror = function() {
            this.onerror = null;
            this.src = 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'45\'><rect width=\'100%\' height=\'100%\' fill=\'%2315803d\' rx=\'6\'/><text x=\'50%\' y=\'55%\' fill=\'white\' font-size=\'13\' font-weight=\'bold\' text-anchor=\'middle\' dominant-baseline=\'middle\'>ສົ່ງ</text></svg>';
        };
    } else {
        btnImg.src = 'back.png';
        btnImg.onerror = function() {
            this.onerror = null;
            this.src = 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'45\'><rect width=\'100%\' height=\'100%\' fill=\'%23dc2626\' rx=\'6\'/><text x=\'50%\' y=\'55%\' fill=\'white\' font-size=\'13\' font-weight=\'bold\' text-anchor=\'middle\' dominant-baseline=\'middle\'>ກັບ</text></svg>';
        };
    }
}

function cat5PrevOrSubmit() {
    const answeredCount = Object.keys(cat5Answers).length;
    const isCompleted = answeredCount >= cat5Questions.length;

    if (isCompleted) {
        cat5SubmitExam();
    } else {
        cat5PrevQuestion();
    }
}

function renderCat5Question() {
    if (cat5Questions.length === 0) return;
    
    const progressEl = document.getElementById('cat5-progress-text');
    if (progressEl) {
        progressEl.innerText = `ຄຳຖາມທີ ${cat5Index + 1} ທັງໝົດ ${cat5Questions.length}`;
    }

    const q = cat5Questions[cat5Index];
    document.getElementById('cat5-question-text').innerText = q.question;
    
    const imgBox = document.getElementById('cat5-image-container');
    imgBox.innerHTML = q.image ? `<img src="${q.image}" alt="Sign">` : '';

    const optList = document.getElementById('cat5-options-list');
    optList.innerHTML = '';
    const letters = ['ກ', 'ຂ', 'ຄ', 'ງ'];
    const userAns = cat5Answers[cat5Index];

    q.options.forEach((opt, idx) => {
        let optStyle = "display: flex; align-items: center; padding: 14px 18px; border-radius: 10px; margin-bottom: 10px; cursor: pointer; font-size: 1.45rem; font-weight: bold; color: #000000; background: #f1f5f9; border: 2px solid #cbd5e1;";
        if (userAns !== undefined) {
            if (idx === q.answer) {
                optStyle = "display: flex; align-items: center; padding: 14px 18px; border-radius: 10px; margin-bottom: 10px; font-size: 1.45rem; font-weight: bold; color: #ffffff; background-color: #16a34a !important; border: 2px solid #22c55e !important;";
            } else if (idx === userAns) {
                optStyle = "display: flex; align-items: center; padding: 14px 18px; border-radius: 10px; margin-bottom: 10px; font-size: 1.45rem; font-weight: bold; color: #ffffff; background-color: #dc2626 !important; border: 2px solid #ef4444 !important;";
            }
        }
        optList.innerHTML += `
            <div onclick="cat5SelectOption(${idx})" style="${optStyle}">
                <span style="color: ${userAns !== undefined ? '#ffffff' : '#000000'}; margin-right: 12px; font-size: 1.55rem;">${letters[idx]}.</span>
                <span>${opt}</span>
            </div>
        `;
    });
    renderCat5SidebarGrid();
    updateHeaderBadge();
}

function cat5SelectOption(optIdx) {
    if (cat5Answers[cat5Index] !== undefined) return;
    
    cat5Answers[cat5Index] = optIdx;
    captureCat5Snapshot(cat5Index + 1);

    const q = cat5Questions[cat5Index];
    const keyName = 'lao_quiz_wrong_' + cat5Config.fileName;
    let existingWrong = JSON.parse(localStorage.getItem(keyName) || '[]');
    
    if (optIdx !== q.answer) {
        if (!existingWrong.some(e => e.question === q.question)) {
            existingWrong.push(q);
            localStorage.setItem(keyName, JSON.stringify(existingWrong));
        }
    }

    saveProgressToStorage();
    renderCat5Question();

    setTimeout(() => {
        if (cat5Index < cat5Questions.length - 1) {
            cat5Index++;
            saveProgressToStorage();
            renderCat5Question();
        }
    }, 400);
}

function cat5PrevQuestion() {
    if (cat5Index > 0) {
        cat5Index--;
        saveProgressToStorage();
        renderCat5Question();
    }
}

function cat5NextQuestion() {
    if (cat5Index < cat5Questions.length - 1) {
        cat5Index++;
        saveProgressToStorage();
        renderCat5Question();
    }
}

function cat5SubmitExam() {
    if (timerInterval) clearInterval(timerInterval);
    localStorage.removeItem('cat5_timer_seconds_' + cat5Config.fileName);

    let wrongCount = 0;
    let correctCount = 0;
    let wrongList = [];

    cat5Questions.forEach((q, idx) => {
        const userAns = cat5Answers[idx];
        if (userAns === q.answer) {
            correctCount++;
        } else {
            wrongCount++;
            wrongList.push(q);
        }
    });

    const keyName = 'lao_quiz_wrong_' + cat5Config.fileName;
    let existingWrong = JSON.parse(localStorage.getItem(keyName) || '[]');
    wrongList.forEach(w => {
        if (!existingWrong.some(ew => ew.question === w.question)) {
            existingWrong.push(w);
        }
    });
    localStorage.setItem(keyName, JSON.stringify(existingWrong));

    let batchHistory = JSON.parse(localStorage.getItem('cat5_history_' + cat5Config.fileName) || '[]');
    batchHistory.push({ wrong: wrongCount, correct: correctCount, total: cat5Questions.length });
    localStorage.setItem('cat5_history_' + cat5Config.fileName, JSON.stringify(batchHistory));

    let masterBank = JSON.parse(localStorage.getItem('cat5_master_bank_' + cat5Config.fileName) || '[]');

    localStorage.removeItem('cat5_current_batch_' + cat5Config.fileName);
    localStorage.removeItem('cat5_answers_' + cat5Config.fileName);
    localStorage.removeItem('cat5_index_' + cat5Config.fileName);

    if (masterBank.length === 0) {
        let totalBatchWrong = 0;
        let totalBatchCorrect = 0;
        let totalBatchQuestions = 0;

        batchHistory.forEach(b => {
            totalBatchWrong += b.wrong;
            totalBatchCorrect += b.correct;
            totalBatchQuestions += b.total;
        });

        const roundKey = `lao_quiz_rounds_cat5_${cat5Config.fileName}`;
        let currentRounds = parseInt(localStorage.getItem(roundKey)) || 0;
        currentRounds++;
        localStorage.setItem(roundKey, currentRounds);

        const isOverallPassed = checkIsPassed(totalBatchWrong);
        if (isOverallPassed) {
            const passedRoundKey = `lao_quiz_passed_rounds_cat5_${cat5Config.fileName}`;
            let passedRounds = parseInt(localStorage.getItem(passedRoundKey)) || 0;
            passedRounds++;
            localStorage.setItem(passedRoundKey, passedRounds);
        }

        localStorage.removeItem('cat5_history_' + cat5Config.fileName);

        const sName = localStorage.getItem('lao_quiz_student_name') || 'ບໍ່ລະບຸຊື່';
        const sAge = localStorage.getItem('lao_quiz_student_age') || '-';
        const sPhone = localStorage.getItem('lao_quiz_student_phone') || '-';
        const rounds = getTotalCompletedRounds();
        const passedRounds = getCat5PassedRounds();

        const currentTime = new Date().toLocaleString('lo-LA', { 
            timeZone: 'Asia/Vientiane',
            dateStyle: 'short', 
            timeStyle: 'medium' 
        });

        let dgMsg = `━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `📊 📉 **ລາຍງານຜົນການສອບເສັງ ໝວດທີ 5 (ຄຳຖາມ - ครบทุกข้อ)** 📉 📊\n` +
                    `👤 ຊື່: ${sName} (ອາຍຸ: ${sAge} ປີ)\n` +
                    `📞 ເບີໂທ: ${sPhone}\n` +
                    `📋 ປະເພດໃບຂັບຂີ່: ${cat5Config.categoryName}\n` +
                    `⏰ ເວລາ: ${currentTime}\n` +
                    `----------------------------------\n` +
                    `✅ ຕອບຖືກລວມ: ${totalBatchCorrect} ຂໍ້\n` +
                    `❌ ຕອບຜິດລວມ: ${totalBatchWrong} ຂໍ້ (ທັງໝົດ ${totalBatchQuestions} ຂໍ້)\n` +
                    `🏆 ຜ່ານ: ${passedRounds} ຮອບ | 🔄 ອ່ານ: ${rounds.r5} ຮອບ\n` +
                    `🔄 **ຈຳນວນຮອບທີ່ອ່ານລວມ (ໝວດ 2, 3, 5):** ${rounds.total} ຮອບ\n` +
                    `   • ໝວດ 2: ${rounds.r2} ຮອບ | ໝວດ 3: ${rounds.r3} ຮອບ | ໝວດ 5: ${rounds.r5} ຮອບ\n` +
                    `📌 ສະຖານະ: ${isOverallPassed ? 'ຜ່ານ ✅' : 'ບໍ່ຜ່ານ ❌'}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━`;
        sendDiscordNotification(dgMsg);

        showFinalCompleteScreen();
    } else {
        showBatchSummaryScreen(correctCount, wrongCount, masterBank.length);
    }
}

function showBatchSummaryScreen(correct, wrong, remainingMaster) {
    const examGrid = document.querySelector('.cat5-exam-grid');
    const topHeader = document.querySelector('.cat5-top-header');
    const bottomBar = document.querySelector('.cat5-bottom-bar');
    if (examGrid) examGrid.style.display = 'none';
    if (topHeader) topHeader.style.display = 'none';
    if (bottomBar) bottomBar.style.display = 'none';
    
    const resultScreen = document.getElementById('cat5-result-screen');
    if (resultScreen) resultScreen.style.display = 'flex';

    document.getElementById('cat5-final-score').innerText = `ຕອບຜິດ ${wrong} ຂໍ້ ໃນທັງໝົດ ${cat5Questions.length} ຂໍ້`;
    
    const rounds = getTotalCompletedRounds();
    const passedRounds = getCat5PassedRounds();
    document.getElementById('cat5-total-rounds-summary').innerHTML = `🏆 <b>ຜ່ານ:</b> ${passedRounds} ຮອບ | 🔄 <b>ອ່ານ:</b> ${rounds.r5} ຮອບ<br>` +
                                                                     `🔄 <b>ອ່ານລວມ (ໝວດ 2, 3, 5):</b> ${rounds.total} ຮອບ<br>` +
                                                                     `<span style="font-size: 0.85rem; color: #475569;">(ໝວດ 2: ${rounds.r2} ຮອບ | ໝວດ 3: ${rounds.r3} ຮອບ | ໝວດ 5: ${rounds.r5} ຮອບ)</span>`;

    let isPassed = checkIsPassed(wrong);
    const bigTextEl = document.getElementById('cat5-pass-fail-big-text');
    if (isPassed) {
        bigTextEl.innerText = 'ຜ່ານ';
        bigTextEl.style.color = '#16a34a';
    } else {
        bigTextEl.innerText = 'ບໍ່ຜ່ານ';
        bigTextEl.style.color = '#dc2626';
    }

    let currentWrongSaved = JSON.parse(localStorage.getItem('lao_quiz_wrong_' + cat5Config.fileName) || '[]');

    let actionButtonsHtml = '';
    if (currentWrongSaved.length > 0) {
        actionButtonsHtml += `
            <button onclick="window.location.href='index.html'" style="padding: 12px; font-size: 0.95rem; font-weight: bold; background: #dc2626; color: white; border: none; border-radius: 8px; cursor: pointer; width: 100%; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
                🎯 ໄປແກ້ສະເພາະຂໍ້ທີ່ຜິດໃນໝວດ 4 (${currentWrongSaved.length} ຂໍ້) - [ບັງຄັບ]
            </button>
        `;
    }

    actionButtonsHtml += `
        <button onclick="window.location.reload()" style="padding: 12px; font-size: 0.95rem; font-weight: bold; background: #0284c7; color: white; border: none; border-radius: 8px; cursor: pointer; width: 100%;">
            🔄 ໄປເຮັດຂໍ້ສອບຊຸດຖັດໄປຕໍ່
        </button>
    `;

    document.getElementById('cat5-result-action-buttons').innerHTML = actionButtonsHtml;
}

function showFinalCompleteScreen() {
    let batchHistory = JSON.parse(localStorage.getItem('cat5_history_' + cat5Config.fileName) || '[]');
    let totalWrong = 0;
    let totalCorrect = 0;
    let totalQuestions = 0;

    batchHistory.forEach(b => {
        totalWrong += b.wrong;
        totalCorrect += b.correct;
        totalQuestions += b.total;
    });

    let isPassed = checkIsPassed(totalWrong);

    const rounds = getTotalCompletedRounds();
    const passedRounds = getCat5PassedRounds();

    const examGrid = document.querySelector('.cat5-exam-grid');
    const topHeader = document.querySelector('.cat5-top-header');
    const bottomBar = document.querySelector('.cat5-bottom-bar');
    if (examGrid) examGrid.style.display = 'none';
    if (topHeader) topHeader.style.display = 'none';
    if (bottomBar) bottomBar.style.display = 'none';
    
    const resultScreen = document.getElementById('cat5-result-screen');
    if (resultScreen) resultScreen.style.display = 'flex';
    
    document.getElementById('cat5-final-score').innerText = `ຕອບຜິດ ${totalWrong} ຂໍ້ ທັງໝົດ ${totalQuestions} ຂໍ້ (ຄຳຖາມ)`;
    
    document.getElementById('cat5-total-rounds-summary').innerHTML = `🏆 <b>ຜ່ານ:</b> ${passedRounds} ຮອບ | 🔄 <b>ອ່ານ:</b> ${rounds.r5} ຮອບ<br>` +
                                                                     `🔄 <b>ອ່ານລວມ (ໝວດ 2, 3, 5):</b> ${rounds.total} ຮອບ<br>` +
                                                                     `<span style="font-size: 0.85rem; color: #475569;">(ໝວດ 2: ${rounds.r2} ຮອບ | ໝວດ 3: ${rounds.r3} ຮອບ | ໝວດ 5: ${rounds.r5} ຮອບ)</span>`;

    const bigTextEl = document.getElementById('cat5-pass-fail-big-text');
    if (isPassed) {
        bigTextEl.innerText = 'ຜ່ານ';
        bigTextEl.style.color = '#16a34a';
    } else {
        bigTextEl.innerText = 'ບໍ່ຜ່ານ';
        bigTextEl.style.color = '#dc2626';
    }

    let currentWrongSaved = JSON.parse(localStorage.getItem('lao_quiz_wrong_' + cat5Config.fileName) || '[]');

    let actionButtonsHtml = '';
    if (currentWrongSaved.length > 0) {
        actionButtonsHtml += `
            <button onclick="window.location.href='index.html'" style="padding: 14px; font-size: 1.05rem; font-weight: bold; background: #dc2626; color: white; border: none; border-radius: 8px; cursor: pointer; width: 100%; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
                🎯 ໄປແກ້ສະເພາະຂໍ້ທີ່ຜິດໃນໝວດ 4 (${currentWrongSaved.length} ຂໍ້) - [ບັງຄັບ]
            </button>
        `;
    } else {
        actionButtonsHtml += `
            <button onclick="window.location.href='index.html'" style="padding: 14px; font-size: 1.05rem; font-weight: bold; background: #16a34a; color: white; border: none; border-radius: 8px; cursor: pointer; width: 100%; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
                🏠 ກຼັບຄືນໜ້າທຳອິດ
            </button>
        `;
    }

    document.getElementById('cat5-result-action-buttons').innerHTML = actionButtonsHtml;
}