const flow = require('lodash.flow');
const reactUpdate = require('react-addons-update');

let async = true;
const privates = new WeakMap();

function isObject(obj) {
  return typeof obj === 'object';
}

class Atom {
  static isAtom(obj) {
    return obj instanceof Atom;
  }

  constructor(data, listeners = []) {
    privates.set(this, {data, listeners, updates: []});
  }

  get() {
    let {data} = privates.get(this);
    return data;
  }

  onCommit(callback) {
    let {updates, listeners, data} = privates.get(this);
    privates.set(this, {updates, listeners: listeners.concat(callback), data});
  }

  flush() {
    let {updates, listeners, data} = privates.get(this);
    if (updates.length > 0) {
      let fn = flow(...updates);
      data = fn.call(this, data);
      listeners.forEach(listener => listener(data));
    }
    privates.set(this, {updates: [], listeners, data});
  }

  update(query) {
    let {updates, listeners, data} = privates.get(this);
    updates.push(data => reactUpdate(data, query));
    privates.set(this, {updates, listeners, data});
  }
}

class Cursor {
  static get async() {
    return async;
  }

  static set async(bool) {
    async = bool;
  }

  constructor(data, path = []) {
    let atom = Atom.isAtom(data) ? data : new Atom(data);
    privates.set(this, {atom, path});
  }

  onCommit(callback) {
    let {atom} = privates.get(this);
    atom.onCommit(callback);
    return this;
  }

  refine(...query) {
    let {atom, path} = privates.get(this);
    query = query.reduce((memo, p) => (memo.push(isObject(p) ? (this.get(...memo)).indexOf(p) : p), memo), []);
    return new Cursor(atom, path.concat(query));
  }

  get(...morePath) {
    const {atom, path} = privates.get(this);
    return path.concat(morePath).reduce((memo, step) => memo[step], atom.get());
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
    const {atom} = privates.get(this);
    atom.flush();
    return this;
  }

  update(options) {
    const {atom, path} = privates.get(this);
    const query = path.reduceRight((memo, step) => ({[step]: {...memo}}), options);
    atom.update(query);
    if (Cursor.async) {
      this.nextTick(atom.flush.bind(atom));
      return this;
    }
    return this.flush();
  }
}

module.exports = Cursor;
