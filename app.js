let quizQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = {};
let isAnswered = false; 

let correctCount = 0;
let wrongCount = 0;
let wrongQuestionsList = []; 
let currentCategoryFile = 'ABC.txt';
let currentMode = 'quiz'; 
let hasSkipped = false; 

let teacherTempUnlocked = false;

const TELEGRAM_BOT_TOKEN = '8235688305:AAGUwsZaWzJJn7keTauBLpbUcUYP5eRuv_A';
const TELEGRAM_CHAT_ID = '-5193551029';

window.addEventListener('DOMContentLoaded', () => {
    const savedName = localStorage.getItem('lao_quiz_student_name');
    const savedAge = localStorage.getItem('lao_quiz_student_age');
    const savedPhone = localStorage.getItem('lao_quiz_student_phone');

    const nameInput = document.getElementById('studentName');
    const ageInput = document.getElementById('studentAge');
    const phoneInput = document.getElementById('studentPhone');
    const homeSelect = document.getElementById('homeCategory');

    if (savedName && nameInput) {
        nameInput.value = savedName;
        nameInput.disabled = true;
        nameInput.style.backgroundColor = '#334155';
    }
    if (savedAge && ageInput) {
        ageInput.value = savedAge;
        ageInput.disabled = true;
        ageInput.style.backgroundColor = '#334155';
    }
    if (savedPhone && phoneInput) {
        phoneInput.value = savedPhone;
        phoneInput.disabled = true;
        phoneInput.style.backgroundColor = '#334155';
    }

    const savedCategory = localStorage.getItem('lao_quiz_selected_category');
    if (savedCategory && homeSelect) {
        homeSelect.value = savedCategory;
        homeSelect.disabled = true;
        homeSelect.style.backgroundColor = '#334155';
        currentCategoryFile = savedCategory;
    }

    let visitCount = parseInt(localStorage.getItem('lao_quiz_visit_count')) || 0;
    visitCount++;
    localStorage.setItem('lao_quiz_visit_count', visitCount);

    checkHomeUnlockStatus();
    window.addEventListener('online', processOfflineQueue);
    processOfflineQueue();
});

window.addEventListener('pageshow', (event) => {
    checkHomeUnlockStatus();
});

function validateAndStartApp(mode) {
    const nameInput = document.getElementById('studentName');
    const ageInput = document.getElementById('studentAge');
    const phoneInput = document.getElementById('studentPhone');
    const homeSelect = document.getElementById('homeCategory');

    const name = nameInput ? nameInput.value.trim() : (localStorage.getItem('lao_quiz_student_name') || '');
    const age = ageInput ? ageInput.value.trim() : (localStorage.getItem('lao_quiz_student_age') || '');
    const phone = phoneInput ? phoneInput.value.trim() : (localStorage.getItem('lao_quiz_student_phone') || '');

    if (!name || !age || !phone) {
        alert('⚠️ ຖ້າກະລຸນາ ໃສ່ຊື່, ອາຍຸ ແລະ ເບີໂທລະສັບ ໃຫ້ຄົບຖ້ວນກ່ອນເລີ່ມຕົ້ນ!');
        if (nameInput) nameInput.focus();
        return;
    }

    if (homeSelect && !homeSelect.value) {
        alert('⚠️ ກະລຸນາເລືອກປະເພດໃບຂັບຂີ່ກ່ອນເລີ່ມຕົ້ນ!');
        homeSelect.focus();
        return;
    }

    const filename = homeSelect ? homeSelect.value : currentCategoryFile;
    const isStudyPassed = (localStorage.getItem(`lao_quiz_study_passed_${filename}`) === 'true') || teacherTempUnlocked || (localStorage.getItem(`lao_quiz_teacher_secret_${filename}`) === 'true');
    const isQuizPassed = (localStorage.getItem(`lao_quiz_quiz_passed_${filename}`) === 'true') || teacherTempUnlocked || (localStorage.getItem(`lao_quiz_teacher_secret_${filename}`) === 'true');
    const savedWrong = JSON.parse(localStorage.getItem('lao_quiz_wrong_' + filename)) || [];
    const isPermanentUnlocked = (localStorage.getItem(`lao_quiz_teacher_secret_${filename}`) === 'true') || teacherTempUnlocked;

    if (mode === 'quiz') {
        if (!isStudyPassed) {
            alert('⚠️ ຍັງບໍ່ສາມາດເຂົ້າໃຊ້ງານໄດ້!\nກະລຸນາອ່ານໂໝດອ່ານຮຽນຮູ້ (ໝວດ 1) ໃຫ້ຈົບທຸກຂໍ້ກ່ອນ.');
            return;
        }
    }

    if (mode === 'random') {
        if (!isQuizPassed) {
            alert('⚠️ ຍັງບໍ່ສາມາດເຂົ້າໃຊ້ງານໄດ້!\nກະລຸນາອ່ານແບບທົດສອບ (ໝວດ 2) ໃຫ້ຈົບທຸກຂໍ້ກ່ອນ');
            return;
        }
        if (savedWrong.length > 0 && !isPermanentUnlocked) {
            alert(`⚠️ ຍັງບໍ່ສາມາດເຂົ້າໃຊ້ງານ ໝວດ 3 ໄດ້!\nທ່ານມີຂໍ້ທີ່ຕອບຜິດຄ້າງຢູ່ໃນ ໝວດ 4 ຈຳນວນ ${savedWrong.length} ຂໍ້\nກະລຸນາແກ້ໄຂຂໍ້ຜິດໃນໝວດ 4 ໃຫ້ໝົດກ່ອນ!`);
            return;
        }
    }

    localStorage.setItem('lao_quiz_student_name', name);
    localStorage.setItem('lao_quiz_student_age', age);
    localStorage.setItem('lao_quiz_student_phone', phone);

    if (homeSelect) {
        currentCategoryFile = homeSelect.value;
        localStorage.setItem('lao_quiz_selected_category', currentCategoryFile);
    }

    if (nameInput) nameInput.disabled = true;
    if (ageInput) ageInput.disabled = true;
    if (phoneInput) phoneInput.disabled = true;
    if (homeSelect) homeSelect.disabled = true;

    startApp(mode);
}

