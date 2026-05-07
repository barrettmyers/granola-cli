#!/usr/bin/env node

// src/main.ts
import { readFileSync as readFileSync2 } from "fs";
import { Command as Command20 } from "commander";

// src/commands/alias.ts
import chalk2 from "chalk";
import { Command } from "commander";

// src/lib/config.ts
import Conf from "conf";

// src/lib/alias.ts
import { parse as parseShellQuote } from "shell-quote";
var UNSAFE_ALIAS_PATTERN = /[`$]/;
function parseAliasArguments(command) {
  const parsed = parseShellQuote(command);
  if (parsed.length === 0) {
    throw new Error("Alias command cannot be empty.");
  }
  const hasUnsafeToken = parsed.some((token) => typeof token !== "string");
  if (hasUnsafeToken) {
    throw new Error("Alias command contains unsupported shell syntax.");
  }
  const args = parsed;
  const hasSubstitution = args.some((token) => UNSAFE_ALIAS_PATTERN.test(token));
  if (hasSubstitution) {
    throw new Error("Alias command contains unsupported substitution syntax.");
  }
  return args;
}
function isAliasCommandSafe(command) {
  try {
    parseAliasArguments(command);
    return true;
  } catch {
    return false;
  }
}

// src/lib/debug.ts
import createDebug from "debug";
function createGranolaDebug(namespace) {
  return createDebug(`granola:${namespace}`);
}
function maskToken(token) {
  if (!token || token.length < 12) return "[REDACTED]";
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

// src/lib/config.ts
var debug = createGranolaDebug("lib:config");
var config = new Conf({
  projectName: "granola",
  defaults: {}
});
debug("config store initialized at: %s", config.path);
function getConfig() {
  debug("getConfig: returning store");
  return config.store;
}
function getConfigValue(key) {
  const value = config.get(key);
  debug("getConfigValue: %s = %O", key, value);
  return value;
}
function setConfigValue(key, value) {
  debug("setConfigValue: %s = %O", key, value);
  config.set(key, value);
}
function resetConfig() {
  debug("resetConfig: clearing all configuration");
  config.clear();
}
function getAlias(name) {
  const aliases = config.get("aliases") || {};
  const alias = aliases[name];
  debug("getAlias: %s -> %s", name, alias || "(not found)");
  return alias;
}
function validateAliasCommand(command) {
  return isAliasCommandSafe(command);
}
function setAlias(name, command) {
  debug("setAlias: %s -> %s", name, command);
  if (!validateAliasCommand(command)) {
    debug("setAlias: invalid command characters");
    throw new Error(
      "Alias command contains invalid characters or shell syntax. Only literal arguments are allowed."
    );
  }
  const aliases = config.get("aliases") || {};
  aliases[name] = command;
  config.set("aliases", aliases);
}
function deleteAlias(name) {
  debug("deleteAlias: removing %s", name);
  const aliases = config.get("aliases") || {};
  delete aliases[name];
  config.set("aliases", aliases);
}
function listAliases() {
  const aliases = config.get("aliases") || {};
  debug("listAliases: returning %d aliases", Object.keys(aliases).length);
  return aliases;
}

// src/lib/output.ts
import { encode as toonEncode } from "@toon-format/toon";
import chalk from "chalk";
import Table from "cli-table3";
import { stringify as yamlStringify } from "yaml";
var debug2 = createGranolaDebug("lib:output");
function formatOutput(data, format) {
  debug2("formatOutput: format=%s, dataType=%s", format, typeof data);
  switch (format) {
    case "yaml":
      return yamlStringify(data);
    case "toon":
      return toonEncode(data);
    default:
      return JSON.stringify(data, null, 2);
  }
}
function table(data, columns) {
  debug2("table: rendering %d rows, %d columns", data.length, columns.length);
  const colWidths = columns.map((c) => c.width ?? null);
  const t = new Table({
    head: columns.map((c) => chalk.bold(c.header)),
    colWidths,
    style: { head: [], border: [] },
    chars: {
      top: "",
      "top-mid": "",
      "top-left": "",
      "top-right": "",
      bottom: "",
      "bottom-mid": "",
      "bottom-left": "",
      "bottom-right": "",
      left: "",
      "left-mid": "",
      mid: "",
      "mid-mid": "",
      right: "",
      "right-mid": "",
      middle: "  "
    }
  });
  for (const row of data) {
    t.push(
      columns.map((c) => {
        const val = row[c.key];
        return c.format ? c.format(val) : String(val ?? "");
      })
    );
  }
  return t.toString();
}
function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}
function truncate(s, len) {
  if (s.length <= len) return s;
  return `${s.slice(0, len - 1)}\u2026`;
}

// src/commands/alias.ts
var debug3 = createGranolaDebug("cmd:alias");
function createAliasCommand() {
  const cmd = new Command("alias").description("Create command shortcuts");
  cmd.command("list").description("List aliases").option("-o, --output <format>", "Output format (json, yaml, toon)").action((opts) => {
    debug3("alias list command invoked");
    const aliases = listAliases();
    const format = opts.output || null;
    if (format) {
      if (!["json", "yaml", "toon"].includes(format)) {
        console.error(chalk2.red(`Invalid format: ${format}. Use 'json', 'yaml', or 'toon'.`));
        process.exit(1);
      }
      console.log(formatOutput(aliases, format));
      return;
    }
    if (Object.keys(aliases).length === 0) {
      console.log(chalk2.dim("No aliases defined."));
      return;
    }
    for (const [name, command] of Object.entries(aliases)) {
      console.log(`${chalk2.bold(name)}: ${command}`);
    }
  });
  cmd.command("set <name> <command>").description("Create alias").action((name, command) => {
    debug3("alias set command invoked: %s -> %s", name, command);
    setAlias(name, command);
    console.log(chalk2.green(`Created alias: ${name} -> ${command}`));
  });
  cmd.command("delete <name>").description("Delete alias").action((name) => {
    debug3("alias delete command invoked: %s", name);
    const existing = getAlias(name);
    if (!existing) {
      console.log(chalk2.yellow(`Alias '${name}' not found`));
      return;
    }
    deleteAlias(name);
    console.log(chalk2.green(`Deleted alias: ${name}`));
  });
  return cmd;
}
var aliasCommand = createAliasCommand();

// src/commands/auth/index.ts
import { Command as Command5 } from "commander";

// src/commands/auth/login.ts
import chalk3 from "chalk";
import { Command as Command2 } from "commander";

// src/lib/auth.ts
import { readFile } from "fs/promises";
import { homedir as homedir2, platform } from "os";
import { join as join2 } from "path";
import { deletePassword, getPassword, setPassword } from "cross-keychain";

// src/lib/lock.ts
import { mkdir, open, stat, unlink } from "fs/promises";
import { homedir, tmpdir } from "os";
import { dirname, join } from "path";
var debug4 = createGranolaDebug("lib:lock");
var LOCK_FILE_NAME = "granola-token-refresh.lock";
var LOCK_TIMEOUT_MS = 3e4;
var LOCK_RETRY_INTERVAL_MS = 100;
var LOCK_STALE_MS = 6e4;
function getLockFilePath() {
  const tempDir = process.platform === "darwin" ? join(homedir(), "Library", "Caches", "granola") : tmpdir();
  return join(tempDir, LOCK_FILE_NAME);
}
async function ensureLockDirectory() {
  const lockPath = getLockFilePath();
  const dir = dirname(lockPath);
  await mkdir(dir, { recursive: true });
}
async function isLockStale(lockPath) {
  try {
    const stats = await stat(lockPath);
    const age = Date.now() - stats.mtimeMs;
    return age > LOCK_STALE_MS;
  } catch {
    return true;
  }
}
async function acquireLock(timeoutMs = LOCK_TIMEOUT_MS) {
  const lockPath = getLockFilePath();
  const startTime = Date.now();
  await ensureLockDirectory();
  debug4("attempting to acquire lock at %s", lockPath);
  while (Date.now() - startTime < timeoutMs) {
    try {
      const handle = await open(lockPath, "wx");
      debug4("lock acquired");
      return { handle };
    } catch (error) {
      const err = error;
      if (err.code === "EEXIST") {
        if (await isLockStale(lockPath)) {
          debug4("removing stale lock");
          try {
            await unlink(lockPath);
          } catch {
          }
          continue;
        }
        debug4("lock held by another process, waiting...");
        await new Promise((r) => setTimeout(r, LOCK_RETRY_INTERVAL_MS));
      } else {
        debug4("lock acquisition failed: %O", error);
        throw error;
      }
    }
  }
  debug4("lock acquisition timed out");
  return null;
}
async function releaseLock(lockHandle) {
  const lockPath = getLockFilePath();
  debug4("releasing lock");
  try {
    await lockHandle.handle.close();
    await unlink(lockPath);
    debug4("lock released");
  } catch (error) {
    debug4("error releasing lock: %O", error);
  }
}
async function withLock(operation, timeoutMs = LOCK_TIMEOUT_MS) {
  const handle = await acquireLock(timeoutMs);
  if (handle === null) {
    throw new Error("Failed to acquire token refresh lock");
  }
  try {
    return await operation();
  } finally {
    await releaseLock(handle);
  }
}

// src/lib/auth.ts
var debug5 = createGranolaDebug("lib:auth");
var SERVICE_NAME = "com.granola.cli";
var ACCOUNT_NAME = "credentials";
var DEFAULT_CLIENT_ID = "client_GranolaMac";
async function getCredentials() {
  debug5("loading credentials from keychain");
  try {
    const stored = await getPassword(SERVICE_NAME, ACCOUNT_NAME);
    if (!stored) {
      debug5("no credentials found in keychain");
      return null;
    }
    const parsed = JSON.parse(stored);
    debug5("credentials loaded, hasAccessToken: %s", Boolean(parsed.accessToken));
    return {
      refreshToken: parsed.refreshToken,
      accessToken: parsed.accessToken || "",
      clientId: parsed.clientId
    };
  } catch (error) {
    debug5("failed to get credentials: %O", error);
    return null;
  }
}
async function saveCredentials(creds) {
  debug5("saving credentials to keychain");
  await setPassword(SERVICE_NAME, ACCOUNT_NAME, JSON.stringify(creds));
  debug5("credentials saved");
}
async function deleteCredentials() {
  debug5("deleting credentials from keychain");
  await deletePassword(SERVICE_NAME, ACCOUNT_NAME);
  debug5("credentials deleted");
}
var WORKOS_AUTH_URL = "https://api.workos.com/user_management/authenticate";
async function refreshAccessToken() {
  debug5("attempting token refresh");
  try {
    return await withLock(async () => {
      const creds = await getCredentials();
      if (!creds?.refreshToken || !creds?.clientId) {
        debug5("cannot refresh: missing refreshToken or clientId");
        return null;
      }
      const response = await fetch(WORKOS_AUTH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: creds.clientId,
          grant_type: "refresh_token",
          refresh_token: creds.refreshToken
        })
      });
      if (!response.ok) {
        debug5("token refresh failed: %d %s", response.status, response.statusText);
        return null;
      }
      const data = await response.json();
      const newCreds = {
        refreshToken: data.refresh_token,
        accessToken: data.access_token,
        clientId: creds.clientId
      };
      await saveCredentials(newCreds);
      debug5("token refresh successful, new credentials saved");
      return newCreds;
    });
  } catch (error) {
    debug5("token refresh error: %O", error);
    return null;
  }
}
function parseSupabaseJson(json) {
  debug5("parsing supabase.json");
  try {
    const parsed = JSON.parse(json);
    if (parsed.workos_tokens && typeof parsed.workos_tokens === "string") {
      const workosTokens = JSON.parse(parsed.workos_tokens);
      if (workosTokens.access_token) {
        debug5("found WorkOS tokens");
        return {
          refreshToken: workosTokens.refresh_token || "",
          accessToken: workosTokens.access_token,
          clientId: workosTokens.client_id || DEFAULT_CLIENT_ID
        };
      }
    }
    if (parsed.cognito_tokens && typeof parsed.cognito_tokens === "string") {
      const cognitoTokens = JSON.parse(parsed.cognito_tokens);
      if (!cognitoTokens.refresh_token) return null;
      debug5("found Cognito tokens");
      return {
        refreshToken: cognitoTokens.refresh_token,
        accessToken: cognitoTokens.access_token || "",
        clientId: cognitoTokens.client_id || DEFAULT_CLIENT_ID
      };
    }
    if (!parsed.refresh_token) return null;
    debug5("found legacy token format");
    return {
      refreshToken: parsed.refresh_token,
      accessToken: parsed.access_token || "",
      clientId: parsed.client_id || DEFAULT_CLIENT_ID
    };
  } catch (error) {
    debug5("failed to parse supabase.json: %O", error);
    return null;
  }
}
function getDefaultSupabasePath() {
  const home = homedir2();
  const os2 = platform();
  let path;
  switch (os2) {
    case "darwin":
      path = join2(home, "Library", "Application Support", "Granola", "supabase.json");
      break;
    case "win32":
      path = join2(
        process.env.APPDATA || join2(home, "AppData", "Roaming"),
        "Granola",
        "supabase.json"
      );
      break;
    default:
      path = join2(home, ".config", "granola", "supabase.json");
  }
  debug5("platform: %s, supabase path: %s", os2, path);
  return path;
}
async function loadCredentialsFromFile() {
  const path = getDefaultSupabasePath();
  debug5("loading credentials from file: %s", path);
  try {
    const content = await readFile(path, "utf-8");
    debug5("file read successful, parsing content");
    return parseSupabaseJson(content);
  } catch (error) {
    debug5("failed to load credentials from file: %O", error);
    return null;
  }
}

// src/commands/auth/login.ts
var debug6 = createGranolaDebug("cmd:auth:login");
function createLoginCommand() {
  return new Command2("login").description("Import credentials from Granola desktop app").action(async () => {
    debug6("login command invoked");
    const creds = await loadCredentialsFromFile();
    if (!creds) {
      const path = getDefaultSupabasePath();
      debug6("login failed: could not load credentials from %s", path);
      console.error(chalk3.red("Error:"), "Could not load credentials.");
      console.error(`Expected file at: ${chalk3.dim(path)}`);
      console.error("\nMake sure the Granola desktop app is installed and you are logged in.");
      process.exit(1);
    }
    debug6("credentials loaded, saving to keychain");
    await saveCredentials(creds);
    debug6("login successful");
    console.log(chalk3.green("Credentials imported successfully"));
  });
}
var loginCommand = createLoginCommand();

// src/commands/auth/logout.ts
import chalk4 from "chalk";
import { Command as Command3 } from "commander";
var debug7 = createGranolaDebug("cmd:auth:logout");
function createLogoutCommand() {
  return new Command3("logout").description("Logout from Granola").action(async () => {
    debug7("logout command invoked");
    try {
      await deleteCredentials();
      debug7("logout successful");
      console.log(chalk4.green("Logged out successfully"));
    } catch (error) {
      debug7("logout failed: %O", error);
      console.error(chalk4.red("Error:"), "Failed to logout.");
      if (error instanceof Error) {
        console.error(chalk4.dim(error.message));
      }
      process.exit(1);
    }
  });
}
var logoutCommand = createLogoutCommand();

// src/commands/auth/status.ts
import chalk5 from "chalk";
import { Command as Command4 } from "commander";
var debug8 = createGranolaDebug("cmd:auth:status");
function createStatusCommand() {
  return new Command4("status").description("Check authentication status").option("-o, --output <format>", "Output format (json, yaml, toon)").action(async (opts) => {
    debug8("status command invoked");
    const creds = await getCredentials();
    debug8("authenticated: %s", !!creds);
    const format = opts.output || null;
    if (format) {
      if (!["json", "yaml", "toon"].includes(format)) {
        console.error(chalk5.red(`Invalid format: ${format}. Use 'json', 'yaml', or 'toon'.`));
        process.exit(1);
      }
      console.log(formatOutput({ authenticated: !!creds }, format));
      return;
    }
    if (creds) {
      console.log(chalk5.green("Authenticated"));
    } else {
      console.log(chalk5.yellow("Not authenticated"));
      console.log(chalk5.dim("Run: granola auth login"));
    }
  });
}
var statusCommand = createStatusCommand();

// src/commands/auth/index.ts
var authCommand = new Command5("auth").description("Manage authentication").addCommand(loginCommand).addCommand(logoutCommand).addCommand(statusCommand);

// src/commands/config.ts
import chalk6 from "chalk";
import { Command as Command6 } from "commander";
var debug9 = createGranolaDebug("cmd:config");
var CONFIG_VALUE_PARSERS = {
  default_workspace: (value) => value,
  pager: (value) => value,
  aliases: (value) => {
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error('Aliases must be a JSON object of { "name": "command" } pairs.');
      }
      for (const [alias, command] of Object.entries(parsed)) {
        if (typeof command !== "string") {
          throw new Error(`Alias "${alias}" must map to a string command.`);
        }
      }
      return parsed;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Aliases must be valid JSON (example: {"meetings":"meeting list"}).');
      }
      throw error;
    }
  }
};
var CONFIG_KEYS = Object.keys(CONFIG_VALUE_PARSERS);
function isConfigKey(key) {
  return CONFIG_KEYS.includes(key);
}
function createConfigCommand() {
  const cmd = new Command6("config").description("Manage CLI configuration");
  cmd.command("list").description("View current config").option("-o, --output <format>", "Output format (json, yaml, toon)").action((opts) => {
    debug9("config list command invoked");
    const config2 = getConfig();
    const format = opts.output || null;
    if (format) {
      if (!["json", "yaml", "toon"].includes(format)) {
        console.error(chalk6.red(`Invalid format: ${format}. Use 'json', 'yaml', or 'toon'.`));
        process.exit(1);
      }
      console.log(formatOutput(config2, format));
      return;
    }
    if (Object.keys(config2).length === 0) {
      console.log(chalk6.dim("No configuration set."));
      return;
    }
    for (const [key, value] of Object.entries(config2)) {
      if (typeof value === "object") {
        console.log(`${chalk6.bold(key)}:`);
        for (const [k, v] of Object.entries(value)) {
          console.log(`  ${k}: ${v}`);
        }
      } else {
        console.log(`${chalk6.bold(key)}: ${value}`);
      }
    }
  });
  cmd.command("get <key>").description("Get a config value").option("-o, --output <format>", "Output format (json, yaml, toon)").action((key, opts) => {
    debug9("config get command invoked with key: %s", key);
    const value = getConfigValue(key);
    const format = opts.output || null;
    if (format) {
      if (!["json", "yaml", "toon"].includes(format)) {
        console.error(chalk6.red(`Invalid format: ${format}. Use 'json', 'yaml', or 'toon'.`));
        process.exit(1);
      }
      console.log(formatOutput({ [key]: value }, format));
      return;
    }
    if (value === void 0) {
      console.log(chalk6.dim("(not set)"));
    } else {
      console.log(value);
    }
  });
  cmd.command("set <key> <value>").description("Set a config value").action((key, value) => {
    debug9("config set command invoked: %s = %s", key, value);
    if (!isConfigKey(key)) {
      console.error(
        chalk6.red(
          `Invalid config key: ${key}. Allowed keys: ${CONFIG_KEYS.map((k) => `'${k}'`).join(", ")}.`
        )
      );
      process.exit(1);
    }
    const parser = CONFIG_VALUE_PARSERS[key];
    let parsedValue;
    try {
      parsedValue = parser(value);
    } catch (error) {
      console.error(chalk6.red("Invalid value for config key:"), key);
      if (error instanceof Error) {
        console.error(chalk6.dim(error.message));
      }
      process.exit(1);
    }
    setConfigValue(key, parsedValue);
    console.log(chalk6.green(`Set ${key} = ${value}`));
  });
  cmd.command("reset").description("Reset to defaults").action(() => {
    debug9("config reset command invoked");
    resetConfig();
    console.log(chalk6.green("Configuration reset"));
  });
  return cmd;
}
var configCommand = createConfigCommand();

// src/commands/folder/index.ts
import { Command as Command9 } from "commander";

// src/commands/folder/list.ts
import chalk8 from "chalk";
import { Command as Command7 } from "commander";

// src/services/client.ts
import chalk7 from "chalk";

// src/lib/api.ts
function createApiClient(httpClient) {
  async function getDocuments(options = {}) {
    const body = {
      include_last_viewed_panel: options.include_last_viewed_panel ?? false
    };
    if (options.workspace_id) body.workspace_id = options.workspace_id;
    if (options.limit !== void 0) body.limit = options.limit;
    if (options.offset !== void 0) body.offset = options.offset;
    if (options.cursor) body.cursor = options.cursor;
    return httpClient.post("/v2/get-documents", body);
  }
  async function getDocumentsBatch(options) {
    return httpClient.post("/v1/get-documents-batch", {
      document_ids: options.document_ids,
      include_last_viewed_panel: options.include_last_viewed_panel ?? false
    });
  }
  async function getDocumentMetadata(documentId) {
    return httpClient.post("/v1/get-document-metadata", {
      document_id: documentId
    });
  }
  async function getDocumentTranscript(documentId) {
    return httpClient.post("/v1/get-document-transcript", {
      document_id: documentId
    });
  }
  async function getDocumentLists() {
    const response = await httpClient.post("/v2/get-document-lists", {});
    return response.lists;
  }
  async function getDocumentList(folderId) {
    const folders = await getDocumentLists();
    return folders.find((f) => f.id === folderId) || null;
  }
  async function getWorkspaces() {
    return httpClient.post("/v1/get-workspaces", {});
  }
  function setToken(token) {
    httpClient.setToken(token);
  }
  return {
    getDocuments,
    getDocumentsBatch,
    getDocumentMetadata,
    getDocumentTranscript,
    getDocumentLists,
    getDocumentList,
    getWorkspaces,
    setToken
  };
}

// src/lib/http.ts
import { readFileSync } from "fs";
import os from "os";
import process2 from "process";
function getPackageVersion() {
  for (const path of ["../package.json", "../../package.json"]) {
    try {
      const pkg = JSON.parse(readFileSync(new URL(path, import.meta.url), "utf-8"));
      return pkg.version;
    } catch {
    }
  }
  return "0.0.0";
}
var version = getPackageVersion();
var BASE_URL = "https://api.granola.ai";
var APP_VERSION = "7.0.0";
function buildUserAgent() {
  const platform2 = process2.platform === "darwin" ? "macOS" : process2.platform;
  const osRelease = os.release();
  return `Granola/${APP_VERSION} granola-cli/${version} (${platform2} ${osRelease})`;
}
function getClientHeaders() {
  return {
    "X-App-Version": APP_VERSION,
    "X-Client-Version": APP_VERSION,
    "X-Client-Type": "cli",
    "X-Client-Platform": process2.platform,
    "X-Client-Architecture": process2.arch,
    "X-Client-Id": `granola-cli-${version}`,
    "User-Agent": buildUserAgent()
  };
}
var RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 250,
  retryableStatuses: [429, 500, 502, 503, 504]
};
var ApiError = class extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
    this.name = "ApiError";
  }
};
function isRetryable(status) {
  return RETRY_CONFIG.retryableStatuses.includes(status);
}
async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function createHttpClient(token) {
  let currentToken = token;
  async function post(endpoint, body = {}) {
    let lastError = null;
    const maxAttempts = RETRY_CONFIG.maxRetries + 1;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentToken}`,
            "Content-Type": "application/json",
            ...getClientHeaders()
          },
          body: JSON.stringify(body)
        });
        if (!response.ok) {
          const responseBody = await response.json().catch(() => ({}));
          if (isRetryable(response.status) && attempt < maxAttempts - 1) {
            const delay = RETRY_CONFIG.baseDelay * 2 ** attempt;
            await sleep(delay);
            continue;
          }
          throw new ApiError(
            `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            responseBody
          );
        }
        return await response.json();
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }
        lastError = error;
        if (attempt < maxAttempts - 1) {
          const delay = RETRY_CONFIG.baseDelay * 2 ** attempt;
          await sleep(delay);
        }
      }
    }
    throw lastError;
  }
  function setToken(newToken) {
    currentToken = newToken;
  }
  return { post, setToken };
}

// src/services/client.ts
var debug10 = createGranolaDebug("service:client");
var client = null;
async function getClient() {
  debug10("getClient called, cached: %s", client ? "yes" : "no");
  if (client) return client;
  debug10("fetching credentials");
  const creds = await getCredentials();
  if (!creds) {
    debug10("no credentials found, exiting");
    console.error(chalk7.red("Error:"), "Not authenticated.");
    console.error(`Run ${chalk7.cyan("granola auth login")} to authenticate.`);
    process.exit(2);
  }
  debug10("creating API client, token: %s", maskToken(creds.accessToken));
  const httpClient = createHttpClient(creds.accessToken);
  client = createApiClient(httpClient);
  return client;
}
function resetClient() {
  debug10("client reset");
  client = null;
}
function isUnauthorizedError(error) {
  if (error && typeof error === "object") {
    const e = error;
    return e.status === 401;
  }
  return false;
}
async function withTokenRefresh(operation) {
  try {
    return await operation();
  } catch (error) {
    if (isUnauthorizedError(error)) {
      debug10("401 detected, attempting token refresh");
      const newCreds = await refreshAccessToken();
      if (!newCreds) {
        debug10("token refresh failed, re-throwing original error");
        throw error;
      }
      resetClient();
      debug10("retrying operation with refreshed token");
      return operation();
    }
    throw error;
  }
}

// src/services/folders.ts
var debug11 = createGranolaDebug("service:folders");
function normalizeFolder(folder) {
  const documentIdsFromDocs = Array.isArray(folder.documents) ? folder.documents.map((doc) => doc?.id).filter((id) => Boolean(id)) : void 0;
  const documentIds = Array.isArray(folder.document_ids) && folder.document_ids.length > 0 ? folder.document_ids : documentIdsFromDocs;
  return {
    id: folder.id,
    name: folder.name ?? folder.title,
    title: folder.title ?? folder.name ?? "Untitled",
    created_at: folder.created_at,
    workspace_id: folder.workspace_id,
    owner_id: folder.owner_id,
    document_ids: documentIds ?? [],
    is_favourite: folder.is_favourite
  };
}
async function list(opts = {}) {
  return withTokenRefresh(async () => {
    const client2 = await getClient();
    const documentLists = await client2.getDocumentLists();
    const folders = documentLists.map(normalizeFolder);
    debug11("list fetched %d folders", folders.length);
    if (opts.workspace) {
      const filtered = folders.filter((folder) => folder.workspace_id === opts.workspace);
      debug11("filtered to %d folders for workspace %s", filtered.length, opts.workspace);
      return filtered;
    }
    return folders;
  });
}
async function get(id) {
  return withTokenRefresh(async () => {
    debug11("get called for folder: %s", id);
    const client2 = await getClient();
    const documentLists = await client2.getDocumentLists();
    const folder = documentLists.find((f) => f.id === id);
    if (!folder) {
      debug11("folder %s not found", id);
      return null;
    }
    debug11("folder %s found", id);
    return normalizeFolder(folder);
  });
}

// src/commands/folder/list.ts
var debug12 = createGranolaDebug("cmd:folder:list");
function createListCommand() {
  return new Command7("list").description("List folders").option("-w, --workspace <id>", "Filter by workspace").option("-o, --output <format>", "Output format (json, yaml, toon)").action(async (opts) => {
    debug12("folder list command invoked with opts: %O", opts);
    let data;
    try {
      data = await list({
        workspace: opts.workspace
      });
      debug12("fetched %d folders", data.length);
    } catch (error) {
      console.error(chalk8.red("Error:"), "Failed to list folders.");
      if (error instanceof Error) {
        console.error(chalk8.dim(error.message));
      }
      process.exit(1);
    }
    const format = opts.output || null;
    if (format) {
      if (!["json", "yaml", "toon"].includes(format)) {
        console.error(chalk8.red(`Invalid format: ${format}. Use 'json', 'yaml', or 'toon'.`));
        process.exit(1);
      }
      console.log(formatOutput(data, format));
      return;
    }
    if (data.length === 0) {
      console.log(chalk8.dim("No folders found."));
      return;
    }
    const rows = data.map((folder) => ({
      ...folder,
      display_name: folder.name || folder.title || "Unnamed"
    }));
    const output = table(rows, [
      { key: "id", header: "ID", width: 12, format: (v) => String(v).slice(0, 8) },
      { key: "display_name", header: "NAME", width: 20, format: (v) => String(v || "") },
      {
        key: "workspace_id",
        header: "WORKSPACE",
        width: 12,
        format: (v) => String(v).slice(0, 8)
      }
    ]);
    console.log(output);
  });
}
var listCommand = createListCommand();

// src/commands/folder/view.ts
import chalk9 from "chalk";
import { Command as Command8 } from "commander";
var debug13 = createGranolaDebug("cmd:folder:view");
function createViewCommand() {
  return new Command8("view").description("View folder details").argument("<id>", "Folder ID").option("-o, --output <format>", "Output format (json, yaml, toon)").action(async (id, opts) => {
    debug13("folder view command invoked with id: %s", id);
    let folder;
    try {
      folder = await get(id);
    } catch (error) {
      console.error(chalk9.red("Error:"), "Failed to load folder.");
      if (error instanceof Error) {
        console.error(chalk9.dim(error.message));
      }
      process.exit(1);
    }
    if (!folder) {
      console.error(chalk9.red(`Folder ${id} not found`));
      process.exit(4);
    }
    const format = opts.output || null;
    if (format) {
      if (!["json", "yaml", "toon"].includes(format)) {
        console.error(chalk9.red(`Invalid format: ${format}. Use 'json', 'yaml', or 'toon'.`));
        process.exit(1);
      }
      console.log(formatOutput(folder, format));
      return;
    }
    const name = folder.name || folder.title || "Unnamed";
    const docCount = folder.document_ids?.length || 0;
    console.log(chalk9.bold(name));
    console.log(chalk9.dim(`${docCount} meetings \xB7 Workspace ${folder.workspace_id}`));
    console.log();
    console.log(chalk9.dim('Tip: Use "granola meeting list" to browse recent meetings.'));
  });
}
var viewCommand = createViewCommand();

// src/commands/folder/index.ts
var folderCommand = new Command9("folder").description("Work with folders").addCommand(listCommand).addCommand(viewCommand);

// src/commands/meeting/index.ts
import { Command as Command16 } from "commander";

// src/commands/meeting/enhanced.ts
import chalk10 from "chalk";
import { Command as Command10 } from "commander";

// src/lib/pager.ts
import { spawn } from "child_process";
var debug14 = createGranolaDebug("lib:pager");
var ALLOWED_PAGERS = ["less", "more", "cat", "head", "tail", "bat", "most"];
var SHELL_METACHARACTERS = /[;&|`$(){}[\]<>\\!#*?]/;
function validatePagerCommand(cmd) {
  debug14("validating pager command: %s", cmd);
  if (SHELL_METACHARACTERS.test(cmd)) {
    debug14("pager validation failed: contains shell metacharacters");
    return false;
  }
  const [binary] = cmd.split(" ");
  const binaryName = binary.split("/").pop() || "";
  const valid = ALLOWED_PAGERS.includes(binaryName);
  debug14("pager validation: %s (binary: %s)", valid ? "passed" : "failed", binaryName);
  return valid;
}
function getPagerCommand() {
  if (process.env.GRANOLA_PAGER) {
    debug14("pager command: %s (source: GRANOLA_PAGER)", process.env.GRANOLA_PAGER);
    return process.env.GRANOLA_PAGER;
  }
  if (process.env.PAGER) {
    debug14("pager command: %s (source: PAGER)", process.env.PAGER);
    return process.env.PAGER;
  }
  const configuredPager = getConfigValue("pager");
  if (configuredPager) {
    debug14("pager command: %s (source: config)", configuredPager);
    return configuredPager;
  }
  debug14("pager command: less -R (source: default)");
  return "less -R";
}
async function pipeToPager(content) {
  debug14("pipeToPager: isTTY=%s, contentLength=%d", process.stdout.isTTY, content.length);
  if (!process.stdout.isTTY) {
    debug14("not a TTY, writing directly to stdout");
    process.stdout.write(`${content}
`);
    return;
  }
  const pagerCmd = getPagerCommand();
  if (!validatePagerCommand(pagerCmd)) {
    console.error(`Warning: Invalid pager command "${pagerCmd}". Falling back to direct output.`);
    process.stdout.write(`${content}
`);
    return;
  }
  const [cmd, ...args] = pagerCmd.split(" ");
  debug14("spawning pager: %s with args: %O", cmd, args);
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    const fallbackToStdout = (reason) => {
      if (settled) return;
      settled = true;
      debug14("falling back to stdout: %s", reason);
      console.error(
        `Warning: Unable to launch pager "${pagerCmd}" (${reason}). Falling back to direct output.`
      );
      process.stdout.write(`${content}
`);
      resolve();
    };
    try {
      const pager = spawn(cmd, args, {
        stdio: ["pipe", "inherit", "inherit"]
      });
      pager.stdin.write(content);
      pager.stdin.end();
      pager.on("close", () => {
        debug14("pager closed");
        finish();
      });
      pager.on("error", (err) => {
        debug14("pager error: %O", err);
        fallbackToStdout(err.message);
      });
    } catch (err) {
      debug14("failed to spawn pager: %O", err);
      fallbackToStdout(err.message);
    }
  });
}

