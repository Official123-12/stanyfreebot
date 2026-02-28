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

// ✅ **DETECT ENVIRONMENT**
const IS_VERCEL = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
const SESSIONS_DIR = IS_VERCEL 
    ? '/tmp/sessions'  // Vercel inaruhusu kuandika hapa
    : path.join(__dirname, 'sessions'); // Local

console.log(fancy(`📁 Sessions directory: ${SESSIONS_DIR}`));

// Hakikisha directory ipo
if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    console.log(fancy(`✅ Created sessions directory: ${SESSIONS_DIR}`));
}

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
const bots = new Map(); // key: phoneNumber

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
        
        // Kila namba ina session yake kwenye folder tofauti (kwenye /tmp au sessions/)
        const sessionDir = path.join(SESSIONS_DIR, `insidious_${phoneNumber}`);
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
                
                let botName = conn.user?.name || "INSIDIOUS";
                let botNumber = "Unknown";
                let botId = conn.user?.id || "Unknown";
                
                if (conn.user?.id) {
                    botNumber = conn.user.id.split(':')[0] || "Unknown";
                }
                
                const botSecret = handler.getBotId ? handler.getBotId(phoneNumber) : 'Unknown';
                const pairedCount = handler.getPairedNumbers ? handler.getPairedNumbers(phoneNumber).length : 0;
                
                console.log(fancy(`🤖 Name: ${botName}`));
                console.log(fancy(`📞 Number: ${botNumber}`));
                console.log(fancy(`🆔 Bot ID: ${botSecret}`));
                console.log(fancy(`👥 Paired Owners: ${pairedCount}`));
                
                try {
                    if (handler && typeof handler.init === 'function') {
                        await handler.init(conn, phoneNumber);
                        console.log(fancy(`✅ Handler initialized for ${phoneNumber}`));
                    }
                } catch (e) {
                    console.error(fancy(`❌ Handler init error for ${phoneNumber}:`), e.message);
                }
                
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

👑 *Developer:* STANYTZ
💾 *Version:* 2.2.2 | Vercel-Ready`;
                                
                                await conn.sendMessage(ownerJid, { 
                                    image: { 
                                        url: config.botImage || "https://files.catbox.moe/f3c07u.jpg"
                                    },
                                    caption: welcomeMsg
                                });
                            }
                        }
                    } catch (e) {}
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
                        getOrCreateBot(phoneNumber);
                    }, 5000);
                } else {
                    console.log(fancy(`🚫 Logged out for ${phoneNumber}.`));
                    bots.delete(phoneNumber);
                }
            }
        });

        conn.ev.on('creds.update', saveCreds);
        conn.ev.on('messages.upsert', async (m) => {
            try {
                if (handler && typeof handler === 'function') {
                    await handler(conn, m, phoneNumber);
                }
            } catch (error) {
                console.error(`Message handler error for ${phoneNumber}:`, error.message);
            }
        });

        conn.ev.on('group-participants.update', async (update) => {
            try {
                if (handler && handler.handleGroupUpdate) {
                    await handler.handleGroupUpdate(conn, update, phoneNumber);
                }
            } catch (error) {
                console.error(`Group update error for ${phoneNumber}:`, error.message);
            }
        });

        conn.ev.on('call', async (call) => {
            try {
                if (handler && handler.handleCall) {
                    await handler.handleCall(conn, call, phoneNumber);
                }
            } catch (error) {
                console.error(`Call handler error for ${phoneNumber}:`, error.message);
            }
        });

        console.log(fancy(`🚀 Bot for ${phoneNumber} ready`));
        return botInstance;

    } catch (error) {
        console.error(`Start error for ${phoneNumber}:`, error.message);
        throw error;
    }
}

async function getOrCreateBot(phoneNumber) {
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
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000))
        ]);
        
        res.json({ 
            success: true, 
            code: code,
            message: `8-digit pairing code: ${code}`
        });
        
    } catch (err) {
        console.error("Pairing error:", err.message);
        res.json({ success: false, error: "Failed: " + err.message });
    }
});

app.get('/unpair', async (req, res) => {
    try {
        let num = req.query.num;
        if (!num) {
            return res.json({ success: false, error: "Provide number!" });
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
            return res.json({ success: false, error: "Unpair function not available" });
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
        serverUptime: `${hours}h ${minutes}m ${seconds}s`,
        environment: IS_VERCEL ? 'vercel' : 'local'
    });
});

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
    
    res.json({
        success: true,
        phoneNumber: phoneNumber,
        botName: bot.conn.user?.name || "INSIDIOUS",
        botNumber: bot.conn.user?.id?.split(':')[0] || "Unknown",
        connected: bot.isConnected,
        uptime: Date.now() - bot.startTime
    });
});

app.get('/bots', (req, res) => {
    const botList = [];
    for (let [phoneNumber, bot] of bots.entries()) {
        botList.push({
            phoneNumber,
            connected: bot.isConnected,
            uptime: Date.now() - bot.startTime
        });
    }
    res.json({ success: true, bots: botList });
});

// ✅ **START SERVER**
app.listen(PORT, () => {
    console.log(fancy(`🌐 Web Interface: http://localhost:${PORT}`));
    console.log(fancy(`🔗 Pair: http://localhost:${PORT}/pair?num=255XXXXXXXXX`));
    console.log(fancy(`📁 Sessions: ${SESSIONS_DIR}`));
    console.log(fancy(`🌎 Environment: ${IS_VERCEL ? 'Vercel' : 'Local'}`));
    console.log(fancy("👑 Developer: STANYTZ"));
    console.log(fancy("📅 Version: 2.2.2 | Vercel-Ready"));
});

module.exports = app;
