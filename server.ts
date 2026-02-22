import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PATIENTS_URL = process.env.PATIENTS_URL || "https://script.google.com/macros/s/AKfycby0RXPjUYUxT2Hs3_kM2NAO4x9GJ78j-inwAGE06x6qTZtDBCIxvT7sohL6sZshLrf3/exec";
const CONSULTATIONS_URL = process.env.CONSULTATIONS_URL || "https://script.google.com/macros/s/AKfycbzzMLb-Z-0HQRNXOcpjfyMCfCn1QvNh_1XxTvEUpRSTXSqhwSNTdR3gfvlMqd7iaEVj/exec";

const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
};

if (!isValidUrl(PATIENTS_URL)) console.warn(">>> WARNING: PATIENTS_URL is not a valid URL!");
if (!isValidUrl(CONSULTATIONS_URL)) console.warn(">>> WARNING: CONSULTATIONS_URL is not a valid URL!");

async function startServer() {
  console.log(">>> Starting server...");
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.use((req, res, next) => {
    console.log(`>>> [${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  const apiRouter = express.Router();

  // Test Route
  apiRouter.all("/test", (req, res) => {
    res.json({ status: "ok", method: req.method, time: new Date().toISOString() });
  });

  // Config Route
  apiRouter.get("/config", (req, res) => {
    res.json({
      hasPatientsUrl: !!PATIENTS_URL,
      hasConsultationsUrl: !!CONSULTATIONS_URL,
      isAuthConfigured: false
    });
  });

  // Proxy POST (Create/Update)
  apiRouter.post("/proxy", async (req, res) => {
    const { type, data } = req.body;
    const url = type === "patient" ? PATIENTS_URL : CONSULTATIONS_URL;
    
    try {
      const response = await axios({
        method: 'post',
        url: url,
        data: JSON.stringify({ ...data, action: 'upsert' }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        maxRedirects: 5,
        timeout: 30000
      });
      
      let finalData = response.data;
      if (!finalData) {
        finalData = { status: "success", message: "OK" };
      } else if (typeof finalData === 'string') {
        try { finalData = JSON.parse(finalData); } catch (e) { finalData = { status: "success", raw: finalData }; }
      }
      res.json(finalData);
    } catch (e: any) {
      console.error(`>>> Proxy Error:`, e.message);
      res.status(500).json({ error: "Error de comunicación con Google Sheets", details: e.message });
    }
  });

  // Data GET
  apiRouter.get("/data/:type", async (req, res) => {
    const { type } = req.params;
    const url = type === "patients" ? PATIENTS_URL : CONSULTATIONS_URL;
    try {
      const response = await axios.get(url, { maxRedirects: 5, timeout: 30000 });
      res.json(response.data);
    } catch (e: any) {
      res.status(500).json({ error: "Error al obtener datos", details: e.message });
    }
  });

  // Data DELETE
  apiRouter.delete("/data/:type/:id", async (req, res) => {
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
      res.status(500).json({ error: "Error al eliminar" });
    }
  });

  // Mount API Router
  app.use("/api", apiRouter);

  // Production / Development serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));
  }

  // Catch-all for unhandled POST/PUT/DELETE
  app.use("/api", (req, res) => {
    res.status(404).json({ error: "API route not found", method: req.method, url: req.url });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> Server running on port ${PORT}`);
  });
}

startServer();