// src/lib/prosemirror.ts
var debug15 = createGranolaDebug("lib:prosemirror");
function toMarkdown(doc) {
  debug15("toMarkdown called with doc: %O", doc);
  if (!doc?.content) {
    debug15("No content in doc, returning empty string");
    return "";
  }
  const result = doc.content.map((n) => nodeToMd(n)).join("\n\n");
  debug15("toMarkdown result: %s", result);
  return result;
}
function nodeToMd(node) {
  debug15("nodeToMd processing node type: %s, node: %O", node.type, node);
  let result;
  switch (node.type) {
    case "heading": {
      const lvl = node.attrs?.level || 1;
      result = `${"#".repeat(lvl)} ${inlineToMd(node.content)}`;
      break;
    }
    case "paragraph":
      result = inlineToMd(node.content);
      break;
    case "bulletList":
      result = (node.content || []).map((li) => nodeToMd(li)).join("\n");
      break;
    case "orderedList":
      result = (node.content || []).map((li, i) => nodeToMd(li).replace(/^- /, `${i + 1}. `)).join("\n");
      break;
    case "listItem":
      result = `- ${(node.content || []).map((c) => nodeToMd(c)).join("\n  ")}`;
      break;
    case "blockquote":
      result = (node.content || []).map((c) => `> ${nodeToMd(c)}`).join("\n");
      break;
    case "codeBlock": {
      const lang = node.attrs?.language || "";
      result = `\`\`\`${lang}
${inlineToMd(node.content)}
\`\`\``;
      break;
    }
    case "horizontalRule":
      result = "---";
      break;
    case "text":
      result = applyMarks(node.text || "", node.marks);
      break;
    default:
      debug15("Unknown node type: %s", node.type);
      result = node.content ? node.content.map((c) => nodeToMd(c)).join("") : "";
  }
  debug15("nodeToMd result for %s: %s", node.type, result);
  return result;
}
function inlineToMd(content) {
  return content ? content.map((n) => nodeToMd(n)).join("") : "";
}
function applyMarks(text, marks) {
  if (!marks) return text;
  for (const m of marks) {
    if (m.type === "bold" || m.type === "strong") text = `**${text}**`;
    if (m.type === "italic" || m.type === "em") text = `*${text}*`;
    if (m.type === "code") text = `\`${text}\``;
    if (m.type === "strike") text = `~~${text}~~`;
  }
  return text;
}

