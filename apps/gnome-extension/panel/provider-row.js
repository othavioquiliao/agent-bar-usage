import St from 'gi://St';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import { createProgressBar } from './progress-bar.js';
import { buildProviderRowLayoutModel } from './provider-row-model.js';

function createLabel(text, styleClass) {
  const label = new St.Label({
    text,
    x_expand: true,
    y_expand: false,
    style_class: styleClass,
  });

  if (label.clutter_text) {
    label.clutter_text.line_wrap = false;
    label.clutter_text.single_line_mode = true;
  }

  return label;
}

export function createProviderRow(viewModel) {
  const layout = buildProviderRowLayoutModel(viewModel);
  const row = new PopupMenu.PopupBaseMenuItem({
    reactive: false,
    can_focus: false,
  });
  row.sensitive = false;
  row.add_style_class_name('agent-bar-ubuntu-provider-row');
  row.add_style_class_name(`agent-bar-ubuntu-provider-row--${layout.status}`);
  row.add_style_class_name(`agent-bar-ubuntu-provider-row--${layout.providerId}`);

  const content = new St.BoxLayout({
    vertical: true,
    x_expand: true,
    style_class: 'agent-bar-ubuntu-provider-row__content',
  });
  content.add_child(createLabel(layout.headerText, 'agent-bar-ubuntu-provider-row__header'));
  content.add_child(createLabel(layout.accountText, 'agent-bar-ubuntu-provider-row__meta'));
  content.add_child(createLabel(layout.quotaLine, 'agent-bar-ubuntu-provider-row__usage'));

  if (layout.showProgressBar) {
    content.add_child(
      createProgressBar({
        percent: layout.progressPercent ?? 0,
        accentClass: layout.accentClass,
        showFill: layout.showProgressFill,
      }),
    );
  }

  content.add_child(createLabel(layout.resetText, 'agent-bar-ubuntu-provider-row__meta'));
  row.add_child(content);

  return row;
}