function sendToTelegramAPI(message) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const payload = { chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown' };
    if (!navigator.onLine) { saveToOfflineQueue(payload); return; }
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => { saveToOfflineQueue(payload); });
}

function saveToOfflineQueue(payload) {
    let queue = JSON.parse(localStorage.getItem('lao_quiz_offline_queue')) || [];
    queue.push(payload);
    localStorage.setItem('lao_quiz_offline_queue', JSON.stringify(queue));
}

function processOfflineQueue() {
    if (!navigator.onLine) return;
    let queue = JSON.parse(localStorage.getItem('lao_quiz_offline_queue')) || [];
    if (queue.length === 0) return;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const payload = queue.shift();
    localStorage.setItem('lao_quiz_offline_queue', JSON.stringify(queue));
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(() => { processOfflineQueue(); }).catch(() => { queue.unshift(payload); localStorage.setItem('lao_quiz_offline_queue', JSON.stringify(queue)); });
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function teacherUnlock() {
    const password = prompt("🔐 ໂໝດສຳລັບຄູສອນ\nກະລຸນາໃສ່ລະຫັດຜ່ານ:");
    if (password === null) return;
    const homeSelect = document.getElementById('homeCategory');
    const filename = homeSelect && homeSelect.value ? homeSelect.value : currentCategoryFile;

    if (password === "1234") {
        teacherTempUnlocked = true;
        localStorage.removeItem(`lao_quiz_study_passed_${filename}`);
        localStorage.removeItem(`lao_quiz_quiz_passed_${filename}`);
        localStorage.removeItem(`lao_quiz_teacher_secret_${filename}`);
        if (homeSelect) { homeSelect.disabled = false; homeSelect.style.backgroundColor = '#475569'; }
        localStorage.removeItem('lao_quiz_selected_category');
        checkHomeUnlockStatus();
        alert("🎉 ປົດລັອກແບບ **ຊົ່ວຄາວ** ສຳເລັດ!");
    } else if (password === "77116687") {
        localStorage.setItem(`lao_quiz_study_passed_${filename}`, 'true');
        localStorage.setItem(`lao_quiz_quiz_passed_${filename}`, 'true');
        localStorage.setItem(`lao_quiz_teacher_secret_${filename}`, 'true');
        teacherTempUnlocked = false;
        if (homeSelect) { homeSelect.disabled = false; homeSelect.style.backgroundColor = '#475569'; }
        localStorage.removeItem('lao_quiz_selected_category');
        checkHomeUnlockStatus();
        alert("🎉 ປົດລັອກແບບ **ຖາວອນ** ສຳເລັດ!");
    } else {
        alert("❌ ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ!");
    }
}

function checkHomeUnlockStatus() {
    const homeSelect = document.getElementById('homeCategory');
    if (homeSelect && homeSelect.value) { currentCategoryFile = homeSelect.value; }
    const filename = currentCategoryFile;

    const btn1 = document.getElementById('btn-mode-1');
    const btn2 = document.getElementById('btn-mode-2');
    const btn3 = document.getElementById('btn-mode-3');
    const btn4 = document.getElementById('btn-mode-4');
    const btn5 = document.getElementById('btn-category-5');

    const isStudyPassed = (localStorage.getItem(`lao_quiz_study_passed_${filename}`) === 'true') || teacherTempUnlocked || (localStorage.getItem(`lao_quiz_teacher_secret_${filename}`) === 'true');
    const isQuizPassed = (localStorage.getItem(`lao_quiz_quiz_passed_${filename}`) === 'true') || teacherTempUnlocked || (localStorage.getItem(`lao_quiz_teacher_secret_${filename}`) === 'true');
    
    const savedWrong = JSON.parse(localStorage.getItem('lao_quiz_wrong_' + filename)) || [];
    const hasWrongQuestions = savedWrong.length > 0;
    const isPermanentUnlocked = (localStorage.getItem(`lao_quiz_teacher_secret_${filename}`) === 'true') || teacherTempUnlocked;

    const quizState = JSON.parse(localStorage.getItem('lao_quiz_state_quiz_' + filename)) || {};
    const quizAnsweredCount = quizState.userAnswers ? Object.keys(quizState.userAnswers).length : 0;
    const randomState = JSON.parse(localStorage.getItem('lao_quiz_state_random_' + filename)) || {};
    const randomAnsweredCount = randomState.userAnswers ? Object.keys(randomState.userAnswers).length : 0;

    if (btn1) {
        btn1.style.background = '#0033FF';
        btn1.style.color = '#ffffff';
        btn1.innerHTML = `📖 1. ໂໝດອ່ານຮຽນຮູ້ (ຄຳຕອບຖືກສະແດງ)`;
    }

    if (btn2) {
        if (isStudyPassed) {
            btn2.style.background = '#f57f17';
            btn2.style.color = '#ffffff';
            btn2.innerHTML = `📝 2. ໂໝດແບບທົດສອບ (${quizAnsweredCount} ຂໍ້)`;
        } else {
            btn2.style.background = '#64748b';
            btn2.style.color = '#cbd5e1';
            btn2.innerHTML = `🔒 2. ໂໝດແບບທົດສອບ (${quizAnsweredCount} ຂໍ້) - [ຕ້ອງອ່ານໝວດ 1 ໃຫ້ຈົບກ່ອນ]`;
        }
    }

    if (btn4) {
        btn4.style.background = '#dc2626';
        btn4.style.color = '#ffffff';
        btn4.innerHTML = `🎯 4. ໂໝດແກ້ໄຂຂໍ້ຜິດ (${savedWrong.length} ຂໍ້)`;
    }

    if (btn3) {
        if (!isQuizPassed) {
            btn3.style.background = '#64748b';
            btn3.style.color = '#cbd5e1';
            btn3.innerHTML = `🔒 3. ໂໝດສະຫຼັບຄຳຖາມ (${randomAnsweredCount} ຂໍ້) - [ຕ້ອງເຮັດໝວດ 2 ໃຫ້ສร็จກ່ອນ]`;
        } else if (hasWrongQuestions && !isPermanentUnlocked) {
            btn3.style.background = '#64748b';
            btn3.style.color = '#cbd5e1';
            btn3.innerHTML = `🔒 3. ໂໝດສະຫຼັບຄຳຖາມ (${randomAnsweredCount} ຂໍ້) - [ຕ້ອງແກ້ໄຂຂໍ້ຜິດໃນໝວດ 4 ໃຫ້ໝົດກ່ອນ]`;
        } else {
            btn3.style.background = '#7e22ce';
            btn3.style.color = '#ffffff';
            btn3.innerHTML = `🔀 3. ໂໝດສະຫຼັບຄຳຖາມ (${randomAnsweredCount} ຂໍ້)`;
        }
    }

    if (btn5) {
        if (!isQuizPassed) {
            btn5.style.background = '#64748b';
            btn5.style.color = '#cbd5e1';
            btn5.innerHTML = `🔒 5. ໝວດທີ 5 (${randomAnsweredCount} ຂໍ້) - [ຕ້ອງເຮັດໝວດ 2 ໃຫ້ສร็จກ່ອນ]`;
        } else if (hasWrongQuestions && !isPermanentUnlocked) {
            btn5.style.background = '#64748b';
            btn5.style.color = '#cbd5e1';
            btn5.innerHTML = `🔒 5. ໝວດທີ 5 (${randomAnsweredCount} ຂໍ້) - [ຕ້ອງແກ້ໄຂຂໍ້ຜິດໃນໝວດ 4 ໃຫ້ໝົດກ່ອນ]`;
        } else {
            btn5.style.background = '#0d9488';
            btn5.style.color = '#ffffff';
            btn5.innerHTML = `🚀 5. ໝວດທີ 5 (${randomAnsweredCount} ຂໍ້)`;
        }
    }
}

function startApp(mode) {
    const homeSelect = document.getElementById('homeCategory');
    if (homeSelect && homeSelect.value) {
        currentCategoryFile = homeSelect.value;
        localStorage.setItem('lao_quiz_selected_category', currentCategoryFile);
    }
    
    currentMode = mode;
    hasSkipped = false; 
    
    const innerSelect = document.getElementById('licenseCategory');
    if (innerSelect) innerSelect.value = currentCategoryFile;

    document.getElementById('home-screen').style.display = 'none';
    document.getElementById('main-quiz-wrapper').style.display = 'flex';

    const quizBox = document.getElementById('main-quiz-box');
    if (currentMode === 'study') quizBox.style.backgroundColor = '#000000';
    else if (currentMode === 'quiz') quizBox.style.backgroundColor = '#0000CC';
    else if (currentMode === 'random') quizBox.style.backgroundColor = '#993399';
    else if (currentMode === 'review_wrong') quizBox.style.backgroundColor = '#996600';

    document.getElementById('live-score-board').style.display = (currentMode === 'study') ? 'none' : 'flex';
    fetchQuestions(currentCategoryFile, false);
}

function goHome() {
    document.getElementById('main-quiz-wrapper').style.display = 'none';
    document.getElementById('home-screen').style.display = 'flex';
    document.getElementById('main-quiz-box').style.backgroundColor = '#1e3a8a'; 
    checkHomeUnlockStatus(); 
}

async function fetchQuestions(filename, isRestoring = false) {
    currentCategoryFile = filename;
    document.getElementById('result-screen').style.display = 'none';
    document.getElementById('quiz-screen').style.display = 'flex';
    document.getElementById('question-text').innerText = 'ກຳລັງໂຫຼດຂໍ້ສອບຈາກ ' + filename + '...';
    document.getElementById('options-container').innerHTML = '';
    document.getElementById('image-container').innerHTML = '';
    
    try {
        if (currentMode === 'review_wrong') {
            const savedWrong = localStorage.getItem('lao_quiz_wrong_' + filename);
            quizQuestions = savedWrong ? JSON.parse(savedWrong) : [];
            currentQuestionIndex = 0;
            userAnswers = {};
            correctCount = 0;
            wrongCount = 0;
            wrongQuestionsList = [];
        } else {
            const response = await fetch(filename);
            if (!response.ok) throw new Error('ไม่พบไฟล์ ' + filename);
            const textData = await response.text();
            quizQuestions = parseCsvInsideTxt(textData);
            
            if (!isRestoring) {
                const storageKey = 'lao_quiz_state_' + currentMode + '_' + filename;
                const savedData = localStorage.getItem(storageKey);
                if (savedData) {
                    const data = JSON.parse(savedData);
                    currentQuestionIndex = data.currentQuestionIndex || 0;
                    userAnswers = data.userAnswers || {};
                    correctCount = data.correctCount || 0;
                    wrongCount = data.wrongCount || 0;
                    if (currentMode === 'random' && data.quizQuestions) quizQuestions = data.quizQuestions;
                } else {
                    currentQuestionIndex = 0;
                    userAnswers = {};
                    correctCount = 0;
                    wrongCount = 0;
                    wrongQuestionsList = [];
                    if (currentMode === 'random') shuffleArray(quizQuestions);
                }
            } else {
                if (currentMode === 'random') shuffleArray(quizQuestions);
            }
        }
        
        isAnswered = (currentMode === 'study') ? true : (userAnswers[currentQuestionIndex] !== undefined);
        updateLiveScore();
        
        if (quizQuestions.length > 0) {
            loadQuestion();
        } else {
            if (currentMode === 'review_wrong') {
                showReviewWrongCompleteScreen(); 
            } else {
                document.getElementById('question-text').innerText = 'ບໍ່ມີຂໍ້ສອບ';
            }
        }
    } catch (error) {
        console.error(error);
        document.getElementById('question-text').innerText = 'เกิดข้อผิดพลาดในการโหลดไฟล์ ' + filename;
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
            if (char === '"') inQuotes = !inQuotes;
            else if (char === ',' && !inQuotes) { parts.push(current.trim().replace(/^"|"$/g, '')); current = ''; }
            else current += char;
        }
        parts.push(current.trim().replace(/^"|"$/g, ''));
        if (parts.length < 6) return;
        const qText = parts[0];
        let ansNum = 1;
        try { ansNum = parseInt(parts[1]) || 1; } catch(e) { ansNum = 1; }
        const ansIndex = ansNum - 1;
        let options = [];
        for (let i = 2; i <= 5; i++) {
            if (parts[i]) { let opt = parts[i]; if (opt && opt !== '-') options.push(opt); }
        }
        let imagePath = null;
        for (let i = 0; i < parts.length; i++) {
            let p = parts[i].trim().replace(/^"|"$/g, '');
            let lowerP = p.toLowerCase();
            if (lowerP.endsWith('.png') || lowerP.endsWith('.jpg') || lowerP.endsWith('.jpeg')) { imagePath = p; break; }
        }
        if (qText && options.length > 0) {
            questions.push({ id: questions.length + 1, question: qText, image: imagePath, options: options, answer: ansIndex });
        }
    });
    return questions;
}

