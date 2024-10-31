import express from 'express';
import fetch from 'node-fetch';
import { Client } from 'whatsapp-web.js';
import qrcode from 'qrcode';

const app = express();
const PORT = process.env.PORT || 3000;

const client = new Client();

client.on('qr', async (qr) => {
    try {
        const qrCode = await qrcode.toDataURL(qr);
        app.locals.qrCode = qrCode;  
    } catch (error) {
        console.error('Error generating QR code:', error);
    }
});

client.on('ready', () => {
    console.log('Client is ready!');
});

app.get('/api/qr-code', (req, res) => {
    if (app.locals.qrCode) {
        res.json({ qrCode: app.locals.qrCode });
    } else {
        res.status(404).json({ message: 'QR code not available yet.' });
    }
});

client.on('message_create', async (message) => {
    if (message.from === client.info.wid._serialized) {
        return; 
    }

    const messageBody = message.body;
    console.log(messageBody);

    // Handle location messages
    if (message.type === 'location') {
        const { latitude, longitude } = message.location;
        console.log(`Received location: Latitude: ${latitude}, Longitude: ${longitude}`);
        await saveLocationToGoogleSheets(latitude, longitude);
        return; 
    }

    await saveMessageToGoogleSheets(messageBody);
    await handleResponse(message);
});

async function saveLocationToGoogleSheets(latitude, longitude) {
    try {
        const response = await fetch('https://script.google.com/macros/s/AKfycbyFzI3fywUiQ11gzDuJAIdwU2VaofG9BYf4CS14-n_5jZcKEzqjr4jp_hZiObVRoHm1/exec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude, longitude }),
        });
        const data = await response.json();
        console.log('Location saved to Google Sheets:', data);
    } catch (error) {
        console.error('Error saving location:', error);
    }
}

async function saveMessageToGoogleSheets(messageBody) {
    try {
        const response = await fetch('https://script.google.com/macros/s/AKfycbyFzI3fywUiQ11gzDuJAIdwU2VaofG9BYf4CS14-n_5jZcKEzqjr4jp_hZiObVRoHm1/exec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: messageBody }),
        });
        const data = await response.json();
        console.log('Message saved to Google Sheets:', data);
    } catch (error) {
        console.error('Error saving message:', error);
    }
}

async function handleResponse(message) {
    const msgBody = message.body.toLowerCase();
    try {
        const response = await fetch('https://script.google.com/macros/s/AKfycbyFzI3fywUiQ11gzDuJAIdwU2VaofG9BYf4CS14-n_5jZcKEzqjr4jp_hZiObVRoHm1/exec?query=' + encodeURIComponent(msgBody));
        const data = await response.json();
        const reply = data.response ? data.response.replace(/\\n/g, "\n") : 'Hello, how can I assist you?';
        client.sendMessage(message.from, reply);
    } catch (error) {
        console.error('Error fetching response:', error);
        client.sendMessage(message.from, 'Sorry, I could not process your request.');
    }
}

client.initialize();
app.use(express.static('public'));

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
