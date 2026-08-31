// ==================== ตั้งค่า URL ของ Backend (AI Server) ====================
// ถ้ารันบนเครื่องตัวเอง (localhost) จะเรียก backend ที่ localhost:6767 อัตโนมัติ
// ถ้าอัปขึ้น GitHub Pages (หรือโดเมนอื่น) จะเรียกไปที่ URL backend ที่ deploy ไว้ (เช่น Render)
//
// วิธีใช้งาน: หลัง deploy backend (server.js) ขึ้น Render/Railway แล้ว
// ให้แก้ค่าตัวแปร PRODUCTION_API_URL ด้านล่างเป็น URL จริงของคุณ
// เช่น "https://guidepls-backend.onrender.com"

const PRODUCTION_API_URL = "https://YOUR-BACKEND-URL.onrender.com"; // 👈 แก้ตรงนี้หลัง deploy backend

const API_BASE_URL = (() => {
    const host = window.location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1" || host === "";
    if (isLocal) {
        // รันผ่าน node server.js บนเครื่องตัวเอง ให้เรียก path เดิม (relative)
        return "";
    }
    // รันบน GitHub Pages หรือโดเมนอื่นที่ไม่มี backend ในตัว ให้ชี้ไป backend ที่ deploy แยก
    return PRODUCTION_API_URL;
})();