// src/lib/filters.ts
var debug16 = createGranolaDebug("lib:filters");
function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}
function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}
function endOfDay(date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}
function matchesSearch(meeting, query) {
  const normalizedQuery = query.toLowerCase();
  const normalizedTitle = meeting.title.toLowerCase();
  return normalizedTitle.includes(normalizedQuery);
}
function matchesAttendee(meeting, query) {
  const normalizedQuery = query.toLowerCase();
  const peopleAttendees = meeting.people?.attendees ?? [];
  const topLevelAttendees = meeting.attendees ?? [];
  const allAttendees = [...peopleAttendees, ...topLevelAttendees];
  return allAttendees.some((attendee) => {
    const name = attendee.name?.toLowerCase() ?? "";
    const email = attendee.email?.toLowerCase() ?? "";
    return name.includes(normalizedQuery) || email.includes(normalizedQuery);
  });
}
function matchesDate(meeting, date) {
  const meetingDate = new Date(meeting.created_at);
  return isSameDay(meetingDate, date);
}
function matchesDateRange(meeting, since, until) {
  const meetingDate = new Date(meeting.created_at);
  if (since && meetingDate < startOfDay(since)) {
    return false;
  }
  if (until && meetingDate > endOfDay(until)) {
    return false;
  }
  return true;
}
function hasActiveFilters(options) {
  return !!(options.search || options.attendee || options.date || options.since || options.until);
}
function applyFilters(meetings, options) {
  if (!hasActiveFilters(options)) {
    return meetings;
  }
  debug16("applying filters: %O", options);
  const startCount = meetings.length;
  const filtered = meetings.filter((meeting) => {
    if (options.search && !matchesSearch(meeting, options.search)) {
      return false;
    }
    if (options.attendee && !matchesAttendee(meeting, options.attendee)) {
      return false;
    }
    if (options.date && !matchesDate(meeting, options.date)) {
      return false;
    }
    if (!matchesDateRange(meeting, options.since, options.until)) {
      return false;
    }
    return true;
  });
  debug16("filtered %d -> %d meetings", startCount, filtered.length);
  return filtered;
}

