export const CURRENT_VERSION = 1;

export interface Settings {
  version: number;
}

export const DEFAULT_SETTINGS: Settings = {
  version: CURRENT_VERSION,
};
