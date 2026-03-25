import type { ProviderId } from "shared-contract";

import type { ProviderAdapter } from "./provider-adapter.js";

export class ProviderRegistry {
  readonly #ordered: ProviderAdapter[] = [];
  readonly #byId = new Map<ProviderId, ProviderAdapter>();

  constructor(adapters: ProviderAdapter[] = []) {
    for (const adapter of adapters) {
      this.register(adapter);
    }
  }

  register(adapter: ProviderAdapter): this {
    if (this.#byId.has(adapter.id)) {
      throw new Error(`Provider adapter already registered: ${adapter.id}`);
    }

    this.#ordered.push(adapter);
    this.#byId.set(adapter.id, adapter);
    return this;
  }

  all(): ProviderAdapter[] {
    return [...this.#ordered];
  }

  getById(id: ProviderId): ProviderAdapter | undefined {
    return this.#byId.get(id);
  }

  resolve(providerIds: ProviderId[] | null): ProviderAdapter[] {
    if (!providerIds || providerIds.length === 0) {
      return this.all();
    }

    return providerIds.map((providerId) => {
      const adapter = this.getById(providerId);

      if (!adapter) {
        throw new Error(`Unknown provider: ${providerId}`);
      }

      return adapter;
    });
  }
}
