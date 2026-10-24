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
    // The exact spot being looked at, when it isn't simply the place's center:
    // a searched address or the user's GPS position. Districts (Congress,
    // legislature, schools, wards) are looked up for THIS point.
    this.point = null;
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
      point: this.point || this.current.center,
      pointIsExact: !!this.point,
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
        loading: parent.childrenState === "loading",
        options: options.map((o) => ({ id: o.id, name: o.name })),
        selectedId: selected ? selected.id : "",
      };
    });
  }

  _go(node, point = null) {
    this.current = node;
    this.point = point;
    this._emit();
  }

  // Drill down into a specific child node.
  descendTo(node) {
    this._go(node);
  }

  // Move up one level toward the globe.
  ascend() {
    const path = pathToNode(this.current.id);
    if (path.length > 1) this._go(path[path.length - 2]);
  }

  // Jump to any node in the tree by id.
  jumpTo(nodeId) {
    const path = pathToNode(nodeId);
    if (path.length) this._go(path[path.length - 1]);
  }

  // Go straight to the last node of a path (from search / geolocation).
  // `point` = the exact [lng, lat] to look up districts for.
  goToPath(path, point = null) {
    if (path && path.length) this._go(path[path.length - 1], point);
  }

  // Re-emit the current state (used after lists finish loading).
  refresh() {
    this._emit();
  }

  // Reset to the whole-world view.
  reset() {
    this._go(this.root);
  }
}
