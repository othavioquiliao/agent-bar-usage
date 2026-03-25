import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { Main } from "resource:///org/gnome/shell/ui/main.js";
import { Indicator } from "./panel/indicator.js";
import { createBackendClient } from "./services/backend-client.js";
import { createPollingService } from "./services/polling-service.js";
import { createInitialState } from "./state/extension-state.js";

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
    const findProgramInPath = (name) => GLib.find_program_in_path(name);
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
