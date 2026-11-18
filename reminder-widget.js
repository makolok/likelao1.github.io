// ⚙️ ລະບົບແຈ້ງເຕືອນແຊັດເຕືອນສອບ ແລະ ເດັ້ງໜ້າຈໍ (Chat & Push Reminder System)

(function () {
    // 1. สร้าง HTML โครงสร้างแชทลอยเด้งขึ้นมาแบบอัตโนมัติภายในเว็บ
    function injectChatHTML() {
        if (document.getElementById('chat-reminder-widget')) return;

        const widgetHTML = `
            <div id="chat-reminder-widget">
                <div class="chat-widget-header">
                    <div class="chat-widget-profile">
                        <img src="icon-192.png" alt="Logo" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'28\\' height=\\'28\\'><circle cx=\\'14\\' cy=\\'14\\' r=\\'14\\' fill=\\'%2338bdf8\\'/></svg>'">
                        <span>ຄູສອນ ບ້ານສາມັກຄີ 💬</span>
                    </div>
                    <button class="chat-widget-close" onclick="closeReminderChat()">✕</button>
                </div>
                <div class="chat-widget-body">
                    <div class="chat-bubble" id="chat-reminder-text">
                        ກຳລັງໂຫຼດຂໍ້ຄວາມ...
                    </div>
                    <div class="chat-time" id="chat-reminder-time">00:00</div>
                </div>
                <div class="chat-widget-footer">
                    <button class="chat-btn-action" onclick="goToStudyMode()">📖 ໄປທົບທວນບົດຮຽນ</button>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', widgetHTML);
    }

    // 2. คำนวณจำนวนวันที่เหลือก่อนถึงวันสอบ
    function getDaysUntilExam() {
        const examDateStr = localStorage.getItem('lao_quiz_exam_date');
        if (!examDateStr) return null;

        const examDate = new Date(examDateStr);
        const today = new Date();
        
        examDate.setHours(0,0,0,0);
        today.setHours(0,0,0,0);

        const diffTime = examDate.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // 🛡️ ฟังก์ชันส่งการแจ้งเตือนออกหน้าจอระบบ (เด้งเหมือนมีข้อความ Line เข้า)
    function showSystemNotification(title, bodyText) {
        if ("Notification" in window && Notification.permission === "granted") {
            try {
                const options = {
                    body: bodyText,
                    icon: 'icon-192.png',
                    badge: 'icon-192.png',
                    vibrate: [200, 100, 200]
                };
                new Notification(title, options);
            } catch (e) {
                console.log("Notification error:", e);
            }
        }
    }

    // 3. ตรวจสอบเงื่อนไขและความถี่ในการเด้งข้อความเตือนตามเวลาจริง
    function checkAndShowNotification() {
        const examDateStr = localStorage.getItem('lao_quiz_exam_date');
        if (!examDateStr) return; 

        const daysLeft = getDaysUntilExam();
        const studentName = localStorage.getItem('lao_quiz_student_name') || 'ນັກຮຽນ';
        
        let maxNotiPerDay = 2; 
        if (daysLeft <= 3) maxNotiPerDay = 4;
        else if (daysLeft <= 7) maxNotiPerDay = 3;

        const todayStr = new Date().toISOString().split('T')[0];
        const notiLog = JSON.parse(localStorage.getItem('lao_quiz_noti_log') || '{}');
        
        if (notiLog.date !== todayStr) {
            notiLog.date = todayStr;
            notiLog.count = 0;
        }

        if (notiLog.count >= maxNotiPerDay) return;

        let message = '';
        let titleMsg = '📢 ແຈ້ງເຕືອນຈາກໂຮງຮຽນສອນຂັບລົດ';
        
        if (daysLeft < 0) {
            message = `ສະບາຍດີ ${studentName}! ກາຍກຳໜົດສອບເສັງແລ້ວ ຢ່າລືມມາທົບທວນ 🚗`;
        } else if (daysLeft === 0) {
            titleMsg = '🚨 ມື້ນີ້ເປັນມື້ສອບເສັງແລ້ວ!';
            message = `ມື້ນີ້ເປັນມື້ສອບເສັງແລ້ວ! ທ່ານ ${studentName} ສູ້ໆເດີ ໃຫ້ສອບເສັງຜ່ານເລີຍ! ✌️🎯`;
        } else if (daysLeft === 1) {
            titleMsg = '⚠️ ມື້ອື່ນສອບເສັງແລ້ວ!';
            message = `ມື້ອື່ນສອບເສັງແລ້ວເດີ! ທ່ານ ${studentName} ເຫຼືອເວລາ 1 ວັນ ມາທົບທວນດ່ວນ! 📝`;
        } else if (daysLeft <= 3) {
            message = `⏰ ທ່ານ ${studentName} ເຫຼືອເວລາແຕ່ ${daysLeft} ວັນ ຈະຮອດມື້ສອບເສັງແລ້ວ! ມາທົບທວນໝວດ 4 ໃຫ້ໝົດເດີ 💪`;
        } else {
            message = `ສະບາຍດີ ${studentName} 👋 ເຫຼືອເວລາອີກ ${daysLeft} ວັນ ຈະຮອດມື້ສອບເສັງ ຢ່າລືມເຂ້າມາອ່ານໜັງສືເດີ 📖`;
        }

        // 1. เด้งกล่องแชทลอยในหน้าเว็บ
        const textEl = document.getElementById('chat-reminder-text');
        const timeEl = document.getElementById('chat-reminder-time');
        const widgetEl = document.getElementById('chat-reminder-widget');

        if (textEl && widgetEl) {
            textEl.innerHTML = message;
            const now = new Date();
            timeEl.innerText = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
            widgetEl.style.display = 'flex';

            // 2. เด้งออกหน้าจอระบบ ( Push Notification เหมือนข้อความ Line เด้ง )
            showSystemNotification(titleMsg, message);

            notiLog.count += 1;
            localStorage.setItem('lao_quiz_noti_log', JSON.stringify(notiLog));
        }
    }

    window.addEventListener('DOMContentLoaded', () => {
        injectChatHTML();
        setTimeout(checkAndShowNotification, 2000);
    });
})();

// ปิดกล่องแชท
function closeReminderChat() {
    const widgetEl = document.getElementById('chat-reminder-widget');
    if (widgetEl) widgetEl.style.display = 'none';
}

// 🎯 ปุ่มกดในกล่องแชท: ปิดกล่องแชทแล้วกลับมาหน้าหลัก (Home) ให้ผู้เรียนเลือกหมวดเอง
function goToStudyMode() {
    closeReminderChat();
    if (typeof goHome === 'function') {
        goHome();
    } else {
        window.location.href = 'index.html';
    }
}

// 🧪 ฟังก์ชันสำหรับปุ่มกดทดสอบการเด้งของแชท (เคลียร์โควตาก่อนเทสเพื่อให้เด้งชัวร์ 100%)
function testReminderChat() {
    localStorage.removeItem('lao_quiz_noti_log'); // ล้างโควต้าเก่าเพื่อให้เทสได้ทันที
    
    const studentName = localStorage.getItem('lao_quiz_student_name') || 'ນັກຮຽນ';
    const textEl = document.getElementById('chat-reminder-text');
    const timeEl = document.getElementById('chat-reminder-time');
    const widgetEl = document.getElementById('chat-reminder-widget');

    if (textEl && widgetEl) {
        textEl.innerHTML = `🧪 **[ທົດສອບການແຈ້ງເຕືອນ]**<br>ສະບາຍດີ ${studentName}! ລະບົບແຈ້ງເຕືອນໜ້າຈໍເຮັດວຽກປົກກະຕິແລ້ວ 🚗💨`;
        
        const now = new Date();
        timeEl.innerText = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        
        widgetEl.style.display = 'flex';

        // ทดสอบยิง Push แจ้งเตือนออกหน้าจอระบบด้วย
        if ("Notification" in window && Notification.permission === "granted") {
            new Notification("🧪 ທົດສອບການແຈ້ງເຕືອນ", {
                body: `ສະບາຍດີ ${studentName}! ລະບົບແຈ້ງເຕືອນໜ້າຈໍເຮັດວຽກປົກກະຕິແລ້ວ`,
                icon: 'icon-192.png'
            });
        }
    } else {
        alert('⚠️ ບໍ່ພົບກ່ອງແຊັດ ກະລຸນາເຊັກວ່າໂຫຼດໄຟລ໌ reminder-widget.js ຮຽບຮ້ອຍແລ້ວ');
    }
}