import { Library, Song } from "./library.js";
import { ListNode } from "./doublylinked.js";
import { Player } from "./player.js";
import { loadLibrary } from "./ui/persistence.js";
import { UndoManager } from "./undo.js";

// el estado comun: una sola copia que ven todos los modulos de la interfaz
// si hay algo guardado de la ultima vez se recupera; si no, se empieza de cero
let libInstance: Library | null = null;
try {
  libInstance = loadLibrary();
} catch {
  libInstance = null;
}
export const library: Library = libInstance ?? new Library("My Playlist");
export const player = new Player<Song>(library.getActiveList());

// al arrancar, el reproductor debe mirar a la lista que se esta viendo
player.setPlayingList(library.getActiveList());

export function getActiveList(): import("./doublylinked.js").DoublyLinkedList<Song> {
  const list = library.getActiveList();
  if (list === null) throw new Error("No active playlist");
  return list;
}

// recuerda si lo proximo que se anada va al principio o al final
export let pendingInsertIndex: number | null = null;

export function setPendingInsertIndex(v: number | null): void {
  pendingInsertIndex = v;
}

export const objectUrls = new Set<string>();

export let dragFromIndex: number | null = null;

export function setDragFromIndex(v: number | null): void {
  dragFromIndex = v;
  // al limpiar por la via antigua, el nodo tambien tiene que soltarse
  if (v === null) dragFromNode = null;
}

export let dragFromNode: ListNode<Song> | null = null;

export function setDragFromNode(v: ListNode<Song> | null): void {
  dragFromNode = v;
  // mejor sin indice que con un indice que ya no corresponde a nada
  if (v === null) dragFromIndex = null;
  else dragFromIndex = null;
}

export function getDragFromIndex(): number | null {
  if (dragFromNode !== null) {
    try {
      const list = getActiveList();
      const idx = list.indexOf(dragFromNode);
      return idx === -1 ? null : idx;
    } catch {
      return null;
    }
  }
  return dragFromIndex;
}

// lo ultimo borrado, por si hay que devolverlo a su sitio
export interface UndoInfo {
  index: number;
  song: Song;
}
export let lastDeleted: UndoInfo | null = null;
export function setLastDeleted(v: UndoInfo | null): void {
  lastDeleted = v;
}

// resultado de busqueda que se esta arrastrando hacia un hueco
import type { SearchResult } from "./search.js";
export let draggedRemote: SearchResult | null = null;
export function setDraggedRemote(v: SearchResult | null): void {
  draggedRemote = v;
}

export const undoManager = new UndoManager();
