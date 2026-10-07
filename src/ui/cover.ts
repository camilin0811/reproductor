/** Resumen numerico de un texto. Se conserva por si hace falta mas adelante. */
export function hashHue(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}

/** Ya no hace nada: el fondo de colores se quito del diseno. */
export function applyHue(_title: string | null): void {
}

export function coverStyle(_title: string): string {
  return "";
}

export function coverLetter(title: string): string {
  const t = title.trim();
  return t ? (t[0] ?? "?").toUpperCase() : "?";
}
