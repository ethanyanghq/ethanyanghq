import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const rootDir = resolve(scriptDir, "..");
const tscPath = resolve(rootDir, "node_modules", "typescript", "bin", "tsc");
const shouldWatch = process.argv.includes("--watch");
const port = Number.parseInt(process.env.PORT ?? "4173", 10);

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".ts", "text/plain; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
  [".xml", "application/xml; charset=utf-8"],
]);

function runTypeScript(args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [tscPath, "-p", "tsconfig.json", ...args], {
      cwd: rootDir,
      stdio: "inherit",
    });

    child.once("error", rejectPromise);
    child.once("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(`TypeScript exited with code ${code ?? "unknown"}.`));
    });
  });
}

function startTypeScriptWatcher() {
  const child = spawn(
    process.execPath,
    [tscPath, "-p", "tsconfig.json", "--watch", "--preserveWatchOutput"],
    {
      cwd: rootDir,
      stdio: "inherit",
    },
  );

  child.once("error", (error) => {
    console.error("Failed to start TypeScript watch mode:", error);
    process.exitCode = 1;
  });

  child.once("exit", (code, signal) => {
    if (signal === "SIGINT" || signal === "SIGTERM") {
      return;
    }
    if (code !== 0) {
      console.error(`TypeScript watch mode exited with code ${code ?? "unknown"}.`);
      process.exitCode = 1;
    }
  });

  return child;
}

async function resolveRequestPath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath);
  const normalizedPath = normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  const relativePath = normalizedPath === "/" ? "index.html" : normalizedPath.replace(/^[/\\]+/, "");
  let filePath = resolve(rootDir, relativePath);

  if (filePath !== rootDir && !filePath.startsWith(`${rootDir}${sep}`)) {
    return null;
  }

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      filePath = join(filePath, "index.html");
    }
    return filePath;
  } catch {
    if (extname(relativePath) === "") {
      return resolve(rootDir, "index.html");
    }
    return null;
  }
}

async function start() {
  await runTypeScript([]);

  const watcher = shouldWatch ? startTypeScriptWatcher() : null;
  const server = createServer(async (request, response) => {
    if (!request.url) {
      response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Bad request");
      return;
    }

    try {
      const requestUrl = new URL(request.url, "http://127.0.0.1");
      const filePath = await resolveRequestPath(requestUrl.pathname);

      if (!filePath) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }

      const body = await readFile(filePath);
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": mimeTypes.get(extname(filePath)) ?? "application/octet-stream",
      });
      response.end(body);
    } catch (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Internal server error");
      console.error(error);
    }
  });

  server.listen(port, "127.0.0.1", () => {
    const watchLabel = shouldWatch ? " with TypeScript watch mode" : "";
    console.log(`Local site ready at http://127.0.0.1:${port}${watchLabel}`);
  });

  const shutdown = () => {
    watcher?.kill("SIGTERM");
    server.close(() => {
      process.exit(0);
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
