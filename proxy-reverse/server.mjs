import express from "express";
import cors from "cors";
import axios from "axios";
import https from "https";
import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(process.cwd(), "../.env"),
});

const app = express();

const PORT = process.env.PROXY_REVERSE_PORT || 3000;
const DEFECTDOJO_URL = process.env.PROXY_REVERSE_DEFECTDOJO_URL;
const INSECURE_TLS = process.env.PROXY_REVERSE_INSECURE_TLS === "true";
const DEFECTDOJO_API_TOKEN = process.env.PROXY_REVERSE_DEFECTDOJO_API_TOKEN;

app.use(cors());
app.use(express.json());

const httpsAgent = new https.Agent({
  rejectUnauthorized: !INSECURE_TLS,
});

app.use("/dojo", async (req, res) => {
  try {
    const tagertPath = req.originalUrl.replace("/dojo", "");
    const url = `${DEFECTDOJO_URL}${tagertPath}`;
    console.log(`Proxying ${req.method} request to: ${url}`);

    const headers = {
      ...req.headers,
      host: undefined,
      "Content-Type": "application/json",
      Authorization: req.headers.authorization || `Token ${DEFECTDOJO_API_TOKEN}`,
    };

    const config = {
      method: req.method,
      url: url,
      headers: headers,
      httpsAgent: httpsAgent,
      proxy: false,
      validateStatus: () => true, // Accept all status codes
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      config.data = req.body;
    }

    const response = await axios(config);

    console.log(`Proxied ${req.method} ${url} - Status: ${response.status}`);

    res.status(response.status);
    res.set(response.headers);
    res.send(response.data);
  } catch (error) {
    console.error("Proxy error:", error.message);
    res.status(500).json({ error: "Proxy failed", details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy running on http://localhost:${PORT}`);
  console.log(`Forwarding to ${DEFECTDOJO_URL}`);
  console.log(`TLS insecure mode: ${INSECURE_TLS}`);
});
