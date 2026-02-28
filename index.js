const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const path = require("path");
const fs = require('fs');

// ==================== HANDLER ====================
const handler = require('./handler');

// ✅ **FANCY FUNCTION**
function fancy(text) {
    if (!text || typeof text !== 'string') return text;
    try {
        const fancyMap = {
            a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ',
            j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ',
            s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
            A: 'ᴀ', B: 'ʙ', C: 'ᴄ', D: 'ᴅ', E: 'ᴇ', F: 'ꜰ', G: 'ɢ', H: 'ʜ', I: 'ɪ',
            J: 'ᴊ', K: 'ᴋ', L: 'ʟ', M: 'ᴍ', N: 'ɴ', O: 'ᴏ', P: 'ᴘ', Q: 'ǫ', R: 'ʀ',
            S: 'ꜱ', T: 'ᴛ', U: 'ᴜ', V: 'ᴠ', W: 'ᴡ', X: 'x', Y: 'ʏ', Z: 'ᴢ'
        };
        let result = '';
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            result += fancyMap[char] || char;
        }
        return result;
    } catch (e) {
        return text;
    }
}

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ **MONGODB CONNECTION (OPTIONAL)**
console.log(fancy("🔗 Connecting to MongoDB..."));
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious?retryWrites=true&w=majority";

mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10
})
.then(() => {
    console.log(fancy("✅ MongoDB Connected"));
})
.catch((err) => {
    console.log(fancy("❌ MongoDB Connection FAILED"));
    console.log(fancy("💡 Error: " + err.message));
});

// ✅ **MIDDLEWARE**
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ✅ **CREATE PUBLIC FOLDER IF NOT EXISTS**
if (!fs.existsSync(path.join(__dirname, 'public'))) {
    fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
}

// ✅ **SIMPLE ROUTES**
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ==================== MULTI-USER BOT MANAGEMENT ====================
// Sasa tunatumia namba ya simu kama kitambulisho
const bots = new Map(); // key: phoneNumber (clean), value: bot instance

// ✅ **LOAD CONFIG**
let config = {};
try {
    config = require('./config');
    console.log(fancy("📋 Config loaded"));
} catch (error) {
    console.log(fancy("❌ Config file error, using defaults"));
    config = {
        prefix: '.',
        ownerNumber: ['255000000000'],
        botName: 'INSIDIOUS',
        workMode: 'public',
        botImage: 'https://files.catbox.moe/f3c07u.jpg'
    };
}