// src/services/meetings.ts
var debug17 = createGranolaDebug("service:meetings");
async function getFolderDocumentIds(client2, folderId) {
  debug17("fetching folder %s via getDocumentList", folderId);
  const folder = await client2.getDocumentList(folderId);
  if (!folder) {
    debug17("folder %s not found", folderId);
    return [];
  }
  const ids = folder.document_ids || folder.documents?.map((doc) => doc.id) || [];
  debug17("folder %s returned %d document ids", folderId, ids.length);
  return ids;
}
var DOCUMENT_BATCH_SIZE = 100;
var NOTES_PAGE_SIZE = 50;
var MAX_NOTES_PAGES = 100;
async function fetchMeetingsByIds(client2, documentIds) {
  if (documentIds.length === 0) return [];
  const meetings = [];
  for (let i = 0; i < documentIds.length; i += DOCUMENT_BATCH_SIZE) {
    const chunk = documentIds.slice(i, i + DOCUMENT_BATCH_SIZE);
    const res = await client2.getDocumentsBatch({
      document_ids: chunk,
      include_last_viewed_panel: false
    });
    const docs = res?.documents || res?.docs || [];
    meetings.push(...docs);
  }
  debug17("fetched %d meetings via getDocumentsBatch", meetings.length);
  return meetings;
}
async function loadMeetingMetadata(client2, id) {
  try {
    const metadata = await client2.getDocumentMetadata(id);
    if (!metadata) {
      debug17("getDocumentMetadata returned null for %s", id);
      return null;
    }
    return metadata;
  } catch (err) {
    debug17("getDocumentMetadata failed for %s: %O", id, err);
    return null;
  }
}
async function fetchFolderMeetings(client2, folderId) {
  const ids = await getFolderDocumentIds(client2, folderId);
  if (ids.length === 0) {
    debug17("folder %s has no documents", folderId);
    return [];
  }
  return fetchMeetingsByIds(client2, ids);
}
async function list2(opts = {}) {
  return withTokenRefresh(async () => {
    debug17("list called with opts: %O", opts);
    const client2 = await getClient();
    const { limit = 20, offset = 0, workspace, folder, ...filterOpts } = opts;
    if (folder) {
      debug17("listing meetings for folder: %s", folder);
      const folderMeetings = await fetchFolderMeetings(client2, folder);
      debug17("fetched %d meetings for folder %s", folderMeetings.length, folder);
      let filtered = folderMeetings;
      if (workspace) {
        filtered = folderMeetings.filter((m) => m.workspace_id === workspace);
        debug17(
          "workspace filter applied for folder %s: %d meetings remain",
          folder,
          filtered.length
        );
      }
      filtered = applyFilters(filtered, filterOpts);
      const paginated = filtered.slice(offset, offset + limit);
      debug17("returning %d meetings from folder %s after pagination", paginated.length, folder);
      return paginated;
    }
    if (hasActiveFilters(filterOpts)) {
      debug17("filters active, using cached meetings for filtering");
      let meetings2 = await getCachedMeetings(client2);
      if (workspace) {
        meetings2 = meetings2.filter((m) => m.workspace_id === workspace);
        debug17("filtered to %d meetings for workspace: %s", meetings2.length, workspace);
      }
      meetings2 = applyFilters(meetings2, filterOpts);
      const paginated = meetings2.slice(offset, offset + limit);
      debug17("returning %d meetings after filtering and pagination", paginated.length);
      return paginated;
    }
    const res = await client2.getDocuments({
      limit,
      offset,
      include_last_viewed_panel: false
    });
    let meetings = res?.docs || [];
    debug17("fetched %d meetings", meetings.length);
    if (workspace) {
      meetings = meetings.filter((m) => m.workspace_id === workspace);
      debug17("filtered to %d meetings for workspace: %s", meetings.length, workspace);
    }
    return meetings;
  });
}
var RESOLVE_PAGE_SIZE = 100;
var MAX_RESOLVE_PAGES = 100;
var FULL_UUID_LENGTH = 36;
var CACHE_TTL_MS = 6e4;
var meetingsCache = null;
async function getCachedMeetings(client2) {
  if (meetingsCache && Date.now() - meetingsCache.timestamp < CACHE_TTL_MS) {
    debug17("using cached meetings (%d items)", meetingsCache.meetings.length);
    return meetingsCache.meetings;
  }
  debug17("cache miss or expired, fetching meetings");
  const meetings = [];
  let offset = 0;
  for (let page = 0; page < MAX_RESOLVE_PAGES; page += 1) {
    const res = await client2.getDocuments({
      limit: RESOLVE_PAGE_SIZE,
      offset,
      include_last_viewed_panel: false
    });
    const docs = res?.docs || [];
    meetings.push(...docs);
    if (docs.length < RESOLVE_PAGE_SIZE) {
      break;
    }
    offset += RESOLVE_PAGE_SIZE;
  }
  meetingsCache = { meetings, timestamp: Date.now() };
  debug17("cached %d meetings", meetings.length);
  return meetings;
}
async function resolveId(partialId) {
  return withTokenRefresh(async () => {
    debug17("resolving meeting id: %s (length: %d)", partialId, partialId.length);
    const client2 = await getClient();
    if (partialId.length >= FULL_UUID_LENGTH) {
      debug17("attempting direct lookup for full UUID");
      try {
        const metadata = await client2.getDocumentMetadata(partialId);
        if (metadata) {
          debug17("direct lookup successful for: %s", partialId);
          return partialId;
        }
      } catch {
        debug17("direct lookup failed, falling back to search");
      }
    }
    const meetings = await getCachedMeetings(client2);
    const matches = /* @__PURE__ */ new Set();
    for (const meeting of meetings) {
      if (meeting.id?.startsWith(partialId)) {
        matches.add(meeting.id);
        if (matches.size > 1) {
          debug17("ambiguous id: %s matches >1 meetings", partialId);
          throw new Error(`Ambiguous ID: ${partialId} matches ${matches.size} meetings`);
        }
      }
    }
    if (matches.size === 0) {
      debug17("no meeting found for id: %s", partialId);
      return null;
    }
    const match = matches.values().next().value;
    debug17("resolved meeting: %s -> %s", partialId, match);
    return match;
  });
}
async function get2(id) {
  return withTokenRefresh(async () => {
    debug17("getting meeting: %s", id);
    const client2 = await getClient();
    const metadata = await loadMeetingMetadata(client2, id);
    if (!metadata) {
      debug17("meeting %s: not found", id);
      return null;
    }
    debug17("meeting %s: found", id);
    return { id, ...metadata };
  });
}
async function findMeetingViaDocuments(client2, id, { includeLastViewedPanel }) {
  let offset = 0;
  for (let page = 0; page < MAX_NOTES_PAGES; page += 1) {
    try {
      debug17("findMeetingViaDocuments fetching page %d (offset: %d)", page, offset);
      const res = await client2.getDocuments({
        limit: NOTES_PAGE_SIZE,
        offset,
        include_last_viewed_panel: includeLastViewedPanel
      });
      const meetings = res?.docs || [];
      debug17("findMeetingViaDocuments got %d meetings on page %d", meetings.length, page);
      if (meetings.length === 0) break;
      const meeting = meetings.find((m) => m.id === id);
      if (meeting) {
        debug17("findMeetingViaDocuments located meeting %s on page %d", id, page);
        return meeting;
      }
      offset += NOTES_PAGE_SIZE;
    } catch (err) {
      debug17("findMeetingViaDocuments error: %O", err);
      return null;
    }
  }
  debug17("findMeetingViaDocuments did not locate meeting %s", id);
  return null;
}
async function getNotes(id) {
  return withTokenRefresh(async () => {
    debug17("getNotes called with id: %s", id);
    const client2 = await getClient();
    const metadata = await loadMeetingMetadata(client2, id);
    if (metadata && "notes" in metadata) {
      debug17("getNotes resolved via metadata response");
      return metadata.notes || null;
    }
    const meeting = await findMeetingViaDocuments(client2, id, {
      includeLastViewedPanel: false
    });
    if (meeting) {
      return meeting.notes || null;
    }
    return null;
  });
}
async function getEnhancedNotes(id) {
  return withTokenRefresh(async () => {
    debug17("getEnhancedNotes called with id: %s", id);
    const client2 = await getClient();
    const metadata = await loadMeetingMetadata(client2, id);
    if (metadata && "last_viewed_panel" in metadata) {
      debug17("getEnhancedNotes resolved via metadata response");
      return metadata.last_viewed_panel?.content || null;
    }
    const meeting = await findMeetingViaDocuments(client2, id, {
      includeLastViewedPanel: true
    });
    if (meeting) {
      return meeting.last_viewed_panel?.content || null;
    }
    return null;
  });
}
async function getTranscript(id) {
  return withTokenRefresh(async () => {
    debug17("getTranscript called with id: %s", id);
    const client2 = await getClient();
    try {
      const transcript = await client2.getDocumentTranscript(id);
      debug17("getTranscript got %d utterances", transcript.length);
      return transcript;
    } catch (err) {
      debug17("getTranscript error: %O", err);
      return [];
    }
  });
}

