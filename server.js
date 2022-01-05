const Koa = require('koa');
const app = new Koa();
const path = require('path');
const static = require('koa-static');
const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');
const session = require('koa-session');
const jwt = require('koa-jwt');
const router = new Router();
const control = require('./router/router');
const request = require('request-promise');
const cors = require('koa2-cors');
const jsonwebtoken = require("jsonwebtoken");
//编译后静态路径
const staticPath = './frontend';
//crud服务
const refUrl = "http://192.168.0.166:9090";
app.keys = ['kbds random secret'];
app.use(session(app));
//应用静态资源
app.use(static(
    path.join(__dirname, staticPath)
));
//数据处理
app.use(bodyParser());
app.use(cors());
//日志记录
app.use(async (ctx, next) => {
    ctx.getUserId = jsonwebtoken.decode(ctx.request.req.headers.authorization?.substring(7) || null)?.data.id;
    await next();
    const rt = ctx.response.get('X-Response-Time');
    const reUrl = ctx.response.get('X-Response-Url');
    if (reUrl.length > 0) {
        console.log(`${ctx.method} ${ctx.url} redirect to ${reUrl} - ${rt}`);
    } else {
        console.log(`${ctx.method} ${ctx.url} - ${rt}`);
    }
});

//监听器
app.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    ctx.set('X-Response-Time', `${ms}ms`);
});

// 错误处理
app.use(function (ctx, next) {
    return next().catch((err) => {
        if (401 == err.status) {
            ctx.status = 200;
            ctx.body = {
                status: 401,
                success: false,
                msg: 'Protected resource, use Authorization header to get access\n'
            }
        } else {
            throw '??' + err;
        }
    });
});

// 不过滤的请求路径
const ignoreUrl = [
    /\/public/,
    /\/login/
];
// Middleware below this line is only reached if JWT token is valid
app.use(jwt({
    secret: 'kbds random secret'
}).unless({
    path: ignoreUrl,
}));


//路由
app.use(async (ctx, next) => {
    const url = (ctx.request.url.replace(/([?][^?]+)$/, ''))
    ctx.request.realUrl = ctx.request.url
    switch (url.split('/')[2]) {
        case 'create':
            ctx.request.url = '/create'
            break;
        case 'deleteById':
            ctx.request.url = '/deleteById'
            break;
        case 'getListByPage':
            ctx.request.url = '/getListByPage'
            break;
        case 'updateById':
            ctx.request.url = '/updateById'
            break;
        default:
            break;
    }
    // if (ctx.request.url.indexOf('/api') > -1) {
    //     ctx.set('X-Response-Url', url);
    //     const response = await request({
    //         method: ctx.method,
    //         url: refUrl + url,
    //         headers: {
    //             "content-type": ctx.header['content-type'],
    //         },
    //         body: ctx.request.body,
    //         json: true
    //     });
    //     ctx.apiResponse = response;
    // }
    await next();
});
//接口
app
    .use(control(router).routes())
    .use(router.allowedMethods());
//启动端口
app.listen(3001);

console.log(`listening on port 3001, http://localhost:3001`);