// ✅ **FUNCTION KUUZA UNDA BOT KWA AJILI YA NAMBA**
async function createBotInstance(phoneNumber) {
    try {
        console.log(fancy(`🚀 Starting bot for number: ${phoneNumber}`));
        
        // Kila namba ina session yake kwenye folder tofauti
        const sessionDir = path.join(__dirname, 'sessions', `insidious_${phoneNumber}`);
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }

        // ✅ **AUTHENTICATION**
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const { version } = await fetchLatestBaileysVersion();

        // ✅ **CREATE CONNECTION**
        const conn = makeWASocket({
            version,
            auth: { 
                creds: state.creds, 
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })) 
            },
            logger: pino({ level: "silent" }),
            browser: Browsers.macOS("Safari"),
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            markOnlineOnConnect: true
        });

        const botInstance = {
            conn,
            phoneNumber,
            isConnected: false,
            startTime: Date.now(),
            saveCreds
        };

        // ✅ **CONNECTION EVENT HANDLER**
        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                console.log(fancy(`👹 INSIDIOUS: THE LAST KEY ACTIVATED for ${phoneNumber}`));
                console.log(fancy(`✅ Bot for ${phoneNumber} is now online`));
                
                botInstance.isConnected = true;
                
                // Get bot info
                let botName = conn.user?.name || "INSIDIOUS";
                let botNumber = "Unknown";
                let botId = conn.user?.id || "Unknown";
                
                if (conn.user?.id) {
                    botNumber = conn.user.id.split(':')[0] || "Unknown";
                }
                
                // 🔥 GET BOT ID AND PAIRED COUNT FROM HANDLER (tunapitia phoneNumber)
                const botSecret = handler.getBotId ? handler.getBotId(phoneNumber) : 'Unknown';
                const pairedCount = handler.getPairedNumbers ? handler.getPairedNumbers(phoneNumber).length : 0;
                
                console.log(fancy(`🤖 Name: ${botName}`));
                console.log(fancy(`📞 Number: ${botNumber}`));
                console.log(fancy(`🆔 Bot ID: ${botSecret}`));
                console.log(fancy(`👥 Paired Owners: ${pairedCount}`));
                
                // ✅ **INITIALIZE HANDLER**
                try {
                    if (handler && typeof handler.init === 'function') {
                        await handler.init(conn, phoneNumber);
                        console.log(fancy(`✅ Handler initialized for ${phoneNumber}`));
                    }
                } catch (e) {
                    console.error(fancy(`❌ Handler init error for ${phoneNumber}:`), e.message);
                }
                
                // ✅ **SEND WELCOME MESSAGE TO OWNER (kwa bot hii)**
                setTimeout(async () => {
                    try {
                        if (config.ownerNumber && config.ownerNumber.length > 0) {
                            const ownerNum = config.ownerNumber[0].replace(/[^0-9]/g, '');
                            if (ownerNum.length >= 10) {
                                const ownerJid = ownerNum + '@s.whatsapp.net';
                                
                                const welcomeMsg = `
╭─── • 🥀 • ───╮
   INSIDIOUS: THE LAST KEY
╰─── • 🥀 • ───╯

✅ *Bot Connected Successfully!*
🤖 *Name:* ${botName}
📞 *Number:* ${botNumber}
🆔 *Bot ID:* ${botSecret}
👥 *Paired Owners:* ${pairedCount}
📱 *Phone Number:* ${phoneNumber}

⚡ *Status:* ONLINE & ACTIVE

📊 *ALL FEATURES ACTIVE:*
🛡️ Anti View Once: ✅
🗑️ Anti Delete: ✅
🤖 AI Chatbot: ✅
⚡ Auto Typing: ✅
📼 Auto Recording: ✅
👀 Auto Read: ✅
❤️ Auto React: ✅
🎉 Welcome/Goodbye: ✅

🔧 *Commands:* All working
📁 *Database:* Connected
🚀 *Performance:* Optimal

👑 *Developer:* STANYTZ
💾 *Version:* 2.2.1 | Phone-as-ID`;
                                
                                await conn.sendMessage(ownerJid, { 
                                    image: { 
                                        url: config.botImage || "https://files.catbox.moe/f3c07u.jpg"
                                    },
                                    caption: welcomeMsg,
                                    contextInfo: { 
                                        isForwarded: true,
                                        forwardingScore: 999,
                                        forwardedNewsletterMessageInfo: { 
                                            newsletterJid: config.newsletterJid || "120363404317544295@newsletter",
                                            newsletterName: config.botName || "INSIDIOUS BOT"
                                        }
                                    }
                                });
                                console.log(fancy(`✅ Welcome message sent to owner for ${phoneNumber}`));
                            }
                        }
                    } catch (e) {
                        console.log(fancy(`⚠️ Could not send welcome message for ${phoneNumber}:`), e.message);
                    }
                }, 3000);
            }
            
            if (connection === 'close') {
                console.log(fancy(`🔌 Connection closed for number ${phoneNumber}`));
                botInstance.isConnected = false;
                
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    console.log(fancy(`🔄 Restarting bot for ${phoneNumber} in 5 seconds...`));
                    setTimeout(() => {
                        bots.delete(phoneNumber);
                        getOrCreateBot(phoneNumber);  // itaianzisha upya
                    }, 5000);
                } else {
                    console.log(fancy(`🚫 Logged out for ${phoneNumber}. Please scan QR again.`));
                    bots.delete(phoneNumber);
                }
            }
        });

        // ✅ **CREDENTIALS UPDATE**
        conn.ev.on('creds.update', saveCreds);

        // ✅ **MESSAGE HANDLER**
        conn.ev.on('messages.upsert', async (m) => {
            try {
                if (handler && typeof handler === 'function') {
                    await handler(conn, m, phoneNumber);
                }
            } catch (error) {
                console.error(`Message handler error for ${phoneNumber}:`, error.message);
            }
        });

        // ✅ **GROUP UPDATE HANDLER**
        conn.ev.on('group-participants.update', async (update) => {
            try {
                if (handler && handler.handleGroupUpdate) {
                    await handler.handleGroupUpdate(conn, update, phoneNumber);
                }
            } catch (error) {
                console.error(`Group update error for ${phoneNumber}:`, error.message);
            }
        });

        // ✅ **CALL HANDLER**
        conn.ev.on('call', async (call) => {
            try {
                if (handler && handler.handleCall) {
                    await handler.handleCall(conn, call, phoneNumber);
                }
            } catch (error) {
                console.error(`Call handler error for ${phoneNumber}:`, error.message);
            }
        });

        console.log(fancy(`🚀 Bot for ${phoneNumber} ready for pairing`));
        return botInstance;

    } catch (error) {
        console.error(`Start error for ${phoneNumber}:`, error.message);
        throw error;
    }
}