// src/commands/meeting/enhanced.ts
var debug18 = createGranolaDebug("cmd:meeting:enhanced");
function createEnhancedCommand() {
  return new Command10("enhanced").description("View AI-enhanced meeting notes").argument("<id>", "Meeting ID").option("-o, --output <format>", "Output format (markdown, json, yaml, toon)", "markdown").action(async (id, opts, cmd) => {
    debug18("enhanced command invoked with id: %s", id);
    const global = cmd.optsWithGlobals();
    let fullId;
    try {
      const resolved = await resolveId(id);
      if (!resolved) {
        console.error(chalk10.red(`Meeting ${id} not found`));
        process.exit(4);
      }
      fullId = resolved;
    } catch (err) {
      console.error(chalk10.red(err.message));
      process.exit(1);
    }
    let notes;
    try {
      notes = await getEnhancedNotes(fullId);
    } catch (error) {
      debug18("failed to load enhanced notes: %O", error);
      console.error(chalk10.red("Error:"), "Failed to fetch enhanced notes.");
      if (error instanceof Error) {
        console.error(chalk10.dim(error.message));
      }
      process.exit(1);
    }
    if (!notes) {
      console.error(chalk10.red(`No enhanced notes found for meeting ${id}`));
      process.exit(4);
    }
    const format = opts.output || "markdown";
    const structuredFormats = ["json", "yaml", "toon"];
    if (format !== "markdown" && !structuredFormats.includes(format)) {
      console.error(
        chalk10.red(`Invalid format: ${format}. Use 'markdown', 'json', 'yaml', or 'toon'.`)
      );
      process.exit(1);
    }
    if (structuredFormats.includes(format)) {
      console.log(formatOutput(notes, format));
      return;
    }
    const md = toMarkdown(notes);
    if (global.noPager || !process.stdout.isTTY) {
      console.log(md);
    } else {
      await pipeToPager(md);
    }
  });
}
var enhancedCommand = createEnhancedCommand();

