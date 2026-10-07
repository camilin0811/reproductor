/*
  Los huecos entre canciones.

  Entre cada dos filas hay una franja invisible que sirve de diana al arrastrar.
  La regla es simple: hueco, fila, hueco, fila... y siempre termina en hueco, de
  modo que con N filas hay N+1 huecos y el numero de cada uno coincide con la
  posicion donde se insertaria. Con la lista vacia queda un unico hueco, que es
  donde caen los primeros archivos. Si hay una busqueda activa no se dibuja
  ninguno: el orden que se ve no es el orden real.
*/

export function gapCount(rowCount: number, filtered: boolean): number {
  if (filtered) return 0;
  return rowCount + 1;
}

export function expectedPattern(rowCount: number, filtered: boolean): Array<"gap" | "row"> {
  if (filtered) {
    return Array.from({ length: rowCount }, () => "row" as const);
  }
  const res: Array<"gap" | "row"> = [];
  for (let i = 0; i < rowCount; i++) {
    res.push("gap");
    res.push("row");
  }
  res.push("gap");
  return res;
}

export function expectedGapIndices(rowCount: number, filtered: boolean): number[] {
  if (filtered) return [];
  return Array.from({ length: rowCount + 1 }, (_, i) => i);
}

export function isValidSequence(kinds: Array<"gap" | "row">, rowCount: number, filtered: boolean): boolean {
  const exp = expectedPattern(rowCount, filtered);
  if (kinds.length !== exp.length) return false;
  for (let i = 0; i < exp.length; i++) if (kinds[i] !== exp[i]) return false;
  return true;
}

export function isValidGapIndices(indices: number[], rowCount: number, filtered: boolean): boolean {
  const exp = expectedGapIndices(rowCount, filtered);
  if (indices.length !== exp.length) return false;
  for (let i = 0; i < exp.length; i++) if (indices[i] !== exp[i]) return false;
  return true;
}

/*
  El patron correcto calculado sobre papel, sin tocar la pagina.
  Sirve para comprobar que no quedan huecos de sobra por mucho que se
  haya movido la lista antes.
*/
export function reconcilePure(
  _currentKinds: Array<"gap" | "row">,
  rowCount: number,
  filtered: boolean,
): Array<"gap" | "row"> {
  return expectedPattern(rowCount, filtered);
}

/*
  Deja en la pagina exactamente los huecos que hagan falta: reutiliza los que
  ya estaban, tira los que sobran, crea los que faltan y les pone su numero.
  Devuelve la coleccion ordenada de principio a fin.
*/
export function ensureGapPool(container: HTMLElement, rowCount: number, filtered: boolean): HTMLElement[] {
  const needed = gapCount(rowCount, filtered);
  const existing = Array.from(container.querySelectorAll(".gap")) as HTMLElement[];

  if (filtered) {
    for (const g of existing) g.remove();
    return [];
  }

  // fuera los que sobran, que si no se acumulan
  if (existing.length > needed) {
    for (let i = needed; i < existing.length; i++) existing[i]!.remove();
    existing.length = needed;
  }

  // y crear los que falten
  while (existing.length < needed) {
    const g = document.createElement("div");
    g.className = "gap drop-zone between";
    existing.push(g);
    // todavia sueltos: quien llama los colocara en su sitio
  }

  // cada hueco tiene que saber que posicion representa
  for (let i = 0; i < existing.length; i++) {
    const g = existing[i]!;
    g.className = "gap drop-zone between";
    g.dataset["index"] = String(i);
    g.dataset["id"] = `gap-${i}`;
  }

  // los nuevos entran en la pagina en el paso de reordenar
  // los que ya estaban se quedan donde estan
  return existing;
}

/*
  Intercala huecos y filas hasta dejar el patron en orden.
  Los huecos llegan numerados y las filas en el orden en que se ven.
*/
export function reorderGapsAndRows(container: HTMLElement, gaps: HTMLElement[], rows: HTMLElement[]): void {
  // se van encadenando: hueco, fila, hueco, fila, y hueco final
  // colocar un elemento que ya existia lo mueve, no lo duplica
  for (let i = 0; i < rows.length; i++) {
    container.appendChild(gaps[i]!);
    container.appendChild(rows[i]!);
  }
  if (gaps.length > rows.length) {
    container.appendChild(gaps[gaps.length - 1]!);
  }
  // con busqueda activa no se llega hasta aqui: alli van solo las filas
}
