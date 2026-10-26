// Makes the QR code for the stickers.
//   npm run qr                  -> stickers/qr.svg pointing at artwillsave.com/r
//   npm run qr -- playa01       -> stickers/qr-playa01.svg pointing at artwillsave.com/r?b=playa01
// The batch code lets you tell sticker drops apart later if you add analytics.
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const batch = process.argv[2];
const url = 'https://artwillsave.com/r' + (batch ? `?b=${encodeURIComponent(batch)}` : '');
const out = path.join(__dirname, '..', 'stickers', batch ? `qr-${batch}.svg` : 'qr.svg');

// High error correction so a scuffed or rained-on sticker still scans.
QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'H', margin: 0, color: { dark: '#1C2236', light: '#FFFFFF' } })
  .then((svg) => { fs.writeFileSync(out, svg); console.log(`${url}\n-> ${out}`); });
