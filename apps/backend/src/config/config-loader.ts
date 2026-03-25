import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { ZodError } from "zod";

import {
  backendConfigSchema,
  sanitizeBackendConfig,
  type BackendConfig,
  type SanitizedBackendConfig,
} from "./config-schema.js";
import { resolveBackendConfigPath, type ResolveConfigPathOptions } from "./config-path.js";
import { createDefaultConfig } from "./default-config.js";

export type ConfigLoadErrorCode = "config_read_error" | "config_parse_error" | "config_validation_error";

export class ConfigLoadError extends Error {
  constructor(
    readonly code: ConfigLoadErrorCode,
    readonly configPath: string,
    message: string,
    readonly causeValue?: unknown,
  ) {
    super(message);
    this.name = "ConfigLoadError";
  }
}

export interface LoadBackendConfigOptions extends ResolveConfigPathOptions {
  readTextFile?: (filePath: string) => Promise<string>;
  fileExists?: (filePath: string) => Promise<boolean>;
}

export interface LoadedBackendConfig {
  path: string;
  exists: boolean;
  config: BackendConfig;
}

export interface DumpedBackendConfig {
  path: string;
  exists: boolean;
  config: SanitizedBackendConfig;
}

export async function loadBackendConfig(options: LoadBackendConfigOptions = {}): Promise<LoadedBackendConfig> {
  const configPath = resolveBackendConfigPath(options);
  const exists = await doesFileExist(configPath, options.fileExists);

  if (!exists) {
    return {
      path: configPath,
      exists: false,
      config: createDefaultConfig(),
    };
  }

  const rawText = await readConfigText(configPath, options.readTextFile);
  const parsedJson = parseConfigJson(rawText, configPath);
  const parsedConfig = parseBackendConfig(parsedJson, configPath);

  return {
    path: configPath,
    exists: true,
    config: applyFileAwareDefaults(parsedConfig, parsedJson),
  };
}

export async function loadSanitizedBackendConfig(
  options: LoadBackendConfigOptions = {},
): Promise<DumpedBackendConfig> {
  const loaded = await loadBackendConfig(options);

  return {
    path: loaded.path,
    exists: loaded.exists,
    config: sanitizeBackendConfig(loaded.config),
  };
}

async function doesFileExist(
  filePath: string,
  fileExists?: (filePath: string) => Promise<boolean>,
): Promise<boolean> {
  if (fileExists) {
    return await fileExists(filePath);
  }

  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readConfigText(
  configPath: string,
  readTextFile?: (filePath: string) => Promise<string>,
): Promise<string> {
  try {
    if (readTextFile) {
      return await readTextFile(configPath);
    }

    return await readFile(configPath, "utf8");
  } catch (error) {
    throw new ConfigLoadError(
      "config_read_error",
      configPath,
      `Could not read backend config at ${configPath}.`,
      error,
    );
  }
}

function parseConfigJson(text: string, configPath: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new ConfigLoadError(
      "config_parse_error",
      configPath,
      `Backend config at ${configPath} is not valid JSON.`,
      error,
    );
  }
}

function parseBackendConfig(input: unknown, configPath: string): BackendConfig {
  try {
    const parsed = backendConfigSchema.parse(input);
    assertUniqueProviders(parsed, configPath);
    return parsed;
  } catch (error) {
    if (error instanceof ConfigLoadError) {
      throw error;
    }

    if (error instanceof ZodError) {
      throw new ConfigLoadError(
        "config_validation_error",
        configPath,
        `Backend config at ${configPath} failed schema validation.`,
        error.flatten(),
      );
    }

    throw error;
  }
}

function assertUniqueProviders(config: BackendConfig, configPath: string): void {
  const seen = new Set<string>();

  for (const provider of config.providers) {
    if (seen.has(provider.id)) {
      throw new ConfigLoadError(
        "config_validation_error",
        configPath,
        `Backend config at ${configPath} contains duplicate provider id: ${provider.id}.`,
      );
    }

    seen.add(provider.id);
  }
}

function applyFileAwareDefaults(config: BackendConfig, rawConfig: unknown): BackendConfig {
  if (!isObject(rawConfig)) {
    return config;
  }

  const hasProvidersField = Object.hasOwn(rawConfig, "providers");

  if (hasProvidersField) {
    return config;
  }

  return {
    ...config,
    providers: createDefaultConfig().providers,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
