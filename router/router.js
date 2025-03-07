const svgCaptcha = require('svg-captcha')
const {
    getApi,
    getMenuTree,
    updateById,
    create,
    deleteById,
    covertColumnByType,
    deconstructionData,
    getListByPage,
    invertCtxData,
    formatTime,
    deconstructionArr,
    convertRate,
    newCert,
} = require('../server/user');
const pool = require("../utils/pool");
const request = require("request-promise");
const {refUrl} = require("../config");

// const {default: xlsx} = require("node-xlsx");
async function createUpdateCourses(ctx, next = {}) {
    const typeIds = ctx.request.body.typeId
    const columnIds = ctx.request.body.columnId
    delete ctx.request.body.typeId
    delete ctx.request.body.columnId
    let result = {}
    delete ctx.request.body.id
    result = await create(ctx, next);
    let sum = 0;
    //typeId-课程类型存在
    for (const res of typeIds) {
        const newCtx = {
            request: {
                body: {
                    typeId: res, courseId: ctx.request.body.id || result.rows[0].id
                }, url: '/courseClass/create'
            }
        }
        const data = await create(newCtx, next);
        sum += data.rowCount
    }
    let sumColumn = 0;
    //columnId-课程栏目存在
    for (const res of columnIds) {
        const newCtx = {
            request: {
                body: {
                    columnId: res, courseId: ctx.request.body.id || result.rows[0].id
                }, url: '/courseColumn/create'
            }
        }
        const data = await create(newCtx, next);
        sumColumn += data.rowCount
    }
    return {courseData: result.rows[0]}
}

