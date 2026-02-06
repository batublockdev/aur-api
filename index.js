import {
    Account,
    Asset,
    Operation,
    TransactionBuilder,
    Networks,
    Horizon,
} from "stellar-sdk";
import express from "express";
import 'dotenv/config'
import conn from './db.js';
import { Telegraf, Markup, session } from 'telegraf'
import { message } from 'telegraf/filters'
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
ffmpeg.setFfmpegPath(ffmpegPath);

import axios from 'axios';
import fs from 'fs';
const server = new Horizon.Server(
    "https://horizon-testnet.stellar.org",
);
const app = express();
app.use(express.json());
const PORT = 3000;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
let sessions = {};
const greetedUsers = new Set();
const lastAction = {}; // track last state per user

const GREETINGS = [
    "hi",
    "hello",
    "hey",
    "hola",
    "buenas",
    "buenos días",
    "buenas tardes",
    "buenas noches"
];
const MENUS = {
    ONBOARDING: {
        text:
            `👋 Hola, bienvenido a *AUR Cartera*

Aquí puedes:
💰 Guardar dinero  
📤 Enviar pagos  
👥 Ahorrar en grupo (natilleras)

Para cuidar tu dinero, primero necesitamos activar tu cuenta.`,
        buttons: [
            { id: "ABOUT_CREATE_ACCOUNT", title: "🆕 Crear mi cuenta" },
            { id: "ONBOARD_LOGIN", title: "🔐 Ya tengo cuenta" },
            { id: "ONBOARD_ABOUT", title: "❓ Qué es AUR" },
        ],
    },
};
MENUS.ABOUT = {
    text:
        `💡 *¿Qué es AUR?*

AUR es como una billetera digital en tu celular.

• No necesitas saber de crypto  
• No necesitas banco  
• Tu dinero es solo tuyo  

Para usarla, necesitas una app pequeña que cuida tu dinero 🔒`,
    buttons: [
        { id: "ABOUT_CREATE_ACCOUNT", title: "🆕 Crear mi cuenta" },
        { id: "ABOUT_BACK", title: "⬅️ Volver" },
    ],
};
MENUS.CREATE_ACCOUNT = {
    text:
        `👍 Vamos paso a paso

Para crear tu cuenta necesitas instalar la *App AUR*.

Esta app guarda tu llave secreta, que es como la llave de tu casa 🏠🔑

⚠️ Nadie más puede verla, ni AUR.

📲 Abre la App AUR aquí:
https://aur.app.link/open`,
    buttons: [

        {
            id: "CREATE_BACK",
            title: "⬅️ Volver",
        },
    ],
};
MENUS.MAIN = {
    text: "\n\n¿Qué quieres hacer hoy?",
    buttons: [
        { id: "MAIN_MONEY", title: "💰 Mi dinero" },
        { id: "MAIN_GROUPS", title: "👥 Mis grupos" },
        { id: "MAIN_HELP", title: "ℹ️ Ayuda" },
    ],
};
MENUS.HELP = {
    text:
        `ℹ️ *Ayuda AUR*

¿Cómo te podemos ayudar?`,
    buttons: [
        { id: "HELP_CONTACT", title: "💬 Escribir a AUR" },
        { id: "HELP_BACK", title: "⬅️ Volver" },
    ],
};

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;

app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === "my_toke_verify") {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});
async function sendMenu({ to, phoneNumberId, text, buttons }) {
    await fetch(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to,
                type: "interactive",
                interactive: {
                    type: "button",
                    body: { text },
                    action: {
                        buttons: buttons.map(b => {
                            return {
                                type: "reply",
                                reply: {
                                    id: b.id,
                                    title: b.title,
                                },
                            };
                        }),
                    },
                },
            }),
        }
    );
}