function changeCategory() {
    const selectElement = document.getElementById('licenseCategory');
    if (!selectElement) return;
    const selectedFile = selectElement.value;
    const homeSelect = document.getElementById('homeCategory');
    if (homeSelect && !homeSelect.disabled) homeSelect.value = selectedFile;
    currentCategoryFile = selectedFile;
    if (homeSelect && !homeSelect.disabled) localStorage.setItem('lao_quiz_selected_category', selectedFile);
    checkHomeUnlockStatus();
    fetchQuestions(selectedFile, false);
}

function saveQuizState() {
    if (currentMode === 'review_wrong') return;
    if (hasSkipped) { localStorage.removeItem('lao_quiz_state_' + currentMode + '_' + currentCategoryFile); return; }
    const stateData = { currentQuestionIndex, userAnswers, correctCount, wrongCount, quizQuestions: (currentMode === 'random') ? quizQuestions : undefined };
    localStorage.setItem('lao_quiz_state_' + currentMode + '_' + currentCategoryFile, JSON.stringify(stateData));
}

function loadQuestion() {
    if (quizQuestions.length === 0) return;
    document.getElementById('result-screen').style.display = 'none';
    document.getElementById('quiz-screen').style.display = 'flex';

    const q = quizQuestions[currentQuestionIndex];
    isAnswered = (currentMode === 'study') ? true : (userAnswers[currentQuestionIndex] !== undefined);

    document.getElementById('question-count').innerText = `ຄຳຖາມທີ ${currentQuestionIndex + 1} ຈາກ ${quizQuestions.length}`;
    document.getElementById('question-text').innerText = q.question;
    document.getElementById('image-container').innerHTML = q.image ? `<img src="${q.image}" alt="Traffic Sign" style="max-height: 180px;">` : '';

    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';
    const laoLetters = ['ກ', 'ຂ', 'ຄ', 'ງ'];

    q.options.forEach((opt, idx) => {
        const isChecked = userAnswers[currentQuestionIndex] === idx;
let optionStyle = "display: flex !important; align-items: center !important; padding: 12px 14px !important; border-radius: 8px !important; margin-bottom: 8px !important; cursor: pointer !important; font-size: 1.05rem !important; line-height: 1.45 !important; font-weight: bold !important; color: #ffffff !important; background: transparent !important; background-color: transparent !important; border: none !important; box-shadow: none !important;";
        if (currentMode === 'study') {
            if (idx === q.answer) optionStyle = "display: flex !important; align-items: center !important; padding: 12px 14px !important; border-radius: 8px !important; margin-bottom: 8px !important; cursor: pointer !important; font-size: 1.05rem !important; line-height: 1.45 !important; font-weight: bold !important; color: #ffffff !important; background-color: #15803d !important; border: 1px solid #16a34a !important;";
        } else {
            if (isAnswered) {
                if (idx === q.answer) optionStyle = "display: flex !important; align-items: center !important; padding: 12px 14px !important; border-radius: 8px !important; margin-bottom: 8px !important; cursor: pointer !important; font-size: 1.05rem !important; line-height: 1.45 !important; font-weight: bold !important; color: #ffffff !important; background-color: #15803d !important; border: 1px solid #16a34a !important;"; 
                else if (isChecked && idx !== q.answer) optionStyle = "display: flex !important; align-items: center !important; padding: 12px 14px !important; border-radius: 8px !important; margin-bottom: 8px !important; cursor: pointer !important; font-size: 1.05rem !important; line-height: 1.45 !important; font-weight: bold !important; color: #ffffff !important; background-color: #b91c1c !important; border: 1px solid #dc2626 !important;"; 
            }
        }

        const letterLabel = laoLetters[idx] || (idx + 1);
        optionsContainer.innerHTML += `
            <label class="option-label" onclick="selectOption(${idx})" style="${optionStyle}">
                <input type="radio" name="option" value="${idx}" ${isChecked ? 'checked' : ''} ${isAnswered && currentMode !== 'study' ? 'disabled' : ''} style="display: none;">
                <span style="margin-right: 10px; color: #ffffff; font-size: 1.1rem;">${letterLabel}.</span>
                <span style="color: #ffffff;">${opt}</span>
            </label>
        `;
    });

    // 🎯 สลับปุ่มควบคุมด้านล่างตามโหมด (บังคับเช็คเงื่อนไขหมวด 1 ให้ชัดเจน)
    const nextBtn = document.getElementById('btn-next');
    const bottomBarWrapper = document.getElementById('cat5-bottom-bar-wrapper');

    if (currentMode === 'study' || currentMode === '1') {
        // 📌 ถ้าเป็นหมวด 1 (อ่านเรียนรู้) -> แสดงปุ่ม "ต่อไป" แบบยาว และบังคับซ่อนแถบ ก ข ค ง ทันที
        if (nextBtn) {
            nextBtn.style.setProperty('display', 'block', 'important');
        }
        if (bottomBarWrapper) {
            bottomBarWrapper.style.setProperty('display', 'none', 'important');
        }

        if (currentQuestionIndex === quizQuestions.length - 1) {
            nextBtn.innerText = 'ເກັງຫລາຍ ອ່ານຈົບແລ້ວ ກົດໄປຕໍ່';
            nextBtn.className = 'btn-submit';
        } else {
            nextBtn.innerText = 'ຕໍ່ໄປ';
            nextBtn.className = 'btn-next';
        }
        nextBtn.style.opacity = '1';
        nextBtn.style.cursor = 'pointer';
    } else {
        // 📌 ถ้าเป็นโหมดอื่น (2, 3, 4) -> ซ่อนปุ่มยาว และแสดงแถบ ก ข ค ง
        if (nextBtn) {
            nextBtn.style.setProperty('display', 'none', 'important');
        }
        if (bottomBarWrapper) {
            bottomBarWrapper.style.setProperty('display', 'flex', 'important');
        }
        updateBottomBarState();
    }
	
    saveQuizState();
}

