import { getBuiltinProviders } from '../providers/index.js';
import { ProviderRegistry } from './provider-registry.js';

export function createProviderRegistry(): ProviderRegistry {
  return new ProviderRegistry(getBuiltinProviders());
}
