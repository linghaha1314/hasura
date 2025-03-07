const Koa = require('koa');
const app = new Koa();
const path = require('path');
const static = require('./utils/koa-static');
const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');
const session = require('koa-session');
const jwt = require('koa-jwt');
const router = new Router();
const control = require('./router/router');
const request = require('request-promise');
const cors = require('koa2-cors');
const jsonwebtoken = require("jsonwebtoken");
const pool = require("./utils/pool");
//编译后静态路径
const staticPath = './frontend';
const blockToken = {};

//crud服务
const {refUrl} = require('./config')
app.keys = ['kbds random secret'];
app.use(session(app));
// 添加单点登录
try {
    const CasClient = require('./utils/cas-client');
    const cas = new CasClient({
        cas_url: 'http://117.159.24.46:8083',
        service_url: 'http://117.159.24.46:3001',
        cas_login: '/login',
        cas_logout: '/logout',
        cas_validate: '/serviceValidate'
    });
    app.use(cas.auth);
} catch (e) {
    console.error(e);
}


//应用静态资源
app.use(static(path.join(__dirname, staticPath), {mobile: './mobile'}));
//数据处理
// 设置请求体大小限制
app.use(bodyParser({
    jsonLimit: '30mb', // 限制 JSON 请求体大小为 1MB
    formLimit: '30mb', // 限制表单请求体大小为 1MB
}));
app.use(cors());

//日志记录
app.use(async (ctx, next) => {
    try {
        ctx.getUserId = jsonwebtoken.decode(ctx.request.req.headers.authorization?.substring(7) || null)?.data.id;
    } catch (e) {
    }
    // if(ctx.request.req.headers.authorization !== blockToken.old || ctx.request.url.indexOf('/getCode') > -1){
    //     await next();
    // }
    await next();
    const rt = ctx.response.get('X-Response-Time');
    const reUrl = ctx.response.get('X-Response-Url');
    // if (ctx.originalUrl.indexOf('attachs') > -1) {
    //     const filePath = path.join(__dirname, ctx.url);
    //     const file = fs.readFileSync(filePath); //读取文件
    //     let mimeType = mime.lookup(filePath); //读取图片文件类型
    //     ctx.set('content-type', mimeType); //设置返回类型
    //     ctx.body = file; //返回图片
    // }
    if (reUrl.length > 0) {
        console.log(`${ctx.method} ${ctx.url} redirect to ${reUrl} - ${rt}`);
    } else {
        console.log(`${ctx.method} ${ctx.url} - ${rt}`);
    }
    try {
        if (ctx.getUserId) {
            // 收集日志字段信息
            // const body = {
            //     staffId: ctx.getUserId || null, url: ctx.originalUrl || null, result: ctx.response.body?.msg || null
            // }
            // const valueList = Object.values(body)
            // const sql = `
            // insert
            // into  kb_log(staff_id,url,result)
            // VALUES($1,$2,$3) returning *;
            // `;
            // pool.query(sql, valueList)
        }
    } catch (e) {
        console.error(e)
    }

});

//监听器
app.use(async (ctx, next) => {
    const start = Date.now();
    // if(ctx.request.req.headers.authorization !== blockToken.old || ctx.request.url.indexOf('/getCode') > -1){
    //     await next();
    // }
    await next();
    const ms = Date.now() - start;
    ctx.set('X-Response-Time', `${ms}ms`);
});

//错误处理
app.use(function (ctx, next) {
    return next().catch((err) => {
        ctx.status = err.status || 500;
        ctx.body = {
            status: err.status, success: false, msg: err.message
        }
        ctx.app.emit("error", err, ctx);
        //错误要返回具体的错误数据
    });
});


// 不过滤的请求路径
const ignoreUrl = require('./ignore-path')
const CasClient = require("./utils/cas-client");
// Middleware below this line is only reached if JWT token is valid
app.use(jwt({
    secret: 'kbds random secret'
}).unless({
    path: ignoreUrl,   //引入文件
}));


//路由,跳转到基础接口
app.use(async (ctx, next) => {
    const url = (ctx.request.url.replace(/([?][^?]+)$/, ''))
    ctx.request.realUrl = ctx.request.url
    if (ctx.request.url.indexOf('/api') > -1) {
        ctx.set('X-Response-Url', url);
        const response = await request({
            method: ctx.method, url: refUrl + ctx.request.url, headers: {
                "content-type": ctx.header['content-type'],
            }, body: ctx.request.body, json: true
        });
        ctx.body = {
            data: response, success: true, msg: '查询成功！'
        }
    } else if (ctx.request.url.indexOf('/blockToken') > -1) {
        blockToken.old = ctx.request.req.headers.authorization
    } else {
        switch (url.split('/')[2]) {
            case 'create':
                ctx.request.url = '/create'
                break;
            case 'createMultiple':
                ctx.request.url = '/createMultiple'
                break;
            case 'deleteById':
                ctx.request.url = '/deleteById'
                break;
            case 'deleteMultiCondition':
                ctx.request.url = '/deleteMultiCondition'
                break;
            case 'createUpdateById':
                ctx.request.url = '/createUpdateById'
                break;
            case 'getList':
                ctx.request.url = '/getList'
                break;
            case 'getListByPage':
                ctx.request.url = '/getListByPage'
                break;
            case 'getListByPageNotTree':
                ctx.request.url = '/getListByPageNotTree'
                break;
            case 'getDataById':
                ctx.request.url = '/getDataById'
                break;
            case 'getDataByIdMore':
                ctx.request.url = '/getDataByIdMore'
                break;
            case 'getBeforeNext':
                ctx.request.url = '/getBeforeNext'
                break;
            case 'updateById':
                ctx.request.url = '/updateById'
                break;
            case 'createUpdateByList':
                ctx.request.url = '/createUpdateByList'
                break;
            case 'deleteMultiple':
                ctx.request.url = '/deleteMultiple'
                break;
            case 'import':
                ctx.request.url = '/import'
                break;
            case 'verify':
                ctx.request.url = '/verify'
                break;
            default:
                break;
        }
    }

    // if(ctx.request.req.headers.authorization !== blockToken.old || ctx.request.url.indexOf('/getCode') > -1){
    //     await next();
    // }
    await next();
});

//接口
app
    .use(control(router).routes())
    .use(router.allowedMethods());
//启动端口
app.listen(3011);

console.log(`listening on port 3011, http://localhost:3011`);
