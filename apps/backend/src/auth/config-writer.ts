import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { BackendConfig, ProviderConfig } from "../config/config-schema.js";
import { backendConfigSchema } from "../config/config-schema.js";
import { loadBackendConfig } from "../config/config-loader.js";

export interface SecretReference {
  store: "secret-tool";
  service: string;
  account: string;
}

export interface EnsureCopilotSecretRefOptions {
  fileExists?: (filePath: string) => Promise<boolean>;
  readTextFile?: (filePath: string) => Promise<string>;
  writeTextFile?: (filePath: string, contents: string) => Promise<void>;
  mkdirFn?: (directoryPath: string) => Promise<void>;
}

export async function ensureCopilotSecretRef(
  configPath: string,
  secretRef: SecretReference,
  options: EnsureCopilotSecretRefOptions = {},
): Promise<void> {
  const loadedConfig = await loadBackendConfig({
    explicitPath: configPath,
    fileExists: options.fileExists,
    readTextFile: options.readTextFile,
  });
  const currentCopilot = loadedConfig.config.providers.find((provider) => provider.id === "copilot");

  if (hasMatchingSecretRef(currentCopilot, secretRef)) {
    return;
  }

  const nextConfig = upsertCopilotSecretRef(loadedConfig.config, secretRef);
  const serialized = `${JSON.stringify(backendConfigSchema.parse(nextConfig), null, 2)}\n`;

  await (options.mkdirFn ?? defaultMkdir)(path.dirname(configPath));
  await (options.writeTextFile ?? defaultWriteTextFile)(configPath, serialized);
}

function upsertCopilotSecretRef(config: BackendConfig, secretRef: SecretReference): BackendConfig {
  const providers = [...config.providers];
  const providerIndex = providers.findIndex((provider) => provider.id === "copilot");

  if (providerIndex >= 0) {
    const provider = providers[providerIndex];
    providers[providerIndex] = {
      ...provider,
      secretRef: {
        store: "secret-tool",
        service: secretRef.service,
        account: secretRef.account,
      },
    };
  } else {
    providers.push({
      id: "copilot",
      enabled: true,
      sourceMode: "api",
      secretRef: {
        store: "secret-tool",
        service: secretRef.service,
        account: secretRef.account,
      },
    });
  }

  return {
    ...config,
    providers,
  };
}

function hasMatchingSecretRef(provider: ProviderConfig | undefined, secretRef: SecretReference): boolean {
  return provider?.secretRef?.store === "secret-tool"
    && provider.secretRef.service === secretRef.service
    && provider.secretRef.account === secretRef.account;
}

async function defaultMkdir(directoryPath: string): Promise<void> {
  await mkdir(directoryPath, {
    recursive: true,
  });
}

async function defaultWriteTextFile(filePath: string, contents: string): Promise<void> {
  await writeFile(filePath, contents, "utf8");
}