async function showMenu(menuKey, to, phoneNumberId) {
    const menu = MENUS[menuKey];
    if (!menu) throw new Error(`Menu ${menuKey} not found`);

    await sendMenu({
        to,
        phoneNumberId,
        text: menu.text,
        buttons: menu.buttons,
    });
}
async function sendOpenAppLink(to, phoneNumberId) {
    await fetch(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to,
                type: "interactive",
                interactive: {
                    type: "button",
                    body: {
                        text: "📲 Abre la app para continuar",
                    },
                    action: {
                        buttons: [
                            {
                                type: "url",
                                title: "📲 Abrir App AUR",
                                url: "https://aur.app.link/open",
                            },
                        ],
                    },
                },
            }),
        }
    );
}
async function sendBackButton(to, phoneNumberId) {
    await sendMenu({
        to,
        phoneNumberId,
        text: "⬅️ Si quieres volver:",
        buttons: [
            { id: "CREATE_BACK", title: "Volver al menú" },
        ],
    });
}
async function handleInteractive({ from, interactive, phoneNumberId, name }) {
    console.log("🟢 Interactive received:", interactive);

    const action = interactive?.button_reply?.id;
    console.log("👉 Button action:", action);

    if (!action) return;

    const session = sessions[from];



    switch (action) {
        case "MAIN_HELP":
            await showMenu("HELP", from, phoneNumberId);
            break;

        case "HELP_CONTACT":
            await sendWhatsAppText(
                from,
                `❓ *Preguntas frecuentes*

• ¿Mi dinero está seguro? → Sí, solo tú controlas tu llave.
• ¿Necesito banco? → No.
• ¿Puedo ahorrar en grupo? → Sí.

Escribe *menu* para volver.`,
                phoneNumberId
            );
            await sendWhatsAppText(
                from,
                `💬 Puedes escribirnos tu consulta aquí mismo.

Un asesor de AUR te responderá lo antes posible.`,
                phoneNumberId
            );

            // Optional: tag user as "needs support"
            break;



        case "HELP_BACK":
            await showMenu("MAIN", from, phoneNumberId);
            break;
        case "ONBOARD_LOGIN": {


            await sendWhatsAppText(
                from,
                `👋 Hola ${name}`,
                phoneNumberId
            );

            await showMenu("MAIN", from, phoneNumberId);
            break;
        }
        case "CREATE_BACK":
            await showMenu("ONBOARDING", from, phoneNumberId);
            break;
        case "ABOUT_CREATE_ACCOUNT":
            await showMenu("CREATE_ACCOUNT", from, phoneNumberId);
            break;
        case "ABOUT_BACK":
            await showMenu("ONBOARDING", from, phoneNumberId);
            break;
        case "ONBOARD_ABOUT":
            await showMenu("ABOUT", from, phoneNumberId);
            break;
        case "ONBOARD_CREATE_ACCOUNT":
            await sendWhatsAppText(from, "🆕 Vamos a crear tu cuenta.", phoneNumberId);
            break;

        case "ONBOARD_LOGIN":
            await sendWhatsAppText(from, "🔐 Inicia sesión desde la app.", phoneNumberId);
            break;

        case "ONBOARD_ABOUT":
            await sendWhatsAppText(from, "💡 AUR es una cartera segura y simple.", phoneNumberId);
            await sendWhatsAppText(from, "Escribe *menu* para continuar 👇", phoneNumberId);
            break;

        case "MAIN_GROUPS":
            await showMenu("GROUPS", from, phoneNumberId);
            break;
        case "MENU_QUICK_ACTION":
            await sendWhatsAppText(
                from,
                "🎤 Send a voice message.\nExample:\n“Send 10 XLM to John”",
                phoneNumberId
            );
            break;

        case "MENU_MY_ACCOUNT":
            await sendWhatsAppText(
                from,
                "🧾 Account overview coming soon.",
                phoneNumberId
            );
            break;

        case "MENU_MY_GROUPS":
            await sendWhatsAppText(
                from,
                "👥 Group savings (Natilleras) coming soon 🇨🇴",
                phoneNumberId
            );
            break;

        case "CONFIRM_VOICE_SEND":
            if (!session) {
                await sendWhatsAppText(from, "⚠️ No pending transaction.", phoneNumberId);
                return;
            }

            await sendWhatsAppText(from, "⏳ Building transaction...", phoneNumberId);
            await Buildtransaction(session.to, session.amount.toString());

            await sendWhatsAppText(
                from,
                "📲 Open the app to confirm the transaction.",
                phoneNumberId
            );

            sessions[from] = null;
            break;

        case "CANCEL_VOICE_SEND":
            sessions[from] = null;
            await sendWhatsAppText(from, "❌ Transaction canceled.", phoneNumberId);
            break;
    }
}
async function handleText({ from, text, phoneNumberId }) {
    if (!text) return;

    const isGreeting = GREETINGS.some(g => text.includes(g));
    const isMenu = ["menu", "start"].some(k => text.includes(k));

    if (isGreeting || isMenu) {
        await showMenu("ONBOARDING", from, phoneNumberId);
        return;
    }

    await sendWhatsAppText(
        from,
        "🤖 I didn’t understand that.\nType *menu* to continue.",
        phoneNumberId
    );
}

