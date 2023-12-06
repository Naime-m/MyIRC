const mysql = require('mysql2');

export const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "pass",
    database: "ts_server"
});