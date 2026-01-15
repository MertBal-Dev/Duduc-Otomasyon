
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { GoogleFormsBot, BotConfig } from './bot';
import fs from 'fs';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

let botInstance: GoogleFormsBot | null = null;
let logs: string[] = [];

// Logger callback
const logCallback = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    logs.push(`[${timestamp}] ${msg}`);
    if (logs.length > 1000) logs.shift(); // Keep last 1000 logs
};

// API: Start Bot
app.post('/api/start', (req, res) => {
    if (botInstance) {
        return res.status(400).json({ message: 'Bot is already running!' });
    }

    const config: BotConfig = {
        targetUrl: req.body.targetUrl,
        targetCount: parseInt(req.body.targetCount),
        timing: {
            minExecTimeSec: parseInt(req.body.minExecTimeSec),
            maxExecTimeSec: parseInt(req.body.maxExecTimeSec),
            minCooldownMin: parseInt(req.body.minCooldownMin),
            maxCooldownMin: parseInt(req.body.maxCooldownMin)
        },
        proxies: req.body.proxies || [],
        demographics: req.body.demographics || {}
    };

    // Load questions from config.json (demographics structure)
    try {
        const configFile = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
        config.demographics = configFile.questions;
    } catch (e) {
        logCallback(`[WARN] Could not load config.json for questions: ${e}`);
    }

    logs = []; // Clear logs on start
    botInstance = new GoogleFormsBot(config, logCallback);

    // Start asynchronously
    botInstance.start().then(() => {
        botInstance = null;
        logCallback('[SYSTEM] Bot execution finished.');
    }).catch(err => {
        botInstance = null;
        logCallback(`[ERROR] Bot crashed: ${err}`);
    });

    res.json({ message: 'Bot started successfully' });
});

// API: Stop Bot
app.post('/api/stop', (req, res) => {
    if (botInstance) {
        botInstance.stop();
        res.json({ message: 'Stop signal sent to bot' });
    } else {
        res.status(400).json({ message: 'Bot is not running' });
    }
});

// API: Get Status & Logs
app.get('/api/status', (req, res) => {
    res.json({
        isRunning: !!botInstance,
        logs: logs
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
