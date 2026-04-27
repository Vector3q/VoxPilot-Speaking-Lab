const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const requestedPort = Number(process.argv[2]) || Number(process.env.PORT) || 5173;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const safeUrl = decodeURIComponent(req.url.split("?")[0]);
  const requestedPath = safeUrl === "/" ? "/index.html" : safeUrl;
  const filePath = path.normalize(path.join(root, requestedPath));

  if (!filePath.startsWith(root)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  sendFile(res, filePath);
});

server.listen(requestedPort, () => {
  console.log(`TOEFL Speaking Lab is running at http://localhost:${requestedPort}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    const fallbackPort = requestedPort + 1;
    server.listen(fallbackPort, () => {
      console.log(`Port ${requestedPort} is busy. Running at http://localhost:${fallbackPort}`);
    });
    return;
  }

  throw error;
});
