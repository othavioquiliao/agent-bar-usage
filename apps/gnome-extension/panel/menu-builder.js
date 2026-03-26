import St from "gi://St";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

import { buildSnapshotViewModel } from "../utils/view-model.js";
import { createProviderRow } from "./provider-row.js";

function createSectionLabel(text) {
  const item = new PopupMenu.PopupMenuItem(text);
  item.sensitive = false;
  item.add_style_class_name("agent-bar-ubuntu-section-label");

  if (item.label?.clutter_text) {
    item.label.clutter_text.single_line_mode = true;
  }

  return item;
}

function createCompactTextItem(text, styleClass = "") {
  const item = new PopupMenu.PopupBaseMenuItem({
    reactive: false,
    can_focus: false,
  });
  const label = new St.Label({
    text,
    x_expand: true,
  });

  item.sensitive = false;

  if (styleClass) {
    item.add_style_class_name(styleClass);
  }

  if (label.clutter_text) {
    label.clutter_text.line_wrap = false;
    label.clutter_text.single_line_mode = true;
  }

  item.add_child(label);
  return item;
}

export function rebuildMenu(menu, state, { onRefresh = null, now = new Date() } = {}) {
  menu.removeAll();

  const snapshotViewModel = buildSnapshotViewModel(state, { now });
  const extension = menu._agentBarExtension ?? null;

  menu.addMenuItem(createSectionLabel("Summary"));
  menu.addMenuItem(createCompactTextItem(snapshotViewModel.summaryTitle, "agent-bar-ubuntu-summary-row"));

  if (snapshotViewModel.providerRows.length > 0) {
    for (const providerRow of snapshotViewModel.providerRows) {
      menu.addMenuItem(createProviderRow(providerRow, { extension }));
    }
  } else {
    menu.addMenuItem(createCompactTextItem(snapshotViewModel.emptyStateText, "agent-bar-ubuntu-empty-state"));
  }

  menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

  if (snapshotViewModel.lastUpdatedText || snapshotViewModel.diagnosticsSummaryText || state.lastError) {
    menu.addMenuItem(createSectionLabel("Details"));
  }

  if (snapshotViewModel.lastUpdatedText) {
    menu.addMenuItem(createCompactTextItem(snapshotViewModel.lastUpdatedText, "agent-bar-ubuntu-details"));
  }

  if (snapshotViewModel.diagnosticsSummaryText) {
    menu.addMenuItem(createCompactTextItem(snapshotViewModel.diagnosticsSummaryText, "agent-bar-ubuntu-details"));
  }

  if (snapshotViewModel.suggestedCommandText) {
    menu.addMenuItem(createCompactTextItem(snapshotViewModel.suggestedCommandText, "agent-bar-ubuntu-details"));
  }

  const refreshItem = menu.addAction(state.isLoading ? "Refreshing..." : "Refresh Now", () => {
    if (!state.isLoading && typeof onRefresh === "function") {
      void onRefresh();
    }
  });
  refreshItem.sensitive = !state.isLoading;
}
