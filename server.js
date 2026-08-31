import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { GoogleGenAI } from '@google/genai';
import cors from 'cors';
import MarkdownIt from 'markdown-it';

const app = express();
const md = new MarkdownIt({ html: true });
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Middleware (ต้องวางไว้ก่อนการกำหนด Routes)
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, './'))); // เสิร์ฟไฟล์ในโฟลเดอร์ปัจจุบัน เช่น index.html, CSS, JS

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

console.log("🔑 ตรวจสอบ API Key ปัจจุบัน:", process.env.GEMINI_API_KEY ? "พบคีย์แล้ว (พร้อมใช้งาน)" : "❌ ไม่พบคีย์ (ค่าว่างเปล่า)");

const apiKeyString = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKeyString });

// รายชื่อโมเดลที่จะลองเรียกตามลำดับ ถ้าตัวแรกโควต้าเต็ม (429) จะลองตัวถัดไปอัตโนมัติ
const MODEL_FALLBACK_LIST = ['gemini-3.6-flash', 'gemini-3.5-flash-lite'];

const SYSTEM_INSTRUCTION = `
# ROLE: You are 'Guide Thitipong' (ไกด์ฐิติพงศ์), the #1 local expert for Songkhla, Thailand. 
# PERSONALITY: Friendly, minimalist, polite, and concise. Your vibe is "chill local friend who knows everything."

# [CRITICAL RULE: LANGUAGE DETECTION]
- ALWAYS detect the user's language and respond in that language 100%. 
- If asked in English, reply in English. If Malay, reply in Malay. If Chinese, reply in Chinese. 
- DO NOT default to Thai unless the user speaks Thai first.

# CAPABILITIES & TOOLS:
1. **Google Search Mandatory:** Use 'googleSearch' for EVERY query regarding shops, hotels, attractions, or car rentals to ensure information is fresh and the place is currently open.
2. **Maps Integration:** Every time you mention a location, provide a summary and a Google Maps link in THIS EXACT HTML format: 
   <a href="https://www.google.com/maps/search/?api=1&query={{LOCATION_NAME}}" target="_blank" class="map-link">📍 เปิด Google Maps: [ชื่อสถานที่]</a>
3. **Uncertainty:** If you are unsure, say: "ขออภัยครับ ผมไม่แน่ใจเรื่องนี้ แต่ผมจะหาข้อมูลให้คุณนะครับ" (or equivalent) and use Google Search immediately.

# SONGKHLA EXPERTISE:
- Travel Strategy: 4 main zones: 1) Songkhla Town, 2) Koh Yo, 3) Hat Yai, 4) Nature/Waterfalls/Caves.
- 1-Day Trip: Start at Samila Beach -> Tang Kuan Hill -> Old Town -> National Museum.

# SPECIAL SCENARIO: CONFLICT HANDLING
- If the user insults/curses at you: Respond with a brief, humorous "mock-angry" tone (e.g., "แล้วมึงเป็นอะไรมากป่าว"), then pivot to a playful apology: "ขอโทษครับ ผมแค่พยายามช่วยคุณนะครับไอลาบ🤣🤣"

# RESPONSE STYLE:
- Minimalist, scannable, use bullet points, avoid long paragraphs.
`;