module.exports = (router) => {
    require('./basic-router.js')(router)
    //首页栏目
    router.post(`/roleAuthorityHomeColumn/update`, async (ctx, next) => {
        const newCtx = {
            request: {
                url: '/roleHomeColumn/deleteById', body: {
                    roleId: ctx.request.body.roleId
                }
            }
        }
        await deleteById(newCtx, next);
        const menuIds = ctx.request.body['menuIds'] || []
        let data = {};
        for (const res of menuIds) {
            const createNewCtx = {
                request: {
                    url: '/roleHomeColumn/create', body: {
                        roleId: ctx.request.body.roleId, columnId: res
                    }
                }
            }
            data = await create(createNewCtx, next);
        }
        if (data) {
            ctx.body = {
                success: true, msg: '授权成功！'
            }
        }
    });

    //菜单授权
    router.post(`/roleAuthority/update`, async (ctx, next) => {
        const newCtx = {
            request: {
                url: '/roleAuthority/deleteById', body: {
                    roleId: ctx.request.body.roleId
                }
            }
        }
        await deleteById(newCtx, next);
        const menuIds = ctx.request.body['menuIds'] || []
        let data = {};
        for (const res of menuIds) {
            const createNewCtx = {
                request: {
                    url: '/roleAuthority/create', body: {
                        roleId: ctx.request.body.roleId, menuId: res
                    }
                }
            }
            data = await create(createNewCtx, next);
        }
        if (data) {
            ctx.body = {
                success: true, msg: '授权成功！'
            }
        }
    });

    //栏目授权
    router.post(`/roleColumn/update`, async (ctx, next) => {
        const newCtx = {
            request: {
                url: '/roleColumn/deleteById', body: {
                    roleId: ctx.request.body.roleId
                }
            }
        }
        await deleteById(newCtx, next);
        const menuIds = ctx.request.body['menuIds'] || []
        for (const res of menuIds) {
            const createNewCtx = {
                request: {
                    url: '/roleColumn/create', body: {
                        roleId: ctx.request.body.roleId, menuId: res
                    }
                }
            }
            data = await create(createNewCtx, next);
        }
        if (data) {
            ctx.body = {
                data, success: true, msg: '授权成功！'
            }
        }
    });

    router.post(`/moreTable`, async (ctx, next) => {
        ctx.body = {
            success: true, msg: '授权成功！'
        }
    });

    router.post(`/roleAuthority/getMenusByRoleId`, async (ctx, next) => {
        try {
            const data = await getApi(ctx, next);
            const list = [];
            data.list.forEach(res => {
                list.push(res['menuData'])
            })
            const parentData = list.filter(res => !res.parentId);
            const childData = list.filter(res => res.parentId);
            getMenuTree(parentData, childData);
            ctx.body = {
                success: true, msg: '获取成功', list: parentData
            }
        } catch (e) {
            ctx.body = {
                success: false, msg: '没有请求成功，接口被拦截'
            }
        }
    });

    router.post(`/roleColumn/getColumnByRoleId`, async (ctx, next) => {
        const data = await getApi(ctx, next);
        const list = [];
        data.list.forEach(res => {
            list.push(res['menuData'])
        })
        const parentData = list.filter(res => !res.parentId);
        const childData = list.filter(res => res.parentId);
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
        if (roles) {
            roles.forEach(res => {
                pool.query(`insert into  kb_user_role (user_id,role_id) VALUES($1,$2);`, [data.rows[0].id, res]);
            })
        }
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

    router.post(`/user/getUserListByPage`, async (ctx, next) => {
        ctx.request.url = ctx.request.realUrl
        const data = await getApi(ctx, next);
        const list = [];
        data.list.forEach((res, index) => {
            res['roles'] = [];
            const roleList = [];
            (res['roleList'] || []).forEach(rr => {
                const obj = deconstructionData(rr);
                res['roles'].push(obj.roleId)
                roleList.push(obj)
            })
            res.roleList = roleList;
            list.push(deconstructionData(res))
        })
        ctx.body = {
            list, total: data.total['aggregate'].count, success: true, msg: '查询成功！'
        }
    });

    router.post(`/user/deleteUserById`, async (ctx, next) => {
        ctx.request.url = ctx.request.realUrl
        await pool.query(`delete from kb_user_role where user_id = $1`, [ctx.request.body.id]);
        const data = await deleteById(ctx, next);
        //根据userId；删除
        ctx.body = {
            list: data.list, total: data.total, success: true, msg: '删除成功！'
        }
    });

    router.post(`/user/updateUserById`, async (ctx, next) => {
        ctx.request.url = ctx.request.realUrl
        const roles = ctx.request.body['roles'] || []
        delete ctx.request.body['roles']
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

    router.post('/userRole/createUpdate', async (ctx) => {
        const deleteCtx = {
            request: {
                body: {
                    userId: ctx.request.body.id
                }, url: '/userRole/deleteById'
            }
        }
        const deleteData = await deleteById(deleteCtx)
        const roles = ctx.request.body.roles
        for (const res of roles) {
            const index = roles.indexOf(res);
            const createCtx = {
                request: {
                    body: {
                        roleId: res, userId: ctx.request.body.id, isCurrentRole: index === 0 ? true : false
                    }, url: '/userRole/create'
                }
            }
            await create(createCtx)
        }
        if (deleteData) {
            ctx.body = {
                data: deleteData, success: true, msg: '更新成功！'
            }
            return;
        }
        ctx.body = {
            success: false, msg: '更新失败！'
        }
    })

    router.post('/userRole/updateCurrentRole', async (ctx) => {
        const getUserRoleCtx = {
            request: {
                method: 'GET', query: {
                    limit: 1000, offset: 0, userId: ctx.request.body.staffId
                }, url: '/userRole/getListByPage'
            }
        }
        const getData = await getListByPage(getUserRoleCtx)
        for (const res of getData.list) {
            const objCtx = {
                request: {
                    body: {
                        id: res.id, isCurrentRole: false
                    }, url: '/userRole/updateById'
                }
            }
            objCtx.request.body.isCurrentRole = res.roleId === ctx.request.body.currentRoleId ? true : false
            await updateById(objCtx)
        }
        ctx.body = {
            data: 1, success: true, msg: '更新成功！'
        }
    })

    router.post(`/exam/insert`, async (ctx) => {
        //先创建试卷；
        const bodyData = ctx.request.body;
        const paperResult = await create(invertCtxData({
            name: bodyData.name, staffId: bodyData.staffId, totalScore: bodyData.totalScore, number: bodyData.number
        }, '/examPaper/create'));
        //再创建题目；
        for (const res of ctx.request.body['questionList']) {
            const titleResult = await create(invertCtxData({
                name: res.name, type: res.type, score: res.score, sequence: res.sequence
            }, '/examTitle/create'));
            //创建题目后，要创建试卷和试题的联合表
            const paperTitleResult = await create(invertCtxData({
                paperId: paperResult.rows[0].id,
                titleId: titleResult.rows[0].id,
                score: res.score,
                sequence: res.sequence
            }, '/examPaperTitle/create'));
            //在创建选项 starScore没得选项
            for (const dd of res.options) {
                const index = res.options.indexOf(dd);
                const optionResult = await create(invertCtxData({
                    name: dd.name,
                    score: dd.score,
                    titleId: titleResult.rows[0].id,
                    isRight: dd.isRight,
                    sequence: index + 1
                }, '/examOptions/create'));
            }
        }
        ctx.body = {
            success: true, msg: '成功！'
        }
    });

    router.post(`/exam/update`, async (ctx) => {
        //修改试卷的相关信息examPaper
        const bodyData = ctx.request.body;
        await updateById(invertCtxData({
            id: bodyData.id, name: bodyData.name, totalScore: bodyData.totalScore, number: bodyData.number
        }, '/examPaper/updateById'));
        //删除一切的问题关联；重新创建所有的question
        await deleteById(invertCtxData({
            paperId: bodyData.id,
        }, '/examPaperTitle/deleteById'));
        for (const res of ctx.request.body['questionList']) {
            await deleteById(invertCtxData({
                titleId: res.id
            }, '/examOptions/deleteById'));
            await deleteById(invertCtxData({
                id: res.id
            }, '/examTitle/deleteById'));
        }
        //再创建题目；
        for (const res of ctx.request.body['questionList']) {
            const titleResult = await create(invertCtxData({
                name: res.name, type: res.type, score: res.score, sequence: res.sequence
            }, '/examTitle/create'));
            //创建题目后，要创建试卷和试题的联合表
            const paperTitleResult = await create(invertCtxData({
                paperId: bodyData.id, titleId: titleResult.rows[0].id, score: res.score, sequence: res.sequence
            }, '/examPaperTitle/create'));
            //在创建选项 starScore没得选项
            for (const dd of res.options) {
                const index = res.options.indexOf(dd);
                const optionResult = await create(invertCtxData({
                    name: dd.name,
                    score: dd.score,
                    titleId: titleResult.rows[0].id,
                    isRight: dd.isRight,
                    sequence: index + 1
                }, '/examOptions/create'));
            }
        }
        ctx.body = {
            success: true, msg: '成功！'
        }
    });

    router.post(`/exam/delete`, async (ctx) => {
        //修改试卷的相关信息examPaper
        const bodyData = ctx.request.body;
        //删除一切的问题关联；重新创建所有的question
        // await deleteById(invertCtxData({
        //     paperId: bodyData.id,
        // }, '/examPaperTitle/deleteById'));
        // for (const res of ctx.request.body['questionList']) {
        //     await deleteById(invertCtxData({
        //         titleId: res.id
        //     }, '/examOptions/deleteById'));
        //     await deleteById(invertCtxData({
        //         id: res.id
        //     }, '/examTitle/deleteById'));
        // }
        await deleteById(invertCtxData({
            id: bodyData.id
        }, '/examPaper/deleteById'));
        ctx.body = {
            success: true, msg: '成功！'
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

    router.get(`/lecturer/getLecturerListByPage`, async (ctx, next) => {
        ctx.request.url = ctx.request.realUrl
        const data = await getApi(ctx, next);
        const list = [];
        data.list.forEach(res => {
            let obj = {...res['userData'], ...res}
            //如果存在才替换，否则不替换；
            delete obj['userData']
            obj = {...obj, ...obj['sectionData'], ...obj['majorName']}
            delete obj['sectionData']
            delete obj['majorData']
            list.push(obj)
        })
        if (data) {
            ctx.body = {
                list: list, total: data['totalData']['aggregate'].count, success: true, msg: '查询成功！'
            }
            return;
        }
        ctx.body = {
            success: false, msg: '失败！'
        }
    });

    router.post('/getPaperId/byDataCode', async (ctx) => {
        const result = await getApi(ctx)
        ctx.body = {
            data: result.list.length > 0 ? deconstructionData(result.list[0]) : {},
            total: result.total,
            success: true,
            msg: '查询成功！'
        }
    })

    router.get(`/convertVideo`, async (ctx, next) => {
        const url = encodeURIComponent(Buffer.from(ctx.query.url).toString('base64'));
        ctx.body = await request({
            method: ctx.method,
            url: `http://127.0.0.1:7001/viewVideo?url=${url}&time=${ctx.query.time || 4}`,
            json: true
        });
        // ctx.body = {
        //     url: '/attachs/1652493115904511-20220720172122-20221206154502.mp4', json: true, success: true
        // }
    });

    router.post(`/courseVerify/update`, async (ctx, next) => {
        const verifyBeforeData = await getListByPage(invertCtxData({chapterId: ctx.request.body.chapterId}, '/courseVerify/getListByPage', 'get'))
        await deleteById(invertCtxData({chapterId: ctx.request.body.chapterId}, '/courseVerify/deleteById'));
        for (const rr of (verifyBeforeData.list || [])) {
            await deleteById(invertCtxData({id: rr.questionId}, '/questions/deleteById'));
        }
        for (const res of ctx.request.body['verifyList']) {
            //先存题目获取对应的questionId,然后存储弹窗
            if (res.typeCode === 'byChapter' && res.examData) {
                if (res.examData.id) {
                    await deleteById(invertCtxData({id: res.id}, '/questions/deleteById'));
                }
                const questionData = await create(invertCtxData({
                    title: res.examData.title || '',
                    options: JSON.stringify(res.examData.options || ''),
                    typeCode: res.examData.typeCode || '',
                    rightAnswer: res.examData.rightAnswer || ''
                }, '/questions/create'));
                res.questionId = questionData.rows[0].id;
            }
            const verifyCreateData = await create(invertCtxData({
                time: res.time,
                typeId: res.typeId,
                chapterId: ctx.request.body.chapterId,
                questionId: res.questionId || null
            }, '/courseVerify/create'))
        }
        ctx.body = {
            success: true, msg: '设置成功！'
        }
    });

    router.post('/verify/getListByChapterId', async (ctx, next) => {
        const data = await getApi(invertCtxData({chapterId: ctx.request.body.chapterId}, '/verify/getListByChapterId', 'post', 'getApi'))
        data.list.forEach(rr => {
            if (rr.examData) {
                rr.examData.options = JSON.parse(rr.examData.options)
            }
            rr.typeCode = rr.typeData?.typeCode
            delete rr.typeData
        })
        ctx.body = {
            list: data.list, success: true, msg: '查询成功！'
        }
    })

    router.post(`/courseFiles/update`, async (ctx, next) => {
        const deleteCtx = {
            request: {
                body: {
                    courseId: ctx.request.body.courseId
                }, url: '/courseFiles/deleteById'
            }
        }
        await deleteById(deleteCtx, next);
        let sum = 0;
        for (const res of ctx.request.body['verifyList']) {
            const newCtx = {
                request: {
                    body: {
                        time: res.time, typeId: res.typeId, courseId: ctx.request.body.courseId
                    }, url: '/courseFiles/create'
                }
            }
            const data = await create(newCtx, next);
            sum += data.rowCount
        }
        if (sum === ctx.request.body['verifyList'].length) {
            ctx.body = {
                data: sum, success: true, msg: '设置成功！'
            }
            return;
        }
        ctx.body = {
            success: false, msg: '失败！'
        }
    });


    //课程创建和更新都是一个接口
    router.post(`/courses/createUpdate`, async (ctx, next) => {
        ctx.request.url = ctx.request.realUrl
        const typeIds = ctx.request.body.typeId
        const columnIds = ctx.request.body.columnId
        delete ctx.request.body.typeId
        delete ctx.request.body.columnId
        let result = {}
        if (!ctx.request.body.id) {
            delete ctx.request.body.id
            result = await create(ctx, next);
        } else {
            result = await updateById(ctx, next);
            //删除课程分类
            const deleteCtx = {
                request: {
                    body: {
                        courseId: ctx.request.body.id || result.id
                    }, url: '/courseClass/deleteById'
                }
            }
            await deleteById(deleteCtx, next);
            //删除课程栏目
            const deleteColumnIdCtx = {
                request: {
                    body: {
                        courseId: ctx.request.body.id || result.id
                    }, url: '/courseColumn/deleteById'
                }
            }
            await deleteById(deleteColumnIdCtx, next);
        }
        let sum = 0;
        //typeId-课程类型存在
        for (const res of typeIds) {
            const newCtx = {
                request: {
                    body: {
                        typeId: res, courseId: ctx.request.body.id || result.rows[0].id
                    }, url: '/courseClass/create'
                }
            }
            const data = await create(newCtx, next);
            sum += data.rowCount
        }
        let sumColumn = 0;
        //columnId-课程栏目存在
        for (const res of columnIds) {
            const newCtx = {
                request: {
                    body: {
                        columnId: res, courseId: ctx.request.body.id || result.rows[0].id
                    }, url: '/courseColumn/create'
                }
            }
            const data = await create(newCtx, next);
            sumColumn += data.rowCount
        }
        if (sum === typeIds.length) {
            ctx.body = {
                data: sum, success: true, msg: '提交成功！'
            }
            return;
        }
        ctx.body = {
            success: false, msg: '提交失败！'
        }
    });

    //批量导入课程！注意记录当前导入人员的staffId和角色Id
    router.post(`/courses/multiImport`, async (ctx) => {
        const list = JSON.parse(JSON.stringify(ctx.request.body.list));
        const staff = ctx.request.body.staff;
        //先导入课程
        let courseCreateResult;
        let chapterCreateResult;
        let index;
        for (const res of list) {
            index = list.indexOf(res);
            const chapters = res.children;
            delete res.children;
            const createCourseCtx = {
                request: {
                    body: {...res, ...staff}, url: '/courses/createUpdate'
                }
            }
            courseCreateResult = await createUpdateCourses(createCourseCtx);
            //创建对应章节
            for (const res1 of chapters) {
                const dd = chapters.indexOf(res1);
                const chapterCreateCtx = {
                    request: {
                        body: {
                            courseId: courseCreateResult.courseData.id,
                            name: res1.name,
                            parentId: null,
                            path: res1.path,
                            sequence: dd + 1,
                            video: null
                        }, url: "/chapters/create"
                    }
                }
                chapterCreateResult = await create(chapterCreateCtx);
            }
        }
        //再导入章节
        if (courseCreateResult && chapterCreateResult) {
            ctx.body = {
                data: {courseCreateResult, chapterCreateResult}, total: index, success: true, msg: '提交成功！'
            }
            return;
        }
        ctx.body = {
            success: false, msg: '提交失败！'
        }
    });

    router.post(`/courses/getDataListByPage`, async (ctx) => {
        ctx.request.url = ctx.request.realUrl
        const data = await getApi(ctx)
        const list = []
        data.list.forEach(res => {
            const obj = {
                ...res, typeId: [], columnId: []
            }
            delete obj['courseClass']
            res['courseClass'].forEach(rr => {
                obj.typeId.push(rr.typeId)
            })
            res['courseColumnData'].forEach(rr => {
                obj.columnId.push(rr.columnId)
            })
            list.push(deconstructionData(obj))
        })
        if (list) {
            ctx.body = {
                list: list, total: data.total.aggregate.count, success: true, msg: '提交成功！'
            }
            return;
        }
        ctx.body = {
            success: false, msg: '提交失败！'
        }
    });

    router.post(`/course/getListPageByWhere`, async (ctx) => {
        ctx.request.url = ctx.request.realUrl
        const data = await getApi(ctx)
        const list = [];
        data.list.forEach(res => {
            list.push(deconstructionData(res))
        })
        if (list) {
            ctx.body = {
                list: list, total: deconstructionData(data['totalData']).total, success: true, msg: '提交成功！'
            }
            return;
        }
        ctx.body = {
            success: false, msg: '提交失败！'
        }
    });

    router.post(`/note/getDataListByPage`, async (ctx) => {
        ctx.request.url = ctx.request.realUrl
        const data = await getApi(ctx);
        const list = [];
        data.list.forEach(res => {
            const obj = deconstructionData(res);
            list.push(obj);
        })
        if (true) {
            ctx.body = {
                list: list, total: deconstructionData(data['totalData']), success: true, msg: '提交成功！'
            }
            return;
        }
        ctx.body = {
            success: false, msg: '提交失败！'
        }
    });

    router.post(`/staff/getStudyListByPage`, async (ctx) => {
        ctx.request.url = ctx.request.realUrl
        const data = await getApi(ctx);
        const list = [];
        data.list.forEach(res => {
            const obj = deconstructionData(res);
            obj.studyTime = obj.studyTime;
            obj.studyTotalTime = (obj.studyTotalTime / 60 / 60).toFixed(1) || 0
            obj.notCompleteNum = 0
            obj.credits = obj.credits || 0
            obj.watchNum = obj.watchRecords.nodes.length
            obj.mustBeCourseList = [];
            obj.compulsoryCourses.forEach(rr => {
                rr.isCompleted = rr.courseData.completed.length ? true : false;
                obj.mustBeCourseList.push(deconstructionData(rr))
            })
            obj.watchRecordList = []
            obj.todayStudyTime = (obj.todayStudyTime / 60 / 60).toFixed(1) || 0.01
            obj.watchRecords.nodes.forEach(rr => {
                obj.watchRecordList.push(deconstructionData(rr));
            })
            list.push(obj);
        })
        if (list) {
            ctx.body = {
                list: list, total: deconstructionData(data['totalData']).total, success: true, msg: '查询成功！'
            }
            return;
        }
        ctx.body = {
            success: false, msg: '查询失败！'
        }
    });

    router.get(`/staffCredits/getCreditsRecordByStaffId`, async (ctx) => {
        ctx.request.url = ctx.request.realUrl
        const data = await getApi(ctx);
        const list = [];
        data.list.forEach(res => {
            const obj = deconstructionData(res);
            list.push(obj);
        })
        if (list) {
            ctx.body = {
                list: list, total: deconstructionData(data['totalData']).total, success: true, msg: '查询成功！'
            }
            return;
        }
        ctx.body = {
            success: false, msg: '查询失败！'
        }
    });

    router.post(`/courseStatistic/getCourseStatistic`, async (ctx) => {
        ctx.request.url = ctx.request.realUrl
        const sqlt = `SELECT COUNT(*)
FROM kb_courses;`
        const sql = `
            SELECT
            c.*,
            s.name AS section_name,
            m.name AS major_name,
            st.name AS staff_name,
            us.name AS lecturer_name,
            (select count(distinct w.staff_id) from kb_staff_compulsory_courses w where w.course_id=c.id) as total,
            (select count(distinct wr.staff_id) from kb_watch_record wr where wr.course_id=c.id and wr.course_completed=true) as completed,
            (select sc.score from kb_course_score sc where sc.course_id=c.id) as score,
            (select count(*) from kb_collect_course cc where cc.course_id=c.id) as collect
            FROM
            kb_courses AS c
            LEFT JOIN kb_section AS s ON c.section_id = s.id
            LEFT JOIN kb_major AS m ON c.major_id = m.id
            LEFT JOIN kb_user AS st ON c.staff_id = st.id
            LEFT JOIN kb_user AS us ON c.lecturer_id = us.id
            where c.name like concat('%', ${ctx.request.body.name?'\''+ctx.request.body.name+'\'' : '\'\''}, '%')
            limit ${ ctx.request.body.limit } offset ${ ctx.request.body.offset || 0 }
        `;

        const resultData = await pool.query(sql)
        const totalData = await pool.query(sqlt)
        const list = covertColumnByType(resultData.rows, 2)
        // const data = await getApi(ctx);
        // const list = [];
        // (data.list || []).forEach(res => {
        //     const obj = deconstructionData(res);
        //     obj.score = obj.score ? Number((obj.score * 2).toFixed(1)) : 0   //转化成十分制
        //     obj.studyTime = (obj.studyTime / 60 / 60).toFixed(2)
        //     const compulsoryStaffs = []
        //     const watchStaffs = [];
        //     let notCompleteStaffNum = 0;
        //     obj.compulsoryStaffs = deconstructionArr(obj.compulsoryStaffs);
        //     obj.watchRecords = deconstructionArr(obj.watchRecords);
        //     obj.compulsoryStaffs.forEach(ii => {
        //         compulsoryStaffs.push(ii);
        //     })
        //     obj.completeStaffList = obj.completeStaffList.map(res => deconstructionData(res));
        //     obj.notCompleteStaffList = obj.notCompleteStaffList.map(res => deconstructionData(res));
        //     obj.compulsoryStaffs = compulsoryStaffs;
        //     obj.watchRecords.forEach(ii => {
        //         watchStaffs.push({...ii, courseCompleted: ii[0].courseCompleted});
        //     })
        //     delete obj.watchRecords
        //     obj['watchStaffs'] = watchStaffs;
        //     obj['actualStudyNum'] = watchStaffs.length;
        //     obj['expectStudyNum'] = obj.compulsoryStaffs.length;
        //     obj['notCompleteStaffNum'] = notCompleteStaffNum;
        //     obj['studyEngageRate'] = convertRate(watchStaffs.length / (obj.compulsoryStaffs.length || 1));  //学习参与率
        //     obj['completeEngageRate'] = convertRate((obj.compulsoryStaffs.length - notCompleteStaffNum) / obj.compulsoryStaffs.length);  //学习完成人率
        //     obj['notCompleteEngageRate'] = convertRate(notCompleteStaffNum / obj.compulsoryStaffs.length); //
        //     list.push(obj);
        // })
        if (list) {
            ctx.body = {
                list: list, total: parseInt(totalData.rows[0].count), success: true, msg: '查询成功！'
            }
            return;
        }
        ctx.body = {
            success: false, msg: '查询失败！'
        }
    });

    router.post('/courseStatistic/viewCompleted',async (ctx) => {
        const sql = `
            SELECT
            st.*,
            s.name AS section_name,
            c.total_time AS study_time,
            co.score AS score
            FROM
            kb_watch_record AS c
            LEFT JOIN kb_user AS st ON c.staff_id = st.id
            LEFT JOIN kb_section AS s ON st.section_id = s.id
            LEFT JOIN kb_course_score AS co ON c.course_id = co.course_id
            where c.course_id = '${ctx.request.body.courseId}'
        `;

        const resultData = await pool.query(sql)
        const list = covertColumnByType(resultData.rows, 2)
        if (list) {
            ctx.body = {
                list: list, total: list.length, success: true, msg: '查询成功！'
            }
            return;
        }
        ctx.body = {
            success: false, msg: '查询失败！'
        }
    })

    router.post('/courseStatistic/viewNeed',async (ctx) => {
        const sql = `
            SELECT
            st.*,
            s.name AS section_name,
            co.score AS score
            FROM
            kb_staff_compulsory_courses AS c
            LEFT JOIN kb_user AS st ON c.staff_id = st.id
            LEFT JOIN kb_section AS s ON st.section_id = s.id
            LEFT JOIN kb_course_score AS co ON c.course_id = co.course_id
            where c.course_id = '${ctx.request.body.courseId}'
        `;

        const resultData = await pool.query(sql)
        const list = covertColumnByType(resultData.rows, 2)
        if (list) {
            ctx.body = {
                list: list, total: list.length, success: true, msg: '查询成功！'
            }
            return;
        }
        ctx.body = {
            success: false, msg: '查询失败！'
        }
    })

    router.post(`/todayStudy/getDateRangeData`, async (ctx) => {
        const data = await getApi(ctx);
        const result = deconstructionData(data.data)
        result.studyTime = (result.studyTime / 60 / 60).toFixed(1) || 0.01
        const obj = {
            timeList: [], staffList: [], courseList: [], studyTimeList: []
        }
        if (result.nodes.length > 0) {
            let time = (result.nodes[0]['study_time'] || 0);
            let lastData = result.nodes[0]
            obj.timeList.push(lastData.date)
            let everyDateStaff = new Set([lastData.staff_id])
            let everyDateCourse = new Set([lastData.course_id])
            result.nodes.forEach(res => {
                if (res.date === lastData.date) {
                    time += (res['study_time'] || 0)
                    everyDateStaff.add(res.staff_id)
                    everyDateCourse.add(res.course_id)
                } else {
                    obj.timeList.push(res.date)
                    obj.staffList.push(everyDateStaff.size)
                    obj.courseList.push(everyDateCourse.size)
                    obj.studyTimeList.push((time / 60 / 60).toFixed(1) || 0.01)
                    lastData = res
                    time = 0;
                    everyDateStaff = new Set([lastData.staff_id]);
                    everyDateCourse = new Set([lastData.course_id]);
                }
            })
        }
        if (data) {
            ctx.body = {
                data: {...result, ...obj}, success: true, msg: '查询成功！'
            }
            return;
        }
        ctx.body = {
            success: false, msg: '查询失败！'
        }
    });

    router.get(`/homeColumns/getDataList`, async (ctx) => {
        ctx.request.url = ctx.request.realUrl
        const data = await getApi(ctx);
        const parentData = data.list.filter(res => !res.parentId);
        const childData = data.list.filter(res => res.parentId);
        getMenuTree(parentData, childData); //如果存在父子关系，变成树状结构
        const list = [];
        if (list) {
            ctx.body = {
                list: parentData, success: true, msg: '查询成功！'
            }
            return;
        }
        ctx.body = {
            success: false, msg: '查询失败！'
        }
    });

    router.post(`/homeColumns/getCourseByColumnCode`, async (ctx) => {
        ctx.request.url = ctx.request.realUrl
        ctx.request.body.code = ctx.request.body.code + '%'
        const data = await getApi(ctx);
        const list = [];
        data.list.forEach(res => {
            const obj = deconstructionData(res)
            list.push(obj)
        })
        if (data) {
            ctx.body = {
                list: list, success: true, total: data.totalData.aggregateData.count, msg: '查询成功！'
            }
            return;
        }
        ctx.body = {
            success: false, msg: '查询失败！'
        }
    });

    router.get(`/public/getCode`, async (ctx) => {
        const c = svgCaptcha.create({
            size: 4, // 验证码长度
            ignoreChars: '0o1i', // 验证码字符中排除 0o1i
            color: true, // 验证码是否有彩色
            noise: 1, // 干扰线
            background: '#666', // 背景颜色
            charPreset: '1234567890'
        })
        // ctx.cookies.set('code', c.text)
        // ctx.request.url = '/dictionaryData/updateById'
        // ctx.request.body = {
        //     code: c.text,
        //     id: 'c0fe3740-ed2d-4f9d-8629-2dbd7c3cc2ad',
        //     name: '验证码',
        //     remark: '验证码存储',
        //     status: 0,
        //     typeId: '3e8c3fda-a532-4c22-bda6-4dd248561b92'
        // }
        // const data = await updateById(ctx);
        // if (data) {
        //     ctx.body = {
        //         data: c.data, text: c.text, success: true, msg: '查询成功！'
        //     }
        // }
        ctx.body = {
            data: c.data, text: c.text, success: true, msg: '查询成功！'
        }
    });

    router.post(`/chapters/getListByCourseId`, async (ctx, next) => {
        ctx.request.url = ctx.request.realUrl
        const data = (await getApi(ctx, next)).data;
        if (ctx.request.body['where']) {  // 登录才会查询播放记录
            data.list.forEach(res => {
                res.completed = false;
                if (res['recordChapter'].length === 0) {
                    res.completedRate = 0;
                } else if (res['recordChapter'].length > 0 && res['recordChapter'][0].isRealCompleted) {
                    res.completed = true;
                    res.completedRate = 100;
                } else {
                    res.completedRate = (res.recordChapter[0].studyTime / res.recordChapter[0].totalTime * 100).toFixed(1)
                }
            })
        }
        const parentData = data.list.filter(res => !res.parentId);
        const childData = data.list.filter(res => res.parentId);
        getMenuTree(parentData, childData); //如果存在父子关系，变成树状结构
        ctx.body = {
            list: parentData, total: data.total.count, success: true, msg: '查询成功！'
        }
    });

    router.post('/courses/getDetailListByPage', async (ctx) => {
        //sort 'date','hot','default',
        const sql = ``
    })

    router.post(`/courses/getDataListByStaffNum`, async (ctx, next) => {
        const sql = `select c.name, c.img, c.id, w.staffNum
         from kb_courses c
         left join (select kwr.course_id, count(distinct kwr.staff_id) as staffNum
                    from kb_watch_record kwr
                    group by kwr.course_id) w
                   on c.id = w.course_id
         where recommend_status = 1 order by w.staffNum desc nulls last limit $1;` // lc.set
//         const sql = `select c.name, c.img, c.id
//          from kb_courses c
// //          left join (select kwr.course_id, count(distinct kwr.staff_id) as staffNum
// //                     from kb_watch_record kwr
// //                     group by kwr.course_id) w
// //                    on c.id = w.course_id
//          where status = 1 order by c.created desc;`
        const result = await pool.query(sql, [ctx.request.body.limit || 3])
        ctx.body = {
            list: result.rows, total: result.rows.length, success: true, msg: '查询成功！'
        }
    });

    router.get('/homeColumns/getCourseByColumnCode', async (ctx, next) => {
        const data = await getApi(ctx);
        const list = [];
        data.list.forEach(res => {
            res.columnName = res.courseColumn.length > 0 ? res.courseColumn[0].columnCodeData?.name : ''
            res.typeName = res.typeList.length > 0 ? res.typeList[0].typeData?.typeName : ''
            list.push(deconstructionData(res))
        })
        ctx.body = {
            list, total: data.totalData.aggregateData.count, success: true, msg: '查询成功！'
        }
    })

    router.post(`/watchRecord/record`, async (ctx, next) => {
        const selectIsHasCtx = {
            request: {
                query: {
                    staffId: ctx.request.body['staffId'],
                    courseId: ctx.request.body['courseId'],
                    chapterId: ctx.request.body['chapterId'],
                    sort: 'sequence desc',
                    limit: 1
                }, url: ctx.request.realUrl
            }
        }
        const nameData = {
            staffName: ctx.request.body['staffName'] || '',
            courseName: ctx.request.body['courseName'] || '',
            majorName: ctx.request.body['majorName'] || '',
        }
        delete ctx.request.body?.staffName
        delete ctx.request.body?.courseName
        delete ctx.request.body?.majorName
        const data = await getListByPage(selectIsHasCtx);
        if (data.list.length === 0) {  //没有观看记录
            await create(ctx, next);
        } else if (data.list[0].completed) {  //有观看记录，但是已经看完了，需要新增一次看课记录????
            const res = data.list[0]
            if (res.studyTime + 5 >= res['totalTime']*0.9 && ctx.request.body.studyTime === 1) {
                ctx.request.body.courseCompleted = res.courseCompleted
                ctx.request.body.isRealCompleted = true    //改变所有的有关章节数据！
                ctx.request.body.maxTime = res.totalTime    //改变所有的有关章节数据！
                await create(ctx, next);
            }
        } else {
            const res = data.list[0]
            ctx.request.body.id = res.id
            ctx.request.body.endDate = (new Date).toISOString().replace(/Z/, "+00");
            if (!res.isRealCompleted && res.studyTime > ctx.request.body.studyTime) {
                ctx.request.body.studyTime = res.studyTime
            }
            ctx.request.body.maxTime = res.maxTime < ctx.request.body.studyTime ? ctx.request.body.studyTime : res.maxTime;
            //获取当前播放的studyTime;传入的studyTime>才记录；否则不记录；因为只执行一次，所以应该有try,catch防止错误，数据改变！必须一步一步都正确，分级！！！
            if (ctx.request.body.studyTime + 5 >= ctx.request.body['totalTime']*0.9) {  //章节结束
                ctx.request.body.completed = true
                ctx.request.body.isRealCompleted = true    //改变所有的有关章节数据！
                ctx.request.body.studyTime = res['totalTime']
                ctx.request.body.maxTime = res['totalTime'];
                await updateById(ctx, next);
                //获取当前人员当前课程完成情况；可能会出错，一旦出错数据就不对！！
                const cc = {
                    request: {
                        method: 'GET',
                        url: `/watchRecord/getCompletedByStaffIdCourseId?courseId=${ctx.request.body['courseId']}&staffId=${ctx.request.body['staffId']}`,
                        query: {
                            limit: 1000, offset: 0
                        }
                    }, header: ctx.header

                }
                const result = await getApi(cc);
                //每一个章节完成的时候都要验证一遍
                if (result['completedChapterList'].length === result['chapterList'].length) {
                    //修改观看课程的状态；生成一个证书！人员名+课程名+帐号；把文件链接存储到得分表
                    await pool.query(`update kb_watch_record set course_completed=true where course_id = $1`, [ctx.request.body['courseId']]);
                    //如果已经存在courseId和staffId就已经存在；就不在生成证书和记录学分；
                    const credits = await getApi(invertCtxData({
                        where: {
                            staff_id: {_eq: ctx.request.body.staffId}, course_id: {_eq: ctx.request.body.courseId}
                        }
                    }, '/staffCredits/getDataByStaffId', 'post', 'getApi'))
                    if (credits.list.length === 0) {
                        const date = formatTime('', 'YY-MM-DD-hh:mm:ss')
                        await newCert({
                            name: nameData.staffName || '',
                            title: nameData.courseName || '',
                            typeName: nameData.majorName || '',
                            date: formatTime('')
                        }, nameData.staffName + nameData.courseName + date + '.doc')
                        const staffCredits = await create(invertCtxData({
                            staffId: ctx.request.body.staffId,
                            courseId: ctx.request.body.courseId,
                            credits: result['courseData'][0].credits || 0,
                            path: '/attachs/' + nameData.staffName + nameData.courseName + date + '.doc'
                        }, '/staffCredits/create'));
                    }
                }
            } else {
                await updateById(ctx, next);
            }
        }
        //记录今日学习时间；
        //如果不存在今天，且staffId和当前chapterId一样的记录；创建一条数据，并存入今天的年月日！
        // 如果已经存在staffId和当前chapterId;而且时间是今天
        const selectData = await getListByPage(invertCtxData({
            staffId: ctx.request.body['staffId'], chapterId: ctx.request.body['chapterId'], date: formatTime('')
        }, '/todayStudy/getListByPage', 'get'));
        if (selectData && selectData.list.length > 0) {
            await updateById(invertCtxData({
                id: selectData.list[0].id, studyTime: selectData.list[0].studyTime + 1
            }, '/todayStudy/create'));
        } else {
            await create(invertCtxData({
                staffId: ctx.request.body['staffId'],
                chapterId: ctx.request.body['chapterId'],
                courseId: ctx.request.body['courseId'],
                date: formatTime(''),
                studyTime: 1
            }, '/todayStudy/create'));
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
        const list = [];
        data.list.forEach((res => {
            const columnData = (res.courseData.courseColumn && res.courseData.courseColumn.length > 0) ? res.courseData.courseColumn[0].homeColumnData : {}
            const typeNameData = (res.courseData.courseClass && res.courseData.courseClass.length > 0) ? res.courseData.courseClass[0].courseTypeData : {}
            const obj = {...deconstructionData(res), ...columnData, ...typeNameData}
            list.push(obj)
        }))
        ctx.body = {
            list, total: data.total['aggregate'].count, success: true, msg: '查询成功！'
        }
    });

    router.post(`/comment/getCommentListByPage`, async (ctx, next) => {
        const data = await getApi(ctx, next);
        const listData = [];
        (data.data.list || []).forEach((res) => {
            let obj = res;
            obj = {...obj, ...res['courseData'], ...res['userData']}
            delete obj['courseData'];
            delete obj['userData'];
            listData.push(obj)
        })
        ctx.body = {
            list: listData, total: data.data.total.count, success: true, msg: '查询成功！'
        }
    });

    //全部课程查询和筛选
    router.post('/courses/getAllListByPage', async (ctx) => {
        let orderSql = ''
        if (ctx.request.body.sort === 'hot') {
            orderSql = `order by w.staff_num desc nulls last`

        } else if (ctx.request.body.sort === 'date') {
            orderSql = `order by c.created desc`
        } else {
            orderSql = ''
        }
        const sql = `select 
                c.id,
                c.name,
                c.img,
                c.created,
                c.status,
                w.staff_num,
                s.section_id,
                s.section_name,
                m.major_id,
                m.major_name,
                u.lecturer_id,
                u.lecturer_name,
                array_to_string(array_agg(cc.type_id), ',') as type_id,
                array_to_string(array_agg(cc.type_code), ',') as type_code,
                array_to_string(array_agg(cc.type_name), ',') as type_name,
                array_to_string(array_agg(col.column_id), ',')   as column_id,
                array_to_string(array_agg(col.column_code), ',') as column_code,
                array_to_string(array_agg(col.column_name), ',') as column_name
from kb_courses c
         left join (select kwr.course_id, count(distinct kwr.staff_id) as staff_num
                    from kb_watch_record kwr
                    group by kwr.course_id) w
                   on c.id = w.course_id
         left join (select s1.id as section_id, s1.name as section_name from kb_section s1) s
                   on s.section_id = c.section_id
         left join (select u1.id as lecturer_id, u1.name as lecturer_name from kb_user u1) u
                   on u.lecturer_id = c.lecturer_id
         left join (select m1.id as major_id, m1.name as major_name from kb_major m1) m on m.major_id = c.major_id
         left join (select ccol1.column_id, ccol1.course_id, kch.column_code, kch.column_name
                    from kb_course_column ccol1
                             left join (select khc1.code as column_code, khc1.name as column_name, khc1.id
                                        from kb_home_columns khc1) kch
                                       on ccol1.column_id = kch.id) col on c.id = col.course_id
         left join (select cc1.course_id, cc1.type_id, kct.type_name, kct.type_code
                    from kb_course_class cc1
                             left join (select kct1.id, kct1.name as type_name, kct1.code as type_code
                                        from kb_course_type kct1) kct
                                       on kct.id = cc1.type_id order by cc1.created desc) cc on cc.course_id = c.id
         where c.status = 1
         and concat(cc.type_code) like $4
         and concat(col.column_code) like $5
         and (concat(c.name) like $1
         or concat(u.lecturer_name) like $1
         or concat(cc.type_name) like $1) group by c.id,w.staff_num,s.section_id,s.section_name,m.major_id,m.major_name,u.lecturer_id,u.lecturer_name ${orderSql} limit $2 offset $3`
        const result = await pool.query(sql, ['%' + ctx.request.body.name + '%', ctx.request.body.limit, ctx.request.body.offset, (ctx.request.body.typeCode ?? '%') + '%', (ctx.request.body.columnCode ?? '%') + '%'])
        const total = await pool.query(sql, ['%' + ctx.request.body.name + '%', 1000000, 0, (ctx.request.body.typeCode ?? '%') + '%', (ctx.request.body.columnCode ?? '%') + '%'])
        ctx.body = {
            list: covertColumnByType(result.rows, 2), total: total.rows.length, success: true, msg: '查询成功！'
        }
    })

    router.get(`/course/getCourseById`, async (ctx, next) => {
        const data = await getApi(ctx, next);
        const result = deconstructionData(data.data[0]);
        let classData = {};
        let columnData = {};
        let flag = false;
        if (result.chapters && result.chapters.length > 0) {
            result.chapters.forEach(res => {
                if (!flag && res['recordChapter'] && res['recordChapter'].length > 0 && res['recordChapter'][0].completed) {
                    result.courseCompleted = true;
                    flag = true;
                }
            })
        }
        if (result.classList.length > 0) {
            classData = result.classList[0]['courseTypeData'];
        }
        if (result.columnList.length > 0) {
            columnData = result.columnList[0]['homeColumnData'];
        }
        //设置每个章节的进度,如果是完成就是100，否则算百分比，小于1默认未观看
        ctx.body = {
            data: {...result}, columnData, classData, total: data.total, success: true, msg: '查询成功！'
        }
    });

    router.post('/watchRecord/getStaffWatchListByPage', async (ctx) => {
        ctx.request.body['staffId'] = ctx.request.body.where.staff_id._eq || null;
        const data = await getApi(ctx);
        const list = [];
        data.list.forEach(res => {
            const obj = deconstructionData(res)
            const len = obj.chapters.length
            let completed = obj.courseCompleted ? len : 0
            if (!obj.courseCompleted) {
                obj.chapters.forEach(dd => {
                    if (dd.recordChapter.length > 0 && dd.recordChapter[0].isRealCompleted) {
                        completed++
                    } else if (dd.recordChapter.length > 0 && !dd.recordChapter[0].isRealCompleted) {
                        completed += Number((dd.recordChapter[0].maxTime / dd.recordChapter[0].totalTime).toFixed(1))
                    }
                })
            }
            obj.completedRate = Math.floor((completed / len) * 100)
            list.push(obj)
        })
        ctx.body = {
            list, total: data.total.aggregate.count, success: true, msg: '查询成功！'
        }
    })

    //评价提交
    router.post(`/examAnswer/insert`, async (ctx, next) => {
        const data = ctx.request.body
        const createStaff = await create(invertCtxData({
            courseId: data.courseId, staffId: data.staffId, score: data.score, paperId: data.paperId
        }, '/examAnswerStaffs/create'))
        for (const rr of data.questions) {
            const obj = {
                answerId: createStaff.rows[0].id,
                questionId: rr.id,
                getScore: rr.type === 'text' ? rr.score : rr.result,
                resultOption: rr.type === 'text' ? rr.result : JSON.stringify(rr.resultOption)
            }
            await create(invertCtxData(obj, '/examAnswerQuestions/create'))
            ctx.body = {
                success: true, msg: '提交成功！'
            }
        }
    })

    router.post(`/cert/download`, async (ctx) => {
        // const PizZip = require('pizzip');
        // const Docxtemplater = require('docxtemplater');
        // const fs = require('fs');
        // const path = require('path');
        // // 读取文件,以二进制文件形式保存
        // const content = fs.readFileSync(path.resolve('/Users/mac/wzr/资源库/hasura-web/attachs/test.docx'), 'binary');
        // // 压缩数据
        // const zip = new PizZip(content);
        // // 生成模板文档
        // const doc = new Docxtemplater(zip);
        // // 设置填充数据
        // doc.setData({
        //     name: ctx.request.body['staffName'],
        //     title: ctx.request.body.name,
        //     typeName: ctx.request.body.name,
        //     date: ctx.request.body['date']
        // });
        // //渲染数据生成文档
        // doc.render()
        // // 将文档转换文nodejs能使用的buf
        // const buf = doc.getZip().generate({type: 'nodebuffer'});
        // // 输出文件
        // fs.writeFileSync(path.resolve(__dirname, ctx.request.body['staffName'] + '-' + ctx.request.body.name + '.docx'), buf);
        // ctx.body = {
        //     success: true, msg: '查询成功！'
        // }
    });

    require('./manage-router.js')(router)

    return router;
};
