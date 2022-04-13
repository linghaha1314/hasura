const pool = require('../utils/pool');
const request = require("request-promise");
const {search} = require("koa/lib/request");
const refUrl = "http://zyk.mrtcloud.com:8888/api/rest";
const result = {
    msg: '', success: false
};

//获取表名
function getTableName(url) {
    let tableName = convertColumn(url.split('/')[1]);
    const strArr = tableName.split('')
    strArr.forEach(res => {
        if (/[A-Z]/.test(res)) {
            tableName = tableName.replace(res, `_${res.toLowerCase()}`)
        }
    })
    tableName = 'kb_' + tableName
    return tableName
}

//转化列名
function convertColumn(column) {
    let columnArr = column.split('')
    //xxx_id->xxxId
    if (column.indexOf('_') > -1) {
        columnArr.forEach((res, index) => {
            if (res === '_') {
                columnArr[index + 1] = (columnArr[index + 1]).toUpperCase()
                columnArr[index] = ""
            }
        })
        return columnArr.join('')
    }
    //xxxId->xxx_id
    columnArr.forEach(res => {
        if (/[A-Z]/.test(res)) {
            column = column.replace(res, `_${res.toLowerCase()}`)
        }
    })
    return column
}

//根据类型转换列名，返回对应的数据格式
function covertColumnByType(data, type = 1) {
    const list = []
    switch (type) {
        case 1:
            //data是一个数组
            data.map(res => {
                list.push(convertColumn(res))
            })
            return list
            break;
        case 2:
            //data是一个对象数组
            data.forEach(res => {
                const obj = {}
                for (const i in res) {
                    obj[convertColumn(i)] = res[i]
                }
                list.push(obj)
            })
            return list
            break;
    }
}

//登录验证
async function validLogin(loginObj) {
    const user = await pool.query('SELECT * FROM kb_user where username=$1', [loginObj.username]);
    const pass = await pool.query(`SELECT * FROM kb_user where username=$1 And password=$2`, [loginObj.username, loginObj.password]);
    if (user.rows.length === 0) {
        result.msg = '用户名错误！';
    } else if (pass.rows.length !== 1) {
        result.msg = '密码错误';
        result.success = false;
    } else {
        result.id = user.rows[0].id;
        result.success = true;
        result.msg = '登录成功！';
    }
    return result;
}

//查
async function getListByPage(ctx) {
    const obj = JSON.parse(JSON.stringify(ctx.request.query));
    delete obj.limit;
    delete obj.offset;
    delete obj.sort;
    const keys = Object.keys(obj);
    let sortKey = ctx.request.query.sort || 'id'
    const params = [];
    let sql = '';
    if (keys.length > 0) {
        sql += ' where';
    }
    let index = 1;
    for (const w in obj) {
        sql += (convertColumn(w).indexOf('id') > -1 || convertColumn(w).indexOf('status') > -1) ? ` ${convertColumn(w)}=$${index}` : ` ${convertColumn(w)} like concat('%',$${index}, '%')`;
        params.push(obj[w]);
        if (index < keys.length) {
            sql += ` and`
        }
        index++;
    }
    const total = await pool.query(`SELECT count(id) FROM ${getTableName(ctx.request.url)}${sql}`, params);
    sql += ' order by ' + convertColumn(sortKey) + ' limit $' + (params.length + 1);
    params.push(ctx.request.query.limit || 20);
    sql += ' offset $' + (params.length + 1);
    params.push(ctx.request.query.offset || null);
    const data = await pool.query(`select * from ${getTableName(ctx.request.url)}${sql}`, params);
    const list = covertColumnByType(data.rows, 2)
    return {
        list, total: Number(total.rows[0].count)
    }
}

async function getList(ctx, next) {
    const obj = JSON.parse(JSON.stringify(ctx.request.query));
    delete obj.limit;
    delete obj.offset;
    delete obj.search;
    const keys = Object.keys(obj);
    let otherSql = ''
    keys.forEach((res, index) => {
        otherSql += 'and ' + convertColumn(res) + '=$' + (index + 4);
    })
    let data = {};
    if (otherSql) {
        data = await pool.query(`SELECT * FROM ${getTableName(ctx.request.url)} where name like $1 ${otherSql} order by id ;`, [`%${ctx.request.query.search || ''}%`]);
    } else {
        data = await pool.query(`SELECT * FROM ${getTableName(ctx.request.url)} where name like $1 order by id ;`, [`%${ctx.request.query.search || ''}%`]);
    }
    const total = await pool.query(`SELECT count(id) FROM ${getTableName(ctx.request.url)} where name like $1`, [`%${ctx.request.query.search || ''}%`]);
    const list = covertColumnByType(data.rows, 2)

    return {
        list, total: Number(total.rows[0].count)
    }
}

//查
async function getDataById(ctx, next) {
    const idName = convertColumn((Object.keys(ctx.request.body))[0]);
    const valueList = Object.values(ctx.request.body)
    const data = await pool.query(`SELECT * FROM ${getTableName(ctx.request.url)} where ${idName}=$1`, valueList);
    return covertColumnByType(data.rows, 2)

}