// src/commands/meeting/export.ts
import chalk11 from "chalk";
import { Command as Command11 } from "commander";

// src/lib/toon.ts
import { encode } from "@toon-format/toon";
function toToon(data) {
  return encode(data);
}

// src/commands/meeting/export.ts
var debug19 = createGranolaDebug("cmd:meeting:export");
function createExportCommand() {
  return new Command11("export").description("Export meeting data").argument("<id>", "Meeting ID").option("-f, --format <format>", "Output format (json, toon)", "json").action(async (id, options) => {
    debug19("export command invoked with id: %s, format: %s", id, options.format);
    const format = options.format;
    if (format !== "json" && format !== "toon") {
      console.error(chalk11.red(`Invalid format: ${options.format}. Use 'json' or 'toon'.`));
      process.exit(1);
    }
    let fullId;
    try {
      const resolved = await resolveId(id);
      if (!resolved) {
        console.error(chalk11.red(`Meeting ${id} not found`));
        process.exit(4);
      }
      fullId = resolved;
    } catch (err) {
      console.error(chalk11.red(err.message));
      process.exit(1);
    }
    const [meeting, notes, transcript] = await Promise.all([
      get2(fullId),
      getNotes(fullId),
      getTranscript(fullId)
    ]);
    if (!meeting) {
      console.error(chalk11.red(`Meeting ${id} not found`));
      process.exit(4);
    }
    const output = {
      id: meeting.id,
      title: meeting.title,
      created_at: meeting.created_at,
      updated_at: meeting.updated_at,
      workspace_id: meeting.workspace_id,
      people: meeting.people,
      notes_markdown: notes ? toMarkdown(notes) : null,
      notes_raw: notes,
      transcript
    };
    if (format === "toon") {
      console.log(toToon(output));
    } else {
      console.log(JSON.stringify(output, null, 2));
    }
  });
}
var exportCommand = createExportCommand();

// src/commands/meeting/list.ts
import chalk12 from "chalk";
import { Command as Command12 } from "commander";

// src/lib/date-parser.ts
var debug20 = createGranolaDebug("lib:date-parser");
var MONTH_NAMES = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11
};
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}
function startOfDay2(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}
function parseDate(input) {
  const normalized = input.trim().toLowerCase();
  debug20("parsing date: %s", normalized);
  if (normalized === "today") {
    return startOfDay2(/* @__PURE__ */ new Date());
  }
  if (normalized === "yesterday") {
    return startOfDay2(addDays(/* @__PURE__ */ new Date(), -1));
  }
  if (normalized === "tomorrow") {
    return startOfDay2(addDays(/* @__PURE__ */ new Date(), 1));
  }
  if (normalized === "last week") {
    return startOfDay2(addDays(/* @__PURE__ */ new Date(), -7));
  }
  if (normalized === "last month") {
    return startOfDay2(addMonths(/* @__PURE__ */ new Date(), -1));
  }
  const daysAgoMatch = normalized.match(/^(\d+)\s+days?\s+ago$/);
  if (daysAgoMatch) {
    return startOfDay2(addDays(/* @__PURE__ */ new Date(), -Number.parseInt(daysAgoMatch[1], 10)));
  }
  const weeksAgoMatch = normalized.match(/^(\d+)\s+weeks?\s+ago$/);
  if (weeksAgoMatch) {
    return startOfDay2(addDays(/* @__PURE__ */ new Date(), -Number.parseInt(weeksAgoMatch[1], 10) * 7));
  }
  const monthsAgoMatch = normalized.match(/^(\d+)\s+months?\s+ago$/);
  if (monthsAgoMatch) {
    return startOfDay2(addMonths(/* @__PURE__ */ new Date(), -Number.parseInt(monthsAgoMatch[1], 10)));
  }
  const isoMatch = input.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const year = Number.parseInt(isoMatch[1], 10);
    const month = Number.parseInt(isoMatch[2], 10) - 1;
    const day = Number.parseInt(isoMatch[3], 10);
    const date = new Date(year, month, day);
    if (!Number.isNaN(date.getTime())) {
      return startOfDay2(date);
    }
  }
  const monthDayMatch = normalized.match(/^([a-z]+)\s+(\d{1,2})(?:\s+(\d{4}))?$/);
  if (monthDayMatch) {
    const monthNum = MONTH_NAMES[monthDayMatch[1]];
    if (monthNum !== void 0) {
      const day = Number.parseInt(monthDayMatch[2], 10);
      const year = monthDayMatch[3] ? Number.parseInt(monthDayMatch[3], 10) : (/* @__PURE__ */ new Date()).getFullYear();
      const date = new Date(year, monthNum, day);
      if (!Number.isNaN(date.getTime())) {
        return startOfDay2(date);
      }
    }
  }
  const dayMonthMatch = normalized.match(/^(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?$/);
  if (dayMonthMatch) {
    const monthNum = MONTH_NAMES[dayMonthMatch[2]];
    if (monthNum !== void 0) {
      const day = Number.parseInt(dayMonthMatch[1], 10);
      const year = dayMonthMatch[3] ? Number.parseInt(dayMonthMatch[3], 10) : (/* @__PURE__ */ new Date()).getFullYear();
      const date = new Date(year, monthNum, day);
      if (!Number.isNaN(date.getTime())) {
        return startOfDay2(date);
      }
    }
  }
  debug20("failed to parse date: %s", input);
  return null;
}
function validateDateOption(value, optionName) {
  const parsed = parseDate(value);
  if (!parsed) {
    throw new Error(
      `Invalid date for ${optionName}: "${value}". Try formats like: today, yesterday, last week, 2024-01-15, "Dec 20"`
    );
  }
  debug20("validated %s: %s -> %s", optionName, value, parsed.toISOString());
  return parsed;
}