// หน่วงเวลาแบบ Promise (ใช้ตอน retry)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// เรียก Gemini พร้อม retry (exponential backoff) เมื่อเจอ 429
// และสลับโมเดลอัตโนมัติถ้าโมเดลปัจจุบันโควต้าเต็ม
async function generateWithRetry(userMessage, { maxRetriesPerModel = 2 } = {}) {
    let lastError = null;

    for (const model of MODEL_FALLBACK_LIST) {
        for (let attempt = 0; attempt <= maxRetriesPerModel; attempt++) {
            try {
                const response = await ai.models.generateContent({
                    model,
                    contents: userMessage,
                    config: {
                        systemInstruction: SYSTEM_INSTRUCTION,
                        tools: [{ googleSearch: {} }]
                    }
                });
                if (model !== MODEL_FALLBACK_LIST[0]) {
                    console.log(`ℹ️ ใช้โมเดลสำรอง "${model}" แทน (โมเดลหลักติดโควต้า/ใช้ไม่ได้)`);
                }
                return response;
            } catch (error) {
                lastError = error;
                const status = error?.status;

                if (status === 429) {
                    if (attempt < maxRetriesPerModel) {
                        const waitMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s...
                        console.warn(`⏳ โควต้าโมเดล "${model}" ชนขีดจำกัด (429) รอ ${waitMs / 1000}s แล้วลองใหม่...`);
                        await sleep(waitMs);
                        continue;
                    }
                    console.warn(`🚫 โมเดล "${model}" ยังติดโควต้าอยู่ ลองสลับไปโมเดลถัดไป...`);
                    break; // ไปโมเดลถัดไปใน MODEL_FALLBACK_LIST
                }

                if (status === 404) {
                    console.warn(`⚠️ ไม่พบโมเดล "${model}" (อาจถูกยกเลิกใช้งานแล้ว) ลองสลับไปโมเดลถัดไป...`);
                    break; // ไปโมเดลถัดไปใน MODEL_FALLBACK_LIST
                }

                // error ประเภทอื่น (400, 500, network) ไม่ต้อง retry ต่อ ให้โยนออกไปเลย
                throw error;
            }
        }
    }

    // ลองครบทุกโมเดลแล้วยังไม่สำเร็จ
    throw lastError;
}

app.post('/api/chat', async (req, res) => {
    try {
        // รองรับทั้งข้อความใน req.body.message หรือ req.body.prompt
        const userMessage = req.body.message || req.body.prompt || '';

        if (!userMessage) {
            return res.status(400).json({ error: 'กรุณาส่งข้อความมาด้วยครับ' });
        }

        const response = await generateWithRetry(userMessage);

        // ดึงข้อความตอบกลับ พร้อมป้องกันค่า null/undefined
        const rawText = response.text || 'ขออภัยครับ ไม่สามารถสร้างคำตอบได้ในขณะนี้';
        const htmlReply = md.render(rawText);

        // ส่ง JSON ครอบคลุมทุกชื่อ Key ที่หน้าบ้านอาจจะเรียกใช้ (reply, response, text, message)
        res.json({
            reply: htmlReply,
            response: htmlReply,
            text: htmlReply,
            message: htmlReply
        });
    } catch (error) {
        console.error("เกิดข้อผิดพลาดภายในบอร์ด:", error);

        const status = error?.status;
        let errorMessage = 'AI เกิดอาการมึนงงชั่วคราว ลองใหม่อีกครั้งนะครับ';

        if (status === 429) {
            errorMessage = 'โควต้าฟรีของ Gemini API (ทุกโมเดลที่ลองแล้ว) เต็มครับ 🙏 รอให้โควต้ารีเซ็ต (เที่ยงคืนเวลา Pacific Time) หรือเปิด Billing ที่ Google AI Studio เพื่อใช้ได้ต่อเนื่องนะครับ';
        } else if (status === 400) {
            errorMessage = 'ข้อความที่ส่งมามีปัญหาบางอย่างครับ ลองพิมพ์ใหม่อีกครั้งนะครับ';
        } else if (!process.env.GEMINI_API_KEY) {
            errorMessage = 'ยังไม่ได้ตั้งค่า API Key ในไฟล์ .env ครับ';
        }

        res.status(status && Number.isInteger(status) ? status : 500).json({
            error: errorMessage,
            reply: errorMessage,
            text: errorMessage,
            message: errorMessage
        });
    }
});

const PORT = process.env.PORT || 6767;
app.listen(PORT, () => console.log(`🚀 เซิร์ฟเวอร์ไกด์สงขลาตัวเต็ม พร้อมรันแล้วบนพอร์ต ${PORT}!`));
