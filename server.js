const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy so req.ip works correctly behind reverse proxies
app.set('trust proxy', true);

// Middleware
app.use(cors());
app.use(express.json());

// Serve files from the 'shootgeeks' folder as the root directory (so ./styles.css works)
app.use(express.static(path.join(__dirname, 'shootgeeks')));

// Serve the 'src' and 'assets' folders so ../src/ and ../assets/ paths in HTML work
app.use('/src', express.static(path.join(__dirname, 'src')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// --- IP-Based Rate Limiter ---
// Allows a max of 5 messages per 2 minutes per unique IP address
const RATE_LIMIT_MAX = 5;          // max messages
const RATE_LIMIT_WINDOW = 2 * 60 * 1000; // 2 minutes in milliseconds
const ipRequestMap = new Map();    // stores { count, firstRequestTime } per IP

function rateLimiter(req, res, next) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const record = ipRequestMap.get(ip);

    console.log(`[RateLimit] IP: ${ip} | Count: ${record ? record.count : 0}`);

    if (!record || (now - record.firstRequestTime) > RATE_LIMIT_WINDOW) {
        // First request or window has expired — reset
        ipRequestMap.set(ip, { count: 1, firstRequestTime: now });
        return next();
    }

    if (record.count >= RATE_LIMIT_MAX) {
        const retryAfterSeconds = Math.ceil((RATE_LIMIT_WINDOW - (now - record.firstRequestTime)) / 1000);
        console.log(`[RateLimit] BLOCKED IP: ${ip} | Retry after: ${retryAfterSeconds}s`);
        return res.status(429).json({
            error: {
                message: `You've sent too many messages. Please wait ${retryAfterSeconds} seconds before trying again.`
            }
        });
    }

    record.count++;
    return next();
}

// Chatbot API Endpoint
app.post('/api/chat', rateLimiter, async (req, res) => {
    try {
        const { model, messages } = req.body;
        
        // Google Gemini OpenAI-compatible endpoint
        const API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: { message: "API Key not configured on the server." } });
        }

        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: model || "Gemini-2.5-Pro",
                messages: messages,
            }),
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => null);
            throw new Error(errData?.error?.message || `API error ${response.status}`);
        }

        const data = await response.json();
        res.json(data);

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        res.status(500).json({ error: { message: error.message || "Internal server error" } });
    }
});



app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