function parseIncomingMessage(req) {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) return null;

    return {
        message,
        from: message.from,
        type: message.type,
        text: message.text?.body?.toLowerCase(),
        interactive: message.interactive,
        audio: message.audio,
        phoneNumberId: value?.metadata?.phone_number_id,
        name: value?.contacts?.[0]?.profile?.name,
    };
}

async function handleAudio({ from, audio }) {
    if (!audio?.id) return;
    await handleVoice(audio.id, from);
}
app.post("/webhook", async (req, res) => {
    try {
        console.log("📩 Incoming webhook:", JSON.stringify(req.body, null, 2));

        const data = parseIncomingMessage(req);
        if (!data) return res.sendStatus(200);

        if (data.type === "text") {
            await handleText(data);
        }

        if (data.type === "interactive") {
            await handleInteractive(data);
        }

        if (data.type === "audio") {
            await handleAudio(data);
        }

        res.sendStatus(200);
    } catch (err) {
        console.error("Webhook error ❌", err);
        res.sendStatus(500);
    }


});
async function downloadWhatsAppAudio(mediaId, outputPath) {
    // 1️⃣ Get media URL
    const mediaInfo = await axios.get(
        `https://graph.facebook.com/v18.0/${mediaId}`,
        {
            headers: {
                Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            },
        }
    );

    // 2️⃣ Download file
    const media = await axios.get(mediaInfo.data.url, {
        responseType: "stream",
        headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        },
    });

    await new Promise(resolve =>
        media.data
            .pipe(fs.createWriteStream(outputPath))
            .on("finish", resolve)
    );
}
async function sendWhatsAppText(to, text) {
    await axios.post(
        `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
        {
            messaging_product: "whatsapp",
            to,
            text: { body: text }
        },
        {
            headers: {
                Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            },
        }
    );
}
async function sendWhatsAppButtons(to, { header, body, buttons }) {
    await axios.post(
        `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
        {
            messaging_product: "whatsapp",
            to,
            type: "interactive",
            interactive: {
                type: "button",
                body: { text: body },
                header: { type: "text", text: header },
                action: {
                    buttons: buttons.map(b => ({
                        type: "reply",
                        reply: b
                    }))
                }
            }
        },
        {
            headers: {
                Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            },
        }
    );
}