// ✅ **FUNCTION YA KUPATA AU KUUUNDA BOT KWA NAMBA**
async function getOrCreateBot(phoneNumber) {
    // Safisha namba (tayari imesafishwa)
    if (!phoneNumber || typeof phoneNumber !== 'string' || !/^\d+$/.test(phoneNumber)) {
        throw new Error('Invalid phone number. Use only digits.');
    }

    if (bots.has(phoneNumber)) {
        const bot = bots.get(phoneNumber);
        if (bot.conn?.user) {
            return bot;
        } else {
            bots.delete(phoneNumber);
        }
    }

    const newBot = await createBotInstance(phoneNumber);
    bots.set(phoneNumber, newBot);
    return newBot;
}

// ==================== HTTP ENDPOINTS ====================

// ✅ **PAIRING ENDPOINT – sasa inatumia namba tu**
app.get('/pair', async (req, res) => {
    try {
        let num = req.query.num;
        
        if (!num) {
            return res.json({ success: false, error: "Provide number! Example: /pair?num=255618558502" });
        }
        
        const cleanNum = num.replace(/[^0-9]/g, '');
        if (cleanNum.length < 10) {
            return res.json({ success: false, error: "Invalid number. Must be at least 10 digits." });
        }
        
        // Tumia namba kama kitambulisho
        const phoneNumber = cleanNum;
        
        let bot;
        try {
            bot = await getOrCreateBot(phoneNumber);
        } catch (e) {
            return res.json({ success: false, error: e.message });
        }
        
        console.log(fancy(`🔑 Generating 8-digit code for ${phoneNumber}`));
        
        const code = await Promise.race([
            bot.conn.requestPairingCode(phoneNumber),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout - no response from WhatsApp')), 30000))
        ]);
        
        res.json({ 
            success: true, 
            code: code,
            message: `8-digit pairing code: ${code}`
        });
        
    } catch (err) {
        console.error("Pairing error:", err.message);
        if (err.message.includes("already paired")) {
            res.json({ success: true, message: "Number already paired" });
        } else {
            res.json({ success: false, error: "Failed: " + err.message });
        }
    }
});

