import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PATIENTS_URL = "https://script.google.com/macros/s/AKfycby0RXPjUYUxT2Hs3_kM2NAO4x9GJ78j-inwAGE06x6qTZtDBCIxvT7sohL6sZshLrf3/exec";
const CONSULTATIONS_URL = "https://script.google.com/macros/s/AKfycbzzMLb-Z-0HQRNXOcpjfyMCfCn1QvNh_1XxTvEUpRSTXSqhwSNTdR3gfvlMqd7iaEVj/exec";

async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json());

  app.get("/api/config", (req, res) => {
    res.json({
      hasPatientsUrl: true,
      hasConsultationsUrl: true,
    });
  });

  // Direct Proxy to Google Sheets (Create/Update)
  app.post("/api/proxy", async (req, res) => {
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
  app.get("/api/data/:type", async (req, res) => {
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
  app.delete("/api/data/:type/:id", async (req, res) => {
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
