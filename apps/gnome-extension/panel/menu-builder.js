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

function createMessageItem(text, styleClass = "") {
  const item = new PopupMenu.PopupMenuItem(text);
  item.sensitive = false;

  if (styleClass) {
    item.add_style_class_name(styleClass);
  }

  if (item.label?.clutter_text) {
    item.label.clutter_text.line_wrap = true;
    item.label.clutter_text.single_line_mode = false;
  }

  return item;
}

export function rebuildMenu(menu, state, { onRefresh = null, now = new Date() } = {}) {
  menu.removeAll();

  const snapshotViewModel = buildSnapshotViewModel(state, { now });

  menu.addMenuItem(createSectionLabel("Status"));
  menu.addMenuItem(createMessageItem(`${snapshotViewModel.summaryTitle}\n${snapshotViewModel.summaryBody}`, "agent-bar-ubuntu-summary-item"));

  if (snapshotViewModel.providerRows.length > 0) {
    menu.addMenuItem(createSectionLabel("Providers"));

    for (const providerRow of snapshotViewModel.providerRows) {
      menu.addMenuItem(createProviderRow(providerRow));
    }
  } else {
    menu.addMenuItem(createMessageItem(snapshotViewModel.emptyStateText, "agent-bar-ubuntu-empty-state"));
  }

  menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

  const refreshItem = menu.addAction(state.isLoading ? "Refreshing…" : "Refresh Now", () => {
    if (!state.isLoading && typeof onRefresh === "function") {
      void onRefresh();
    }
  });
  refreshItem.sensitive = !state.isLoading;

  if (snapshotViewModel.lastUpdatedText || snapshotViewModel.diagnosticsSummaryText || state.lastError) {
    menu.addMenuItem(createSectionLabel("Details"));
  }

  if (snapshotViewModel.lastUpdatedText) {
    menu.addMenuItem(createMessageItem(snapshotViewModel.lastUpdatedText, "agent-bar-ubuntu-footer-item"));
  }

  if (snapshotViewModel.diagnosticsSummaryText) {
    menu.addMenuItem(createMessageItem(snapshotViewModel.diagnosticsSummaryText, "agent-bar-ubuntu-error-item"));
  }

  if (snapshotViewModel.suggestedCommandText) {
    menu.addMenuItem(createMessageItem(snapshotViewModel.suggestedCommandText, "agent-bar-ubuntu-footer-item"));
  }
}
