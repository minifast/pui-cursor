const flow = require('lodash.flow');
const reactUpdate = require('react-addons-update');

let async = true, debug = true;
const privates = new WeakMap();

function isObject(obj) {
  return typeof obj === 'object';
}

class Cursor {
  static get async() {
    return async;
  }

  static set async(bool) {
    async = bool;
  }

  static get debug() {
    return debug;
  }

  static set debug(bool) {
    debug = bool;
  }

  constructor(data, {path = [], listeners = [], state = {updates: [], data}} = {}) {
    privates.set(this, {data, listeners, path, state});
  }

  onCommit(callback) {
    let {data, listeners, path, state} = privates.get(this);
    privates.set(this, {data, listeners: listeners.concat(callback), path, state});
  }

  refine(...query) {
    let {listeners, data, path, state} = privates.get(this);
    query = query.reduce((memo, p) => (memo.push(isObject(p) ? (this.get(...memo)).indexOf(p) : p), memo), []);
    return new Cursor(data, {path: path.concat(query), listeners, state});
  }

  get(...morePath) {
    const {data, path} = privates.get(this);
    return path.concat(morePath).reduce((memo, step) => memo[step], data);
  }

  isEqual(otherCursor) {
    return this.get() === otherCursor.get();
  }

  apply(options) {
    return this.update({$apply: options});
  }

  merge(options) {
    return this.update({$merge: options});
  }

  set(options) {
    return this.update({$set: options});
  }

  push(...options) {
    return this.update({$push: options});
  }

  remove(obj) {
    const target = this.get();
    if (Array.isArray(target)){
      const objArrayIndex = target.indexOf(obj);
      if(objArrayIndex === -1) return this.splice();
      return this.splice([objArrayIndex, 1]);
    }
    return this.apply(data => (delete data[obj], data));
  }

  splice(...options) {
    return this.update({$splice: options});
  }

  unshift(...options) {
    return this.update({$unshift: options});
  }

  nextTick(fn) {
    setImmediate(fn);
  }

  flush() {
    let {listeners, state} = privates.get(this);
    if (!state.updates.length) return this;
    const fn = flow(...state.updates);
    state.updates = [];
    state.data = fn.call(this, state.data);
    if (Cursor.async) state.stale = true;
    listeners.forEach(listener => listener(state.data));
    return this;
  }

  update(options) {
    const {path, state: {updates, stale}} = privates.get(this);
    if (Cursor.debug && stale) console.warn('You are updating a stale cursor, this is almost always a bug');
    const query = path.reduceRight((memo, step) => ({[step]: {...memo}}), options);
    updates.push(data => reactUpdate(data, query));
    if (!Cursor.async) return this.flush();
    if (updates.length === 1) this.nextTick(this.flush.bind(this));
    return this;
  }
}

module.exports = Cursor;
