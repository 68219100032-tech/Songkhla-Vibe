# Songkhla Vibe — Guide Thitipong 🌊

เว็บไซต์แนะนำเที่ยวสงขลา พร้อม AI แชทบอท "ไกด์ฐิติพงศ์" (ขับเคลื่อนด้วย Gemini API)

## โครงสร้างโปรเจกต์

- **Frontend**: `index.html`, `about.html`, `contact.html`, `attractions.html`, `smart-travel.html`, `images/`
- **Backend**: `server.js` (Node.js + Express) — เป็นตัวเชื่อมไปหา Gemini API
- **config.js**: ตั้งค่า URL ของ backend ให้ frontend เรียกใช้ถูกที่ (สลับอัตโนมัติระหว่าง local กับ production)

⚠️ **สำคัญ**: โปรเจกต์นี้มี 2 ส่วนที่ต้อง deploy แยกกัน เพราะ GitHub Pages เสิร์ฟได้แค่ไฟล์ static (HTML/CSS/JS) รัน Node.js/Express ไม่ได้

---

## 1. รันบนเครื่องตัวเอง (Local)

```bash
npm install
cp .env.example .env
# แก้ .env ใส่ GEMINI_API_KEY ของคุณ
npm start
```

เข้าเว็บที่ `http://localhost:6767` (ต้องเข้าผ่าน URL นี้เท่านั้น ห้ามดับเบิลคลิกเปิดไฟล์ HTML ตรงๆ)

---

## 2. Deploy ขึ้นใช้งานจริง (Frontend บน GitHub Pages + Backend บน Render)

### ขั้นที่ 1: Deploy Backend ที่ Render

1. Push โปรเจกต์นี้ทั้งหมดขึ้น GitHub repo ของคุณ (ไฟล์ `.env` จะไม่ถูกอัปเพราะอยู่ใน `.gitignore` แล้ว)
2. ไปที่ [render.com](https://render.com) → New → Web Service → เชื่อมต่อ repo นี้
3. Render จะอ่านค่าจาก `render.yaml` ให้อัตโนมัติ (Build: `npm install`, Start: `node server.js`)
4. ไปที่หน้า Environment ของ service แล้วใส่ค่า `GEMINI_API_KEY` (เอาจาก [aistudio.google.com/apikey](https://aistudio.google.com/apikey))
5. Deploy เสร็จแล้วจะได้ URL ประมาณ `https://guidepls-backend.onrender.com` — **คัดลอก URL นี้ไว้**

> หมายเหตุ: Render free tier จะ sleep เมื่อไม่มีคนใช้งาน ทำให้คำขอแรกช้าประมาณ 30-60 วินาที (cold start) เป็นเรื่องปกติของแผนฟรี

### ขั้นที่ 2: ตั้งค่า Frontend ให้ชี้ไป Backend

1. เปิดไฟล์ `config.js`
2. แก้บรรทัด:
   ```js
   const PRODUCTION_API_URL = "https://YOUR-BACKEND-URL.onrender.com";
   ```
   เป็น URL จริงจากขั้นที่ 1
3. Commit และ push ขึ้น GitHub อีกครั้ง

### ขั้นที่ 3: เปิด GitHub Pages

1. ไปที่ repo → Settings → Pages
2. เลือก Branch ที่ต้องการ (เช่น `main`) และโฟลเดอร์ `/ (root)`
3. รอสักครู่ จะได้ URL เว็บประมาณ `https://your-username.github.io/repo-name/`

เท่านี้ AI แชทบอทก็ใช้งานได้จากเว็บที่ deploy บน GitHub Pages แล้วครับ 🎉

---

## ข้อควรระวังด้านความปลอดภัย

- **ห้ามใส่ API key ลงในโค้ดฝั่ง frontend (HTML/JS ที่รันในเบราว์เซอร์) เด็ดขาด** เพราะใครก็เปิดดูได้ผ่าน "View Page Source"
- ไฟล์ `.env` ต้องไม่ถูก commit ขึ้น GitHub เด็ดขาด (เช็คว่ามีอยู่ใน `.gitignore` แล้ว)
- ถ้า API key เคยหลุดหรือถูกแชร์ออกไปแล้ว ให้สร้างคีย์ใหม่ทันทีที่ [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

## หากเจอ Error 429 (โควต้าเต็ม)

โค้ด `server.js` มีระบบ retry และสลับโมเดลสำรองอัตโนมัติอยู่แล้ว แต่ถ้าโควต้าฟรีเต็มทั้งหมด ให้:
- รอให้โควต้ารีเซ็ต (เที่ยงคืนเวลา Pacific Time)
- หรือเปิด Billing ที่ Google AI Studio เพื่อขยับเป็น Tier ที่มีโควต้าสูงขึ้น
