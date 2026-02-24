import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Persistence for URLs if not in env
const CONFIG_FILE = path.join(__dirname, "config.json");

function getUrls() {
  let patientsUrl = "";
  let consultationsUrl = "";
  let prescriptionsUrl = "";
  let authUrl = "";

  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
      patientsUrl = config.patientsUrl || "";
      consultationsUrl = config.consultationsUrl || "";
      prescriptionsUrl = config.prescriptionsUrl || "";
      authUrl = config.authUrl || "";
    } catch (e) {
      console.error(">>> Error reading config file:", e);
    }
  }

  // If still empty, check environment variables
  if (!patientsUrl) patientsUrl = process.env.PATIENTS_URL || "";
  if (!consultationsUrl) consultationsUrl = process.env.CONSULTATIONS_URL || "";
  if (!prescriptionsUrl) prescriptionsUrl = process.env.PRESCRIPTIONS_URL || "";
  if (!authUrl) authUrl = process.env.AUTH_URL || "";

  // Fallback to defaults if still empty
  if (!patientsUrl) patientsUrl = "https://script.google.com/macros/s/AKfycbwXl4eqFjn1Fp3FDixMWIGd-eeEAiWwdraj9LJLP5Ibw2r7qVnTvq1IIaKYSonV8btw/exec";
  if (!consultationsUrl) consultationsUrl = "https://script.google.com/macros/s/AKfycbznw7XYg8Rsi34JKfzB1rDMcSN3Hv9GqNkUNhmspptFT93sA-Wn9nBb7I6LTTUCX8dx/exec";
  if (!prescriptionsUrl) prescriptionsUrl = "https://script.google.com/macros/s/AKfycbydwPLlWksXPYqhbi6ALD-2A_xtdwwIEikFMR4cj_1i0sBev4dCQTlZJMz7n_m44OAcxg/exec";

  return { patientsUrl, consultationsUrl, prescriptionsUrl, authUrl };
}

const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
};

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
    const { patientsUrl, consultationsUrl, prescriptionsUrl, authUrl } = getUrls();
    res.json({
      hasPatientsUrl: !!patientsUrl,
      hasConsultationsUrl: !!consultationsUrl,
      hasPrescriptionsUrl: !!prescriptionsUrl,
      hasAuthUrl: !!authUrl,
      patientsUrl: patientsUrl,
      consultationsUrl: consultationsUrl,
      prescriptionsUrl: prescriptionsUrl,
      authUrl: authUrl,
      isAuthConfigured: !!authUrl
    });
  });

  // Save Config Route
  apiRouter.post("/config", (req, res) => {
    const { patientsUrl, consultationsUrl, prescriptionsUrl, authUrl } = req.body;
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify({ patientsUrl, consultationsUrl, prescriptionsUrl, authUrl }));
      res.json({ status: "success" });
    } catch (e: any) {
      res.status(500).json({ error: "Error saving config", details: e.message });
    }
  });

  // Proxy POST (Create/Update/Auth)
  apiRouter.post("/proxy", async (req, res) => {
    const { type, data } = req.body;
    const { patientsUrl, consultationsUrl, prescriptionsUrl, authUrl } = getUrls();
    let url = "";
    if (type === "patient") url = patientsUrl;
    else if (type === "consultation") url = consultationsUrl;
    else if (type === "prescription") url = prescriptionsUrl;
    else if (type === "auth") url = authUrl;
    
    if (!isValidUrl(url)) {
      return res.status(400).json({ error: "URL de Google Sheets no configurada o inválida" });
    }

    try {
      const response = await axios({
        method: 'post',
        url: url,
        data: JSON.stringify({ ...data, action: type === 'auth' ? 'login' : 'upsert' }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        maxRedirects: 5,
        timeout: 30000
      });
      
      let finalData = response.data;
      
      if (typeof finalData === 'string') {
        if (finalData.trim().startsWith('<')) {
          console.error(">>> Google returned HTML instead of JSON.");
          return res.status(500).json({ 
            error: "Google Sheets devolvió una página de error/login.", 
            details: "Asegúrate de que el script esté publicado como 'Cualquier persona' (Anyone)." 
          });
        }
        if (finalData.includes("Rate exceeded")) {
          return res.status(429).json({ 
            error: "Límite de peticiones excedido en Google Sheets.", 
            details: "Por favor, espera unos segundos antes de intentar de nuevo." 
          });
        }
      }

      if (!finalData) {
        finalData = { status: "success", message: "OK" };
      } else if (typeof finalData === 'string') {
        try { 
          finalData = JSON.parse(finalData); 
        } catch (e) { 
          finalData = { status: "success", raw: finalData }; 
        }
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
    const { patientsUrl, consultationsUrl, prescriptionsUrl } = getUrls();
    let url = "";
    if (type === "patients") url = patientsUrl;
    else if (type === "consultations") url = consultationsUrl;
    else if (type === "prescriptions") url = prescriptionsUrl;

    if (!isValidUrl(url)) {
      return res.status(400).json({ error: "URL no configurada" });
    }

    try {
      console.log(`>>> Fetching data from Google: ${url}`);
      const response = await axios.get(url, { maxRedirects: 5, timeout: 30000 });
      let data = response.data;
      console.log(`>>> Received data from Google (first 100 chars):`, typeof data === 'string' ? data.substring(0, 100) : 'Object/Array');

      if (typeof data === 'string' && data.trim().startsWith('<')) {
        console.error(">>> Google returned HTML instead of JSON for GET.");
        return res.status(500).json({ error: "Google Sheets devolvió HTML. Revisa los permisos del script." });
      }

      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) { data = []; }
      }
      
      if (!Array.isArray(data)) {
        data = [];
      }

      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: "Error al obtener datos", details: e.message });
    }
  });

  // Data DELETE
  apiRouter.delete("/data/:type/:id", async (req, res) => {
    const { type, id } = req.params;
    console.log(`>>> DELETE request received for type: ${type}, id: ${id}`);
    
    const { patientsUrl, consultationsUrl, prescriptionsUrl } = getUrls();
    let url = "";
    if (type === "patients") url = patientsUrl;
    else if (type === "consultations") url = consultationsUrl;
    else if (type === "prescriptions") url = prescriptionsUrl;

    if (!isValidUrl(url)) {
      console.error(`>>> Invalid URL for type ${type}: ${url}`);
      return res.status(400).json({ error: "URL no configurada o inválida" });
    }

    try {
      console.log(`>>> Proxying delete to Google (GET): ${url}`);
      const deleteUrl = new URL(url);
      deleteUrl.searchParams.append('id', id);
      deleteUrl.searchParams.append('action', 'delete');

      const response = await axios.get(deleteUrl.toString(), {
        maxRedirects: 5,
        timeout: 30000
      });
      
      console.log(">>> Google response for delete:", response.data);
      
      let finalData = response.data;
      if (typeof finalData === 'string' && finalData.trim().startsWith('<')) {
        return res.status(500).json({ error: "Google Sheets devolvió HTML. Revisa los permisos." });
      }

      res.json(finalData || { status: "success" });
    } catch (e: any) {
      console.error(`>>> Delete Proxy Error:`, e.message);
      res.status(500).json({ error: "Error al eliminar", details: e.message });
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