// src/commands/meeting/list.ts
var debug21 = createGranolaDebug("cmd:meeting:list");
function createListCommand2() {
  return new Command12("list").description("List meetings").option("-l, --limit <n>", "Number of meetings", "20").option("-w, --workspace <id>", "Filter by workspace").option("-f, --folder <id>", "Filter by folder").option("-s, --search <query>", "Search in meeting titles").option("-a, --attendee <name>", "Filter by attendee name or email").option("-d, --date <date>", "Filter meetings on a specific date").option("--since <date>", "Filter meetings from date (inclusive)").option("--until <date>", "Filter meetings up to date (inclusive)").option("-o, --output <format>", "Output format (json, yaml, toon)").action(async (opts) => {
    debug21("list command invoked with opts: %O", opts);
    const limit = Number.parseInt(opts.limit, 10);
    if (!Number.isFinite(limit) || limit < 1) {
      console.error(chalk12.red("Invalid --limit value. Please provide a positive number."));
      process.exit(1);
    }
    const configuredWorkspace = getConfigValue("default_workspace");
    const workspace = opts.workspace ?? configuredWorkspace;
    let date;
    let since;
    let until;
    try {
      if (opts.date) {
        date = validateDateOption(opts.date, "--date");
      }
      if (opts.since) {
        since = validateDateOption(opts.since, "--since");
      }
      if (opts.until) {
        until = validateDateOption(opts.until, "--until");
      }
    } catch (err) {
      console.error(chalk12.red(err.message));
      process.exit(1);
    }
    if (since && until && since > until) {
      console.error(chalk12.red("--since date must be before --until date"));
      process.exit(1);
    }
    const data = await list2({
      limit,
      workspace,
      folder: opts.folder,
      search: opts.search,
      attendee: opts.attendee,
      date,
      since,
      until
    });
    debug21("fetched %d meetings", data.length);
    const format = opts.output || null;
    debug21("output format: %s", format || "table");
    if (format) {
      if (!["json", "yaml", "toon"].includes(format)) {
        console.error(chalk12.red(`Invalid format: ${format}. Use 'json', 'yaml', or 'toon'.`));
        process.exit(1);
      }
      console.log(formatOutput(data, format));
      return;
    }
    if (data.length === 0) {
      console.log(chalk12.dim("No meetings found."));
      return;
    }
    console.log(chalk12.dim(`Showing ${data.length} meetings
`));
    const output = table(data, [
      { key: "id", header: "ID", width: 12, format: (v) => String(v).slice(0, 8) },
      { key: "title", header: "TITLE", width: 36, format: (v) => truncate(String(v), 35) },
      { key: "created_at", header: "DATE", width: 14, format: (v) => formatDate(String(v)) }
    ]);
    console.log(output);
  });
}
var listCommand2 = createListCommand2();

// src/commands/meeting/notes.ts
import chalk13 from "chalk";
import { Command as Command13 } from "commander";
var debug22 = createGranolaDebug("cmd:meeting:notes");
function createNotesCommand() {
  return new Command13("notes").description("View meeting notes").argument("<id>", "Meeting ID").option("-o, --output <format>", "Output format (markdown, json, yaml, toon)", "markdown").action(async (id, opts, cmd) => {
    debug22("notes command invoked with id: %s", id);
    const global = cmd.optsWithGlobals();
    let fullId;
    try {
      const resolved = await resolveId(id);
      if (!resolved) {
        console.error(chalk13.red(`Meeting ${id} not found`));
        process.exit(4);
      }
      fullId = resolved;
    } catch (err) {
      console.error(chalk13.red(err.message));
      process.exit(1);
    }
    let notes;
    try {
      notes = await getNotes(fullId);
    } catch (error) {
      debug22("failed to load notes: %O", error);
      console.error(chalk13.red("Error:"), "Failed to fetch notes.");
      if (error instanceof Error) {
        console.error(chalk13.dim(error.message));
      }
      process.exit(1);
    }
    if (!notes) {
      console.error(chalk13.red(`No notes found for meeting ${id}`));
      process.exit(4);
    }
    const format = opts.output || "markdown";
    const structuredFormats = ["json", "yaml", "toon"];
    if (format !== "markdown" && !structuredFormats.includes(format)) {
      console.error(
        chalk13.red(`Invalid format: ${format}. Use 'markdown', 'json', 'yaml', or 'toon'.`)
      );
      process.exit(1);
    }
    if (structuredFormats.includes(format)) {
      console.log(formatOutput(notes, format));
      return;
    }
    const md = toMarkdown(notes);
    if (global.noPager || !process.stdout.isTTY) {
      console.log(md);
    } else {
      await pipeToPager(md);
    }
  });
}
var notesCommand = createNotesCommand();

// src/commands/meeting/transcript.ts
import chalk14 from "chalk";
import { Command as Command14 } from "commander";