function selectOptionByLetter(index) {
    if (currentMode === 'study') return;
    if (isAnswered) return;
    selectOption(index);
}

function selectOption(index) {
    if (currentMode === 'study') return;
    if (isAnswered) return; 

    userAnswers[currentQuestionIndex] = index;
    isAnswered = true;

    const q = quizQuestions[currentQuestionIndex];
    let existingWrong = JSON.parse(localStorage.getItem('lao_quiz_wrong_' + currentCategoryFile)) || [];

    if (index === q.answer) {
        correctCount++;
        if (currentMode === 'review_wrong') {
            existingWrong = existingWrong.filter(item => item.question !== q.question);
            localStorage.setItem('lao_quiz_wrong_' + currentCategoryFile, JSON.stringify(existingWrong));
            wrongQuestionsList = existingWrong;
        }
    } else {
        wrongCount++;
        if (!existingWrong.some(e => e.question === q.question)) {
            existingWrong.push(q);
            localStorage.setItem('lao_quiz_wrong_' + currentCategoryFile, JSON.stringify(existingWrong));
        }
        if (!wrongQuestionsList.some(item => item.question === q.question)) {
            wrongQuestionsList.push(q);
        }
    }
    updateLiveScore();
    saveQuizState();
    loadQuestion(); 
}

