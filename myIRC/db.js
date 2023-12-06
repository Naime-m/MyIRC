"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
var mysql = require('mysql2');
exports.db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "pass",
    database: "ts_server"
});
