import {
    Account,
    Asset,
    Operation,
    TransactionBuilder,
    Networks,
    Horizon,
    StrKey,
    Keypair,
    BASE_FEE
} from "stellar-sdk";
import express from "express";
import 'dotenv/config'
import conn from './db.js';
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
async function getUsdToCop(usd) {
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
    const data = await res.json();
    console.log("USD to COP rate:", data.rates.COP);
    const result = data.rates.COP * usd;
    console.log(`$${usd} USD is approximately ₱${result.toFixed(2)} COP`);
    return result;
}
function formatCOP(value) {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0
    }).format(value);
}
const UserBalance = async (address) => {
    console.log("Fetching balance for address:", address);
    const account = await server.loadAccount(address);
    const assetUsdcBalance = account.balances.find(
        (b) => b.asset_code === USDCasset.getCode() && b.asset_issuer === USDCasset.getIssuer()
    );
    const xlmBalance = account.balances.find(
        (b) => b.asset_type === "native"
    );
    console.log("XLM balance:", xlmBalance?.balance);
    /*if (xlmBalance) {
        setenergyLevels(xlmBalance?.balance);
    }*/
    if (assetUsdcBalance) {

        console.log(`${USDCasset.getCode()} balance: ${assetUsdcBalance.balance}`);
        let usd = await getUsdToCop(parseFloat(assetUsdcBalance.balance));
        let formattedUsd = await formatCOP(usd);
        console.log(formattedUsd, "Apx");
        amount = assetUsdcBalance.balance;
    } else {
        console.log(`No ${USDCasset.getCode()} balance found`);
    }
    return xlmBalance ? xlmBalance.balance : "0";




};
const USDCasset = new Asset("USDC", "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN");
const TrustAsset = new Asset("TRUST", "GD4IBE2P3LXDLXCL5G5LNNPPZLOCWDGTXJF44UHWLHHUDBZDYYRRJDYE");
let sessions = {};
let usersCreation = {};
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
let name = "";
let amount = "₱0";
const MENUS = {
    ONBOARDING: {
        text:
            `Hola {name}
            
Tu saldo actual es de:

💵 {amount}

¿Qué quieres hacer con tu dinero?`,
        buttons: [
            { id: "MAIN_MONEY", title: "💰 Mi platica" },
            { id: "MAIN_GROUPS", title: "👥 Mis grupos" },
            { id: "MAIN_HELP", title: "ℹ️ Ayuda" },
        ],
    },
};
MENUS.ONBOARDING2 = {
    text:
        `👋 ¡Ey! Bienvenido a *AUR Cartera*

Aquí guardás tu plata, mandás dinero
y ahorrás con tu gente 😄

Fácil y seguro`,
    buttons: [
        { id: "ABOUT_CREATE_ACCOUNT", title: "🆕 Crear mi cuenta" },
        { id: "ONBOARD_ABOUT", title: "❓ Qué es AUR" },
    ],
},
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
MENUS.CREATE_ACCOUNT2 = {
    text: `✨ Casi listo, ${name}!

Para entrar al grupo primero debes completar tu registro en la app AUR.

1️⃣ Descarga la app  
2️⃣ Crea tu cuenta con este número  
3️⃣ Cuando termines, vuelve aquí y te agrego automáticamente

Tu código de invitación está guardado 👍`,
    ctaText: " Abrir App AUR",
    ctaUrl: "https://aur.app.link/open",
    footerText: "Serás redirigido a la app o a la tienda",
};
MENUS.MAIN = {
    text: `Hola {name} ¿Que mas? \n\n¿Qué vamos a hacer hoy?`,
    buttons: [
        { id: "MAIN_MONEY", title: "💰 Mi platica" },
        { id: "MAIN_GROUPS", title: "👥 Mis grupos" },
        { id: "MAIN_HELP", title: "ℹ️ Ayuda" },
    ],
};
MENUS.ADDED_GROUP = {
    text: `🎉 ¡Listo {name}!

Ya fuiste agregado al grupo correctamente 🙌 
\n FALTA QUE LOS DEMÁS PARTICIPANTES SE UNAN PARA QUE PUEDAS VER EL GRUPO EN TU APP.
Desde aquí podrás ver tus grupos, hacer aportes y llevar el control de tus pagos.

\n\n¿Qué vamos a hacer hoy?`,
    buttons: [
        { id: "MAIN_MONEY", title: "💰 Mi platica" },
        { id: "MAIN_GROUPS", title: "👥 Mis grupos" },
        { id: "MAIN_HELP", title: "ℹ️ Ayuda" },
    ],
};

