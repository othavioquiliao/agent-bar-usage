import Gio from "gi://Gio";
import St from "gi://St";

const PROVIDER_ICON_FILENAMES = {
  claude: "claude-code-icon.png",
  claudecode: "claude-code-icon.png",
  codex: "codex-icon.png",
};

function normalizeProviderId(providerId) {
  return String(providerId ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function createPackagedIconActor({ extension, filename, providerId, status, size }) {
  const file = extension?.dir?.get_child("assets")?.get_child(filename);
  if (!file?.query_exists(null)) {
    return createFallbackBadgeActor({ providerId, status, size });
  }

  return new St.Icon({
    gicon: new Gio.FileIcon({ file }),
    icon_size: size,
    style_class: "agent-bar-ubuntu-provider-icon",
    accessible_name: providerId,
  });
}

function createFallbackBadgeActor({ providerId, status, size }) {
  const labelText =
    providerId === "copilot" ? "Co" : (providerId || "?").slice(0, 2).toUpperCase();
  const badge = new St.Label({
    text: labelText,
    style_class: "agent-bar-ubuntu-provider-badge",
    accessible_name: providerId === "copilot" ? "Copilot" : "Provider",
  });
  badge.set_width(size);
  badge.set_height(size);
  badge.add_style_class_name(`agent-bar-ubuntu-provider-badge--${providerId || "default"}`);
  badge.add_style_class_name(`agent-bar-ubuntu-provider-badge--${status || "unknown"}`);
  return badge;
}

export function createProviderIdentityActor({ extension, providerId, status, size = 16 }) {
  const normalizedProviderId = normalizeProviderId(providerId);
  const filename = PROVIDER_ICON_FILENAMES[normalizedProviderId];

  const actor = filename
    ? createPackagedIconActor({
        extension,
        filename,
        providerId: normalizedProviderId,
        status,
        size,
      })
    : createFallbackBadgeActor({
        providerId: normalizedProviderId === "copilot" ? "copilot" : normalizedProviderId,
        status,
        size,
      });

  actor.add_style_class_name(`agent-bar-ubuntu-provider-row--${normalizedProviderId || "default"}`);
  actor.add_style_class_name(`agent-bar-ubuntu-provider-row--${status || "unknown"}`);
  return actor;
}
