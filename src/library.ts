import { DoublyLinkedList } from "./doublylinked.js";

export interface Song {
  id: string;
  title: string;
  url: string;
  duration?: number;
  fileName?: string;
  fileSize?: number;
  artist?: string;
  source: "local" | "remote" | "youtube";
  remoteId?: string;
  artworkUrl?: string;
  trackTimeMillis?: number;
  videoId?: string;
  license?: string;
  attribution?: string;
  noCors?: boolean;
}

/*
  Traduce el hueco donde sueltas una cancion a la posicion real de destino.

  El detalle fino: al arrastrar, la cancion primero se quita de donde estaba, y
  eso corre una posicion todo lo que venia detras. Si sueltas en su propio sitio
  o en el hueco de al lado no hay nada que hacer y devuelve null.
*/
export function moveTarget(from: number, gap: number): number | null {
  if (gap === from || gap === from + 1) return null;
  if (from < gap) return gap - 1;
  return gap;
}

/*
  La biblioteca: un conjunto de listas con nombre.
  Cada lista es su propia cadena de nodos, independiente de las demas.
*/
export class Library {
  private playlists: Map<string, DoublyLinkedList<Song>> = new Map();
  private activeName: string | null = null;

  /** Nace siempre con una lista creada, nunca completamente vacia. */
  constructor(initialName = "Default") {
    const list = new DoublyLinkedList<Song>();
    this.playlists.set(initialName, list);
    this.activeName = initialName;
  }

  /** Crea una lista nueva. Si el nombre ya existe, le pone un sufijo. */
  createPlaylist(name: string): void {
    const trimmed = name.trim();
    if (trimmed.length === 0) throw new Error("Playlist name cannot be empty");
    if (this.playlists.has(trimmed)) throw new Error(`Playlist "${trimmed}" already exists`);
    this.playlists.set(trimmed, new DoublyLinkedList<Song>());
    this.activeName = trimmed;
  }

  /** Rebautiza una lista sin tocar los nodos que contiene. */
  renamePlaylist(oldName: string, newName: string): void {
    const newTrimmed = newName.trim();
    if (newTrimmed.length === 0) throw new Error("New name cannot be empty");
    if (!this.playlists.has(oldName)) throw new Error(`Playlist "${oldName}" not found`);
    if (this.playlists.has(newTrimmed)) throw new Error(`Playlist "${newTrimmed}" already exists`);
    const list = this.playlists.get(oldName);
    if (list === undefined) throw new Error(`Playlist "${oldName}" not found`);
    this.playlists.delete(oldName);
    this.playlists.set(newTrimmed, list);
    if (this.activeName === oldName) this.activeName = newTrimmed;
  }

  /** Borra una lista, salvo que sea la ultima que queda. */
  deletePlaylist(name: string): void {
    if (!this.playlists.has(name)) throw new Error(`Playlist "${name}" not found`);
    if (this.playlists.size <= 1) throw new Error("Cannot delete the last playlist");
    this.playlists.delete(name);
    if (this.activeName === name) {
      const first = this.playlists.keys().next().value as string | undefined;
      this.activeName = first ?? null;
    }
  }

  /** Cambia la lista activa. Ignora los nombres que no existen. */
  switchTo(name: string): void {
    if (!this.playlists.has(name)) throw new Error(`Playlist "${name}" not found`);
    this.activeName = name;
  }

  /** La lista que se esta viendo ahora, o null si no hay ninguna. */
  getActiveList(): DoublyLinkedList<Song> | null {
    if (this.activeName === null) return null;
    return this.playlists.get(this.activeName) ?? null;
  }

  /** El nombre de la lista que se esta viendo. */
  getActiveName(): string | null {
    return this.activeName;
  }

  /** Los nombres de todas las listas, en el orden en que se crearon. */
  getNames(): string[] {
    return [...this.playlists.keys()];
  }

  /** Busca una lista por su nombre. */
  getPlaylist(name: string): DoublyLinkedList<Song> | undefined {
    return this.playlists.get(name);
  }

  /** Acceso directo al mapa completo, para guardar y restaurar. */
  getPlaylistsMap(): Map<string, DoublyLinkedList<Song>> {
    return this.playlists;
  }
}
