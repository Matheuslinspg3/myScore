import { spawn } from "node:child_process";
import process from "node:process";

const port = "3210";
const nextBin = new URL("../node_modules/next/dist/bin/next", import.meta.url);
const server = spawn(
  process.execPath,
  [nextBin.pathname, "start", "--hostname", "127.0.0.1", "--port", port],
  {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      NEXT_PUBLIC_DEMO_MODE: "true",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

server.stdout.pipe(process.stdout);
server.stderr.pipe(process.stderr);

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:" + port + "/api/health");
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Servidor não ficou pronto a tempo.");
}

try {
  await waitForServer();
  const [homeResponse, healthResponse] = await Promise.all([
    fetch("http://127.0.0.1:" + port + "/"),
    fetch("http://127.0.0.1:" + port + "/api/health"),
  ]);
  const [html, health] = await Promise.all([
    homeResponse.text(),
    healthResponse.json(),
  ]);

  const expectedHomeText = [
    "Saldo Seguro",
    "Chat IA",
    "Baixar planilha CSV",
  ];
  const visibleHomeText = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const missingHomeText = expectedHomeText.filter(
    (text) => !visibleHomeText.includes(text),
  );
  if (!homeResponse.ok || missingHomeText.length) {
    throw new Error(
      "A home não respondeu com o dashboard esperado. Ausente: " +
        missingHomeText.join(", "),
    );
  }
  if (!healthResponse.ok || health.status !== "ok" || health.mode !== "demo") {
    throw new Error("O health check não confirmou o modo demonstração.");
  }

  console.log("Smoke test: dashboard e health check responderam corretamente.");
} finally {
  server.kill("SIGTERM");
}