// ✅ **UNPAIR ENDPOINT**
app.get('/unpair', async (req, res) => {
    try {
        let num = req.query.num;
        if (!num) {
            return res.json({ success: false, error: "Provide number! Example: /unpair?num=255618558502" });
        }
        
        const cleanNum = num.replace(/[^0-9]/g, '');
        if (cleanNum.length < 10) {
            return res.json({ success: false, error: "Invalid number" });
        }
        
        const phoneNumber = cleanNum;
        const bot = bots.get(phoneNumber);
        if (!bot) {
            return res.json({ success: false, error: "No active bot found for this number" });
        }
        
        let result = false;
        if (handler && handler.unpairNumber) {
            result = await handler.unpairNumber(cleanNum, phoneNumber);
        } else {
            return res.json({ success: false, error: "Unpair function not available in handler" });
        }
        
        res.json({ 
            success: result, 
            message: result ? `Number ${cleanNum} unpaired successfully` : `Failed to unpair ${cleanNum}`
        });
        
    } catch (err) {
        console.error("Unpair error:", err.message);
        res.json({ success: false, error: "Failed: " + err.message });
    }
});

// ✅ **HEALTH CHECK (global)**
app.get('/health', (req, res) => {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    const botsStatus = {};
    for (let [phoneNumber, bot] of bots.entries()) {
        botsStatus[phoneNumber] = {
            connected: bot.isConnected,
            uptime: Date.now() - bot.startTime
        };
    }
    
    res.json({
        status: 'healthy',
        totalBots: bots.size,
        bots: botsStatus,
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        serverUptime: `${hours}h ${minutes}m ${seconds}s`
    });
});

// ✅ **BOT INFO ENDPOINT (kwa namba maalum)**
app.get('/botinfo', (req, res) => {
    const num = req.query.num;
    if (!num) {
        return res.json({ success: false, error: "Provide number (num) parameter" });
    }
    
    const cleanNum = num.replace(/[^0-9]/g, '');
    const phoneNumber = cleanNum;
    const bot = bots.get(phoneNumber);
    
    if (!bot || !bot.conn || !bot.conn.user) {
        return res.json({ 
            success: false,
            error: "Bot not connected for this number",
            connected: bot ? bot.isConnected : false
        });
    }
    
    const botSecret = handler.getBotId ? handler.getBotId(phoneNumber) : 'Unknown';
    const pairedCount = handler.getPairedNumbers ? handler.getPairedNumbers(phoneNumber).length : 0;
    
    res.json({
        success: true,
        phoneNumber: phoneNumber,
        botName: bot.conn.user?.name || "INSIDIOUS",
        botNumber: bot.conn.user?.id?.split(':')[0] || "Unknown",
        botJid: bot.conn.user?.id || "Unknown",
        botSecret: botSecret,
        pairedOwners: pairedCount,
        connected: bot.isConnected,
        uptime: Date.now() - bot.startTime
    });
});

// ✅ **ENDPOINT YA KUORODHESHA BOTI ZOTE**
app.get('/bots', (req, res) => {
    const botList = [];
    for (let [phoneNumber, bot] of bots.entries()) {
        botList.push({
            phoneNumber,
            connected: bot.isConnected,
            uptime: Date.now() - bot.startTime,
            number: bot.conn?.user?.id?.split(':')[0] || null
        });
    }
    res.json({ success: true, bots: botList });
});

// ✅ **START SERVER**
app.listen(PORT, () => {
    console.log(fancy(`🌐 Web Interface: http://localhost:${PORT}`));
    console.log(fancy(`🔗 8-digit Pairing: http://localhost:${PORT}/pair?num=255XXXXXXXXX`));
    console.log(fancy(`🗑️  Unpair: http://localhost:${PORT}/unpair?num=255XXXXXXXXX`));
    console.log(fancy(`🤖 Bot Info: http://localhost:${PORT}/botinfo?num=255XXXXXXXXX`));
    console.log(fancy(`❤️ Health: http://localhost:${PORT}/health`));
    console.log(fancy(`📋 List Bots: http://localhost:${PORT}/bots`));
    console.log(fancy("👑 Developer: STANYTZ"));
    console.log(fancy("📅 Version: 2.2.1 | Phone-as-ID"));
    console.log(fancy("🙏 Special Thanks: REDTECH"));
});

module.exports = app;
