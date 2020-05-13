const v8  = require('v8');

let x = new Buffer('ddd');

console.log(  Object.getPrototypeOf(x).constructor.name )