MENUS.CREATE_ACCOUNT = {
    text: `👍 Vamos paso a paso

Para crear tu cuenta necesitas instalar la *App AUR*.

Esta app guarda tu llave secreta, que es como la llave de tu casa 🏠🔑

⚠️ Nadie más puede verla, ni AUR.`,
    ctaText: " Abrir App AUR",
    ctaUrl: "https://aur.app.link/open",
    footerText: "Serás redirigido a la app o a la tienda",
};
MENUS.MAIN = {
    text: `Hola {name} ¿Que mas? \n\n¿Qué vamos a hacer hoy?`,
    buttons: [
        { id: "MAIN_MONEY", title: "💰 Mi platica" },
        { id: "MAIN_GROUPS", title: "👥 Mis grupos" },
        { id: "MAIN_HELP", title: "ℹ️ Ayuda" },
    ],
};
MENUS.GROUPS_HOME = {
    text: `👥 Mis grupos

Hola {name} 👋

Aquí puedes ahorrar con otras personas de forma segura.

¿Qué quieres hacer?`,
    buttons: [
        {
            id: "GROUPS_LIST",
            title: "🧾 Ver mis grupos",
        },
        {
            id: "GROUPS_CREATE",
            title: "➕ Crear grupo",
        },
        {
            id: "MENU_BACK",
            title: "⬅️ Volver",
        },
    ],
};
MENUS.MY_MONEY = {
    text: `
Tienes un saldo actual de:

💵 {amount}

¿Qué quieres hacer?`,
    buttons: [
        {
            id: "MONEY_SEND",
            title: "📤 Enviar dinero",
        },
        {
            id: "MONEY_RECEIVE",
            title: "📥 Recibir dinero",
        },
        {
            id: "MENU_BACK",
            title: "⬅️ Volver",
        },
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
function applyVars(text, vars = {}) {
    let finalText = text;

    Object.entries(vars).forEach(([key, value]) => {
        finalText = finalText.replaceAll(`{${key}}`, value);
    });

    return finalText;
}
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
async function sendMenu({
    to,
    phoneNumberId,
    text,
    buttons = [],
    ctaUrl = null,
    ctaText = null,
    headerImage = null,
    footerText = null,
}) {
    let interactive;

    // 🔗 CTA URL message (App Store / Open App)
    if (ctaUrl) {
        interactive = {
            type: "cta_url",
            body: {
                text,
            },
            action: {
                name: "cta_url",
                parameters: {
                    display_text: ctaText || "Abrir",
                    url: ctaUrl,
                },
            },
        };

        if (headerImage) {
            interactive.header = {
                type: "image",
                image: { link: headerImage },
            };
        }

        if (footerText) {
            interactive.footer = { text: footerText };
        }
    }

    // 🔘 Normal button menu
    else {
        interactive = {
            type: "button",
            body: { text },
            action: {
                buttons: buttons.map(b => ({
                    type: "reply",
                    reply: {
                        id: b.id,
                        title: b.title,
                    },
                })),
            },
        };
    }

    await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        },
        body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "interactive",
            interactive,
        }),
    });
}


