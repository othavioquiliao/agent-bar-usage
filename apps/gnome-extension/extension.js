import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

class PendingIndicator {
  destroy() {}
}

export default class AgentBarUbuntuExtension extends Extension {
  constructor(metadata) {
    super(metadata);
    this._indicator = null;
  }

  enable() {
    if (this._indicator) {
      return;
    }

    this._indicator = new PendingIndicator();
  }

  disable() {
    this._indicator?.destroy();
    this._indicator = null;
  }
}