// src/lib/transcript.ts
var debug23 = createGranolaDebug("lib:transcript");
function formatTranscript(utterances, opts = {}) {
  debug23("formatTranscript: %d utterances, opts=%O", utterances.length, opts);
  const { timestamps = false, source = "all" } = opts;
  let filtered = utterances;
  if (source !== "all") {
    filtered = utterances.filter((u) => u.source === source);
    debug23("filtered to %d utterances (source=%s)", filtered.length, source);
  }
  if (filtered.length === 0) {
    debug23("no transcript available");
    return "No transcript available.";
  }
  const lines = [];
  for (const u of filtered) {
    const speaker = u.source === "microphone" ? "You" : "Participant";
    if (timestamps) {
      const time = formatTimestamp(u.start_timestamp);
      lines.push(`[${time}] ${speaker}`);
      lines.push(u.text);
      lines.push("");
    } else {
      lines.push(`${speaker}: ${u.text}`);
      lines.push("");
    }
  }
  return lines.join("\n").trim();
}
function formatTimestamp(iso) {
  const d = new Date(iso);
  const h = d.getUTCHours().toString().padStart(2, "0");
  const m = d.getUTCMinutes().toString().padStart(2, "0");
  const s = d.getUTCSeconds().toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

// src/commands/meeting/transcript.ts
var debug24 = createGranolaDebug("cmd:meeting:transcript");
var SOURCE_OPTIONS = /* @__PURE__ */ new Set(["microphone", "system", "all"]);
function createTranscriptCommand() {
  return new Command14("transcript").description("View meeting transcript").argument("<id>", "Meeting ID").option("-t, --timestamps", "Include timestamps").option("-s, --source <type>", "Filter: microphone, system, all", "all").option("-o, --output <format>", "Output format (text, json, yaml, toon)", "text").action(async (id, opts, cmd) => {
    debug24("transcript command invoked with id: %s, opts: %O", id, opts);
    const global = cmd.optsWithGlobals();
    let fullId;
    try {
      const resolved = await resolveId(id);
      if (!resolved) {
        console.error(chalk14.red(`Meeting ${id} not found`));
        process.exit(4);
      }
      fullId = resolved;
    } catch (err) {
      console.error(chalk14.red(err.message));
      process.exit(1);
    }
    const transcript = await getTranscript(fullId);
    if (transcript.length === 0) {
      console.error(chalk14.red(`No transcript found for meeting ${id}`));
      process.exit(4);
    }
    const requestedSource = opts.source || "all";
    if (!SOURCE_OPTIONS.has(requestedSource)) {
      console.error(
        chalk14.red(`Invalid source: ${requestedSource}. Use 'microphone', 'system', or 'all'.`)
      );
      process.exit(1);
    }
    const format = opts.output || "text";
    const structuredFormats = ["json", "yaml", "toon"];
    if (format !== "text" && !structuredFormats.includes(format)) {
      console.error(
        chalk14.red(`Invalid format: ${format}. Use 'text', 'json', 'yaml', or 'toon'.`)
      );
      process.exit(1);
    }
    if (structuredFormats.includes(format)) {
      console.log(formatOutput(transcript, format));
      return;
    }
    const output = formatTranscript(transcript, {
      timestamps: opts.timestamps,
      source: requestedSource
    });
    if (global.noPager || !process.stdout.isTTY) {
      console.log(output);
    } else {
      await pipeToPager(output);
    }
  });
}
var transcriptCommand = createTranscriptCommand();

// src/commands/meeting/view.ts
import chalk15 from "chalk";
import { Command as Command15 } from "commander";
import open2 from "open";
var debug25 = createGranolaDebug("cmd:meeting:view");
function createViewCommand2() {
  return new Command15("view").description("View meeting details").argument("<id>", "Meeting ID").option("--web", "Open in browser").option("-o, --output <format>", "Output format (json, yaml, toon)").action(async (id, opts) => {
    debug25("view command invoked with id: %s, opts: %O", id, opts);
    let fullId;
    try {
      const resolved = await resolveId(id);
      if (!resolved) {
        console.error(chalk15.red(`Meeting ${id} not found`));
        process.exit(4);
      }
      fullId = resolved;
    } catch (err) {
      console.error(chalk15.red(err.message));
      process.exit(1);
    }
    if (opts.web) {
      await open2(`https://notes.granola.ai/d/${fullId}`);
      return;
    }
    const meeting = await get2(fullId);
    if (!meeting) {
      console.error(chalk15.red(`Meeting ${id} not found`));
      process.exit(4);
    }
    const format = opts.output || null;
    if (format) {
      if (!["json", "yaml", "toon"].includes(format)) {
        console.error(chalk15.red(`Invalid format: ${format}. Use 'json', 'yaml', or 'toon'.`));
        process.exit(1);
      }
      console.log(formatOutput(meeting, format));
      return;
    }
    console.log(chalk15.bold(meeting.title));
    console.log(chalk15.dim(`Recorded ${formatDate(meeting.created_at)}`));
    console.log();
    console.log(`Workspace:    ${meeting.workspace_id || "Personal"}`);
    if (meeting.creator?.name) {
      console.log(`Organizer:    ${meeting.creator.name}`);
    }
    if (meeting.attendees?.length) {
      console.log(`Attendees:    ${meeting.attendees.length} participant(s)`);
      for (const attendee of meeting.attendees) {
        const name = attendee.name || attendee.details?.person?.name?.fullName || "Unknown";
        const title = attendee.details?.employment?.title;
        const info = title ? `${name} (${title})` : name;
        console.log(chalk15.dim(`              - ${info}`));
      }
    }
    console.log();
    console.log(`${chalk15.dim("View notes:       ")}granola meeting notes ${id}`);
    console.log(`${chalk15.dim("View transcript:  ")}granola meeting transcript ${id}`);
  });
}
var viewCommand2 = createViewCommand2();

// src/commands/meeting/index.ts
var meetingCommand = new Command16("meeting").description("Work with meetings").addCommand(listCommand2).addCommand(viewCommand2).addCommand(notesCommand).addCommand(enhancedCommand).addCommand(transcriptCommand).addCommand(exportCommand);

// src/commands/workspace/index.ts
import { Command as Command19 } from "commander";

// src/commands/workspace/list.ts
import chalk16 from "chalk";
import { Command as Command17 } from "commander";

// src/services/workspaces.ts
var debug26 = createGranolaDebug("service:workspaces");
async function list3() {
  return withTokenRefresh(async () => {
    debug26("fetching workspaces");
    const client2 = await getClient();
    const res = await client2.getWorkspaces();
    const workspacesArray = res?.workspaces || [];
    debug26("found %d workspaces", workspacesArray.length);
    return workspacesArray.map((item) => {
      const ws = item.workspace;
      return {
        id: ws.workspace_id,
        name: ws.display_name,
        created_at: ws.created_at,
        owner_id: ""
      };
    });
  });
}
async function resolveId2(partialId) {
  debug26("resolving workspace id: %s", partialId);
  const workspaces = await list3();
  const matches = workspaces.filter((w) => w.id.startsWith(partialId));
  if (matches.length === 0) {
    debug26("no workspace found for id: %s", partialId);
    return null;
  }
  if (matches.length > 1) {
    debug26("ambiguous id: %s matches %d workspaces", partialId, matches.length);
    throw new Error(`Ambiguous ID: ${partialId} matches ${matches.length} workspaces`);
  }
  debug26("resolved workspace: %s -> %s", partialId, matches[0].id);
  return matches[0].id;
}
async function get3(id) {
  debug26("getting workspace: %s", id);
  const workspaces = await list3();
  const workspace = workspaces.find((w) => w.id === id) || null;
  debug26("workspace %s: %s", id, workspace ? "found" : "not found");
  return workspace;
}

// src/commands/workspace/list.ts
var debug27 = createGranolaDebug("cmd:workspace:list");
function createListCommand3() {
  return new Command17("list").description("List workspaces").option("-o, --output <format>", "Output format (json, yaml, toon)").action(async (opts) => {
    debug27("workspace list command invoked");
    const data = await list3();
    debug27("fetched %d workspaces", data.length);
    const format = opts.output || null;
    if (format) {
      if (!["json", "yaml", "toon"].includes(format)) {
        console.error(chalk16.red(`Invalid format: ${format}. Use 'json', 'yaml', or 'toon'.`));
        process.exit(1);
      }
      console.log(formatOutput(data, format));
      return;
    }
    if (data.length === 0) {
      console.log(chalk16.dim("No workspaces found."));
      return;
    }
    const output = table(data, [
      { key: "id", header: "ID", width: 12, format: (v) => String(v).slice(0, 8) },
      { key: "name", header: "NAME", width: 20 },
      { key: "created_at", header: "CREATED", width: 14, format: (v) => formatDate(String(v)) }
    ]);
    console.log(output);
  });
}
var listCommand3 = createListCommand3();

// src/commands/workspace/view.ts
import chalk17 from "chalk";
import { Command as Command18 } from "commander";
var debug28 = createGranolaDebug("cmd:workspace:view");
function createViewCommand3() {
  return new Command18("view").description("View workspace details").argument("<id>", "Workspace ID").option("-o, --output <format>", "Output format (json, yaml, toon)").action(async (id, opts) => {
    debug28("workspace view command invoked with id: %s", id);
    let fullId;
    try {
      const resolved = await resolveId2(id);
      if (!resolved) {
        console.error(chalk17.red(`Workspace ${id} not found`));
        process.exit(4);
      }
      fullId = resolved;
    } catch (err) {
      console.error(chalk17.red(err.message));
      process.exit(1);
    }
    const workspace = await get3(fullId);
    if (!workspace) {
      console.error(chalk17.red(`Workspace ${id} not found`));
      process.exit(4);
    }
    const format = opts.output || null;
    if (format) {
      if (!["json", "yaml", "toon"].includes(format)) {
        console.error(chalk17.red(`Invalid format: ${format}. Use 'json', 'yaml', or 'toon'.`));
        process.exit(1);
      }
      console.log(formatOutput(workspace, format));
      return;
    }
    console.log(chalk17.bold(workspace.name));
    console.log(chalk17.dim(`Created ${formatDate(workspace.created_at)}`));
    console.log();
    console.log(`View all meetings:  granola meeting list --workspace ${id}`);
  });
}
var viewCommand3 = createViewCommand3();

// src/commands/workspace/index.ts
var workspaceCommand = new Command19("workspace").description("Work with workspaces").addCommand(listCommand3).addCommand(viewCommand3);

// src/lib/errors.ts
import chalk18 from "chalk";
function handleGlobalError(error) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      console.error(chalk18.red("Error:"), "Authentication required.");
      console.error(`Run ${chalk18.cyan("granola auth login")} to authenticate.`);
      return 2;
    }
    console.error(chalk18.red("Error:"), error.message);
    return 1;
  }
  if (error instanceof Error && error.message.includes("fetch failed")) {
    console.error(chalk18.red("Error:"), "Network error. Check your connection.");
    return 1;
  }
  if (error instanceof Error) {
    console.error(chalk18.red("Error:"), error.message || "An unexpected error occurred.");
  } else {
    console.error(chalk18.red("Error:"), "An unexpected error occurred.");
  }
  return 1;
}

// src/main.ts
var debug29 = createGranolaDebug("cli");
var debugAlias = createGranolaDebug("cli:alias");
var packageJson = JSON.parse(readFileSync2(new URL("../package.json", import.meta.url), "utf-8"));
debug29("granola-cli v%s starting", packageJson.version);
debug29("arguments: %O", process.argv.slice(2));
var program = new Command20();
program.name("granola").description("CLI for Granola meeting notes").version(packageJson.version).option("--no-pager", "Disable pager");
program.addCommand(authCommand);
program.addCommand(meetingCommand);
program.addCommand(workspaceCommand);
program.addCommand(folderCommand);
program.addCommand(configCommand);
program.addCommand(aliasCommand);
function expandAlias(args) {
  if (args.length < 3) return args;
  const command = args[2];
  debugAlias("checking alias for command: %s", command);
  const alias = getAlias(command);
  if (alias) {
    debugAlias("alias found: %s -> %s", command, alias);
    try {
      const aliasArgs = parseAliasArguments(alias);
      const expanded = [...args.slice(0, 2), ...aliasArgs, ...args.slice(3)];
      debugAlias("expanded args: %O", expanded.slice(2));
      return expanded;
    } catch (err) {
      debugAlias("failed to expand alias %s: %O", command, err);
      return args;
    }
  }
  return args;
}
var expandedArgs = expandAlias(process.argv);
debug29("parsing with args: %O", expandedArgs.slice(2));
program.parseAsync(expandedArgs).catch((error) => {
  const exitCode = handleGlobalError(error);
  process.exit(exitCode);
});
//# sourceMappingURL=main.js.map