//增
async function create(ctx) {
    const columns = Object.keys(ctx.request.body);
    const keyList = covertColumnByType(columns)
    const valueList = Object.values(ctx.request.body)
    const params = [];
    keyList.forEach((k, i) => params.push('$' + (i + 1)));
    const sql = `
    insert
    into  ${getTableName(ctx.request.url)}(${keyList.join(',')})
    VALUES(${params.join(',')}) returning *;
    `;
    const data = await pool.query(sql, valueList);
    return data
}

//删
async function deleteById(ctx, next) {
    const keys = Object.keys(ctx.request.body)
    const values = Object.values(ctx.request.body)
    const data = await pool.query(`
    delete from ${getTableName(ctx.request.url)} where ${convertColumn(keys[0])} = $1`, [values[0]]);
    return data
}

//批量删除
async function deleteMultiple(ctx, next) {
    let idStr = '';
    const list = ctx.request.body['id'].split(',')
    list.forEach((res, index) => {
        idStr += index === list.length - 1 ? "'" + res + "'" : "'" + res + "'" + ','
    })
    const data = await pool.query(`
    delete from ${getTableName(ctx.request.url)} where id IN (${idStr});`)
    return data
}

//改
async function updateById(ctx, next) {
    let columns = ""
    for (const key in ctx.request.body) {
        if (key !== 'id') {
            columns += (convertColumn(key) + "=" + stringToNull(ctx.request.body[key]) + ",")
        }
    }
    columns = columns.slice(0, columns.length - 1)
    await pool.query(`
    update  ${getTableName(ctx.request.url)}
    set ${columns}
    where id = $1`, [ctx.request.body.id]);
    const currentRow = await pool.query(`
    select * from  ${getTableName(ctx.request.url)}
    where id = $1`, [ctx.request.body.id]);
    return covertColumnByType(currentRow.fields, 2)
}

//根据字典typeCode获取所有的data
async function dictionaryDataByTypeCode(ctx, next) {
    //合并两张表
    const result = await pool.query(`select d.* from kb_dictionary_type t join kb_dictionary_data d on t.id=d.type_id where t.code=$1 order by d.sequence`, [ctx.request.body['typeCode']])
    return covertColumnByType(result.rows, 2)
}

//查
async function getBeforeNext(ctx, next) {
    const idName = ctx.request.body.id;
    // const valueList = Object.values(ctx.request.body)
//     const sql = `SELECT * FROM ${getTableName(ctx.request.url)} where sequence > ${idName} and not exists(select 1 from ${getTableName(ctx.request.url)} where sequence > ${idName} and
// sequence < ${idName} )`
    const sql = `select * from ${getTableName(ctx.request.url)} a
where sequence > ${idName} and not exists(select 1 from ${getTableName(ctx.request.url)} where sequence > ${idName} and
sequence < a.sequence )
or
sequence < ${idName} and not exists(select 1 from ${getTableName(ctx.request.url)} where sequence < ${idName} and
sequence > a.sequence )`
    console.log(sql, 5555)
    const data = await pool.query(sql)
    console.log(data, 9999)
    return covertColumnByType(data.rows, 2)
}

//转发请求
async function getApi(ctx, next) {
    let url = ctx.request.url;
    if (url.indexOf('getListByPage') > -1) {
        ctx.request.query.limit = Number(ctx.request.query.limit || 20);
        ctx.request.query.offset = Number(ctx.request.query.offset || 0);
    }
    if (url.indexOf('search') > -1) {
        const arr = url.split('search=');
        url = arr[0] + `
    search =
    %${ctx.request.query.search}
    %
    ` + arr[1].replace(/[^&]+/, '')
    }
    try {
        ctx.set('X-Response-Url', url);
    } catch (e) {
    }
    const response = await request({
        method: ctx.method, url: refUrl + url, headers: {
            "content-type": ctx.header['content-type'],
        }, body: ctx.request.body, json: true
    });
    return response;
}

//改变tree结构
async function changeDataTree(list, key) {
    const result = [];
    list.forEach(res => {
        const data = JSON.parse(JSON.stringify(res[key]));
        delete res[key];
        res = {...res, ...data}
        result.push(res);
    });
    return result;
}

//菜单tree结构设置
function getMenuTree(parentList, childList) {
    for (let i = 0; i < parentList.length; i++) {
        parentList[i].children = [];
        for (let j = 0; j < childList.length; j++) {
            if (parentList[i].id === childList[j].parentId) {
                childList[j].parentName = parentList[i].name
                childList[j].hasParent = true;
                parentList[i].children.push(childList[j]);
            }
        }
    }
    childList = childList.filter(res => !res.hasParent)
    //一轮结束后，childList还存在，就再一次调用这个方法
    if (childList.length > 0) {
        for (let i = 0; i < parentList.length; i++) {
            getMenuTree(parentList[i].children, childList);
        }
    }
}

function stringToNull(val) {
    return val === null ? val : "'" + val + "'"
}

//秒转化成时分秒的结构

module.exports = {
    refUrl,
    deleteById,
    validLogin,
    getApi,
    getList,
    getListByPage,
    getMenuTree,
    changeDataTree,
    create,
    updateById,
    getDataById,
    getBeforeNext,
    deleteMultiple,
    covertColumnByType,
    dictionaryDataByTypeCode
}
