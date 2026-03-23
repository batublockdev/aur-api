import {
    Account,
    Asset,
    Operation,
    TransactionBuilder,
    Networks,
    Transaction,
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
    "https://horizon.stellar.org",
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

    let amountusdc;
    let amountxlm;
    console.log("Fetching balance for address:", address);
    const account = await server.loadAccount(address);
    const assetUsdcBalance = account.balances.find(
        (b) => b.asset_code === USDCasset.getCode() && b.asset_issuer === USDCasset.getIssuer()
    );
    const xlmBalance = account.balances.find(
        (b) => b.asset_type === "native"
    );
    console.log("XLM balance:", xlmBalance?.balance);
    if (xlmBalance) {
        amountxlm = xlmBalance?.balance;
    }
    if (assetUsdcBalance) {
        console.log(`${USDCasset.getCode()} balance: ${assetUsdcBalance.balance}`);
        amountusdc = assetUsdcBalance.balance;
    } else {
        console.log(`No ${USDCasset.getCode()} balance found`);
    }
    return { amountxlm, amountusdc }




};
const USDCasset = new Asset("USDC", "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN");
let sessions = {};
let usersCreation = {};
let usersTransactions = {};
let pendingGroupAdd = {};

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

💵 {amountxlm}
💵 {amountusdc}

¿Qué quieres hacer con tu dinero?`,
        buttons: [
            { id: "MAIN_MONEY", title: "💰 Mi platica" },
            { id: "MAIN_GROUPS", title: "👥 Mis grupos" },
            { id: "MAIN_HELP", title: "ℹ️ Ayuda" },
        ],
    },
};

MENUS.SWAP = {

    text:
        `💱 Convertir dinero

¿Qué deseas hacer?`,
    buttons: [
        { id: "SWAP_XLM_USDC", title: "🔄 XLM → USDC" },
        { id: "SWAP_USDC_XLM", title: "🔄 USDC → XLM" },
        { id: "SWAP_BACK", title: "🔙 Volver" },
    ],

};

MENUS.CREATED_GROUP = {
    text: `¡Éxito! El grupo *{name}* ya está activo 🎉

Cuenta multi-firma creada:
{to}

Se requieren **{threshold} de {members}** firmas para mover fondos.

¿Qué quieres hacer ahora?`,
    buttons: [
        // { id: `GROUP_DETAIL_{groupid}`, title: "detalles grupo" },
        { id: "GROUPS_HOME", title: "⬅️ Volver " }
    ]
},
    MENUS.SOLICITUD = {
        text:
            `*📊 Grupo: {groupName}*

¿Qué quieres hacer?`,
        buttons: [
            { id: "CREATE_GASTO", title: "💸 Proponer gasto" },
            { id: "CREATE_LOAN", title: "💰 Solicitar préstamo" },
            { id: "REQUESTS", title: "📄 Ver solicitudes" },

        ],
    },
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
MENUS.TRANSACTION_CONFIRMED_GROUP_TX_BUTTON = {
    text: `¡Pago confirmado en el grupo! ✅💸

Transacción exitosa en la red Stellar.

Detalles aquí:
🔗 https://stellar.expert/explorer/public/tx/{hash}

Gracias por tu aporte en *{groupName}* 🙌
¡Vamos por más! 🔥`,
    buttons: [
        {
            id: "MENU_BACK",
            title: "⬅️ Volver",
        },
    ],

};
MENUS.TRANSACTION_CONFIRMED_PRIVATE = {
    text: `¡Transacción confirmada! ✅👍

Se realizó exitosamente en la red Stellar.

