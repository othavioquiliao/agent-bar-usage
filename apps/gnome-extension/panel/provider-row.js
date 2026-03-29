import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

function formatRowLines(viewModel) {
  const lines = [
    `${viewModel.title} · ${viewModel.statusText}`,
    viewModel.usageText,
    viewModel.resetText,
    viewModel.updatedAtText,
    viewModel.sourceText,
    viewModel.diagnosticsSummaryText,
    viewModel.suggestedCommandText,
    viewModel.errorText ? `Error: ${viewModel.errorText}` : null,
  ].filter(Boolean);

  return lines.join('\n');
}

export function createProviderRow(viewModel) {
  const row = new PopupMenu.PopupMenuItem(formatRowLines(viewModel));
  row.sensitive = false;
  row.add_style_class_name('agent-bar-ubuntu-provider-row');
  row.add_style_class_name(`agent-bar-ubuntu-provider-row--${viewModel.status}`);
  row.add_style_class_name(`agent-bar-ubuntu-provider-row--${viewModel.providerId}`);

  if (row.label?.clutter_text) {
    row.label.clutter_text.line_wrap = true;
    row.label.clutter_text.single_line_mode = false;
  }

  return row;
}
