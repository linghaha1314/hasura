const jsonwebtoken = require('jsonwebtoken')
const mime = require('mime-types')
const koaBody = require('koa-body')({
    multipart: true, uploadDir: '.'
})
const {
    getApi,
    validLogin,
    getMenuTree,
    updateById,
    create,
    deleteById,
    refUrl,
    changeDataTree,
    covertColumnByType,
    dictionaryDataByTypeCode,
    getList,
    getListByPage,
    getDataById,
    deleteMultiple
} = require('../server/user');
const fs = require("fs");
const path = require("path");
const pool = require("../utils/pool");
const request = require("request");

module.exports = (router) => {
    //基础接口
    router.post(`/create`, async (ctx, next) => {
        ctx.request.url = ctx.request.realUrl
        const data = await create(ctx, next);
        if (data) {
            ctx.body = {
                id: data, success: true, msg: '添加成功！'
            }
            return;
        }
        ctx.body = {
            success: false, msg: '新增失败！'
        }
    });
    router.post(`/deleteById`, async (ctx, next) => {
        ctx.request.url = ctx.request.realUrl
        const data = await deleteById(ctx, next);
        if (data) {
            ctx.body = {
                data, success: true, msg: '删除成功！'
            }
            return;
        }
        ctx.body = {
            success: false, msg: '删除失败!'
        }
    });
    router.get(`/getList`, async (ctx, next) => {
        ctx.request.url = ctx.request.realUrl
        const data = await getList(ctx, next);
        const parentData = data.list.filter(res => !res.parentId);
        const childData = data.list.filter(res => res.parentId);
        getMenuTree(parentData, childData); //如果存在父子关系，变成树状结构
        ctx.body = {
            list: parentData, total: data.total, success: true, msg: '查询成功！'
        }
    });
    router.get(`/getListByPage`, async (ctx, next) => {
        ctx.request.url = ctx.request.realUrl
        const data = await getListByPage(ctx, next);
        const parentData = data.list.filter(res => !res.parentId);
        const childData = data.list.filter(res => res.parentId);
        getMenuTree(parentData, childData); //如果存在父子关系，变成树状结构
        ctx.body = {
            list: parentData, total: data.total, success: true, msg: '查询成功！'
        }
    });
    router.post(`/updateById`, async (ctx, next) => {
        ctx.request.url = ctx.request.realUrl
        const data = await updateById(ctx, next);
        if (data) {
            ctx.body = {
                data: data, success: true, msg: '更新成功！'
            }
            return;
        }
        ctx.body = {
            success: false, msg: '更新失败！'
        }
    });
    router.post(`/getDataById`, async (ctx, next) => {
        ctx.request.url = ctx.request.realUrl
        const data = await getDataById(ctx, next);
        if (data) {
            ctx.body = {
                data: data[0], success: true, msg: '查询成功！'
            }
            return;
        }
        ctx.body = {
            success: false, msg: '查询失败！'
        }
    });
    router.post(`/deleteMultiple`, async (ctx, next) => {
        ctx.request.url = ctx.request.realUrl
        const data = await deleteMultiple(ctx, next);
        if (data) {
            ctx.body = {
                data: data, success: true, msg: '删除成功！'
            }
            return;
        }
        ctx.body = {
            success: false, msg: '删除失败！'
        }
    });
    router.get(`/api`, async (ctx, next) => {
        // ctx.set('X-Response-Url', refUrl + ctx.request.url);
        const response = await request({
            method: ctx.request.url.indexOf('get') ? 'GET' : ctx.method,
            url: refUrl + ctx.request.realUrl.replace(/\/api\/rest/, ''),
            headers: {
                "content-type": ctx.header['content-type'],
            },
            body: ctx.request.body,
            json: true
        });
        if (response) {
            ctx.body = {
                data: [], success: true, msg: '删除成功！'
            }
            return;
        }
        ctx.body = {
            success: false, msg: '删除失败！'
        }
    });
    //字典数据获取
    router.post(`/dictionaryData/getByTypeCode`, async (ctx, next) => {
        ctx.request.url = ctx.request.realUrl
        const data = await dictionaryDataByTypeCode(ctx, next);
        if (data) {
            ctx.body = {
                list: data, success: true, msg: '查询成功！'
            }
            return;
        }
        ctx.body = {
            success: false, msg: '失败！'
        }
    });

    //自定义接口
    router.post('/login', async (ctx) => {
        const result = await validLogin(ctx.request.body);
        ctx.body = result.success ? {
            ...result, token: jsonwebtoken.sign({
                data: {
                    id: result.id, name: ctx.request.body.username
                }, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 10), // 60 seconds * 60 minutes = 1 hour
            }, 'kbds random secret'),
        } : result;
    });
    router.get('/getUserInfo', async (ctx, next) => {
        const data = await getApi(ctx, next);
        //获取当前登录用户的个人信息
        ctx.body = {
            Message: '', status: 200, success: true, data: data.data
        }
    });
    router.post(`/user/resetPass`, async (ctx, next) => {
        const data = await getApi(ctx, next);
        if (data) {
            ctx.body = {
                id: data.data['returning'][0].id, success: true, msg: '重置成功！'
            }
            return;
        }
        ctx.body = {
            success: false, msg: '重置失败！'
        }

    });
    router.get(`/menu/list`, async (ctx, next) => {
        const data = await getApi(ctx, next);
        const parentData = data.list.filter(res => !res.parentId);
        const childData = data.list.filter(res => res.parentId);
        getMenuTree(parentData, childData);
        ctx.body = {
            success: true, msg: '获取成功', list: parentData
        }
    });
    router.post(`/user/createUser`, async (ctx, next) => {
        ctx.request.url = ctx.request.realUrl
        const roles = ctx.request.body['roles']
        delete ctx.request.body['roles']
        const data = await create(ctx, next);
        roles.forEach(res => {
            pool.query(`insert into  kb_user_role (user_id,role_id) VALUES($1,$2);`, [data.rows[0].id, res]);
        })
        if (data) {
            ctx.body = {
                id: data, success: true, msg: '添加成功！'
            }
            return;
        }
        ctx.body = {
            success: false, msg: '新增失败！'
        }
    });
    router.get(`/user/getUserListByPage`, async (ctx, next) => {
        ctx.request.url = ctx.request.realUrl
        const data = await getApi(ctx, next);
        data.list.forEach(res => {
            res['roles'] = [];
            (res['roleList'] || []).forEach(rr => {
                res['roles'].push(rr['roleId'])
            })
            delete data.list['roleList']
        })
        ctx.body = {
            list: data.list, total: data.total['aggregate'].count, success: true, msg: '查询成功！'
        }
    });
    router.post(`/user/deleteUserById`, async (ctx, next) => {
        ctx.request.url = ctx.request.realUrl
        await pool.query(`delete from kb_user_role where user_id = $1`, [ctx.request.body.id]);
        const data = await deleteById(ctx, next);
        //根据userId；删除
        ctx.body = {
            list: data.list, total: data.total, success: true, msg: '查询成功！'
        }
    });
    router.post(`/user/updateUserById`, async (ctx, next) => {
        ctx.request.url = ctx.request.realUrl
        const roles = ctx.request.body['roles']
        delete ctx.request.body['roles']
        const data = await updateById(ctx, next);
        //先查询角色信息是否已经有了；有了就不新增；
        pool.query(`delete from kb_user_role where user_id=$1`, [ctx.request.body.id])
        roles.forEach(res => {
            pool.query(`insert into  kb_user_role (user_id,role_id) VALUES($1,$2);`, [ctx.request.body.id, res]);
        })
        if (data) {
            ctx.body = {
                data: data, success: true, msg: '更新成功！'
            }
            return;
        }
        ctx.body = {
            success: false, msg: '更新失败！'
        }
    });
    router.post(`/exam/insert`, async (ctx) => {
        //先创建试卷；
        const examPaper = {
            request: {
                url: '/examPaper/create', body: {
                    name: ctx.request.body.name,
                    totalScore: ctx.request.body.totalScore,
                    number: ctx.request.body.number
                },
            }
        }
        const paperResult = await create(examPaper);
        //再创建题目；
        for (const res of ctx.request.body['questionList']) {
            const examTitle = {
                request: {
                    url: '/examTitle/create', body: {
                        name: res.name, type: res.type, score: res.score, sequence: res.sequence,
                    },
                }
            }
            const titleResult = await create(examTitle);
            //创建题目后，要创建试卷和试题的联合表
            const examPaperTitle = {
                request: {
                    url: '/examPaperTitle/create', body: {
                        paperId: paperResult.rows[0].id,
                        titleId: titleResult.rows[0].id,
                        score: res.score,
                        sequence: res.sequence
                    },
                }
            }
            const paperTitleResult = await create(examPaperTitle);
            //在创建选项；
            for (const dd of res.options) {
                const index = res.options.indexOf(dd);
                const examOptions = {
                    request: {
                        url: '/examOptions/create', body: {
                            name: dd.name, titleId: titleResult.rows[0].id, isRight: dd.isRight, sequence: index + 1
                        },
                    }
                }
                const optionResult = await create(examOptions);
            }
        }
    });
    router.post(`/exam/getQuestionList`, async (ctx, next) => {
        ctx.request.url = ctx.request.realUrl
        const data = await getApi(ctx, next);
        const list = []
        data.list.forEach(res => {
            res = {...res, ...res['titleData']}
            const resultOption = []
            res.options.forEach(r => {
                if (r.isRight) {
                    resultOption.push(r.id)
                }
            })
            res.resultOption = res.type === 'radio' ? resultOption[0] : resultOption
            delete res['titleData']
            list.push(res)
        })
        if (data) {
            ctx.body = {
                list: list, success: true, msg: '查询成功！'
            }
            return;
        }
        ctx.body = {
            success: false, msg: '失败！'
        }
    });

    //client接口
    router.post('/client/login', async (ctx) => {
        const result = await validLogin(ctx.request.body);
        ctx.body = result.success ? {
            ...result, token: jsonwebtoken.sign({
                data: {
                    id: result.id, name: ctx.request.body.username
                }, exp: Math.floor(Date.now() / 1000) + (60 * 60), // 60 seconds * 60 minutes = 1 hour
            }, 'kbds random secret'),
        } : result;
    });
    router.get(`/chapters/getListByCourseId`, async (ctx, next) => {
        ctx.request.url = ctx.request.realUrl
        const data = (await getApi(ctx, next)).data;
        data.list.forEach(res => {
            res['recordChapter'].forEach(rr => {
                if (rr.completed) {
                    res.completed = true;
                } else {
                    res.studyTime = rr.studyTime
                }
            })
        })
        const parentData = data.list.filter(res => !res.parentId);
        const childData = data.list.filter(res => res.parentId);
        getMenuTree(parentData, childData); //如果存在父子关系，变成树状结构
        ctx.body = {
            list: parentData, total: data.total.count, success: true, msg: '查询成功！'
        }
    });
    router.post(`/watchRecord/record`, async (ctx, next) => {
        const selectIsHasCtx = {
            request: {
                query: {
                    staffId: ctx.request.body['staffId'],
                    courseId: ctx.request.body['courseId'],
                    chapterId: ctx.request.body['chapterId'],
                    sort: 'startDate',
                    limit: 1
                }, url: ctx.request.realUrl
            }
        }
        const data = await getListByPage(selectIsHasCtx);
        if (data.list.length === 0) {
            await create(ctx, next);
        } else if (data.list[0].completed) {
            const res = data.list[0]
            if (res.studyTime + 5 < res['totalTime']) {
                await create(ctx, next);
            }
        } else {
            const res = data.list[0]
            ctx.request.body.id = res.id
            ctx.request.body.endDate = (new Date).toISOString().replace(/Z/, "+00");
            if (res.studyTime + 5 >= res['totalTime']) {
                ctx.request.body.completed = true
                ctx.request.body.studyTime = res['totalTime']
                await updateById(ctx, next);
                const cc = {
                    request: {
                        method: 'GET',
                        url: `/watchRecord/getStaffCompleted?courseId=${ctx.request.body['courseId']}&staffId=${ctx.request.body['staffId']}`,
                        query: {
                            limit: 1000, offset: 0
                        }
                    }, header: ctx.header

                }
                //完成的章节数目;
                const result = await getApi(cc);
                console.log(result, result.data[0]['courseData']['videoNumber'] === result.data.length)
                if (result.data.length > 0 && result.data[0]['courseData']['videoNumber'] === result.data.length) {
                    //修改观看课程的状态；
                    await pool.query(`update kb_watch_record set course_completed=true where course_id = $1`, [ctx.request.body['courseId']]);
                    //给个人加学分！
                    await pool.query(`update kb_user set credits=$1 where id = $2`, [result.data[0]['courseData']['credits'], ctx.request.body['staffId']]);
                }
            } else {
                await updateById(ctx, next);
            }
        }
        if (data) {
            ctx.body = {
                id: data, success: true, msg: '记录成功！'
            }
            return;
        }
        ctx.body = {
            success: false, msg: '记录失败！'
        }
    })
    router.get(`/collectCourse/getDataListByPage`, async (ctx, next) => {
        const data = await getApi(ctx, next);
        ctx.body = {
            list: data.list, total: data.total, success: true, msg: '查询成功！'
        }
    });
    router.get(`/comment/getStaffCommentListByPage`, async (ctx, next) => {
        const data = await getApi(ctx, next);
        ctx.body = {
            list: data.list, total: data.total, success: true, msg: '查询成功！'
        }
    });
    router.get(`/course/getCourseById`, async (ctx, next) => {
        const studyCtx = {
            request: {
                method: 'GET', url: `/watchRecord/getStaffNumberByCourseId?courseId=${ctx.request.query.id}`, json: true
            }, header: {
                "content-type": 'text/plain; charset=utf-8',
            },
        }
        const studyStaffNumber = (await getApi(studyCtx)).studyStaffNumber.total.count;
        const data = await getApi(ctx, next);
        const result = data.data[0];
        result.typeName = result.courseType?.name
        result.studyStaffNumber = studyStaffNumber
        delete result.courseType
        ctx.body = {
            data: result, total: data.total, success: true, msg: '查询成功！'
        }
    });
    router.post(`/cert/download`, async (ctx) => {
        const PizZip = require('pizzip');
        const Docxtemplater = require('docxtemplater');
        const fs = require('fs');
        const path = require('path');
        // 读取文件,以二进制文件形式保存
        const content = fs.readFileSync(path.resolve('/Users/mac/wzr/资源库/hasura-web/attachs/test.docx'), 'binary');
        // 压缩数据
        const zip = new PizZip(content);
        // 生成模板文档
        const doc = new Docxtemplater(zip);
        // 设置填充数据
        doc.setData({
            name: 'John', title: 'Doe', typeName: '0652455478'
        });
        //渲染数据生成文档
        doc.render()
        // 将文档转换文nodejs能使用的buf
        const buf = doc.getZip().generate({type: 'nodebuffer'});
        // 输出文件
        fs.writeFileSync(path.resolve(__dirname, 'output.docx'), buf);
        ctx.body = {
            list: data.list, total: data.total, success: true, msg: '查询成功！'
        }
    });
    //读取图片
    router.get('/attachs/:name', ctx => {
        try {
            const filePath = path.join(__dirname.split('/router')[0], ctx.url);
            const file = fs.readFileSync(filePath);
            let mimeType = mime.lookup(filePath);
            ctx.set('content-type', mimeType);
            ctx.body = file;
        } catch (err) {
            console.log(`error ${err.message}`)
        }
    });
    router.post('/public/upload', koaBody, async ctx => {
        try {
            const {
                path, name
            } = ctx.request.files.file;
            await fs.copyFileSync(path, `attachs/${name}`)
            ctx.body = {
                success: true, msg: '上传成功！', data: {
                    path: '/attachs/' + name, name: name
                }
            }
        } catch (err) {
            console.log(`error ${err.message}`)
            // await ctx.render('error', {
            //     message: err.message
            // })
        }
    });
    return router;
};
