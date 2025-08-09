const { default: makeWASocket, useMultiFileAuthState } = require("baileys");
const QRCode = require("qrcode");

const connect = async () => {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
  const sock = makeWASocket({
    auth: state,
  });
  sock.ev.on("creds.update", saveCreds);
  //conexion
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log(await QRCode.toString(qr, { type: "terminal" }));
    }
  });
};

connect();