function updateLiveScore() {
    document.getElementById('live-correct').innerText = correctCount;
    document.getElementById('live-wrong').innerText = wrongCount;
}

function nextQuestion() {
    if (currentQuestionIndex < quizQuestions.length - 1) {
        currentQuestionIndex++;
        saveQuizState();
        loadQuestion();
    } else {
        finishExamOrNext();
    }
}

function prevOrSubmit() {
    const answeredCount = Object.keys(userAnswers).length;
    const isCompleted = answeredCount >= quizQuestions.length;

    if (isCompleted || currentQuestionIndex === quizQuestions.length - 1) {
        finishExamOrNext();
    } else {
        prevQuestion();
    }
}

function prevQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        saveQuizState();
        loadQuestion();
    }
}

// 🎯 ปรับปรุงจุดนี้: บังคับให้ผู้ใชิต้องเลือกตอบก่อน ถึงจะกดปุ่มข้อถัดไป/ข้าม ได้
function nextOrSkipQuestion() {
    if (currentMode !== 'study' && !isAnswered) {
        alert('⚠️ ກະລຸນາເລືອກຕອບຄຳຖາມ (ກ, ຂ, ຄ, ງ) ກ່ອນໄປຂໍ້ຕໍ່ໄປ!');
        return;
    }

    if (currentQuestionIndex < quizQuestions.length - 1) {
        currentQuestionIndex++;
        saveQuizState();
        loadQuestion();
    } else {
        finishExamOrNext();
    }
}

