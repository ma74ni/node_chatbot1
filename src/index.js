const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require("baileys");
const QRCode = require("qrcode");
const Pino = require("pino");

const logger = Pino({ level: "info" });

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
  const { version } = await fetchLatestBaileysVersion(); // evita fallar por versión

  const sock = makeWASocket({
    version,
    logger,
    auth: state,
    printQRInTerminal: false, // lo imprimimos con qrcode
    browser: ["Ubuntu", "Chrome", "22.04.4"], // opcional
    syncFullHistory: false,
    keepAliveIntervalMs: 30000,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // QR en terminal
      console.log(await QRCode.toString(qr, { type: "terminal" }));
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
        // reconectar realmente (¡aquí estaba el bug!)
        setTimeout(() => connect().catch(console.error), 2000);
      } else {
        console.log(
          "🛑 Sesión cerrada (logged out). Borra credenciales y vuelve a escanear."
        );
      }
    }
  });

  // (opcional) requerido en algunas versiones si usas mensajes guardados
  sock.ev.on("messages.upsert", () => {});
}

connect().catch((e) => {
  console.error("Fallo al conectar:", e);
});
