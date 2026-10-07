export type LinkKind = "audio" | "youtube" | "spotify" | "apple" | "unsupported" | "invalid";

export interface ClassifyResult {
  kind: LinkKind;
  url?: string;
  videoId?: string;
  trackId?: string;
  reason?: string;
}

const AUDIO_EXTS = ["mp3","m4a","aac","ogg","oga","opus","wav","flac","weba","webm"];

export function classifyUrl(input: string): ClassifyResult {
  const trimmed = input.trim();
  if (!trimmed) return { kind: "invalid", reason: "empty" };
  if (trimmed.length > 5000) return { kind: "invalid", reason: "too long" };
  if (/^spotify:(track|album|playlist|episode):[a-zA-Z0-9]+$/.test(trimmed)) return { kind: "spotify", url: trimmed, trackId: trimmed.split(":")[2] };
  let url: URL;
  try { url = new URL(trimmed); } catch {
    return { kind: "invalid", reason: "not a url" };
  }
  const scheme = url.protocol.replace(":", "").toLowerCase();
  if (scheme === "spotify") {
    const parts = url.pathname.split(":").filter(Boolean);
    const id = parts[1] ?? parts[0] ?? "";
    if (id) return { kind: "spotify", url: trimmed, trackId: id };
    return { kind: "spotify", url: trimmed };
  }
  if (["javascript","data","file","blob","ftp"].includes(scheme)) return { kind: "invalid", reason: "blocked scheme" };
  if (scheme !== "http" && scheme !== "https") return { kind: "invalid", reason: "unsupported scheme" };
  const host = url.hostname.toLowerCase();
  const path = url.pathname;
  const search = url.search;

  // los servicios conocidos mandan sobre la extension del archivo
  // youtube: varias formas de escribir la misma direccion
  if (host.includes("youtube.com") || host === "youtu.be" || host.includes("music.youtube.com") || host.includes("m.youtube.com")) {
    let videoId: string | null = null;
    if (host === "youtu.be") {
      const parts = path.split("/").filter(Boolean);
      videoId = parts[0] ?? null;
      if (videoId) videoId = videoId.split("?")[0] ?? videoId;
    } else if (path.startsWith("/shorts/")) {
      videoId = path.split("/")[2] ?? null;
    } else if (path.startsWith("/embed/")) {
      videoId = path.split("/")[2] ?? null;
    } else {
      videoId = url.searchParams.get("v");
    }
    if (videoId) {
      // fuera los parametros de seguimiento
      videoId = videoId.split("&")[0] ?? videoId;
      videoId = videoId.split("?")[0] ?? videoId;
      return { kind: "youtube", url: trimmed, videoId };
    }
  }
  // spotify
  if (host.includes("spotify.com") || host.includes("open.spotify.com")) {
    // las direcciones traducidas meten el idioma en medio
    const m = path.match(/\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/);
    if (m) return { kind: "spotify", url: trimmed, trackId: m[2] };
    // el formato corto de la app ya vino resuelto antes
  }
  if (trimmed.startsWith("spotify:track:")) {
    return { kind: "spotify", url: trimmed, trackId: trimmed.split(":")[2] };
  }
  // apple music e itunes comparten dominio
  if (host.includes("music.apple.com") || host.includes("itunes.apple.com")) {
    const iParam = url.searchParams.get("i");
    if (iParam) return { kind: "apple", url: trimmed, trackId: iParam };
    const m1 = path.match(/\/id(\d+)/);
    if (m1) return { kind: "apple", url: trimmed, trackId: m1[1] };
    const parts = path.split("/").filter(Boolean);
    const last = parts[parts.length - 1] ?? "";
    if (/^\d+$/.test(last)) return { kind: "apple", url: trimmed, trackId: last };
    // aunque el patron no encaje, el dominio ya lo delata
    return { kind: "apple", url: trimmed };
  }
  // soundcloud no se puede reproducir desde aqui
  if (host.includes("soundcloud.com")) return { kind: "unsupported", reason: "SoundCloud not supported", url: trimmed };
  // ultimo recurso: mirar la extension del archivo
  const ext = path.split(".").pop()?.toLowerCase().split("?")[0] ?? "";
  if (AUDIO_EXTS.includes(ext)) return { kind: "audio", url: trimmed };
  // sin extension no hay forma fiable de saberlo aqui
  // se podria preguntar al servidor por el tipo de contenido, pero eso toca mas tarde
  // mientras tanto conviene no dar por bueno lo que no se reconoce
  // si nada encajo: es un sitio real pero no sabemos tocarlo
  if (host) return { kind: "unsupported", url: trimmed, reason: "unknown host" };
  return { kind: "invalid", reason: "unknown" };
}
