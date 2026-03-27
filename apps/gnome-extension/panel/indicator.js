import Clutter from "gi://Clutter";
import Gio from "gi://Gio";
import GObject from "gi://GObject";
import St from "gi://St";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";

import { createInitialState } from "../state/extension-state.js";
import { buildIndicatorSummaryViewModel, INDICATOR_PROVIDER_ORDER } from "../utils/view-model.js";
import { rebuildMenu } from "./menu-builder.js";

export const Indicator = GObject.registerClass(
{ GTypeName: "AgentBarUbuntuIndicator" },
class Indicator extends PanelMenu.Button {
  _init(extension, { state = createInitialState(), onRefreshNow = null } = {}) {
    super._init(0.0, extension.metadata.name, false);

    this._extension = extension;
    this._state = state;
    this._refreshHandler = onRefreshNow;
    this._providerActors = new Map();
    this._providerIcons = new Map();

    this.add_style_class_name("agent-bar-ubuntu-panel-button");
    this.menu?.actor?.add_style_class_name("agent-bar-ubuntu-menu");

    this._box = new St.BoxLayout({
      style_class: "agent-bar-ubuntu-indicator",
      x_expand: false,
      y_expand: false,
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
    });

    for (const providerId of INDICATOR_PROVIDER_ORDER) {
      const slot = this._createProviderSlot(providerId);
      this._providerActors.set(providerId, slot);
      this._box.add_child(slot.container);
    }

    this.add_child(this._box);

    this._render();
  }

  _createProviderSlot(providerId) {
    const container = new St.BoxLayout({
      style_class: `agent-bar-ubuntu-indicator__provider agent-bar-ubuntu-indicator__provider--${providerId}`,
      x_expand: false,
      y_expand: false,
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
    });
    const iconBox = new St.Bin({
      style_class: `agent-bar-ubuntu-indicator__provider-icon-box agent-bar-ubuntu-indicator__provider-icon-box--${providerId}`,
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
    });
    const icon = new St.Icon({
      gicon: this._loadProviderIcon(providerId),
      style_class: "agent-bar-ubuntu-indicator__provider-icon",
      y_align: Clutter.ActorAlign.CENTER,
    });
    const usageLabel = new St.Label({
      text: "--%",
      style_class: "agent-bar-ubuntu-indicator__provider-usage",
      y_align: Clutter.ActorAlign.CENTER,
    });

    iconBox.set_child(icon);
    container.add_child(iconBox);
    container.add_child(usageLabel);

    return {
      container,
      iconBox,
      icon,
      usageLabel,
    };
  }

  _loadProviderIcon(providerId) {
    if (this._providerIcons.has(providerId)) {
      return this._providerIcons.get(providerId);
    }

    const iconFile = this._extension.dir
      .get_child("assets")
      .get_child("providers")
      .get_child(`${providerId}.svg`);
    const gicon = new Gio.FileIcon({ file: iconFile });
    this._providerIcons.set(providerId, gicon);
    return gicon;
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
    this._box.style_class = `agent-bar-ubuntu-indicator agent-bar-ubuntu-indicator--${summary.panelStatus}`;

    for (const provider of summary.providerItems) {
      const slot = this._providerActors.get(provider.providerId);
      if (!slot) {
        continue;
      }

      const containerClasses = [
        "agent-bar-ubuntu-indicator__provider",
        `agent-bar-ubuntu-indicator__provider--${provider.providerId}`,
        `agent-bar-ubuntu-indicator__provider--${provider.status}`,
      ];

      if (provider.isStale) {
        containerClasses.push("agent-bar-ubuntu-indicator__provider--stale");
      }

      if (provider.isLoading) {
        containerClasses.push("agent-bar-ubuntu-indicator__provider--refreshing");
      }

      slot.container.style_class = containerClasses.join(" ");
      slot.usageLabel.text = provider.usagePercentText;
      slot.usageLabel.style_class = [
        "agent-bar-ubuntu-indicator__provider-usage",
        provider.isMissingUsage
          ? "agent-bar-ubuntu-indicator__provider-usage--placeholder"
          : "agent-bar-ubuntu-indicator__provider-usage--value",
      ].join(" ");
      slot.container.accessible_name = `${provider.title}: ${provider.usagePercentText} (${provider.statusText})`;
    }

    rebuildMenu(this.menu, this._state, {
      onRefresh: this._refreshHandler,
    });
  }

  destroy() {
    this._extension = null;
    this._refreshHandler = null;
    this._state = null;
    this._providerActors?.clear();
    this._providerIcons?.clear();
    this.menu?.removeAll();
    super.destroy();
  }
});