async function handleVoice(mediaId, from) {
    const inputPath = `./${mediaId}.ogg`;
    const outputPath = `./${mediaId}.mp3`;

    try {
        // 🎧 Acknowledge
        await sendWhatsAppText(from, "🎧 Listening...");

        // 1️⃣ Download audio
        await downloadWhatsAppAudio(mediaId, inputPath);

        // 2️⃣ Convert to MP3
        await new Promise((res, rej) => {
            ffmpeg(inputPath)
                .toFormat("mp3")
                .on("end", res)
                .on("error", rej)
                .save(outputPath);
        });

        // 3️⃣ Upload to Gemini
        const uploadResponse = await fileManager.uploadFile(outputPath, {
            mimeType: "audio/mp3",
            displayName: "User Voice Command",
        });

        // 4️⃣ Ask Gemini
        const contacts = await getContacts();
        const contactsText = contacts
            .map(c => `- ${c.name}: ${c.address}`)
            .join("\n");

        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash"
        });

        const result = await model.generateContent([
            {
                fileData: {
                    mimeType: uploadResponse.file.mimeType,
                    fileUri: uploadResponse.file.uri
                }
            },
            {
                text: `
You are a crypto wallet assistant.

Contacts:
${contactsText}

Return ONLY valid JSON:
{
  "action": "SEND" | "UNKNOWN",
  "contact": string | null,
  "address": string | null,
  "amount": string | null
}
`
            }
        ]);

        const clean = extractJson(result.response.text());
        if (!clean) {
            return sendWhatsAppText(from, "❌ I couldn't understand the request.");
        }

        const parsed = JSON.parse(clean);

        if (parsed.action !== "SEND") {
            return sendWhatsAppText(from, "🤔 No send request detected.");
        }

        // 5️⃣ Confirm
        await sendWhatsAppButtons(from, {
            header: "📤 Send request detected",
            body: `To: ${parsed.contact}\nAmount: ${parsed.amount}`,
            buttons: [
                { id: "CONFIRM_VOICE_SEND", title: "✅ Confirm" },
                { id: "CANCEL_VOICE_SEND", title: "❌ Cancel" },
            ],
        });

        // store pending tx
        sessions[from] = {
            to: parsed.address,
            amount: parsed.amount,
        };

    } catch (err) {
        console.error(err);
        await sendWhatsAppText(from, "❌ Error processing voice message.");
    } finally {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
}


function extractJson(text) {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? match[0] : null;
}
async function getContacts() {
    const query = `
        SELECT name, address
        FROM contacts
        ORDER BY name;
    `;
    const res = await conn.query(query);
    return res.rows;
}

app.get("/transactions", async (req, res) => {
    const query = `
    SELECT id, xdr, status, created_at
    FROM stellar_transactionsx
    ORDER BY created_at DESC;
  `;

    try {
        const response = await conn.query(query);
        res.status(200).send(response.rows);

    } catch (error) {
        console.error("Database error:", error);
        res.status(500).send({ error: error.message });
    }
});

async function Buildtransaction(destinationPublicKey, amount) {
    try {
        const account = await server.loadAccount("GD5W6257ASJFTPLNSI547GPLDNTDUIA5L3AMFIKYY6STJ37VHJ4ZCGWH");

        const tx = new TransactionBuilder(account, {
            fee: "100", // stroops
            networkPassphrase: Networks.TESTNET,
        })
            .addOperation(
                Operation.payment({
                    destination: destinationPublicKey,
                    asset: Asset.native(), // XLM
                    amount: amount,        // must be string
                })
            )
            .setTimeout(60)
            .build();
        const xdr = tx.toXDR()
        // Save this
        const query = `
  INSERT INTO stellar_transactionsx (
    id,
    xdr,
    status,
    network
  )
  VALUES (
    gen_random_uuid(),
    $1,
    'PENDING',
    'TESTNET'
  )
  RETURNING id, status, created_at;
`;


        const values = [xdr];
        const response = await conn.query(query, values);

        console.log("INSERT stellar_transactions (XDR only)");

    } catch (error) {
        console.error("Database error:", error);
    }

}


async function sendTestPush(expoPushToken) {
    await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            to: expoPushToken,
            title: "Solicitud envio",
            body: "Solicitud generada desde el bot",
            sound: "default",
            data: {
                from: "test-button",
            },
        }),
    });
}
app.get("/", (req, res) => {
    res.send("Hello World!");
});
app.listen(3000, () => {
    console.log("🤖 WhatsApp bot running on port 3000");
});

