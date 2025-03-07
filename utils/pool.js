// const {Pool} = require('pg');
// const pool = new Pool({
//     user: 'postgres',
//     host: '116.63.181.221',
//     database: 'postgres',
//     password: '1234',
//     port: 51436,
// });
// pool.on('error', (err, client) => {
//     console.error('Unexpected error on idle client', err)
//     process.exit(-1)
// });
// module.exports = pool;

const {Pool} = require('pg');
const {poolObj} = require('../config.js')
const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'postgres',
    password: '1234',
    port: 5433,
});
// const pool = new Pool(poolObj)
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err)
    process.exit(-1)
});
module.exports = pool;
