const db = require("../src/DBUtil");
const util = require("../src/CommonUtil.js");
const config = require("../conf/config.js");
const define = require("../conf/define.js");

const blk_list_sort = (a, b) => {
    if(parseInt(a.blk_num) == parseInt(b.blk_num)) {
        return 0;
    }
    return parseInt(a.blk_num) < parseInt(b.blk_num) ? 1 : -1;
}

exports.LightBlkInfo = async (req, res) => {
    const request = req.query;

    if(request.hash === undefined && request.blknum === undefined) {
        res.send(404);
        return;
    }

    if(request.hash !== undefined) {
        if(!util.REGEX.HEX_STR_REGEX.test(request.hash) || request.hash.length < 0 || request.hash.length > 64) {
            res.send(404);
            return;
        }
    }

    const blk_connection = await db.connection(config.blk_db_config);
    const sc_connection = await db.connection(config.sc_db_config);
    let ret_msg;
    let blkinfo;
    let tx_list;

    try {
        if(request.blknum !== undefined) 
        {
            sql = db.blockQuerys.LightBlkInfoWithBlknum;
            sql += `${parseInt(request.blknum)}`;

            [query_result] = await blk_connection.query(sql);
            blkinfo = query_result[0];
        }
        else if(request.blknum === undefined && request.hash !== undefined) 
        {
            sql = db.blockQuerys.LightBlkInfoWithHash;
            [query_result] = await blk_connection.query(sql, [request.hash]);
            blkinfo = query_result[0];
        }

        sql = db.scQuerys.TxListWithBlkNum;
        [query_result] = await sc_connection.query(sql, [blkinfo.blk_num]);
        let tx_list = query_result;

        ret_msg = { errorCode : 0, contents : { blkinfo : blkinfo, txlist : tx_list}};

        await blk_connection.release();
        await sc_connection.release();
        res.send(ret_msg);
        return;
    } catch (err) {
        console.log(err);
        await blk_connection.release();
        await sc_connection.release();
        res.send(404);
        return;
    }
}

module.exports.BlkList = async (req, res) => {
    const request = req.query;
    const len = parseInt(request.length);
    const startIdx = parseInt(request.start);
    const search = request.search.value;
    
    if(startIdx === undefined || len === undefined) {
        res.send(404);
        return;
    }

    const blk_connection = await db.connection(config.blk_db_config);
    let ret_msg;

    try {
        if(search === "" || util.REGEX.HASH_REGEX.test(search) || search.length < 4) {
            let sql = db.blockQuerys.BlkList;
            [query_result] = await blk_connection.query(sql, [startIdx, len]);
        } else {
            let sql = db.blockQuerys.BlkListWithHash + `"%${search}%"`;
            [query_result] = await blk_connection.query(sql);
        }

        let blk_list_arr = new Array();
        await util.asyncForEach(query_result, (element, index) => {
            let blkInfo = {
                blk_num : element.blk_num,
                bgt : element.bgt,
                tx_cnt : element.tx_cnt,
                blk_hash  : element.blk_hash,
                subnet_id : element.subnet_id
            }
            blk_list_arr.push(blkInfo);
        });

        sql = db.blockQuerys.TotalBlkCnt;
        [query_result] = await blk_connection.query(sql);
        let total_blk_num = query_result[0].cnt;

        ret_msg = { errorCode : 0, contents : { blklist : blk_list_arr}, data : blk_list_arr, recordsTotal : total_blk_num, recordsFiltered : total_blk_num};
    
        await blk_connection.release();
        res.send(ret_msg);
        return;

    } catch (err) {
        console.log(err);
        await blk_connection.release();
        res.send(404);
        return;
    }
}

module.exports.lastBlkNum = async (req, res) => {
    const blk_connection = await db.connection(config.blk_db_config);
    let ret_msg;

    let sql = db.blockQuerys.TotalBlkCnt;
    
    try {
        [query_result] = await blk_connection.query(sql);
        let total_blk_num;

        if(query_result === undefined) {
            total_blk_num = 1;
        } else {
            total_blk_num = Number(query_result[0].cnt) + 1;
        }

        ret_msg = { errorCode : 0, contents : {blk_num : total_blk_num }};

        await blk_connection.release();
        res.send(ret_msg);
        return;

    } catch (err) {
        console.log(err);
        await blk_connection.release();
        res.send(404);
        return;
    }
}