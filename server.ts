import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PATIENTS_URL = process.env.PATIENTS_URL || "https://script.google.com/macros/s/AKfycby0RXPjUYUxT2Hs3_kM2NAO4x9GJ78j-inwAGE06x6qTZtDBCIxvT7sohL6sZshLrf3/exec";
const CONSULTATIONS_URL = process.env.CONSULTATIONS_URL || "https://script.google.com/macros/s/AKfycbzzMLb-Z-0HQRNXOcpjfyMCfCn1QvNh_1XxTvEUpRSTXSqhwSNTdR3gfvlMqd7iaEVj/exec";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
let APP_URL = process.env.APP_URL || "http://localhost:3000";
if (APP_URL.endsWith('/')) APP_URL = APP_URL.slice(0, -1);

console.log(">>> Auth Config:", { 
  hasClientId: !!GOOGLE_CLIENT_ID, 
  hasClientSecret: !!GOOGLE_CLIENT_SECRET,
  APP_URL 
});

const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
const JWT_SECRET = process.env.SESSION_SECRET || 'pawmed-jwt-secret-123';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Auth Routes
  app.get("/api/auth/google/url", (req, res) => {
    console.log(">>> Generating Auth URL...");
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.error(">>> Google OAuth credentials missing!");
      return res.status(500).json({ error: "Google OAuth not configured" });
    }
    const redirectUri = `${APP_URL}/auth/callback`;
    console.log(">>> Redirect URI:", redirectUri);
    const url = client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email'],
      redirect_uri: redirectUri
    });
    res.json({ url });
  });

  app.get("/auth/callback", async (req, res) => {
    console.log(">>> Auth Callback received...");
    const { code } = req.query;
    const redirectUri = `${APP_URL}/auth/callback`;
    try {
      const { tokens } = await client.getToken({
        code: code as string,
        redirect_uri: redirectUri
      });
      console.log(">>> Tokens received");
      client.setCredentials(tokens);
      
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token!,
        audience: GOOGLE_CLIENT_ID
      });
      const payload = ticket.getPayload();
      console.log(">>> User verified:", payload?.email);
      
      const user = {
        id: payload?.sub,
        email: payload?.email,
        name: payload?.name,
        picture: payload?.picture
      };

      const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
      console.log(">>> JWT Generated for:", user.email);

      res.send(`
        <html>
          <body>
            <script>
              console.log(">>> Auth Success! Sending token...");
              try {
                if (window.opener) {
                  window.opener.postMessage({ 
                    type: 'OAUTH_AUTH_SUCCESS', 
                    token: '${token}',
                    user: ${JSON.stringify(user)}
                  }, '*');
                  console.log(">>> Message sent. Closing in 1s...");
                  setTimeout(() => window.close(), 1000);
                } else {
                  console.log(">>> No opener found, redirecting...");
                  window.location.href = '/?token=${token}';
                }
              } catch (err) {
                console.error(">>> PostMessage error:", err);
                window.location.href = '/?token=${token}';
              }
            </script>
            <div style="font-family: sans-serif; text-align: center; padding-top: 50px;">
              <h2 style="color: #e11d48;">¡Autenticación Exitosa!</h2>
              <p>Sincronizando con la aplicación...</p>
            </div>
          </body>
        </html>
      `);
    } catch (e) {
      console.error(">>> OAuth Error:", e);
      res.status(500).send("Error de autenticación: " + (e as any).message);
    }
  });

  app.get("/api/auth/me", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json(null);
    }
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      res.json(decoded);
    } catch (e) {
      res.json(null);
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.json({ success: true });
  });

  app.get("/api/config", (req, res) => {
    res.json({
      hasPatientsUrl: !!PATIENTS_URL,
      hasConsultationsUrl: !!CONSULTATIONS_URL,
      isAuthConfigured: !!GOOGLE_CLIENT_ID
    });
  });

  // Middleware to check auth via JWT
  const checkAuth = (req: any, res: any, next: any) => {
    if (!GOOGLE_CLIENT_ID) return next();
    
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(">>> Auth failed: No Bearer token");
      return res.status(401).json({ error: "No autorizado" });
    }
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (e) {
      console.error(">>> Auth failed: Invalid JWT", e);
      res.status(401).json({ error: "Sesión expirada" });
    }
  };

  // Direct Proxy to Google Sheets (Create/Update)
  app.post("/api/proxy", checkAuth, async (req, res) => {
    const { type, data } = req.body;
    const url = type === "patient" ? PATIENTS_URL : CONSULTATIONS_URL;
    
    try {
      const response = await axios({
        method: 'post',
        url: url,
        data: JSON.stringify({ ...data, action: 'upsert' }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        maxRedirects: 5
      });
      res.json(response.data);
    } catch (e: any) {
      console.error(`>>> Google Sheets Error (${type}):`, e.message);
      res.status(500).json({ error: "Error de comunicación con Google Sheets" });
    }
  });

  // Direct Fetch from Google Sheets
  app.get("/api/data/:type", checkAuth, async (req, res) => {
    const { type } = req.params;
    const url = type === "patients" ? PATIENTS_URL : CONSULTATIONS_URL;
    
    try {
      const response = await axios.get(url, { maxRedirects: 5 });
      res.json(response.data);
    } catch (e: any) {
      console.error(`>>> Fetch Error (${type}):`, e.message);
      res.status(500).json({ error: "Error al obtener datos de Google Sheets" });
    }
  });

  // Delete from Google Sheets
  app.delete("/api/data/:type/:id", checkAuth, async (req, res) => {
    const { type, id } = req.params;
    const url = type === "patients" ? PATIENTS_URL : CONSULTATIONS_URL;
    
    try {
      const response = await axios({
        method: 'post',
        url: url,
        data: JSON.stringify({ id, action: 'delete' }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        maxRedirects: 5
      });
      res.json(response.data);
    } catch (e: any) {
      res.status(500).json({ error: "Error al eliminar en Google Sheets" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => console.log(`>>> Server running on port ${PORT}`));
}

startServer();