function finishExamOrNext() {
    localStorage.removeItem('lao_quiz_state_' + currentMode + '_' + currentCategoryFile);

    if (currentMode === 'study') {
        localStorage.setItem(`lao_quiz_study_passed_${currentCategoryFile}`, 'true');
        checkHomeUnlockStatus();
        showStudyCompleteScreen();
    } else if (currentMode === 'quiz') {
        localStorage.setItem(`lao_quiz_quiz_passed_${currentCategoryFile}`, 'true');
        checkHomeUnlockStatus();
        showResults();
    } else if (currentMode === 'random') {
        localStorage.setItem(`lao_quiz_random_passed_${currentCategoryFile}`, 'true');
        checkHomeUnlockStatus();
        showResults();
    } else if (currentMode === 'review_wrong') {
        let remainingWrong = JSON.parse(localStorage.getItem('lao_quiz_wrong_' + currentCategoryFile)) || [];
        if (remainingWrong.length > 0) {
            alert(`⚠️ ຍັງມີຂໍ້ທີ່ຕອບຜິດຄ້າງຢູ່ ${remainingWrong.length} ຂໍ້!`);
            startApp('review_wrong'); 
        } else {
            showReviewWrongCompleteScreen(); 
        }
    }
}

function updateBottomBarState() {
    const answeredCount = Object.keys(userAnswers).length;
    const isCompleted = answeredCount >= quizQuestions.length || currentQuestionIndex === quizQuestions.length - 1;
    const btnImg = document.getElementById('back-submit-img');
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

function showStudyCompleteScreen() {
    document.getElementById('quiz-screen').style.display = 'none';
    document.getElementById('result-screen').style.display = 'block';
    document.getElementById('final-score').innerHTML = '🎉 ທ່ານອ່ານທົບທວນຄຳຖາມຈົບໝົດທຸກຂໍ້ແລ້ວ!';
    document.getElementById('score-message').innerHTML = 'ຍິນດີດ້ວຍ! ທ່ານໄດ້ປົດລັອກໝວດທີ 2 (ແບບທົດສອບ) ແລ້ວ!';
    document.getElementById('result-action-buttons').innerHTML = `
        <button onclick="goHome()" style="padding: 10px; font-size: 0.85rem; font-weight: bold; background: #475569; color: white; border: none; border-radius: 8px; cursor: pointer; width: 100%;">
            🏠 ກຼັບຄືນໜ້າທຳອິດ
        </button>
    `;
}

function showReviewWrongCompleteScreen() {
    document.getElementById('quiz-screen').style.display = 'none';
    document.getElementById('result-screen').style.display = 'block';
    document.getElementById('final-score').innerHTML = '🎉 ຍິນດີນຳ ທ່ານໄດ້ແກ້ໄຂທັງໝົດຖືກຕ້ອງຄົບແລ້ວ';
    document.getElementById('score-message').innerHTML = 'ສຸດຍອດ! ທ່ານໄດ້ຕອບຖືກຄົບທຸກຂໍ້ທີ່ເຄຍເຮັດຜິດໄວ້ແລ້ວ';
    document.getElementById('result-action-buttons').innerHTML = `
        <button onclick="goHome()" style="padding: 10px; font-size: 0.85rem; font-weight: bold; background: #475569; color: white; border: none; border-radius: 8px; cursor: pointer; width: 100%;">
            🏠 ກຼັບຄືນໜ້າທຳອິດ
        </button>
    `;
}

function showResults() {
    document.getElementById('quiz-screen').style.display = 'none';
    document.getElementById('result-screen').style.display = 'block';
    
    document.getElementById('final-score').innerText = `ຜິດພາດ: ${wrongCount} ຂໍ້ (ຈາກ ${quizQuestions.length} ຂໍ້)`;
    const isPassed = wrongCount <= 10;
    document.getElementById('score-message').innerText = isPassed ? `🎉 ຍິນດີດ້ວຍ! ທ່ານຜ່ານການສອບເສັງ` : `❌ ທ່ານບໍ່ຜ່ານການສອບເສັງ`;

    let currentWrongSaved = JSON.parse(localStorage.getItem('lao_quiz_wrong_' + currentCategoryFile)) || [];
    let reviewButtonHtml = '';
    if (currentWrongSaved.length > 0) {
        reviewButtonHtml = `
            <button onclick="startApp('review_wrong')" style="padding: 12px; font-size: 0.95rem; font-weight: bold; background: #dc2626; color: white; border: none; border-radius: 8px; cursor: pointer; width: 100%; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
                🎯 ໄປແກ້ສະເພາະຂໍ້ທີ່ຜິດ (${currentWrongSaved.length} ຂໍ້)
            </button>
        `;
    }

    document.getElementById('result-action-buttons').innerHTML = `
        ${reviewButtonHtml}
        <button onclick="goHome()" style="padding: 10px; font-size: 0.85rem; font-weight: bold; background: #475569; color: white; border: none; border-radius: 8px; cursor: pointer; width: 100%;">
            🏠 ກຼັບຄືນໜ້າທຳອິດ
        </button>
    `;
}

function openCategory5() {
    const nameInput = document.getElementById('studentName');
    const ageInput = document.getElementById('studentAge');
    const phoneInput = document.getElementById('studentPhone');
    const homeSelect = document.getElementById('homeCategory');

    const name = nameInput ? nameInput.value.trim() : (localStorage.getItem('lao_quiz_student_name') || '');
    const age = ageInput ? ageInput.value.trim() : (localStorage.getItem('lao_quiz_student_age') || '');
    const phone = phoneInput ? phoneInput.value.trim() : (localStorage.getItem('lao_quiz_student_phone') || '');

    if (!name || !age || !phone) {
        alert('⚠️ ຖ້າກະລຸນາ ໃສ່ຊື່, ອາຍຸ ແລະ ເບີໂທລະສັບ ໃຫ້ຄົບຖ້ວນກ່ອນເລີ່ມຕົ້ນ!');
        if (nameInput) nameInput.focus();
        return;
    }

    let selectedCategory = homeSelect ? homeSelect.value : (localStorage.getItem('lao_quiz_selected_category') || 'ABC.txt');
    const isQuizPassed = (localStorage.getItem(`lao_quiz_quiz_passed_${selectedCategory}`) === 'true') || teacherTempUnlocked || (localStorage.getItem(`lao_quiz_teacher_secret_${selectedCategory}`) === 'true');
    const savedWrong = JSON.parse(localStorage.getItem('lao_quiz_wrong_' + selectedCategory)) || [];
    const isPermanentUnlocked = (localStorage.getItem(`lao_quiz_teacher_secret_${selectedCategory}`) === 'true') || teacherTempUnlocked;

    if (!isQuizPassed) {
        alert('⚠️ ຍັງບໍ່ສາມາດເຂົ້າໃຊ້ງານ ໝວດ 5 ได้!\nກະລຸນາເຮັດແບບທົດສອບ (ໝວດ 2) ให้เสร็จก่อนครับ.');
        return;
    }

    if (savedWrong.length > 0 && !isPermanentUnlocked) {
        alert(`⚠️ ຍັງບໍ່ສາມາດເຂົ້າໃຊ້ງານ ໝວດ 5 ได้!\nທ່ານມີຂໍ້ທີ່ຕອບຜິດຄ້າງຢູ່ໃນ ໝວດ 4 ຈຳນວນ ${savedWrong.length} ຂໍ້\nກະລຸນາเข้าไปแก้ข้อผิดในหมวด 4 ให้หมดก่อนครับ!`);
        return;
    }

    localStorage.setItem('lao_quiz_student_name', name);
    localStorage.setItem('lao_quiz_student_age', age);
    localStorage.setItem('lao_quiz_student_phone', phone);
    localStorage.setItem('lao_quiz_selected_category', selectedCategory);

    setTimeout(() => { window.location.href = 'category5.html'; }, 300);
}