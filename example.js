require('console-stamp')(console, "HH:MM:ss.l");
var dump = require('./dump.js');

var tableNames = [
    'articles',
    'author',
    'book'
];

console.time('total dump time');
var dumpPromise = dump.tableToCollection(tableNames);
dumpPromise.done(function(results) {
    console.timeEnd('total dump time');
});