async function showMenu(menuKey, to, phoneNumberId, vars = {}) {
    const menu = MENUS[menuKey];
    if (!menu) throw new Error(`Menu ${menuKey} not found`);
    const text = applyVars(menu.text, vars);
    await sendMenu({
        to,
        phoneNumberId,
        text: text,
        buttons: menu.buttons,
        ctaUrl: menu.ctaUrl,
        ctaText: menu.ctaText,
        headerImage: menu.headerImage,
        footerText: menu.footerText,
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
function buildGroupsListText({ name, groups }) {
    if (!groups || groups.length === 0) {
        return `👥 Mis grupos

Hola ${name} 👋

Aún no estás en ningún grupo.

Los grupos sirven para ahorrar juntos (como una natillera digital 💰)`;
    }

    let list = groups
        .map((g, i) => `${i + 1}️⃣ ${g.name}`)
        .join("\n");

    return `👥 Mis grupos

Hola ${name} 👋

Estos son tus grupos:

${list}

✍️ Escribe el número del grupo que quieres ver.`;
}
async function openGroupDetail(to, phoneNumberId, group, currentUserPhoneId) {
    // group viene del query anterior (getUserGroups o similar)
    // Asegúrate de que incluya: id, name, amount, payment_interval_days, is_active, created_by, my_joined_at, members, payments, total_amount_collected, my_total_paid

    const isCreator = group.created_by === currentUserPhoneId;
    const isActive = group.is_active;

    // ── Cálculos de estado del usuario ──────────────────────────────────────
    const myTotalPaid = Number(group.my_total_paid) || 0;
    const expectedPerUser = Number(group.amount) || 0; // monto por aporte individual

    // Ejemplo simple: si cada miembro debe aportar lo mismo que el "amount" del grupo por ciclo
    // Puedes ajustar esta lógica según tu modelo real (ronda, orden, etc.)
    let statusText = "";
    let nextPaymentDate = "Por definir";

    if (isActive) {
        // Lógica ejemplo: suponiendo aportes mensuales fijos
        // Aquí deberías calcular realmente según la última fecha de pago del usuario + interval
        // Por ahora usamos un placeholder realista
        if (myTotalPaid >= expectedPerUser) {
            statusText = "✅ Estás al día";
        } else {
            const deuda = expectedPerUser - myTotalPaid;
            statusText = `⚠️ Tienes una deuda de $${deuda.toLocaleString("es-CO")}`;
        }

        // Próximo pago: puedes calcularlo mejor con la fecha del último pago + interval
        // Ejemplo placeholder:
        nextPaymentDate = "15 de marzo de 2026"; // ← ← ← reemplazar con cálculo real
    }

    // ── Texto base común ─────────────────────────────────────────────────────
    let text = `👥 *${group.name}*\n\n`;

    text += `💰 Aporte individual: $${Number(group.group_amount).toLocaleString("es-CO")}\n`;
    text += `📅 Frecuencia: Cada ${group.payment_interval_days} días\n`;
    text += `🟢 Estado: ${isActive ? "Activo" : "Pendiente de creación"}\n\n`;

    if (isActive) {
        text += `Miembros: ${group.members?.length || 0}\n`;
        text += `Total recolectado: $${Number(group.total_amount_collected || 0).toLocaleString("es-CO")}\n`;
        text += `Tú has aportado: $${myTotalPaid.toLocaleString("es-CO")}\n\n`;
        text += `${statusText}\n`;
        text += `Próximo aporte: ${nextPaymentDate}\n\n`;
        text += `¿Qué deseas hacer?`;
    } else if (!isActive && isCreator) {
        text += `Tú creaste este grupo.\n`;
        text += `Está listo para ser activado cuando desees.\n\n`;
        text += `Miembros: ${group.members?.length || 0}\n\n`;
        text += `¿Qué quieres hacer?`;
    } else if (!isActive && !isCreator) {
        text += `Este grupo aún no ha sido activado por el creador.\n`;
        text += `Te notificaremos cuando esté listo para empezar.\n\n`;
    }

    // ── Botones según el caso ────────────────────────────────────────────────
    let buttons = [];

    if (isActive) {
        buttons = [
            { id: `GROUP_CONTRIBUTE`, title: "💸 Aportar ahora" },
            { id: `GROUP_PROPOSE_EXPENSE`, title: "📝 Proponer gasto" },
            { id: "GROUPS_HOME", title: "⬅️ Volver" },
        ];
    } else if (!isActive && isCreator) {
        buttons = [
            { id: `GROUP_ACTIVATE`, title: "✅ Activar grupo" },
            { id: `GROUP_DELETE`, title: "🗑️ Eliminar grupo" },
            { id: "GROUPS_HOME", title: "⬅️ Volver" },
        ];
    } else {
        // No creador + inactivo → opciones limitadas
        buttons = [
            { id: "GROUPS_HOME", title: "⬅️ Volver" },
        ];
    }

    await sendMenu({
        to,
        phoneNumberId,
        text,
        buttons,
    });
}
function generateGroupCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    // removed confusing characters: O, I, 0, 1

    let code = "";
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }

    return `AUR-${code}`;
}


async function handleInteractive({ from, interactive, phoneNumberId, name }) {
    console.log("🟢 Interactive received:", interactive);

    const action = interactive?.button_reply?.id;
    console.log("👉 Button action:", action);

    if (!action) return;

    const session = sessions[from];
    console.log("Current session for user:", session);


    switch (action) {
        case "VERIFY_PHONE": {
            try {
                await conn.query(
                    `UPDATE contactsx
                     SET verified = true,
                         verified_at = NOW()
                     WHERE contact_value = $1`,
                    [from]
                );

                console.log("✅ User verified via WhatsApp:", from);

                await sendWhatsAppText(
                    from,
                    "✅ Número confirmado. Puedes volver a la app.",
                    phoneNumberId
                );

            } catch (error) {
                console.error("Verification error:", error);
            }
            break;
        }

        case "GROUP_FREQ_30": {
            if (!session || session.step !== "CREATING_GROUP_FREQUENCY") {
                await sendWhatsAppText(
                    from,
                    "⚠️ No hay creación de grupo en proceso.",
                    phoneNumberId
                );
                return;
            }

            const value = action.replace("GROUP_FREQ_", "");

            const frequency =
                value === "SKIP"
                    ? "Libre"
                    : `${value} días`;

            session.frequency = frequency;
            session.step = "GROUP_WAITING_MEMBERS";

            const inviteCode = generateGroupCode();
            session.inviteCode = inviteCode;
            await createGroup({ name: session.groupName, createdBy: from, amount: session.amount, paymentIntervalDays: value, inviteCode });
            await addUserToGroup(from, inviteCode); // Add creator to the group
            await sendWhatsAppText(
                from,
                `Grupo en espera

Nombre: ${session.groupName}
Monto: ${session.amount === 0 ? "Sin monto fijo" : session.amount}
Frecuencia: ${session.frequency}

Tú ya haces parte del grupo como creador.

Ahora invita a los participantes con el mensaje que te enviaré a continuación una vez esten todos debes confirmar la creacion.`,
                phoneNumberId
            );

            const joinText = `QUIERO_UNIRME ${inviteCode}`;
            const link = `https://wa.me/${573148924300}?text=${encodeURIComponent(joinText)}`;

            await sendWhatsAppText(
                from,
                `📩 Mensaje para invitar participantes, compartilo con los que quieres agregar`,
                phoneNumberId
            );

            await sendWhatsAppText(
                from,
                `

🎉 Te invito a un grupo de ahorro

Nombre: ${session.groupName}
Monto: ${session.amount === 0 ? "Aporte flexible" : session.amount}
Frecuencia: ${session.frequency}

👉 Únete aquí:
${link}

(Solo toca el enlace y envía el mensaje automáticamente)`,
                phoneNumberId
            );
            break;
        }
        case "GROUP_FREQ_15": {
            if (!session || session.step !== "CREATING_GROUP_FREQUENCY") {
                await sendWhatsAppText(
                    from,
                    "⚠️ No hay creación de grupo en proceso.",
                    phoneNumberId
                );
                return;
            }

            const value = action.replace("GROUP_FREQ_", "");

            const frequency =
                value === "SKIP"
                    ? "Libre"
                    : `${value} días`;

            session.frequency = frequency;
            session.step = "GROUP_WAITING_MEMBERS";

            const inviteCode = generateGroupCode();
            session.inviteCode = inviteCode;
            await createGroup({ name: session.groupName, createdBy: from, amount: session.amount, paymentIntervalDays: value, inviteCode });
            await addUserToGroup(from, inviteCode); // Add creator to the group

            await sendWhatsAppText(
                from,
                `Grupo en espera

Nombre: ${session.groupName}
Monto: ${session.amount === 0 ? "Sin monto fijo" : session.amount}
Frecuencia: ${session.frequency}

Tú ya haces parte del grupo como creador.

Ahora invita a los participantes con el mensaje que te enviaré a continuación una vez esten todos debes confirmar la creacion.`,
                phoneNumberId
            );

            const joinText = `QUIERO_UNIRME ${inviteCode}`;
            const link = `https://wa.me/${573148924300}?text=${encodeURIComponent(joinText)}`;

            await sendWhatsAppText(
                from,
                `📩 Mensaje para invitar participantes, compartilo con los que quieres agregar`,
                phoneNumberId
            );

            await sendWhatsAppText(
                from,
                `

🎉 Te invito a un grupo de ahorro

Nombre: ${session.groupName}
Monto: ${session.amount === 0 ? "Aporte flexible" : session.amount}
Frecuencia: ${session.frequency}

👉 Únete aquí:
${link}

(Solo toca el enlace y envía el mensaje automáticamente)`,
                phoneNumberId
            );
            break;
        }
        case "GROUP_FREQ_SKIP": {
            if (!session || session.step !== "CREATING_GROUP_FREQUENCY") {
                await sendWhatsAppText(
                    from,
                    "⚠️ No hay creación de grupo en proceso.",
                    phoneNumberId
                );
                return;
            }

            const value = action.replace("GROUP_FREQ_", "");

            const frequency =
                value === "SKIP"
                    ? "Libre"
                    : `${value} días`;

            session.frequency = frequency;
            session.step = "GROUP_WAITING_MEMBERS";

            const inviteCode = generateGroupCode();
            session.inviteCode = inviteCode;
            await createGroup({ name: session.groupName, createdBy: from, amount: session.amount, paymentIntervalDays: value, inviteCode });
            await addUserToGroup(from, inviteCode); // Add creator to the group

            await sendWhatsAppText(
                from,
                `Grupo en espera

Nombre: ${session.groupName}
Monto: ${session.amount === 0 ? "Sin monto fijo" : session.amount}
Frecuencia: ${session.frequency}

Tú ya haces parte del grupo como creador.

Ahora invita a los participantes con el mensaje que te enviaré a continuación una vez esten todos debes confirmar la creacion.`,
                phoneNumberId
            );

            const joinText = `QUIERO_UNIRME ${inviteCode}`;
            const link = `https://wa.me/${573148924300}?text=${encodeURIComponent(joinText)}`;

            await sendWhatsAppText(
                from,
                `📩 Mensaje para invitar participantes, compartilo con los que quieres agregar`,
                phoneNumberId
            );

            await sendWhatsAppText(
                from,
                `

🎉 Te invito a un grupo de ahorro

Nombre: ${session.groupName}
Monto: ${session.amount === 0 ? "Aporte flexible" : session.amount}
Frecuencia: ${session.frequency}

👉 Únete aquí:
${link}

(Solo toca el enlace y envía el mensaje automáticamente)`,
                phoneNumberId
            );
            break;
        }

        // ✅ CONFIRM CREATE GROUP
        case "GROUP_CONFIRM_CREATE": {
            const data = sessions[from];

            await sendWhatsAppText(
                from,
                `✅ Grupo creado correctamente

Nombre: ${data.groupName}
Monto: ${data.amount}
Frecuencia: ${data.frequency}

Ya pueden comenzar a ahorrar juntos 💰`,
                phoneNumberId
            );

            break;
        }

        // ❌ CANCEL CREATE GROUP
        case "GROUP_CANCEL_CREATE":
            await sendWhatsAppText(
                from,
                "❌ Creación del grupo cancelada.",
                phoneNumberId
            );
            break;

        case "GROUPS_CREATE":
            updateSession(from, { step: "CREATING_GROUP_NAME" });

            await sendWhatsAppText(
                from,
                `➕ Crear grupo de ahorro

Escribe el *nombre del grupo*.

Ejemplos:
Natillera diciembre
Viaje a Cartagena
Ahorro familia`,
                phoneNumberId
            );
            break;
        case "GROUPS_LIST": {

            // Later this comes from DB
            await handleMainGroups(from, phoneNumberId)


            // ⭐ IMPORTANT → save state

            updateSession(from, {
                step: "WAITING_GROUP_SELECTION",

            });

            break;
        }

        case "MAIN_GROUPS":
            await showMenu(
                "GROUPS_HOME",
                from,
                phoneNumberId,
                { name }
            );
            break;
        case "MONEY_SEND":
            updateSession(from, {
                step: "SEND_CHOOSE_METHOD"
            });

            await sendMenu({
                to: from,
                phoneNumberId,
                text: `📤 Enviar dinero

¿Cómo quieres indicar el envío?`,
                buttons: [
                    { id: "SEND_VOICE", title: "🎤 Con voz" },
                    { id: "SEND_TEXT", title: "⌨️ Escribir datos" },
                    { id: "MENU_BACK", title: "⬅️ Volver" },
                ],
            });
            break;
        case "SEND_VOICE":
            updateSession(from, { step: "SEND_WAITING_VOICE" });

            await sendWhatsAppText(
                from,
                `🎤 Envía un mensaje de voz

Ejemplo:
"Enviar 20 a Juan"`,
                phoneNumberId
            );
            break;
        case "SEND_TEXT":
            updateSession(from, { step: "SEND_WAITING_ADDRESS" });

            await sendWhatsAppText(
                from,
                `✏️ Escribe la dirección del destinatario`,
                phoneNumberId
            );
            break;
        case "MAIN_HELP":
            await showMenu("HELP", from, phoneNumberId);
            break;
        case "MAIN_MONEY":

            const amount = await UserBalance(session.address);
            await showMenu("MY_MONEY", from, phoneNumberId, { name, amount });
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

        case "GROUP_ACTIVATE":
            await handleActivateGroup(from, phoneNumberId, session.groupId, session);
            break;

        case "HELP_BACK":
            await showMenu("MAIN", from, phoneNumberId, { name });
            break;
        case "ONBOARD_LOGIN": {

            await showMenu("MAIN", from, phoneNumberId, { name });
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
        case "SELECT_GROUP": {
            const selectedIndex = parseInt(text) - 1;

            const groups = session.groupsCache;

            if (!groups || !groups[selectedIndex]) {
                await sendWhatsAppText(
                    phone,
                    "❌ Número inválido. Escribe el número del grupo.",
                    phoneNumberId
                );
                return;
            }

            const group = groups[selectedIndex];

            sessions[phone] = {
                ...session,
                step: null,
                selectedGroupId: group.id
            };

            const details = formatGroupDetails(group);

            await sendWhatsAppText(phone, details, phoneNumberId);
            await sendMenu(phone, MENUS.MAIN, session.name);
            break;
        }

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
            console.log("✅ Confirming voice transaction:", session);

            await sendWhatsAppText(from, "⏳ Building transaction...", phoneNumberId);
            await Buildtransaction(session.address, session.to, session.amount.toString(), session.tokennotification);

            await sendWhatsAppText(
                from,
                "📲 Open the app to confirm the transaction.",
                phoneNumberId
            );
            break;

        case "CANCEL_VOICE_SEND":
            await sendWhatsAppText(from, "❌ Transaction canceled.", phoneNumberId);
            break;
    }
}
function formatGroupDetails(group) {
    return `📌 *${group.name}*

💰 Aporte: ${Number(group.amount) > 0
            ? `$${group.amount}`
            : "Sin monto fijo"
        }

📅 Frecuencia: cada ${group.payment_interval_days} días
🟢 Estado: ${group.is_active ? "Activo" : "Pendiente"}

Estás dentro del grupo ✅`;
}
async function handleActivateGroup(to, phoneNumberId, groupId, session) {
    const selectedGroup = session.groupsCache.find(g => g.id == groupId);
    if (!selectedGroup || selectedGroup.is_active) {
        await sendWhatsAppText(to, "Este grupo ya está activo o no se encontró.", phoneNumberId);
        return;
    }

    // ── 1. Extraer las direcciones Stellar directamente del array members ──
    const members = selectedGroup.members || [];

    if (members.length === 0) {
        await sendWhatsAppText(to, "No hay miembros en el grupo. Invita al menos a una persona antes de activar.", phoneNumberId);
        return;
    }

    const signerPublicKeys = members
        .map(m => m.address)
        .filter(addr => addr && addr.startsWith('G')); // seguridad básica: solo claves válidas G...

    if (signerPublicKeys.length === 0) {
        await sendWhatsAppText(to, "Error: No se encontraron direcciones válidas de Stellar entre los miembros.", phoneNumberId);
        return;
    }

    // ── 2. Decidir cuántas firmas se requieren (ajusta esta lógica) ───────────
    const memberCount = signerPublicKeys.length;
    let threshold = 1;

    if (memberCount >= 3) {
        threshold = Math.ceil(memberCount * 0.67);     // → mayoría calificada (~2/3)
    } else if (memberCount === 2) {
        threshold = 2;                                 // ambos deben firmar
    } else if (memberCount === 1) {
        threshold = 1;                                 // solo el creador
    }

    // ── 3. Obtener la secret key del funder (¡parte crítica y sensible!) ─────
    // Ejemplos de cómo podrías obtenerla (elige SOLO UNO según tu arquitectura):
    //
    // Opción A: wallet custodial / servicio externo
    // const funderSecret = await getUserSecretFromVault(session.phone);
    //
    // Opción B: el usuario la tiene temporalmente en la sesión (menos seguro)
    // const funderSecret = session.stellarSecret; // ← solo si la pediste antes
    //
    // Opción C: cuenta fundadora central de tu app (más simple al inicio)
    // const funderSecret = process.env.MAIN_FUNDER_SECRET;



    // ── 4. Crear la cuenta multi-firma ───────────────────────────────────────
    try {
        const result = await createAccount(
            session.address,                    // dirección del creador/funder
            session.tokennotification,       // o el del grupo/creador
            signerPublicKeys,
            threshold,
            groupId
        );

        // Ejemplo de lo que podría devolver tu función:
        // { success: true, accountId: 'GBX...', txHash: '...' }

        // 5. Marcar grupo como activo + guardar cuenta multi-sig (importante)
        await conn.query(`
    UPDATE groups 
    SET 
        is_active     = false,
        multisig_address = $2
    WHERE id = $1
`, [groupId, result.accountId]);

        // Opcional: notificar a todos los miembros
        /*for (const member of members) {
            if (member.tokennotification && member.phoneid !== session.phone) {
                await sendPushNotification(
                    member.tokennotification,
                    `¡El grupo ${selectedGroup.name} ya está activo!`
                );
            }
        }*/

        await sendMenu({
            to,
            phoneNumberId,
            text: `¡Éxito! El grupo *${selectedGroup.name}* ya está activo 🎉

Cuenta multi-firma creada:
${result.accountId || '—'}

Se requieren **${threshold} de ${memberCount}** firmas para mover fondos.

¿Qué quieres hacer ahora?`,
            buttons: [
                { id: `GROUP_DETAIL_${groupId}`, title: "detalles grupo" },
                { id: "GROUPS_HOME", title: "⬅️ Volver " }
            ]
        });

    } catch (err) {
        console.error("Fallo al activar grupo:", err);

        await sendWhatsAppText(to, `No pudimos activar el grupo en este momento.\n\n${err.message || 'Error desconocido'}\n\nIntenta de nuevo en unos minutos.`, phoneNumberId);
    }
}
async function getUserGroups(phoneid) {
    const query = `
        SELECT 
            g.id,
            g.name,
            g.invite_code,
            g.created_by,
            g.amount AS group_amount,
            g.payment_interval_days,
            g.created_at AS group_created_at,
            g.is_active,
            
            ug.joined_at AS my_joined_at,
            
            -- All members with their user info
            (
                SELECT json_agg(
                    json_build_object(
                        'phoneid', u.phoneid,
                        'address', u.address,
                        'tokennotification', u.tokennotification,
                        'joined_at', ug2.joined_at
                    )
                    ORDER BY ug2.joined_at DESC
                )
                FROM user_groups ug2
                JOIN usuarios u ON u.phoneid = ug2.user_phoneid
                WHERE ug2.group_id = g.id
            ) AS members,
            
            -- All payments in this group
            (
                SELECT json_agg(
                    json_build_object(
                        'id', p.id,
                        'user_phoneid', p.user_phoneid,
                        'payment_number', p.payment_number,
                        'amount', p.amount,
                        'created_at', p.created_at
                    )
                    ORDER BY p.created_at DESC
                )
                FROM payments p
                WHERE p.group_id = g.id
            ) AS payments,
            
            -- Total collected in the group
            (
                SELECT COALESCE(SUM(p2.amount), 0)
                FROM payments p2
                WHERE p2.group_id = g.id
            ) AS total_amount_collected,
            
            -- Total paid by THIS user in the group
            (
                SELECT COALESCE(SUM(p3.amount), 0)
                FROM payments p3
                WHERE p3.group_id = g.id 
                  AND p3.user_phoneid = $1
            ) AS my_total_paid

        FROM user_groups ug
        JOIN groups g ON g.id = ug.group_id
        WHERE ug.user_phoneid = $1
        ORDER BY ug.joined_at DESC;
    `;

    const res = await conn.query(query, [phoneid]);

    // Optional: nice logging
    console.log(`User groups for ${phoneid}:`, res.rows, 'groups found');
    // console.log(JSON.stringify(res.rows, null, 2)); // uncomment for debugging

    return res.rows;
}


async function createAccount(
    funder,
    tokennotification,
    signerPublicKeys,
    threshold,
    groupId

) {
    try {
        console.log("Creating multi-sig account with funder:", funder);
        const fresh = Keypair.random();
        const funderAccount = await server.loadAccount(funder);

        const builder = new TransactionBuilder(funderAccount, {
            fee: BASE_FEE,
            networkPassphrase: Networks.TESTNET,
        });

        // 1️⃣ create account
        builder.addOperation(
            Operation.createAccount({
                destination: fresh.publicKey(),
                startingBalance: "3",
            })
        );

        const tx = builder.setTimeout(360).build();

        //tx.sign(fresh);

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
        const txRow = response.rows[0];

        const payload = {
            id: txRow.id,
            status: txRow.status,
            date_created: txRow.created_at,
            xdr,
            network: "TESTNET",
        };

        await sendTestPush(tokennotification, payload);

        console.log("INSERT stellar_transactions (XDR only)");
        usersCreation[fresh.publicKey()] = {
            groupId,
            freshPublic: fresh.publicKey(),
            freshSecret: fresh.secret(),          // ← lives only here
            creationXdr: xdr,
            startedAt: Date.now(),
            status: 'WAITING_CREATION_SIGNATURE',
            publicKeys: signerPublicKeys,
            threshold,
        }; // Store the secret temporarily for the creation flow
        return { success: true, accountId: fresh.publicKey() };
    } catch (error) {
        console.error("Database error:", error);
    }


}

function formatGroupsList(name, groups) {
    if (!groups.length) {
        return `Hola ${name} 👋

Aún no estás en ningún grupo.

Pide un código AUR para unirte 💫`;
    }

    let text = `👥 *Tus grupos, ${name}*\n\n`;

    groups.forEach((g, i) => {
        text += `${i + 1}. ${g.name}\n`;
    });

    text += `\n✍️ Responde con el *número del grupo* para ver detalles.`;

    return text;
}
async function handleMainGroups(phone, phoneNumberId) {
    const session = sessions[phone];
    const groups = await getUserGroups(phone);

    // store for selection
    sessions[phone] = {
        ...session,
        step: "SELECT_GROUP",
        groupsCache: groups
    };

    const message = formatGroupsList(
        session?.name || "amigo",
        groups
    );

    await sendWhatsAppText(phone, message, phoneNumberId);
}


async function createGroup({
    name,
    createdBy,               // phoneid of creator
    amount = 0,              // 0 = no fixed amount
    paymentIntervalDays,     // 7, 15, 30, etc
    inviteCode
}) {
    console.log("Creating group with data:", {
        name,
        createdBy,
        amount,
        paymentIntervalDays,
        inviteCode
    });
    const query = `
        INSERT INTO groups (
            name,
            invite_code,
            created_by,
            amount,
            payment_interval_days
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
    `;

    const values = [
        name,
        inviteCode,
        createdBy,
        amount,
        paymentIntervalDays
    ];

    const res = await conn.query(query, values);

    return res.rows[0];
}
async function handleText({ from, text, phoneNumberId }) {
    if (!text) return;
    const session = sessions[from];
    console.log(" session:", session);
    const isGreeting = GREETINGS.some(g => text.includes(g));
    const isMenu = ["menu", "start"].some(k => text.includes(k));

    if (isGreeting || isMenu) {
        const amount = await UserBalance(session?.address);
        await showMenu("ONBOARDING", from, phoneNumberId, { name: session?.name || "Amigo", amount });
        return;
    }
    if (session?.step === "SEND_WAITING_ADDRESS") {
        const normalizedAddress = normalizeStellarAddress(text.trim());

        if (!normalizedAddress) {
            await sendWhatsAppText(
                from,
                "⚠️ La dirección no es válida. Verifica y vuelve a intentar.",
                phoneNumberId
            );
            return;
        }
        updateSession(from, {
            step: "SEND_WAITING_AMOUNT",
            to: normalizedAddress,
        });

        await sendWhatsAppText(
            from,
            `💰 ¿Cuánto deseas enviar?`,
            phoneNumberId
        );
        return;
    }
    if (session?.step === "SEND_WAITING_AMOUNT") {

        const amount = Number(text);

        if (isNaN(amount) || amount <= 0) {
            await sendWhatsAppText(
                from,
                "⚠️ Escribe un monto válido.",
                phoneNumberId
            );
            return;
        }

        updateSession(from, {
            amount,
            step: "SEND_CONFIRM"
        });
        await sendMenu({
            to: from,
            phoneNumberId,
            text: `📤 Confirmar envío

Destino:
${session.to}

Monto:
${amount} XLM

¿Confirmas la transacción?`,
            buttons: [
                { id: "CONFIRM_VOICE_SEND", title: "✅ Confirmar" },
                { id: "CANCEL_VOICE_SEND", title: "❌ Cancelar" },
            ],
        });

        return;
    }
    if (session?.step === "CREATING_GROUP_AMOUNT") {
        // normalize input
        const raw = text.trim();

        // remove separators like 20.000 or 50,000
        const normalizedNumber = raw.replace(/[.,\s]/g, "");

        let amount;

        if (!isNaN(normalizedNumber)) {
            const value = Number(normalizedNumber);

            if (value === 0) {
                amount = "Libre";
            } else if (value > 0) {
                amount = value;
            }
        }

        if (amount === undefined) {
            await sendWhatsAppText(
                from,
                "⚠️ Escribe el monto (ej: 20000) o escribe 0 si será monto libre.",
                phoneNumberId
            );
            return;
        }

        updateSession(from, { amount, step: "CREATING_GROUP_FREQUENCY" });

        await sendMenu({
            to: from,
            phoneNumberId,
            text: `📅 ¿Cada cuánto se aporta? (opcional)`,
            buttons: [
                { id: "GROUP_FREQ_15", title: "Cada 15 días" },
                { id: "GROUP_FREQ_30", title: "Cada 30 días" },
                { id: "GROUP_FREQ_SKIP", title: "Fecha libre" },
            ],
        });

        return;
    }
    if (session?.step === "CREATING_GROUP_NAME") {
        const groupName = text;


        updateSession(from, { groupName, step: "CREATING_GROUP_AMOUNT" });

        await sendWhatsAppText(
            from,
            `✅ Grupo: *${groupName}*

Ahora escribe el monto de aporte por periodo.

Ejemplo:
20000
50000

Si escribes el numero 0 el grupo no tendrá monto fijo.`,
            phoneNumberId
        );

        return;
    }


    if (session?.step === "WAITING_GROUP_SELECTION") {
        const index = parseInt(text) - 1;

        if (isNaN(index) || !session.groupsCache || !session.groupsCache[index]) {
            await sendWhatsAppText(
                from,
                "⚠️ Escribe el número del grupo que quieres ver.",
                phoneNumberId
            );
            return;
        }

        const selectedGroup = session.groupsCache[index];

        updateSession(from, {
            step: "VIEWING_GROUP",
            groupId: selectedGroup.id
        });

        await openGroupDetail(from, phoneNumberId, selectedGroup, from);
        return;
    }
    // data.text is already a string in your normalized object

    // ALWAYS guard before using string methods
    const match = text.toUpperCase().match(/AUR-[A-Z0-9]+/);

    if (match) {
        const inviteCode = match[0];
        console.log("🎟️ Invite code detected:", inviteCode);
        await addUserToGroup(from, inviteCode);
        // store pending signup session

        updateSession(from, { step: "AWAITING_SIGNUP", inviteCode });

        await showMenu("ADDED_GROUP", from, phoneNumberId, { name });

        return;
    }
    await sendWhatsAppText(
        from,
        "🤖 I didn’t understand that.\nType *menu* to continue.",
        phoneNumberId
    );

}
async function addUserToGroup(phoneid, code) {

    // find group
    const group = await conn.query(
        "SELECT id FROM groups WHERE invite_code = $1",
        [code]
    );

    if (group.rowCount === 0) {
        throw new Error("Group not found");
    }

    const groupId = group.rows[0].id;

    // insert membership
    await conn.query(
        "INSERT INTO user_groups (user_phoneid, group_id) VALUES ($1, $2)",
        [phoneid, groupId]
    );
}
async function handleUnregisteredUser(data) {
    console.log("👤 Unregistered user:", data);

    const from = data.from;
    const name = data.name || "amigo";

    // data.text is already a string in your normalized object
    const text = (data.text || "").trim();

    // ALWAYS guard before using string methods
    const match = text.toUpperCase().match(/AUR-[A-Z0-9]+/);

    if (match) {
        const inviteCode = match[0];

        // store pending signup session
        updateSession(from, { step: "AWAITING_SIGNUP", inviteCode });

        await addUserToGroup(from, inviteCode);

        await showMenu("CREATE_ACCOUNT2", from, data.phoneNumberId, { name });

        return;
    }

    // no invite code → just guide them
    await sendWhatsAppText(
        from,
        `👋 Hola ${name}!

Para usar AUR necesitas crear tu cuenta en la app primero.

Cuando termines el registro, vuelve aquí y te conecto automáticamente.`,
        data.phoneNumberId
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

        const { user, session } = await ensureUserContext(data);

        // 👇 GLOBAL ENTRY LOGIC
        if (!user) {
            if (data.type === "interactive") {

                const action = data.interactive?.button_reply?.id;
                console.log("👉 Interactive from unregistered user. Action:", action);
                if (!action) return;

                // detect confirmation button
                if (action.startsWith("confirm_")) {
                    const phone = action.replace("confirm_", "");

                    try {
                        await conn.query(
                            `UPDATE contactsx
             SET verified = true,
                 verified_at = NOW()
             WHERE contact_value = $1`,
                            [phone]
                        );

                        console.log("✅ WhatsApp verified:", phone);

                        await sendWhatsAppText(
                            data.from,
                            "✅ Número confirmado. Puedes volver a la app.",
                            data.phoneNumberId
                        );

                    } catch (error) {
                        console.error("Verification error:", error);
                    }

                    return;
                }

            }
            await handleUnregisteredUser(data, session);
            return res.sendStatus(200);
        }

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
        updateSession(from, {
            to: parsed.address,
            amount: parsed.amount,
        });

    } catch (err) {
        console.error(err);
        await sendWhatsAppText(from, "❌ Error processing voice message.");
    } finally {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
}
function updateSession(from, data) {
    sessions[from] = {
        ...(sessions[from] || {}),
        ...data,
    };
}


function extractJson(text) {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? match[0] : null;
}
async function ensureUserContext(data) {
    const { from, name, phoneNumberId } = data;

    const user = await getUser(from);
    console.log("🔍 User lookup:", user);
    // create session if not exists
    if (!sessions[from]) {
        sessions[from] = {
            phone: from,
            name,
            address: user?.address || null,
            tokennotification: user?.tokennotification || null,
            registered: !!user,
            step: null,
        };
        console.log("👤 New session created:", sessions[from]);
    } else {
        sessions[from].registered = !!user;
    }

    return { user, session: sessions[from] };
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
async function getUser(phoneid) {
    const query = `
        SELECT phoneid, address, tokennotification
        FROM usuarios
        WHERE phoneid = $1
        LIMIT 1;
    `;

    const res = await conn.query(query, [phoneid]);
    return res.rows[0] || null;
}
import crypto from "crypto";

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashOTP(code) {
    return crypto.createHash("sha256").update(code).digest("hex");
}
async function sendWhatsAppConfirm(to, phoneNumberId) {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

    const payload = {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
            type: "button",
            body: {
                text: "Confirma tu número para continuar en AUR"
            },
            action: {
                buttons: [
                    {
                        type: "reply",
                        reply: {
                            id: `confirm_${to}`,
                            title: "✅ Confirmar"
                        }
                    }
                ]
            }
        }
    };

    await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });
}
app.post("/request-verification", async (req, res) => {
    const { contact } = req.body;

    if (!contact) {
        return res.status(400).json({ error: "phone required" });
    }

    try {
        await conn.query(
            `INSERT INTO contactsx (contact_value, verified)
             VALUES ($1, false)
             ON CONFLICT (contact_value)
             DO UPDATE SET verified = false`,
            [contact]
        );

        await sendWhatsAppConfirm(contact, process.env.WHATSAPP_PHONE_ID);

        res.json({ message: "Verification sent" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
});
app.post("/check-verification", async (req, res) => {
    const { contact } = req.body;

    if (!contact) {
        return res.status(400).json({ error: "contact required" });
    }

    try {
        const result = await conn.query(
            "SELECT verified FROM contactsx WHERE contact_value = $1",
            [contact]
        );

        if (result.rows.length === 0) {
            return res.json({ verified: false });
        }

        res.json({ verified: result.rows[0].verified });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
});
app.post("/usuarios", async (req, res) => {
    const { phoneid, address, tokennotification } = req.body;

    if (!phoneid || !address) {
        return res.status(400).json({ error: "phoneid and address required" });
    }

    try {
        const query = `
      INSERT INTO usuarios (phoneid, address, tokennotification)
      VALUES ($1, $2, $3)
      ON CONFLICT (phoneid)
      DO UPDATE SET
        address = EXCLUDED.address,
        tokennotification = EXCLUDED.tokennotification
      RETURNING *;
    `;

        const values = [phoneid, address, tokennotification];

        const result = await conn.query(query, values);

        res.json({
            success: true,
            user: result.rows[0]
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "database error" });
    }
});
app.post("/confirm-creation", async (req, res) => {
    console.log("Received creation confirmation:", req.body);
    const { txHash, multisigAddress, success } = req.body;
    const session = usersCreation[multisigAddress];
    /**        usersCreation[fresh.publicKey()] = {
                groupId,
                freshPublic: fresh.publicKey(),
                freshSecret: fresh.secret(),          // ← lives only here
                creationXdr: xdr,
                startedAt: Date.now(),
                status: 'WAITING_CREATION_SIGNATURE',
                publicKeys: signerPublicKeys,
                threshold,
            }; */
    if (!txHash || !multisigAddress) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    // Security: must come from active session flow
    if (!session.groupId) {
        return res.status(403).json({ error: "No active activation flow or session expired" });
    }


    // Timeout protection (max 3 min)
    if (Date.now() - session.startedAt > 180_000) {
        usersCreation[multisigAddress] = null; // cleanup
        return res.status(410).json({ error: "Activation flow expired" });
    }

    if (!success) {
        usersCreation[multisigAddress] = null; // cleanup
        return res.status(400).json({ error: "Creation failed in wallet" });
    }

    try {
        // 1. Verify tx on chain (fast check)
        const txRecord = await server.transactions()
            .transaction(txHash)
            .call();
        if (!txRecord.successful) {
            throw new Error("Transaction not successful");
        }

        // 2. Confirm address matches what we expected
        if (multisigAddress !== session.freshPublic) {
            throw new Error("Multisig address mismatch");
        }


        // 4. Build & sign config tx RIGHT NOW (add signers + thresholds)
        const signers = session.publicKeys; // your DB query
        const threshold = Math.ceil(signers.length * 0.67) || 2;

        const multisigAccount = await server.loadAccount(multisigAddress);

        const configBuilder = new TransactionBuilder(multisigAccount, {
            fee: BASE_FEE,
            networkPassphrase: Networks.TESTNET,
        });

        signers.forEach(key => {
            configBuilder.addOperation(Operation.setOptions({
                signer: { ed25519PublicKey: key, weight: 1 }
            }));
        });

        configBuilder.addOperation(Operation.setOptions({
            masterWeight: 0,
            lowThreshold: threshold,
            medThreshold: threshold,
            highThreshold: threshold,
        }));

        const configTx = configBuilder.setTimeout(3600).build();

        // Sign with fresh (we still have it in session!)
        const freshKp = Keypair.fromSecret(session.freshSecret);
        configTx.sign(freshKp);

        // 3. Save confirmed address in DB (public only!)


        await server.submitTransaction(configTx);
        await conn.query(`
            UPDATE groups
            SET multisig_address = $2,
                    is_active     = true,
        activated_at  = NOW()
            WHERE id = $1
        `, [session.groupId, multisigAddress]);
        // 6. CLEANUP – delete secrets immediately
        delete usersCreation[multisigAddress];

        // 7. Response to signing app
        res.json({
            success: true,
            message: "Cuenta creada. Configuración multisig lista para firmar por los miembros.",
        });

    } catch (err) {
        console.error(err);
        delete usersCreation[multisigAddress]; // cleanup on error too
        res.status(500).json({ success: false, error: err.message });
    }
});


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
function normalizeStellarAddress(input) {
    if (!input) return null;

    const cleaned = input
        .trim()
        .replace(/\s+/g, "") // remove hidden spaces/newlines
        .toUpperCase();

    if (!StrKey.isValidEd25519PublicKey(cleaned)) {
        console.warn("Invalid Stellar address:", input, "→ cleaned:", cleaned, "len:", cleaned.length);
        return null;
    }

    return cleaned;
}
async function Buildtransaction(address, destinationPublicKey, amount, tokennotification) {
    try {
        console.log("Building transaction:", { address, destinationPublicKey, amount });
        const account = await server.loadAccount(address);

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
            .setTimeout(3600)
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

        const txRow = response.rows[0];

        const payload = {
            id: txRow.id,
            status: txRow.status,
            date_created: txRow.created_at,
            xdr,
            network: "TESTNET",
        };

        await sendTestPush(tokennotification, payload);

        console.log("INSERT stellar_transactions (XDR only)");

    } catch (error) {
        console.error("Database error:", error);
    }

}


async function sendTestPush(expoPushToken, solicitudData) {
    await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            to: expoPushToken,
            title: "Solicitud",
            body: "Solicitud generada desde el bot",
            sound: "default",
            data: {
                screen: "/(tabs)/detalleSolicitud",
                params: {
                    data: JSON.stringify(solicitudData),
                }
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

