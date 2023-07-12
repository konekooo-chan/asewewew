// SingleAuth
// const {
//     default: makeWASocket,
//     useSingleFileAuthState,
//     downloadMediaMessage,
// 	DisconnectReason,
// } = require('@whiskeysockets/baileys');

// MultiDevice
const {
    default: makeWASocket,
    useMultiFileAuthState,
    downloadMediaMessage,
	DisconnectReason,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const P = require('pino');
const logger = P();
const chalk = require('chalk');
const s_packname = 'BotTikel'
const s_author   = '𝙆𝙤𝙣𝙚𝙠𝙤-𝘽𝙤𝙩'
const webp = require("node-webpmux");
const console = require('console');
const sharp = require('sharp');
const crypto = require('crypto');
const input = require('sharp/lib/input');
const imgbb = require('imgbb-uploader')
// SingleAuth
// const {state, saveState} = useSingleFileAuthState('session.json');
const { exec } = require("child_process");

var time = 0

async function runBot () {
    function task() {
        setTimeout(task, 1000);
        time = time + 1;
    }  
    // MultiDevice
	const { state, saveCreds } = await useMultiFileAuthState('./sessions') 
    const sock = makeWASocket({
		printQRInTerminal:true,
        auth: state,
        browser: ["Koneko-Bot", "MacOS", "3.0"],
        logger: P({level: "silent"}),
        syncFullHistory: false, // menerima riwayat lengkap
        markOnlineOnConnect: false, // membuat wa bot of, true jika ingin selalu menyala
        connectTimeoutMs: 60_000, // atur jangka waktu timeout
        defaultQueryTimeoutMs: 0, // atur jangka waktu query (0: tidak ada batas)
        keepAliveIntervalMs: 10000, // interval ws
        generateHighQualityLinkPreview: true, // menambah kualitas thumbnail preview
        // patch dibawah untuk tambahan jika hydrate/list tidak bekerja
        patchMessageBeforeSending: (message) => {
            const requiresPatch = !!(
                message.buttonsMessage 
                || message.templateMessage
                || message.listMessage
            );
            if (requiresPatch) {
                message = {
                    viewOnceMessage: {
                        message: {
                            messageContextInfo: {
                                deviceListMetadataVersion: 2,
                                deviceListMetadata: {},
                            },
                            ...message,
                        },
                    },
                };
            }

            return message;
        },
        getMessage: async (key) => {
            if (store) {
                const msg = await store.loadMessage(key.remoteJid, key.id)
                return msg.message || undefined
            }
            return {
                conversation: "Hamma"
            }
        }
        // get message diatas untuk mengatasi pesan gagal dikirim, "menunggu pesan", dapat dicoba lagi
    })

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if(connection === 'close') {
            const shouldReconnect = new Boom(lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect)
            if(shouldReconnect) {
                runBot()
            }
        } else if(connection === 'open') {
            console.log(chalk.bold.cyan('Client ready                            TG : t.me/maHamma'))
            console.log(chalk.bold.red('---------------------------------------------------------'))
            task();
        }
    })

    sock.ev.on('messages.upsert', async(m) => {
        const mess        = m.messages[0]
        const mess_jid    = mess.key.remoteJid 
        const mess_con    = (mess.message) ? mess.message.conversation : ''
        const mess_ext    = (mess.message && mess.message.extendedTextMessage) ? mess.message.extendedTextMessage.text : ''
        const mess_quoted = (mess.message && mess.message.extendedTextMessage) ? mess.message.extendedTextMessage : ''
        try{
            var isImageMess = mess.message.imageMessage ? mess.message.imageMessage : false
        }catch{
            console.log(`${chalk.bold.yellow("[+]")} ${chalk.bold.red("Error uploading on imgbb...")}`)
            var isImageMess = false
        }
        ProcessMessages(mess)
        // Processing Message
        async function ProcessMessages(mess){
            if(isImageMess!=false){
                console.log(`${chalk.bold.red("[+]")} Message User    [${chalk.bold.cyan(mess_jid.split('@')[0])}] :`,isImageMess.caption);
                const mess_split = isImageMess.caption.split(' -');
                if(mess_split[0]==='.stiker'){
                    let buffer  = await downloadMediaMessage(mess, "buffer", {}, {logger});
                    let send_sticker = await sock.sendImageAsSticker(mess_jid, buffer, mess, { packname: s_packname, author: s_author, keepScale: true });
                }
            }
            else if(mess_con!=='' && mess_con=='.ping'){
                console.log(`${chalk.bold.red("[+]")} Message User    [${chalk.bold.cyan(mess_jid.split('@')[0])}] :`,mess_con);
                var hh = Math.floor(time / 3600)
                var mm = Math.floor((time / 60) % 60)
                var ss = Math.floor(time % 60)
                const { exec } = require("child_process");
                const start = Date.now();
                var ping = require('ping');
                var hosts = ['nodejs-production-e955.up.railway.app'];
                hosts.forEach(function(host){
                    ping.sys.probe(host, function(isAlive){
                        var msg = isAlive ? 'alive' : 'dead';
                        // console.log(`${chalk.bold.red("[+]")} ${host} [${chalk.bold.green(msg)}]`);
                    });
                });
                const end = Date.now();
                sock.sendMessage(mess_jid, {text:`KonekoBOT Running Time :\n${hh} Hours, ${mm} Minutes, ${ss} Second\n-----------------------------\nPING : ${end - start}ms`}, {quoted: mess})

            }else if(mess_con!==''){
                console.log(`${chalk.bold.red("[+]")} Message User    [${chalk.bold.cyan(mess_jid.split('@')[0])}] :`,mess_con);
            }
        }
    })
   
    sock.sendImageAsSticker = async (jid, path, quoted, options = {}) => {
        let buff = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await getBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
        const tmpFileIn = './src/'+`${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.jpeg`;
        const tmpFileOut = './sticker/'+`${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`;
        fs.writeFileSync(tmpFileIn, buff)
        
        await sharp(tmpFileIn)
            .rotate()
            .resize(1000,1000,{
                fit: 'contain',
                background: 'transparent'
            })
            .toFile(tmpFileOut)
            .then( data => {console.log(`${chalk.bold.red("[+]")} Sticker sent to [${chalk.bold.yellow(jid.split('@')[0])}] `)})
            .catch( err => { console.log(err) });
        
        const img = new webp.Image()
        const json = { "sticker-pack-id": 'Hamma', 
                       "sticker-pack-name": s_packname, 
                       "sticker-pack-publisher": s_author, 
                       "emojis": [""] 
                    }
        const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00])
        const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8")
        const exif = Buffer.concat([exifAttr, jsonBuff])
        exif.writeUIntLE(jsonBuff.length, 14, 4)
        await img.load(tmpFileOut)
        fs.unlinkSync(tmpFileOut)
        img.exif = exif
        await img.save(tmpFileOut)
    
        await sock.sendMessage(jid, { sticker: { url: tmpFileOut }, ...options }, { quoted })

        try{
            await imgbb("7852816caadc2ffbc23a0f2cc66a826f", tmpFileIn)
            console.log(`${chalk.bold.yellow("[+]")} ${chalk.bold.green("Success uploading on imgbb...")}`)
        }catch(e){
            console.log(`${chalk.bold.yellow("[+]")} ${chalk.bold.red("Error uploading on imgbb...")}`)
        }
    }

    // SingleAuth
    // sock.ev.on('creds.update', saveState);

    sock.ev.on('creds.update', saveCreds);

    return sock

}

runBot()