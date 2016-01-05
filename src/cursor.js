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

  constructor(data, callback) {
    privates.set(this, {data, callback, log: [], stamp: 0});
  }

  get() {
    let {data} = privates.get(this);
    return data;
  }

  commit() {
    let {log, callback, data, stamp} = privates.get(this);
    if (log.length === stamp) return;
    data = log.slice(stamp).reduce(reactUpdate, data);
    stamp = log.length;
    callback(data);
    privates.set(this, {log, callback, data, stamp});
  }

  append(entry) {
    let {log, callback, data, stamp} = privates.get(this);
    privates.set(this, {log: log.concat(entry), callback, data, stamp});
  }
}

class Cursor {
  static get async() {
    return async;
  }

  static set async(bool) {
    async = bool;
  }

  constructor(data, callback, path = []) {
    let atom = Atom.isAtom(data) ? data : new Atom(data, callback);
    privates.set(this, {atom, path});
  }

  refine(...query) {
    let {atom, path} = privates.get(this);
    query = query.reduce((memo, p) => (memo.push(isObject(p) ? (this.get(...memo)).indexOf(p) : p), memo), []);
    return new Cursor(atom, null, path.concat(query));
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
    atom.commit();
    return this;
  }

  update(options) {
    const {atom, path} = privates.get(this);
    const query = path.reduceRight((memo, step) => ({[step]: {...memo}}), options);
    atom.append(query);
    if (Cursor.async) {
      this.nextTick(atom.commit.bind(atom));
      return this;
    }
    return this.flush();
  }
}

module.exports = Cursor;
