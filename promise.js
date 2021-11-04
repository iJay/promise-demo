/**
 * @description [Promise 构造函数]
 * @param [executor运行器]
 * @returns [新的promise实例]
 */
function PromiseA (executor) {

  // promise实例的状态 'pending' => 'fulfilled'/'rejected'
  this.state = 'pending'
  
  // promise实例的传值
  this.value = undefined

  // promise实例的失败原因
  this.reason = undefined

  // 存放fulfilled回调函数的数组
  this.onFulfilledCallbacks = []

  // 存放rejected回调函数的数组
  this.onRejectedCallbacks = []

  let resolve = (value) => {
    if (this.state === 'pending') {
      this.state = 'fulfilled'
      this.value = value
      // 调用fulfilledcallbacks中的成功回调
      this.onFulfilledCallbacks.forEach(fn => fn())
    }
  }

  let reject = (reason) => {
    if (this.state === 'pending') {
      this.state = 'rejected'
      this.reason = reason
      // 调用rejectcallbacks中的失败回调
      this.onRejectedCallbacks.forEach(fn => fn())
    }
  }

  // 如果执行器内部代码执行错误，直接reject抛出错误
  try {
    executor(resolve, reject)
  } catch (error) {
    reject(error)
  }

}

/**
 * @description [promise.then方法]
 * @returns [新的promise实例]
 */
PromiseA.prototype.then = function (onFulfilled, onRejected) {
  onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : value => value
  onRejected = typeof onRejected === 'function' ? onRejected : error => { throw error }
  let promise2 = new PromiseA((resolve, reject) => {
    if (this.state === 'fulfilled') {
      // 异步执行 这里应该是js引擎实现的微任务
     setTimeout(() => {
       // onFulfilled执行中，报错直接reject
      try {
        let x = onFulfilled(this.value)
        // 这里的resolve，reject都是改变promise2的状态值
        resolvePromise(promise2, x, resolve, reject)
      } catch (error) {
        reject(error)
      }
     }, 0)
    }
    if (this.state === 'rejected') {
      // 异步执行 这里应该是js引擎实现的微任务
      setTimeout(() => {
        // 报错直接reject
        try {
          let x = onRejected(this.reason)
          // 这里的resolve，reject都是改变promise2的状态值
          resolvePromise(promise2, x, resolve, reject)
        } catch (error) {
          reject(error)
        }
      }, 0)
    }
    if (this.state === 'pending') { // pending状态下注册回调函数
      this.onFulfilledCallbacks.push(() => {
        // 异步执行 这里应该是js引擎实现的微任务
        setTimeout(() => {
          // 报错直接reject
          try {
            let x = onFulfilled(this.value)
            // 这里的resolve，reject都是改变promise2的状态值
            resolvePromise(promise2, x, resolve, reject)
          } catch (error) {
            reject(error)
          }
        }, 0)
      })
      this.onRejectedCallbacks.push(() => {
        // 异步执行 这里应该是js引擎实现的微任务
        setTimeout(() => {
          // 报错直接reject
          try {
            let x = onRejected(this.reason)
            resolvePromise(promise2, x, resolve, reject)
          } catch (error) {
            reject(error)
          }
        })
      })
    }
  })
  return promise2
}

/**
 * @description [promise.catch方法]
 * @returns [新的promise实例]
 */
PromiseA.prototype.catch = function (onRejected) {
  return this.then(undefined, onRejected)
}

/**
 * @description [Promise.resolve方法]
 * @returns [新的promise实例]
 */
PromiseA.resolve = function (value) {
  if (value instanceof PromiseA) { //如果是promise对象，直接返回该promise
    return value
  }
  return new PromiseA((resolve, reject) => {
    resolve(value)
  })
}

/**
 * @description [Promise.reject方法]
 * @returns [新的promise实例]
 */
PromiseA.reject = function (reason) {
  return new PromiseA((resolve, reject) => {
    reject(reason)
  })
}

/**
 * @description [Promise.all方法]
 */
PromiseA.all = function (promises) {
  let result = []
  let i = 0
  function collectResult (value, index) {
    result.push(value)
    i++
    if (index === promises.length) {
      resolve(result)
    }
  }
  promises.forEach(promise => {
    promise.then((value, index) => {
      collectResult(value, index)
    }, reject)
  })
}

/**
 * @description [Promise.race方法]
 */
PromiseA.race = function (promises) {
  // 将新返回的promise对象的resolve reject方法当promises中每个元素的onFulfilledCallback和onRejectedCallback使用
  // 因此，一旦其中的一个resolve先运行，新返回的promise对象的内部状态就seltted了
  return new PromiseA((resolve, reject) => {
    promises.forEach(promise => {
      promise.then(resolve, reject)
    })
  })
}


/**
 * @description [resolvePromise 解析then方法返回的promise2 与onFulfilled的返回值的关系]
 * @param {*} promise2 
 * @param {*} x 第一个then方法的回调函数onFulfilled的返回值
 * @param {*} resolve 
 * @param {*} reject 
 * @returns 
 */
// 须遵循promiseA+规范
function resolvePromise (promise2, x, resolve, reject) {
  // 循环引用报错
  if (x === promise2) {
    return reject(new TypeError('Chaining cycle detected for promise'))
  }
  // 防止多次调用的flag
  let called
  if (x !== null && (typeof x === 'object' || typeof x === 'function')) { // 这里的x为对象的时候，可能是thenable对象
    try {
      let then = x.then
      if (typeof then === 'function') {
        try {
          then.call(x, val => {
            // 成功/失败都只能调用一次
            if (called) return
            called = true
            resolvePromise(promise2, val, resolve, reject)
          }, err => {
            // 成功/失败都只能调用一次
            if (called) return
            called = true
            reject(error)
          })
        } catch (error) {
          called = true
          reject(error)
        }
      } else {
        // 直接成功即可
        resolve(x)
      }
    } catch (error) {
      if (called) return
      called = true
      // 取then出错了，说明不是thenable对象，那就不要再继续执行了
      reject(error)
    }
  } else {
    resolve(x)
  }
}
