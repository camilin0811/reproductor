// cuentas del aro de progreso: solo matematicas, no se toca la pagina
export type RingGeometry = {
  dasharray: number;
  dashoffset: number;
  knobX: number;
  knobY: number;
};

export function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

/*
  Convierte un avance de 0 a 1 en el trazo del aro.

  El truco del SVG es dibujar la circunferencia entera como una linea de puntos
  gigante y luego desplazarla: lo que queda a la vista es justo el arco
  recorrido. Ademas devuelve donde cae la bolita del extremo, medida desde el
  centro del circulo.
*/
export function ringGeometry(progress01: number, radius: number, _stroke: number): RingGeometry {
  const r = Number.isFinite(radius) && radius > 0 ? radius : 0;
  const p = clamp(progress01, 0, 1);
  const circumference = 2 * Math.PI * r;
  const dasharray = circumference;
  const dashoffset = circumference * (1 - p);
  // la bolita va al final del arco, contando desde arriba y hacia la derecha
  const angle = p * 2 * Math.PI - Math.PI / 2;
  // se podria escribir con seno y coseno al reves
  // sale lo mismo; aqui se usa el desfase de un cuarto de vuelta
  const knobX = r + r * Math.cos(angle);
  const knobY = r + r * Math.sin(angle);
  // con radio cero la bolita se queda en el centro
  if (r === 0) return { dasharray: 0, dashoffset: 0, knobX: 0, knobY: 0 };
  return { dasharray, dashoffset, knobX, knobY };
}

/*
  El camino inverso: donde ha pinchado el dedo se traduce a un avance de 0 a 1.

  Lo delicado es la frontera de las doce en punto. Si el usuario arrastra y se
  pasa un pelo del principio, el angulo salta del 0 al 1 y la cancion daria un
  brinco al final. Por eso, cuando el valor anterior estaba pegado a un extremo,
  el nuevo se frena ahi en vez de dar la vuelta.
*/
export function angleToProgress(
  px: number,
  py: number,
  cx: number,
  cy: number,
  prev?: number,
): number {
  const dx = px - cx;
  const dy = py - cy;
  // justo en el centro no hay angulo que valga: se deja como estaba
  if (dx === 0 && dy === 0) {
    if (typeof prev === "number" && Number.isFinite(prev)) return clamp(prev, 0, 1);
    return 0;
  }
  // el angulo que da la funcion empieza a las tres en punto
  // y ademas va de media vuelta negativa a media vuelta positiva
  // asi que se gira un cuarto y se estira a una vuelta entera
  let angle = Math.atan2(dy, dx) + Math.PI / 2;
  // dejarlo siempre dentro de una vuelta
  while (angle < 0) angle += 2 * Math.PI;
  while (angle >= 2 * Math.PI) angle -= 2 * Math.PI;
  let raw = angle / (2 * Math.PI);
  raw = clamp(raw, 0, 1);
  // freno de la frontera: arrastrando no se salta de un extremo al otro
  if (typeof prev === "number" && Number.isFinite(prev)) {
    const p = clamp(prev, 0, 1);
    // venia del principio y se paso un poco hacia atras: se queda al principio
    // venia del final y se paso hacia delante: se queda al final
    if (p < 0.25 && raw > 0.75) return 0;
    if (p > 0.75 && raw < 0.25) return 1;
  }
  // y que nunca salga un cero con signo raro
  if (Object.is(raw, -0)) raw = 0;
  return raw;
}

export function clampSeek(progress: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  const p = clamp(progress, 0, 1);
  const t = p * duration;
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.min(duration, t));
}
