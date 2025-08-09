const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidNormalize,
} = require("baileys");
const QRCode = require("qrcode");
const Pino = require("pino");

const logger = Pino({ level: "info" });

async function connect(retry = 0) {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger,
    auth: state,
    printQRInTerminal: false,
    browser: ["Ubuntu", "Chrome", "22.04.4"],
    syncFullHistory: false,
    keepAliveIntervalMs: 30_000,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log(await QRCode.toString(qr, { type: "terminal", small: true }));
    }

    if (connection === "open") {
      console.log("✅ Conexión abierta!");
    }

    if (connection === "close") {
      const statusCode =
        lastDisconnect?.error?.output?.statusCode ??
        lastDisconnect?.error?.cause?.output?.statusCode;

      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(
        "⚠️ Conexión cerrada. status:",
        statusCode,
        "shouldReconnect:",
        shouldReconnect
      );

      if (shouldReconnect) {
        const delay = Math.min(30_000, 2_000 * Math.pow(2, retry)); // backoff simple
        setTimeout(() => connect(retry + 1).catch(console.error), delay);
      } else {
        console.log(
          "🛑 Sesión cerrada (logged out). Borra credenciales y vuelve a escanear."
        );
      }
    }
  });

  sock.ev.on("messages.upsert", async (e) => {
    // Ignora tipos que no son notificación de nuevos mensajes
    if (e.type !== "notify") return;

    for (const m of e.messages) {
      try {
        // Guards básicos
        if (!m || m.key?.fromMe) continue;

        const idRaw = m.key?.remoteJid;
        if (!idRaw) continue;

        const id = jidNormalize ? jidNormalize(idRaw) : idRaw;

        // Ignorar grupos y broadcasts
        if (id.endsWith("@g.us") || id.includes("@broadcast")) continue;

        // Ignora mensajes sin contenido
        const msg = m.message;
        if (!msg) continue;

        // Ejemplo: saca texto si existe
        const text =
          msg.conversation ||
          msg.extendedTextMessage?.text ||
          msg.imageMessage?.caption ||
          msg.videoMessage?.caption ||
          "";

        // Respuesta simple de prueba
        await sock.sendMessage(id, {
          text: text ? `Recibido: ${text}` : "jajaja",
        });
      } catch (err) {
        console.error("Error procesando mensaje:", err);
        continue;
      }
    }
  });

  return sock;
}

connect().catch((e) => {
  console.error("Fallo al conectar:", e);
});
