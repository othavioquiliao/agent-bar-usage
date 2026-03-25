import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { Main } from "resource:///org/gnome/shell/ui/main.js";
import { Indicator } from "./panel/indicator.js";

export default class AgentBarUbuntuExtension extends Extension {
  constructor(metadata) {
    super(metadata);
    this._indicator = null;
  }

  enable() {
    if (this._indicator) {
      return;
    }

    const indicator = new Indicator(this);
    this._indicator = indicator;

    try {
      Main.panel.addToStatusArea(this.uuid, indicator);
    } catch (error) {
      this._indicator = null;
      indicator.destroy();
      throw error;
    }
  }

  disable() {
    const indicator = this._indicator;
    this._indicator = null;

    indicator?.destroy();
  }
}
