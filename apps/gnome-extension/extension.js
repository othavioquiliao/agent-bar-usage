import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Indicator } from './panel/indicator.js';
import { createBackendClient } from './services/backend-client.js';
import { createPollingService } from './services/polling-service.js';
import { createInitialState } from './state/extension-state.js';

export default class AgentBarUbuntuExtension extends Extension {
  constructor(metadata) {
    super(metadata);
    this._indicator = null;
    this._backendClient = null;
    this._pollingService = null;
  }

  enable() {
    if (this._indicator) {
      return;
    }

    const initialState = createInitialState();
    const findProgramInPath = (name) => {
      const found = GLib.find_program_in_path(name);
      if (found) return found;

      // GNOME Shell (Wayland) often has no PATH set.
      // Fall back to the well-known install location.
      if (name === 'agent-bar') {
        const fallback = GLib.build_filenamev([GLib.get_home_dir(), '.local', 'bin', 'agent-bar']);
        if (GLib.file_test(fallback, GLib.FileTest.IS_EXECUTABLE)) {
          return fallback;
        }
      }
      return null;
    };
    const backendClient = createBackendClient({
      Gio,
      findProgramInPath,
    });
    const indicator = new Indicator(this, {
      state: initialState,
    });
    const pollingService = createPollingService({
      backendClient,
      initialState,
      onStateChange: (state) => {
        if (this._indicator) {
          this._indicator.setState(state);
        }
      },
    });

    this._indicator = indicator;
    this._backendClient = backendClient;
    this._pollingService = pollingService;
    indicator.setRefreshHandler(() => this._pollingService?.refreshNow({ forceRefresh: true }));

    try {
      Main.panel.addToStatusArea(this.uuid, indicator);
      pollingService.start();
      void pollingService.refreshNow({ forceRefresh: true });
    } catch (error) {
      pollingService.stop();
      this._pollingService = null;
      this._backendClient = null;
      this._indicator = null;
      indicator.destroy();
      throw error;
    }
  }

  disable() {
    const pollingService = this._pollingService;
    this._pollingService = null;
    pollingService?.stop();

    this._backendClient = null;

    const indicator = this._indicator;
    this._indicator = null;

    indicator?.destroy();
  }
}
