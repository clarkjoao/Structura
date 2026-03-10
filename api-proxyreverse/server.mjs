import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();

app.use(cors()); // libera CORS para qualquer origem
app.use(express.json());

const DEFECTDOJO_URL = "https://demo.defectdojo.org";

app.use("/dojo", async (req, res) => {
  try {
    const url = DEFECTDOJO_URL + req.originalUrl.replace("/dojo", "");
    console.log(url);
    console.log(req.method);
    console.log(req.headers.authorization);
    console.log(req.body);
    const response = await fetch(url, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: req.headers.authorization || "",
      },
      body: ["GET", "HEAD"].includes(req.method)
        ? undefined
        : JSON.stringify(req.body),
    });

    const data = await response.text();

    res.status(response.status);
    console.log(data);
    res.send(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "proxy error" });
  }
});

app.listen(3000, () => {
  console.log("Proxy running on http://localhost:3000");
});
