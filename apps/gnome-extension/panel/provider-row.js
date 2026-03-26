import St from "gi://St";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

import { createProviderIdentityActor } from "../utils/provider-icons.js";
import { createProgressBar } from "./progress-bar.js";
import { buildProviderRowLayoutModel } from "./provider-row-model.js";

function setSingleLine(label) {
  if (!label?.clutter_text) {
    return;
  }

  label.clutter_text.single_line_mode = true;
  label.clutter_text.line_wrap = false;
}

export function createProviderRow(viewModel, { extension = null } = {}) {
  const layoutModel = buildProviderRowLayoutModel(viewModel);
  const row = new PopupMenu.PopupBaseMenuItem({
    reactive: false,
    can_focus: false,
  });
  const root = new St.BoxLayout({
    x_expand: true,
    y_expand: false,
  });
  const slot = new St.Bin({
    style_class: "agent-bar-ubuntu-provider-slot",
    x_expand: false,
    y_expand: false,
  });
  const content = new St.BoxLayout({
    vertical: true,
    x_expand: true,
    y_expand: false,
  });
  const header = new St.BoxLayout({
    x_expand: true,
    y_expand: false,
  });
  const title = new St.Label({
    text: layoutModel.title,
    style_class: "agent-bar-ubuntu-provider-title",
    x_expand: true,
  });
  const statusBox = new St.BoxLayout({
    x_expand: false,
    y_expand: false,
  });
  const statusIcon = new St.Icon({
    icon_name: layoutModel.statusIconName,
    style_class: "agent-bar-ubuntu-provider-status-icon",
    icon_size: 12,
  });
  const statusLabel = new St.Label({
    text: layoutModel.statusText,
    style_class: "agent-bar-ubuntu-provider-label",
  });

  row.sensitive = false;
  row.add_style_class_name("agent-bar-ubuntu-provider-row");
  row.add_style_class_name(`agent-bar-ubuntu-provider-row--${layoutModel.status}`);
  row.add_style_class_name(`agent-bar-ubuntu-provider-row--${layoutModel.iconKey || "default"}`);

  setSingleLine(title);
  setSingleLine(statusLabel);

  slot.set_child(
    createProviderIdentityActor({
      extension,
      providerId: layoutModel.iconKey ?? layoutModel.providerId,
      status: layoutModel.status,
      size: 16,
    }),
  );

  statusBox.add_child(statusIcon);
  statusBox.add_child(statusLabel);
  header.add_child(title);
  header.add_child(statusBox);
  content.add_child(header);

  if (layoutModel.quotaLine) {
    const quota = new St.Label({
      text: layoutModel.quotaLine,
      style_class: "agent-bar-ubuntu-provider-quota",
      x_expand: true,
    });
    setSingleLine(quota);
    content.add_child(quota);
  }

  if (layoutModel.showProgressBar) {
    content.add_child(
      createProgressBar({
        percent: layoutModel.progressPercent,
        accentClass: layoutModel.accentClass,
        showFill: layoutModel.showProgressFill,
      }),
    );
  }

  if (layoutModel.secondaryText) {
    const secondary = new St.Label({
      text: layoutModel.secondaryText,
      style_class: "agent-bar-ubuntu-provider-meta",
      x_expand: true,
    });
    setSingleLine(secondary);
    content.add_child(secondary);
  }

  root.add_child(slot);
  root.add_child(content);
  row.add_child(root);

  return row;
}