Puedes ver todos los detalles aquí:
🔗 https://stellar.expert/explorer/public/tx/{hash}
¡Gracias por usar el servicio! 🚀`,
    buttons: [
        {
            id: "MENU_BACK",
            title: "⬅️ Volver",
        },
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

💵 xlm {amountxlm}
💵 usdc {amountusdc}

¿Qué quieres hacer?

**Escribe menu para volver**`,
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
            id: "SWAP_MENU",
            title: "🔄 USDC → XLM",
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
            { id: `GROUP_PROPOSE_EXPENSE`, title: "📝 Solicitudes" },
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
    let group = {};

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
        case "CREATE_GASTO":

            group = session.groupsCache.find(g => g.id === session.groupId);
            updateSession(from, {
                step: "WAITING_EXPENSE_TARGET",
                groupMembers: group.members,
            });
            console.log("Grupo members:", group.members);
            await sendWhatsAppText(
                from,
                `💸 Proponer un gasto al grupo

El grupo deberá aprobar el envío antes de que se ejecute`, phoneNumberId);
            await sendWhatsAppText(
                from,
                `👥 ¿A quién quieres enviar el dinero?

${group.members.map((member, index) => `${index + 1}️⃣ ${member.phoneid}`).join('\n')}

Escribe el número del miembro.

O pega la dirección Stellar si el destinatario no está en la lista`, phoneNumberId);
            break;
        case "CREATE_LOAN":
            updateSession(from, {
                step: "RECEIVE_CREATE_LOAN"
            });
            await sendWhatsAppText(
                from,
                `💰  ¿Cuánto deseas pedir prestado?`, phoneNumberId);
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
            await sendWhatsAppText(from, "⏳ Actualizando tu saldo...", phoneNumberId);
            const { amountxlm, amountusdc } = await UserBalance(session.address);
            await showMenu("MY_MONEY", from, phoneNumberId, { name, amountusdc, amountxlm });
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
        case "GROUP_PROPOSE_EXPENSE":
            group = session.groupsCache.find(g => g.id === session.groupId);
            await showMenu("SOLICITUD", from, phoneNumberId, { groupName: group.name });
            break;
        case "GROUP_ACTIVATE":
            await sendWhatsAppText(
                from,
                `Accepta la solicitu enviada`,
                phoneNumberId
            );
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
        case "SWAP_MENU":
            console.log("swap manu");
            await showMenu("SWAP", from, phoneNumberId);
            break;
        case "SWAP_XLM_USDC":
            await sendWhatsAppText(
                from,
                "💱 Convertir XLM a USDC \n ¿Cuánto XLM quieres convertir? \n Ejemplo: 50",
                phoneNumberId
            );
            updateSession(from, {
                step: "SWAP_WAITING_AMOUNT",
                swapFrom: "XLM",
                swapTo: "USDC"
            });
            break;
        case "SWAP_USDC_XLM_":
            await sendWhatsAppText(
                from,
                "💱 Convertir USDC a XLM   \n ¿Cuánto USDC quieres convertir? \n Ejemplo: 50",
                phoneNumberId
            );
            updateSession(from, {
                step: "SWAP_WAITING_AMOUNT",
                swapFrom: "USDC",
                swapTo: "XLM"
            });
            break;
        case "GROUP_CONTRIBUTE":
            //const balance = await UserBalance(session.address);
            group = session.groupsCache.find(g => g.id === session.groupId);

            if (!group) {
                console.log("Grupo no encontrado en cache");
                return;
            }

            console.log("Grupo activo:", group);
            updateSession(from, {
                to: group.multisig_address,
                amount: group.group_amount,
            });

            await sendMenu({
                to: from,
                phoneNumberId,
                text: `📤 Confirmar envío

Destino:
${group.multisig_address}

Monto:
${group.group_amount} USDC

¿Confirmas la transacción?`,
                buttons: [
                    { id: "CONFIRM_VOICE_SEND", title: "✅ Confirmar" },
                    { id: "CANCEL_VOICE_SEND", title: "❌ Cancelar" },
                ],
            });
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
            if (!session.to || !session.amount) {
                await sendWhatsAppText(from, "⚠️ Transacion sin informacion.", phoneNumberId);
                return;
            }
            if (session.multisigTransaction) {
                group = session.groupsCache.find(g => g.id === session.groupId);
                usersTransactions[group.multisig_address] = {
                    token: session.tokennotification,
                    to: session.to,
                    amount: session.amount,
                    phone: from,
                    name: session.name,
                    date: new Date(),
                };

                await sendWhatsAppText(from, "⏳ Creando transacción...", phoneNumberId);
                await Buildtransaction(group.multisig_address, session.to, session.amount.toString(), session.tokennotification, session);
                await sendWhatsAppText(
                    from,
                    "📲 Los miembros deben confirmar la transacción en la aplicación.",
                    phoneNumberId
                );
            } else {

                usersTransactions[session.address] = {
                    token: session.tokennotification,
                    to: session.to,
                    amount: session.amount,
                    phone: from,
                    name: session.name,
                    date: new Date(),
                };
                console.log("✅ Confirming voice transaction:", session);

                await sendWhatsAppText(from, "⏳ Creando transacción...", phoneNumberId);
                await Buildtransaction(session.address, session.to, session.amount.toString(), session.tokennotification, session);

                await sendWhatsAppText(
                    from,
                    "📲 Confirma la transacción en tu aplicación.",
                    phoneNumberId
                );
            }
            break;
        case "SWAP_CONFIRM_YES":
            await sendWhatsAppText(from, "⏳ Creando transacción...", phoneNumberId);
            await BuildtransactionSWAP(session.address, session.swapAmount.toString(), session.destMin, session.path, session.tokennotification, session);

            await sendWhatsAppText(
                from,
                "📲 Confirma la transacción en tu aplicación.",
                phoneNumberId
            );
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
            memberCount,
            selectedGroup.name,
            to,
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
    g.multisig_address,
    
    ug.joined_at AS my_joined_at,
    
    -- All members with their user info
    (
    SELECT json_agg(
        json_build_object(
            'phoneid', u.phoneid,
            'address', COALESCE(sa.public_addr, u.address),
            'tokennotification', u.tokennotification,
            'joined_at', ug2.joined_at
        )
        ORDER BY ug2.joined_at DESC
    )
    FROM user_groups ug2
    JOIN usuarios u ON u.phoneid = ug2.user_phoneid
    LEFT JOIN secondary_accounts sa 
        ON sa.phone::text = u.phoneid::text
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
    memeberCount,
    name,
    to,
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
            networkPassphrase: Networks.PUBLIC,
        });

        // 1️⃣ create account
        builder.addOperation(
            Operation.createAccount({
                destination: fresh.publicKey(),
                startingBalance: "5",
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
    network,
    from_phone
  )
  VALUES (
    gen_random_uuid(),
    $1,
    'PENDING',
    'PUBLIC',
    $2
  )
  RETURNING id, status, created_at;
`;


        const values = [xdr, tokennotification];
        const response = await conn.query(query, values);
        const txRow = response.rows[0];

        const payload = {
            id: txRow.id,
            status: txRow.status,
            date_created: txRow.created_at,
            xdr,
            network: "PUBLIC",
        };
        console.log(tokennotification)
        await sendTestPush(tokennotification, payload);

        console.log("INSERT stellar_transactions (XDR only)");
        usersCreation[fresh.publicKey()] = {
            memeberCount,
            to,
            name,
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

        await sendWhatsAppText(from, "⏳ Actualizando tu saldo...", phoneNumberId);

        const { amountxlm, amountusdc } = await UserBalance(session?.address);
        await showMenu("ONBOARDING", from, phoneNumberId, { name: session?.name || "Amigo", amountxlm, amountusdc });
        updateSession(from, { step: null }); // reset any ongoing steps
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
    if (session.step === "SWAP_WAITING_AMOUNT") {

        const amount = parseFloat(text);

        if (isNaN(amount) || amount <= 0) {
            await sendWhatsAppText(
                from,
                "⚠️ Escribe un monto válido en XLM.",
                phoneNumberId
            );
            return;
        }

        // aquí obtienes precio del DEX
        const { sendAmount,
            expectedReceive,
            destMin,
            path,
            fullPath } = await getBestPath(amount);

        updateSession(from, {
            step: "SWAP_CONFIRM",
            swapAmount: amount,
            destMin,
            path
        });

        const message = `
📄 Confirmar conversión

Enviar: ${amount} XLM
Recibir aprox: ${destMin} USDC

⚠️ El valor puede variar según el mercado.

¿Deseas continuar?
`;

        await sendMenu({
            to: from,
            phoneNumberId,
            text: message,
            buttons: [
                { id: "SWAP_CONFIRM_YES", title: "✅ Confirmar" },
                { id: "SWAP_CANCEL", title: "❌ Cancelar" }
            ]
        });
    }
    if (session.step === "WAITING_EXPENSE_TARGET") {

        let targetAddress;

        const index = parseInt(text) - 1;

        if (!isNaN(index) && session.groupMembers[index]) {
            targetAddress = session.groupMembers[index].address;
        }
        else if (text.startsWith("G") && text.length > 40) {
            const normalizedAddress = normalizeStellarAddress(text.trim());
            targetAddress = normalizedAddress;
            if (!normalizedAddress) {
                await sendWhatsAppText(
                    from,
                    "⚠️ La dirección no es válida. Verifica y vuelve a intentar.",
                    phoneNumberId
                );
                return;
            }
        }
        else {
            await sendWhatsAppText(
                from,
                "⚠️ Escribe un número válido o pega una dirección Stellar.",
                phoneNumberId
            );
            return;
        }


        updateSession(from, {
            step: "SEND_WAITING_REASON",
            to: targetAddress,
            multisigTransaction: true,
        });
        await sendWhatsAppText(
            from,
            "📝 Escribe el *motivo del gasto*.\n\nEjemplo:\nCompra de balón\nPizza para el grupo",
            phoneNumberId
        );


        return;
    }
    if (session?.step === "SEND_WAITING_REASON") {

        const reason = text.trim();

        if (!reason || reason.length < 3) {
            await sendWhatsAppText(
                from,
                "⚠️ Escribe un motivo válido para el gasto.",
                phoneNumberId
            );
            return;
        }

        updateSession(from, {
            step: "SEND_WAITING_AMOUNT",
            reason: reason
        });

        await sendWhatsAppText(
            from,
            "💰 ¿Cuánto dinero deseas proponer enviar?\n\nEjemplo: 20000",
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

        // Replace comma with dot (for decimal support like 0,5)
        let normalized = raw.replace(",", ".");

        // Remove thousand separators ONLY (dots between digits like 20.000)
        normalized = normalized.replace(/(?<=\d)\.(?=\d{3})/g, "");

        // Final number
        const value = Number(normalized);

        let amount;

        if (!isNaN(value)) {
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


async function getBestPath(sendAmount) {
    try {
        const paths = await server.strictSendPaths(
            Asset.native(), // XLM
            sendAmount,
            [USDCasset]
        ).call();

        if (!paths.records.length) {
            throw new Error("No available paths (no liquidity)");
        }

        // 🔥 Select best path (max destination_amount)
        const best = paths.records.reduce((prev, current) => {
            return parseFloat(current.destination_amount) >
                parseFloat(prev.destination_amount)
                ? current
                : prev;
        });

        // 💰 Expected receive
        const expectedReceive = best.destination_amount;
        console.log(expectedReceive)
        // 🔒 Slippage protection (1%)
        const destMin = (
            parseFloat(expectedReceive) * 0.99
        ).toFixed(7);
        console.log("minimo a recibir: ", destMin);

        return {
            sendAmount,
            expectedReceive,
            destMin,
            path: best.path,
            fullPath: best, // optional (debug/info)
        };
    } catch (err) {
        console.error("Error getting best path:", err);
        throw err;
    }
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

        //await addUserToGroup(from, inviteCode);
        pendingGroupAdd[from] = {
            inviteCode
        }

        await showMenu("CREATE_ACCOUNT2", from, data.phoneNumberId, { name });

        return;
    }

    // no invite code → just guide them
    await showMenu("ONBOARDING2", from, data.phoneNumberId, { name });

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
                if (action.startsWith("VERIFY_PHONE")) {
                    const phone = data.from;

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
                if (action == "ONBOARD_ABOUT" || action == "ABOUT_CREATE_ACCOUNT") {
                    await handleInteractive(data);

                }


            } else {

                await handleUnregisteredUser(data, session);
            }
            return res.sendStatus(200);
        }
        //await addUserToGroup(from, inviteCode);
        /*const inviteCode = pendingGroupAdd[data.from];
        if (!inviteCode) {

        } else {
            await addUserToGroup(data.from, inviteCode);
            pendingGroupAdd[data.from] = {};
            await sendWhatsAppText(
                data.from,
                "✅ Has sido aggregado al grupo",
                data.phoneNumberId
            );
        }*/

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
        if (user != null) {
            if (sessions[from].address != user.address) {
                sessions[from] = {
                    phone: from,
                    name,
                    address: user?.address || null,
                    tokennotification: user?.tokennotification || null,
                    registered: !!user,
                    step: null,
                };
                console.log("👤 New session created:", sessions[from]);
            }
        }

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
import crypto, { hash } from "crypto";

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
                            id: `VERIFY_PHONE`,
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
app.get("/user", async (req, res) => {
    const { tokennotification, phoneid, address } = req.query;

    let queryText = `
SELECT 
    u.name,
    u.phoneid,
    u.address,
    u.tokennotification,
    s.public_addr AS secondary_address,
    s.created_at
FROM usuarios u
LEFT JOIN secondary_accounts s
ON u.phoneid = s.phone
`;

    const values = [];
    const conditions = [];

    if (!tokennotification && !phoneid && !address) {
        return res.status(400).json({
            success: false,
            error: "At least one of tokennotification, phoneid, or address is required"
        });
    }

    if (address) {
        values.push(address);
        const idx = values.length;

        conditions.push(`(u.address = $${idx} OR s.public_addr = $${idx})`);
    }

    if (tokennotification) {
        values.push(tokennotification);
        conditions.push(`u.tokennotification = $${values.length}`);
    }

    if (phoneid) {
        values.push(phoneid);
        conditions.push(`u.phoneid = $${values.length}`);
    }

    if (conditions.length > 0) {
        queryText += ` WHERE ` + conditions.join(" AND ");
    }

    try {
        const result = await conn.query(queryText, values);

        res.status(200).json({
            success: true,
            found: result.rowCount,
            data: result.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});
app.post("/request-verification", async (req, res) => {
    const { contact } = req.body;

    if (!contact) {
        return res.status(400).json({ error: "phone required" });
    }

    try {




        // 3️⃣ If not verified → insert/update
        if (contact == "573045653893") {
            await conn.query(
                `INSERT INTO contactsx (contact_value, verified)
             VALUES ($1, true)
             ON CONFLICT (contact_value)
             DO UPDATE SET verified = true`,
                [contact]
            );
        } else {
            await conn.query(
                `INSERT INTO contactsx (contact_value, verified)
             VALUES ($1, false)
             ON CONFLICT (contact_value)
             DO UPDATE SET verified = false`,
                [contact]
            );
        }



        // 4️⃣ Send WhatsApp verification
        await sendWhatsAppConfirm(contact, process.env.WHATSAPP_PHONE_ID);

        res.json({
            verified: false,
            message: "Verification sent"
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
});

app.post("/secondary-account", async (req, res) => {
    try {

        const { phone, public_addr } = req.body;

        if (!phone || !public_addr) {
            return res.status(400).json({
                error: "phone and public_addr are required"
            });
        }

        const result = await conn.query(
            `INSERT INTO secondary_accounts (phone, public_addr)
 VALUES ($1, $2)
 ON CONFLICT (phone)
 DO UPDATE SET 
     public_addr = EXCLUDED.public_addr,
     created_at = NOW()
 RETURNING phone, public_addr, created_at`,
            [phone, public_addr]
        );

        return res.json({
            success: true,
            account: result.rows[0]
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            error: "Server error"
        });
    }
});

app.post("/check-verification", async (req, res) => {
    const { contact } = req.body;

    if (!contact) {
        return res.status(400).json({ error: "contact required" });
    }

    try {
        const contactResult = await conn.query(
            "SELECT verified FROM contactsx WHERE contact_value = $1",
            [contact]
        );
        console.log("Verification check for", contact, "Result:", contactResult.rows);
        if (contactResult.rows.length === 0) {
            // No record → send confirmation and return not verified
            await sendWhatsAppConfirm(contact, process.env.WHATSAPP_PHONE_ID);
            return res.json({ verified: false });
        }
        const isVerified = contactResult.rows[0].verified;
        // 2. If verified → fetch full user data (same query as in request-verification)
        if (isVerified) {
            const userResult = await conn.query(
                `SELECT 
                    u.phoneid,
                    u.address,
                    u.tokennotification,
                    s.public_addr AS secondary_address,
                    s.created_at AS secondary_created_at
                FROM usuarios u
                LEFT JOIN secondary_accounts s
                ON s.phone = u.phoneid
                WHERE u.phoneid = $1`,
                [contact]
            );

            const user = userResult.rows[0] || null;

            return res.json({
                verified: true,
                user: user
            });
        }
        res.json({ verified: false });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
});
app.post("/usuarios", async (req, res) => {
    const { phoneid, address, tokennotification, name } = req.body;

    if (!phoneid || !address) {
        return res.status(400).json({ error: "phoneid and address required" });
    }

    try {
        const query = `
      INSERT INTO usuarios (phoneid, address, tokennotification, name)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (phoneid)
      DO UPDATE SET
        address = EXCLUDED.address,
        tokennotification = EXCLUDED.tokennotification
      RETURNING *;
    `;

        const values = [phoneid, address, tokennotification, name];

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
    const { txHash, to, from, token, success, id } = req.body;
    const session = usersCreation[to];
    console.log(session);
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
    const name = session.name;
    const toNumber = session.to;
    const members = session.memeberCount;
    const groupid = session.groupId;

    if (!txHash || !to) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    // Security: must come from active session flow
    if (!session.groupId) {
        return res.status(403).json({ error: "No active activation flow or session expired" });
    }


    // Timeout protection (max 3 min)
    if (Date.now() - session.startedAt > 180_000) {
        usersCreation[to] = null; // cleanup
        return res.status(410).json({ error: "Activation flow expired" });
    }

    if (!success) {
        usersCreation[to] = null; // cleanup
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
        if (to !== session.freshPublic) {
            throw new Error("Multisig address mismatch");
        }


        // 4. Build & sign config tx RIGHT NOW (add signers + thresholds)
        const signers = session.publicKeys; // your DB query
        const threshold = Math.ceil(signers.length * 0.67) || 2;
        const multisigAccount = await server.loadAccount(to);

        const configBuilder = new TransactionBuilder(multisigAccount, {
            fee: BASE_FEE,
            networkPassphrase: Networks.PUBLIC,
        });

        signers.forEach(key => {
            configBuilder.addOperation(Operation.setOptions({
                signer: { ed25519PublicKey: key, weight: 1 }
            }));
        });
        if (signers.length == 2) {
            const sourceKeypairAdmin = Keypair.fromSecret(process.env.ADMIN_KEY);
            configBuilder.addOperation(Operation.setOptions({
                signer: { ed25519PublicKey: sourceKeypairAdmin.publicKey(), weight: 1 }
            }));
        }
        configBuilder.addOperation(Operation.changeTrust({ asset: USDCasset }))

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
        `, [session.groupId, to]);
        await conn.query(`
        UPDATE stellar_transactionsx
        SET status     = $1,
            tx_hash    = $2,
            updated_at = NOW()
        WHERE id = $3
    `, ['SUCCESS', txHash, id]);

        // 6. CLEANUP – delete secrets immediately
        await showMenu("CREATED_GROUP", toNumber, PHONE_NUMBER_ID, { name, to: to, threshold: threshold, members });

        delete usersCreation[to];


        // 7. Response to signing app
        console.log("done")
        res.json({
            success: true,
            message: "Cuenta creada. Configuración multisig lista para firmar por los miembros.",
        });

    } catch (err) {
        console.error(err);
        console.log(err.response.data.extras);
        res.status(500).json({ success: false, error: err.message });
    }
});

