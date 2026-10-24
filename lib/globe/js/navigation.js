// js/navigation.js
// The navigation state machine. Owns "where am I in the hierarchy right now",
// and provides descend / ascend / jump operations. It is UI- and map-agnostic:
// it just emits state and lets subscribers (the app) react.

import { PLACES, pathToNode, optionsForLevel } from "../data/places.js";
import { levelByKey } from "../data/levels.js";

// Levels offered in the "pick from a list" dropdowns, in order.
const BROWSE_LEVELS = ["state", "county", "city"];

export class Navigation {
  constructor() {
    this.root = PLACES;
    this.current = PLACES; // start at the globe
    this._subscribers = [];
  }

  // Subscribe to state changes. Returns an unsubscribe function.
  subscribe(fn) {
    this._subscribers.push(fn);
    fn(this.getState()); // emit current state immediately
    return () => {
      this._subscribers = this._subscribers.filter((f) => f !== fn);
    };
  }

  _emit() {
    const state = this.getState();
    for (const fn of this._subscribers) fn(state);
  }

  getState() {
    const path = pathToNode(this.current.id);
    return {
      current: this.current,
      path, // breadcrumb trail root -> current
      children: this.current.children || [],
      canAscend: path.length > 1,
      canDescend: (this.current.children || []).length > 0,
      browse: this._browseModel(path),
    };
  }

  // Data for the dropdowns: one entry per level with its choices and the
  // currently selected place (if the path passes through that level).
  _browseModel(path) {
    return BROWSE_LEVELS.map((level) => {
      const { parent, options, selected } = optionsForLevel(path, level);
      return {
        level,
        label: levelByKey(level).label,
        parentId: parent.id,
        options: options.map((o) => ({ id: o.id, name: o.name })),
        selectedId: selected ? selected.id : "",
      };
    });
  }

  // Drill down into a specific child node.
  descendTo(node) {
    this.current = node;
    this._emit();
  }

  // Move up one level toward the globe.
  ascend() {
    const path = pathToNode(this.current.id);
    if (path.length > 1) {
      this.current = path[path.length - 2];
      this._emit();
    }
  }

  // Jump to any node in the tree by id.
  jumpTo(nodeId) {
    const path = pathToNode(nodeId);
    if (path.length) {
      this.current = path[path.length - 1];
      this._emit();
    }
  }

  // Go straight to the last node of a path (from search / geolocation).
  goToPath(path) {
    if (path && path.length) {
      this.current = path[path.length - 1];
      this._emit();
    }
  }

  // Reset to the whole-world view.
  reset() {
    this.current = this.root;
    this._emit();
  }
}
