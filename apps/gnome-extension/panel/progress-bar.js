import St from "gi://St";

export function createProgressBar({ percent = 0, accentClass = "", showFill = true } = {}) {
  const clampedPercent = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
  const track = new St.Bin({
    style_class: "agent-bar-ubuntu-progress",
    x_expand: true,
    y_expand: false,
  });
  const fill = new St.Widget({
    style_class: ["agent-bar-ubuntu-progress-fill", accentClass].filter(Boolean).join(" "),
    x_expand: true,
    y_expand: true,
  });

  fill.set_pivot_point(0, 0.5);
  fill.scale_x = showFill ? clampedPercent / 100 : 0;
  track.set_child(fill);

  return track;
}
