import express from "express";
import cors from "cors";
import fetch from "node-fetch";
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
    const url = DEFECTDOJO_URL + req.originalUrl.replace("/dojo", "");

    const response = await fetch(url, {
      method: req.method,
      headers: {
        ...req.headers,
        host: undefined,
        Authorization:
          req.headers.authorization || `Token ${DEFECTDOJO_API_TOKEN}`,
      },
      body:
        req.method === "GET" || req.method === "HEAD"
          ? undefined
          : JSON.stringify(req.body),
      agent: httpsAgent,
    });

    const data = await response.text();

    res.status(response.status);
    res.send(data);
  } catch (error) {
    console.error("Proxy error:", error);
    res.status(500).json({ error: "Proxy failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy running on http://localhost:${PORT}`);
  console.log(`Forwarding to ${DEFECTDOJO_URL}`);
  console.log(`TLS insecure mode: ${INSECURE_TLS}`);
});
