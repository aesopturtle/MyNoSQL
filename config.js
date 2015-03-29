'use strict';

module.exports = {
    connections: {
        mysql     : {
            host    : 'localhost',
            user    : 'mysql_username',
            password: 'mysql_password',
            database: 'mysql_database',
            multipleStatements: true
        },
        mongo      : {
            host    : 'localhost',
            port    : 27017,
            database: 'dump'
        }
    }
};