'use strict';

var format = require('string-format');
var mysql = require('mysql');
var mongodb = require('mongodb');
var Q = require('q');
var async = require('async');
var config = require('./config.js');

var pool = mysql.createPool(config.connections.mysql);

module.exports = {
    cleanSource: cleanSource,

    /**
     * Dumps data from MySQL tables to MongoDB collections.
     * The input can be in the form of the followings:
     * 1. string of a source table name.
     *    For example, 'member'.
     * 2. array of source table names.
     *    For example, ['member', 'book', 'article'].
     * 3. object with the source MySQL table names as keys and destination MongoDB collection names as values.
     *    For example, { 'member': 'Member', 'book': 'Publication', 'article': 'Article' }.
     * The returned object is of a Q.promise type which can be used to perform further operations upon done, error, etc.
     * @param {string | Array | object} sourceTableNames - A table name, an array of table names, or an object with source table names as keys and target collection names as values.
     * @returns {*} - A Q.promise object.
     */
    tableToCollection: function (sourceTableNames) {
        var defer = Q.defer();
        var promise;

        if (sourceTableNames instanceof Array) {
            promise = dumpTablesToCollections(sourceTableNames);
        } else {
            var type = typeof sourceTableNames;

            switch(type) {
                case 'string':
                    promise = dumpTableToCollection(sourceTableNames);
                    break;
                case 'object':
                    promise = dumpTablesToNamedCollections(sourceTableNames);
                    break;
            }
        }

        promise.done(function (results) {
            defer.resolve(results);
            pool.end();
        });

        return defer.promise;
    }
};

function dumpTableToCollection(sourceTableName, destinationCollectionName) {
    var defer = Q.defer();

    if (!destinationCollectionName) {
        destinationCollectionName = sourceTableName;
    }

    var rowCountPromise = getSqlRowCount(sourceTableName);
    rowCountPromise.done(function (rowCount) {
        var chunkSize = -1;
        var sqlStatements = generateSqlQueries(rowCount, sourceTableName, chunkSize);

        var recordsPromise = getSqlRecords(sqlStatements);
        recordsPromise.done(function (records) {
            var insertPromise = insertToMongo(destinationCollectionName, records);
            insertPromise.done(function (result) {
                defer.resolve(result);
                console.log(format('dumped {0} {1} records', sourceTableName, result.nInserted));
            });
        });
    });

    return defer.promise;
}

function dumpTablesToCollections(sourceTableNames) {
    var defer = Q.defer();
    var promises = [];

    async.each(sourceTableNames,
        function (tableName) {
            var dumpPromise = dumpTableToCollection(tableName);
            promises.push(dumpPromise);
        },
        function (err) {
            if (err) throw err;
        }
    );

    Q.allSettled(promises)
        .then(function (results) {
            defer.resolve(results);
        }
    );

    return defer.promise;
}

function dumpTablesToNamedCollections(tableCollectionMap) {
    var defer = Q.defer();

    var promises = [];

    async.forEach(Object.keys(tableCollectionMap), function (tableName) {
        var collectionName = tableCollectionMap[tableName];
        var dumpPromise = dumpTableToCollection(tableName, collectionName);
        promises.push(dumpPromise);
    });

    Q.allSettled(promises)
        .then(function (results) {
            defer.resolve(results);
        }
    );

    return defer.promise;
}

function cleanSource() {
    var sql = 'update author set author.cache = null, author.cachePrinterFriendly = null where 1=1;' +
        'update book set book.cache = null, book.cachePrinterFriendly = null , book.cacheEbook = null where 1=1;' +
        'update conferenceproceedings set conferenceproceedings.cache = null, conferenceproceedings.cachePrinterFriendly = null where 1=1;' +
        'update page set page.cache = null, page.cachePrinterFriendly = null, page.cacheEbook = null where 1=1;' +
        'update cachedvalue set value = "" where 1=1;';

    return getSqlRecords(sql);
}

function generateSqlQueries(rowCount, sourceTableName, chunkSize) {
    var sqlStatements = [];
    var startRow = 0;
    var sql = '';

    if (chunkSize <= 0) {
        sql = format('SELECT * FROM {0}', sourceTableName);
        sqlStatements.push(sql);

        return sqlStatements;
    }

    do {
        sql = format('SELECT * FROM {0} LIMIT {1}, {2};', sourceTableName, startRow, chunkSize);
        sqlStatements.push(sql);

        rowCount -= chunkSize;
        startRow += chunkSize;
    } while (rowCount > 0);

    return sqlStatements;
}

function getSqlRowCount(sourceTableName) {
    var sql = format('SELECT COUNT(*) AS RowCount FROM {0};', sourceTableName);

    var defer = Q.defer();

    pool.getConnection(function (err, connection) {
        if (err) {
            defer.reject(new Error(err));
            return;
        }

        connection.query(sql, function (err, rows, fields) {
            if (err) {
                defer.reject(new Error(err));
                return;
            }

            var rowCount = rows[0]['RowCount'];

            connection.release();
            defer.resolve(rowCount);
        });
    });

    return defer.promise;
}

function getSqlRecords(sqlStatements) {
    if (sqlStatements instanceof Array) {
        sqlStatements = sqlStatements.join(' ');
    }

    var defer = Q.defer()

    pool.getConnection(function (err, connection) {
        if (err) {
            defer.reject(new Error(err));
            return;
        }

        connection.query(sqlStatements, function (err, rows, fields) {
            if (err) {
                defer.reject(err);
                return;
            }

            var records = [];
            async.each(rows, function (row) {
                if (row instanceof Array) {
                    records = row.reduce(function (collection, item) {
                        collection.push(item);

                        return collection;
                    }, records);
                } else {
                    records.push(row);
                }
            });

            connection.release();
            defer.resolve(records);
        });
    });

    return defer.promise;
}

function insertToMongo(collectionName, records) {
    var defer = Q.defer()

    var database = mongodb.Db;
    var server = mongodb.Server;

    var db = new database(
        config.connections.mongo.database,
        new server(
            config.connections.mongo.host,
            config.connections.mongo.port,
            {}
        ),
        { native_parser: true }
    );

    db.open(function (err, db) {
        if (err) {
            defer.reject(err);
            return;
        }

        var collection = db.collection(collectionName);
        collection.deleteMany({}, function () {
        });
        var batch = collection.initializeUnorderedBulkOp({ userLegacyOps: true });
        async.forEach(records, function (record) {
            batch.insert(record);
        });

        batch.execute(function (err, result) {
            if (err) {
                defer.reject(err);
                return;
            }

            db.close();
            defer.resolve(result);
        });
    });

    return defer.promise;
}