async function findPendingTransactionForUser(txHash, fromPhone, network = "PUBLIC") {
    const rows = await conn.query(`
SELECT DISTINCT ON (t.id) t.*
FROM (
    -- transactions created by the user
    SELECT *
    FROM stellar_transactionsx
    WHERE  status = 'PENDING' AND from_phone = $1

    UNION ALL

    -- expense group transactions
    SELECT t.*
    FROM stellar_transactionsx t
    JOIN user_groups ug ON ug.group_id = t.group_id
    JOIN usuarios u ON u.phoneid = ug.user_phoneid
    WHERE u.tokennotification = $1

    UNION ALL

    -- recovery transactions
    SELECT t.*
    FROM stellar_transactionsx t
    JOIN recuperation_accountx ra ON ra.group_id = t.group_id
    JOIN usuarios u ON u.phoneid = ra.user_phoneid
    WHERE u.tokennotification = $1

) t
ORDER BY t.id, t.created_at DESC;                                          -- usually 1 or 0 rows
    `, [fromPhone]);

    if (rows.rowCount === 0) return null;

    const networkPassphrase = Networks.PUBLIC;

    for (const row of rows.rows) {
        try {
            const tx = new Transaction(row.xdr, networkPassphrase);

            const computedHash = tx.hash().toString('hex');           // ← usually works perfectly in Node
            console.log(`Comparing hashes for tx ${row.id}: computed ${computedHash} vs provided ${txHash}`);

            if (computedHash === txHash) {
                console.log("Founded")
                return row;
            }
        } catch (e) {
            console.warn(`Bad XDR in tx ${row.id}: ${e.message}`);
        }
    }

    return null;
}
app.post("/confirm-transation", async (req, res) => {
    console.log("Received payment creation:", req.body);
    const { txHash, to, from, token, success } = req.body;
    const match = await findPendingTransactionForUser(txHash, token, "PUBLIC");
    try {
        // 1. Verify tx on chain (fast check)
        const txRecord = await server.transactions()
            .transaction(txHash)
            .call();
        if (match) {
            await conn.query(`
        UPDATE stellar_transactionsx
        SET status     = $1,
            tx_hash    = $2,
            updated_at = NOW()
        WHERE id = $3
    `, [txRecord.successful ? 'SUCCESS' : 'FAILED', txHash, match.id]);

            console.log(`Transaction ${txHash} found in DB with status updated to ${txRecord.successful ? 'SUCCESS' : 'FAILED'}`);

        }

        return res.status(200).json({ ok: true });

    } catch (err) {
        console.error(err);
        delete usersTransactions[from]; // cleanup on error too
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post("/confirm-payment", async (req, res) => {
    console.log("Received payment creation:", req.body);
    const { txHash, to, from, token, success, id } = req.body;
    const session = usersTransactions[from];
    let pago = false;
    let groupName = "";
    /**usersTransactions[session.address] = {
                    to: group.multisig_address,
                    amount: group.group_amount,
                    phone: from,
                    name: session.name,
                    date: new Date(),
                }; */



    if (!success) {
        usersTransactions[from] = null; // cleanup
        await conn.query(`
        UPDATE stellar_transactionsx
        SET status     = $1,
            updated_at = NOW()
        WHERE id = $2
    `, ['REJECTED', id]);

        console.log(`Transaction ${txHash} found in DB with status updated to REJECTED'}`);
        return res.status(200).json({ error: "Se ha rechazado " });
    }
    const match = await findPendingTransactionForUser(txHash, token, "PUBLIC");
    try {
        // 1. Verify tx on chain (fast check)
        const txRecord = await server.transactions()
            .transaction(txHash)
            .call();
        if (match) {
            await conn.query(`
        UPDATE stellar_transactionsx
        SET status     = $1,
            tx_hash    = $2,
            updated_at = NOW()
        WHERE id = $3
    `, [txRecord.successful ? 'SUCCESS' : 'FAILED', txHash, match.id]);

            console.log(`Transaction ${txHash} found in DB with status updated to ${txRecord.successful ? 'SUCCESS' : 'FAILED'}`);

            try {
                console.log("get into try")
                // 1. Load the transaction from Horizon / Stellar server
                const txRecord = await server.transactions()
                    .transaction(txHash)
                    .call();
                console.log("Check hash")


                // Usually we work with the envelope XDR or operations directly
                const opsResponse = await server.operations()
                    .forTransaction(txHash)
                    .call();

                const operations = opsResponse.records || [];
                console.log("Get op")

                if (operations.length === 0) {
                    console.log(`No operations found in tx ${txHash}`);
                    return { success: false, reason: 'no_operations' };
                }
                for (const op of operations) {
                    if (op.type !== 'payment' && op.type !== 'path_payment_strict_send' && op.type !== 'path_payment_strict_receive') {
                        console.log("skip")
                        continue; // skip non-payment ops
                    }

                    const fromAddress = op.source_account || txRecord.source_account; // fallback to tx source if op has no source
                    const toAddress = op.to;
                    const amount = op.amount;           // string in stroops / asset units
                    const asset = op.asset_type === 'native' ? 'XLM' : op.asset_code;

                    // Optional: skip if wrong asset
                    console.log("look for group1")

                    if (asset !== 'USDC' && asset !== 'XLM') continue;
                    console.log("look for group")

                    // 2. Check if destination is a known group multisig address
                    const groupResult = await conn.query(`
                SELECT id AS group_id, 
                       name AS group_name,
                       amount AS expected_amount,
                       created_by
                FROM groups
                WHERE multisig_address = $1
                  AND is_active = true
                LIMIT 1
            `, [toAddress]);
                    console.log("get into try2 ")


                    if (groupResult.rowCount === 0) {
                        console.log(`No active group found for destination ${toAddress}`);
                        if (session) {
                            await showMenu("TRANSACTION_CONFIRMED_PRIVATE", session.phone, PHONE_NUMBER_ID, { groupName, hash: txHash });
                        }
                        continue;
                    }
                    console.log(`Group ${groupResult.rows[0].group_name} found for destination ${toAddress}`);
                    groupName = groupResult.rows[0].group_name;

                    const group = groupResult.rows[0];

                    // 3. Find which user sent this (from usuarios / user_addresses table)
                    const userResult = await conn.query(`
                SELECT phoneid, 
                       address,
                       tokennotification
                FROM usuarios   -- or your table name: user_phoneid | address | tokennotification
                WHERE address = $1
                LIMIT 1
            `, [fromAddress]);

                    if (userResult.rowCount === 0) {
                        console.log(`Unknown sender address: ${fromAddress}`);
                        continue;
                    }
                    console.log(`User with phoneid ${userResult.rows[0].phoneid} found for sender address ${fromAddress}`);
                    const payer = userResult.rows[0];

                    // 4. Decide if this counts as a valid payment
                    //    You can add more rules: exact amount, memo contains invite_code, etc.
                    const isValidAmount = Math.abs(parseFloat(amount) - parseFloat(group.expected_amount)) < 0.01;


                    // 5. Save to payments table
                    const paymentNumber = await generatePaymentNumber(conn, payer.phoneid);

                    await conn.query(`
    INSERT INTO payments 
        (user_phoneid, group_id, payment_number, amount, created_at, tx_hash, status)
    VALUES 
        ($1, $2, $3, $4, NOW(), $5, $6)
    RETURNING id
`, [
                        payer.phoneid,
                        group.group_id,
                        paymentNumber,
                        parseFloat(amount),
                        txHash,
                        isValidAmount ? 'SUCCESS' : 'AMOUNT_MISMATCH'
                    ]);
                    console.log(`Payment record created for user ${payer.phoneid} in group ${group.group_name} with amount ${amount}`);

                    // Optional: send push notification via Expo using payer.tokennotification
                    // await sendPushNotification(payer.tokennotification, `¡Pago registrado en ${group.group_name}!`);

                    // Optional: update group stats, mark round as paid, etc.
                    if (session) {
                        await showMenu("TRANSACTION_CONFIRMED_GROUP_TX_BUTTON", session.phone, PHONE_NUMBER_ID, { groupName, hash: txHash });
                    }
                }


            }
            catch (err) {
                console.error(`Error processing tx ${txHash}:`, err);

                return { success: false, error: err.message };
            }
        } else {
            await conn.query(`
        UPDATE stellar_transactionsx
        SET status     = $1,
            tx_hash    = $2,
            updated_at = NOW()
        WHERE id = $3
    `, [txRecord.successful ? 'SUCCESS' : 'FAILED', txHash, id]);
            console.log("get into try3")

            console.log(`Transaction ${txHash} found in DB with status updated to ${txRecord.successful ? 'SUCCESS' : 'FAILED'}`);

        }


        // 3. Save confirmed address in DB (public only!)
        // 6. CLE+.
        // ANUP – delete secrets immediately
        usersTransactions[from] = {};
        return res.status(200).json({ ok: true });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

async function generatePaymentNumber(conn, userPhoneId) {
    // Find the highest number this user has used this month
    const result = await conn.query(`
        SELECT payment_number
        FROM payments
        WHERE user_phoneid = $1
          AND payment_number LIKE 'PAY-' || TO_CHAR(NOW(), 'YYYYMM') || '-%'
        ORDER BY payment_number DESC
        LIMIT 1
    `, [userPhoneId]);

    let nextSeq = 1;

    if (result.rowCount > 0) {
        const lastNumber = result.rows[0].payment_number;
        // Example: PAY-202603-00042  → extract 00042
        const match = lastNumber.match(/-(\d+)$/);
        if (match) {
            nextSeq = parseInt(match[1], 10) + 1;
        }
    }

    const monthPrefix = new Date().toISOString().slice(0, 7).replace('-', ''); // 202603
    const paddedSeq = String(nextSeq).padStart(5, '0'); // 00001, 00042, etc.

    return `PAY-${monthPrefix}-${paddedSeq}`;
}

app.get("/transactions/:token", async (req, res) => {
    try {

        const { token } = req.params;
        console.log(`Fetching transactions for token: ${token}`);

        const query = `
SELECT DISTINCT ON (t.id) t.*
FROM (
    -- transactions created by the user
    SELECT *
    FROM stellar_transactionsx
    WHERE from_phone = $1

    UNION ALL

    -- expense group transactions
    SELECT t.*
    FROM stellar_transactionsx t
    JOIN user_groups ug ON ug.group_id = t.group_id
    JOIN usuarios u ON u.phoneid = ug.user_phoneid
    WHERE u.tokennotification = $1

    UNION ALL

    -- recovery transactions
    SELECT t.*
    FROM stellar_transactionsx t
    JOIN recuperation_accountx ra ON ra.group_id = t.group_id
    JOIN usuarios u ON u.phoneid = ra.user_phoneid
    WHERE u.tokennotification = $1

) t
ORDER BY t.id, t.created_at DESC;
        `;

        const result = await conn.query(query, [token]);

        res.json({
            success: true,
            transactions: result.rows
        });

    } catch (error) {

        console.error("Error fetching transactions:", error);

        res.status(500).json({
            success: false,
            error: "Database error"
        });

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
async function Buildtransaction(address, destinationPublicKey, amount, tokennotification, session) {
    try {
        console.log("Building transaction:", { address, destinationPublicKey, amount });
        const account = await server.loadAccount(address);

        const tx = new TransactionBuilder(account, {
            fee: BASE_FEE, // stroops
            networkPassphrase: Networks.PUBLIC,
        })
            .addOperation(
                Operation.payment({
                    destination: destinationPublicKey,
                    asset: USDCasset, // XLM
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
    network,
    from_phone,
    group_id,
    concepto
  )
  VALUES (
    gen_random_uuid(),
    $1,
    'PENDING',
    'PUBLIC',
    $2,
    $3,
    $4
  )
  RETURNING id, status, created_at;
`;
        let groupId = null;
        let concepto = "";
        console.log("Session data for transaction:", session);
        if (session?.multisigTransaction) {
            groupId = session.groupId;
            concepto = session.reason;
        }

        const values = [xdr, tokennotification, groupId, concepto];
        const response = await conn.query(query, values);

        const txRow = response.rows[0];

        const payload = {
            id: txRow.id,
            status: txRow.status,
            date_created: txRow.created_at,
            xdr,
            network: "PUBLIC",
        };
        if (session?.multisigTransaction) {
            session.groupMembers.forEach(member => {
                sendTestPush(member.tokennotification, payload);
            });
        } else {
            await sendTestPush(tokennotification, payload);
        }

        console.log("INSERT stellar_transactions (XDR only)");

    } catch (error) {
        console.error("Database error:", error);
    }

}
async function BuildtransactionSWAP(address, sendAmount, destMin, path, tokennotification, session) {
    try {
        console.log("Building transaction:", { address, sendAmount, destMin, path, tokennotification, session });
        const account = await server.loadAccount(address);
        const tx = new TransactionBuilder(account, {
            fee: BASE_FEE, // stroops
            networkPassphrase: Networks.PUBLIC,
        })
            .addOperation(
                Operation.pathPaymentStrictSend({
                    sendAsset: Asset.native(),
                    sendAmount: sendAmount,
                    destination: address,
                    destAsset: USDCasset,
                    destMin: destMin,
                    path: path,
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
    network,
    from_phone,
    group_id,
    concepto
  )
  VALUES (
    gen_random_uuid(),
    $1,
    'PENDING',
    'PUBLIC',
    $2,
    $3,
    $4
  )
  RETURNING id, status, created_at;
`;
        let groupId = null;
        let concepto = "";
        console.log("Session data for transaction:", session);
        if (session?.multisigTransaction) {
            groupId = session.groupId;
            concepto = session.reason;
        }

        const values = [xdr, tokennotification, groupId, concepto];
        const response = await conn.query(query, values);

        const txRow = response.rows[0];

        const payload = {
            id: txRow.id,
            status: txRow.status,
            date_created: txRow.created_at,
            xdr,
            network: "PUBLIC",
        };
        if (session?.multisigTransaction) {
            session.groupMembers.forEach(member => {
                sendTestPush(member.tokennotification, payload);
            });
        } else {
            await sendTestPush(tokennotification, payload);
        }

        console.log("INSERT stellar_transactions (XDR only)");

    } catch (error) {
        console.error("Database error:", error);
    }

}
app.put("/transactions/:id", async (req, res) => {

    const { id } = req.params;
    const { xdr } = req.body;
    console.log(`Updating transaction ${id} with new XDR. XDR length: ${xdr ? xdr.length : 'null'}`);
    const result = await conn.query(
        `UPDATE stellar_transactionsx
         SET
            xdr = COALESCE($1, xdr)
         WHERE id = $2
         RETURNING *`,
        [xdr, id]
    );
    console.log(`Transaction updated: ${id}`);
    res.json(result.rows[0]);
});

app.post('/api/sign-transaction', async (req, res) => {
    console.log("Received request to sign transaction. Body keys:", Object.keys(req.body));
    try {
        const { xdr, network = 'PUBLIC' } = req.body;   // expect base64 XDR

        if (!xdr) {
            return res.status(400).json({ error: 'Missing xdr' });
        }

        const networkPassphrase = network === 'TESTNET'
            ? Networks.TESTNET
            : Networks.PUBLIC;

        // Load the (probably unsigned / partially signed) transaction
        let tx = new Transaction(xdr, networkPassphrase);
        const sourceKeypairAdmin = Keypair.fromSecret(process.env.ADMIN_KEY);
        // Add your signature
        tx.sign(sourceKeypairAdmin);

        // Return the now-signed XDR (base64)
        res.json({
            signed_xdr: tx.toXDR()
        });
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: err.message });
    }
});

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

app.post("/guardian", async (req, res) => {
    const { addresses, xdr, concepto } = req.body;
    console.log(req.body)
    console.log("hit guardian")

    try {


        // 1️⃣ Find users with those addresses
        const users = await conn.query(
            `SELECT phoneid FROM usuarios WHERE address = ANY($1)`,
            [addresses]
        );

        if (users.rows.length === 0) {
            throw new Error("No users found for provided addresses");
        }





        const phoneIds = users.rows.map(u => u.phoneid);

        // 2️⃣ Insert into user_groups
        const result = await conn.query(
            `
            INSERT INTO recuperation_accountx (user_phoneid)
            SELECT phoneid
            FROM usuarios
            WHERE address = ANY($1)
            RETURNING group_id
            `,
            [addresses]
        );
        if (result.rows.length === 0) {
            throw new Error("No users found for provided addresses");
        }

        const group_id = result.rows[0].group_id;
        // 3️⃣ Insert XDR transaction
        await conn.query(
            `
      INSERT INTO stellar_transactionsx
      (id, xdr, status, network, group_id, concepto, from_phone)
      VALUES ( gen_random_uuid(), $1, 'PENDING', 'PUBLIC', $2, $3, $4)
      `,
            [xdr, group_id, concepto, "x"]
        );


        res.json({
            success: true,
            users_added: phoneIds.length,
            group_id
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(3000, () => {
    console.log("🤖 WhatsApp bot running on port 3000");
});

