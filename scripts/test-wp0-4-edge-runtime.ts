import { spawn } from "node:child_process";
import { encode } from "@auth/core/jwt";

const port = 3210;
const base = `http://127.0.0.1:${port}`;
const secret = process.env.AUTH_SECRET || "ci-only-secret-not-for-production";
let output = "";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(base + "/login", { redirect: "manual" });
      if (res.status >= 100) return;
    } catch {}
    await sleep(500);
  }
  throw new Error("WP0-4R failed: production server did not become ready");
}

async function main() {
  const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["start", "--", "-p", String(port)], {
    env: {
      ...process.env,
      PORT: String(port),
      AUTH_URL: base,
      APP_URL: base,
      NEXT_PUBLIC_SITE_URL: base,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  
  try {
    await waitForServer();
  
    const cookieName = "authjs.session-token";
    const token = await encode({
      token: {
        sub: "1",
        uid: "1",
        role: "ADMIN",
        sessionVersion: 0,
        name: "CI Edge Admin",
        email: "ci-edge-admin@example.invalid",
      },
      secret,
      salt: cookieName,
      maxAge: 3600,
    });
  
    const res = await fetch(base + "/login", {
      redirect: "manual",
      headers: { cookie: `${cookieName}=${token}` },
    });
  
    // A valid ADMIN JWT on the mobile root path is handled entirely by Edge
    // middleware and must redirect to /admin without touching Prisma.
    if (![301, 302, 303, 307, 308].includes(res.status)) {
      throw new Error(`WP0-4R failed: authenticated Edge request returned ${res.status}, expected redirect`);
    }
    const location = res.headers.get("location") || "";
    if (!location.endsWith("/admin")) {
      throw new Error(`WP0-4R failed: authenticated Edge request redirected to ${location || "<none>"}`);
    }
  
    await sleep(500);
  
    if (output.includes("PrismaClient is not configured to run in Edge Runtime")) {
      throw new Error("WP0-4R failed: Prisma query executed in Edge Runtime");
    }
    if (output.includes("JWTSessionError")) {
      throw new Error("WP0-4R failed: JWTSessionError occurred during middleware JWT request");
    }
  
    console.log("WP0-4R Edge runtime authenticated-JWT smoke test passed");
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
  }
  
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
