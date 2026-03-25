import { PanelMenu } from "resource:///org/gnome/shell/ui/panelMenu.js";
import { St } from "resource:///org/gnome/shell/ui/st.js";

export class Indicator extends PanelMenu.Button {
  constructor(extension) {
    super(0.0, extension.metadata.name, false);

    this._extension = extension;
    this._icon = new St.Icon({
      icon_name: "dialog-information-symbolic",
      style_class: "system-status-icon",
    });

    this.add_child(this._icon);
  }

  destroy() {
    this._icon?.destroy();
    this._icon = null;
    this._extension = null;
    super.destroy();
  }
}
