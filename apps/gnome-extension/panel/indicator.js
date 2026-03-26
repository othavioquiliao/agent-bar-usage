import GObject from "gi://GObject";
import St from "gi://St";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";

import { createInitialState } from "../state/extension-state.js";
import { buildIndicatorSummaryViewModel } from "../utils/view-model.js";
import { rebuildMenu } from "./menu-builder.js";

export const Indicator = GObject.registerClass(
{ GTypeName: "AgentBarUbuntuIndicator" },
class Indicator extends PanelMenu.Button {
  _init(extension, { state = createInitialState(), onRefreshNow = null } = {}) {
    super._init(0.0, extension.metadata.name, false);

    this._extension = extension;
    this._state = state;
    this._refreshHandler = onRefreshNow;
    this.menu._agentBarExtension = extension;

    this._box = new St.BoxLayout({
      style_class: "agent-bar-ubuntu-indicator",
      x_expand: false,
      y_expand: false,
    });
    this._icon = new St.Icon({
      icon_name: "dialog-information-symbolic",
      style_class: "system-status-icon",
    });
    this._label = new St.Label({
      text: "",
      style_class: "agent-bar-ubuntu-indicator__label",
    });

    this._box.add_child(this._icon);
    this._box.add_child(this._label);
    this.add_child(this._box);

    this._render();
  }

  setRefreshHandler(handler) {
    this._refreshHandler = handler;
    this._render();
  }

  setState(state) {
    this._state = state;
    this._render();
  }

  _render() {
    const summary = buildIndicatorSummaryViewModel(this._state);
    this._icon.icon_name = summary.iconName;
    this._label.text = summary.labelText ?? "";
    this._label.visible = Boolean(summary.labelText);
    this.menu._agentBarExtension = this._extension;
    rebuildMenu(this.menu, this._state, {
      onRefresh: this._refreshHandler,
    });
  }

  destroy() {
    this.menu._agentBarExtension = null;
    this._extension = null;
    this._refreshHandler = null;
    this._state = null;
    this.menu?.removeAll();
    super.destroy();
  }
});
