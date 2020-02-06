const db = require("../src/DBUtil");
const util = require("../src/CommonUtil.js");
const config = require("../conf/config.js");

exports.singleTXInfo = async (req, res) => {
    const request = req.query;
    if(request.hash === undefined && request.db_key === undefined) {
        res.send(404);
        return;
    }

    if(!util.REGEX.HEX_STR_REGEX.test(request.hash) && request.db_key === undefined) {
        res.send(404);
        return;
    }

    const sc_connection = await db.connection(config.sc_db_config);
    let ret_msg;

    try {

        if(request.hash) {
            sql = db.scQuerys.TxInfoWithBlknum;
            [query_result] = await sc_connection.query(sql, [request.hash]);
        }
        else if(request.db_key) {
            sql = db.scQuerys.TxInfoUsingDBKey;
            [query_result] = await sc_connection.query(sql, [request.db_key]);
        }        
        
        ret_msg = { errorCode : 0, contents : 
            { txinfo : 
                { blk_num : query_result[0].blk_num, 
                    tx_hash : query_result[0].sc_hash,
                    subnet_id : query_result[0].subnet_id,
                    contract : JSON.parse(query_result[0].contract.slice(1, query_result[0].contract.length - 1))}}};
        await sc_connection.release();
        res.send(ret_msg);
        return;
    } catch (err) {
        console.log(err);
        await sc_connection.release();
        res.send(404);
        return;
    }
}

module.exports.TXList = async (req, res) => {
    const request = req.query;
    const len = parseInt(request.length);
    const startIdx = parseInt(request.start);
    const search = request.search.value;

    if(startIdx === undefined || len === undefined) {
        res.send(404);
        return;
    }

    const sc_connection = await db.connection(config.sc_db_config);
    let ret_msg;

    try {
        if(search === "" || !util.REGEX.HASH_REGEX.test(search) || search.length < 4) {
            let sql = db.scQuerys.TxList;
            [query_result] = await sc_connection.query(sql, [startIdx, len]);
        } else {
            let sql = db.scQuerys.TxListWithHash + `"%${search}%"`;
            [query_result] = await sc_connection.query(sql);
        }

        let tx_list_arr = new Array();
        await util.asyncForEach(query_result, async (element, index) => {
            sql = db.scQuerys.TxInfoUsingDBKey;
            [contract_query_result] = await sc_connection.query(sql, [element.db_key]);

            let contract_str = contract_query_result[0].contract;
            let contract_json = JSON.parse(JSON.stringify(contract_str.substr(1, contract_str.length - 2)));
            let contract = JSON.parse(contract_json);

            let txInfo = {
                subnet_id : contract_query_result[0].subnet_id,
                blk_num : contract_query_result[0].blk_num,
                sc_hash : contract_query_result[0].sc_hash,
                cct : contract.ContractCreateTime
            }
            tx_list_arr.push(txInfo);
        });

        sql = db.scQuerys.TotalSCCnt;
        [query_result] = await sc_connection.query(sql);

        ret_msg = { errorCode : 0, contents : { txlist : tx_list_arr}, data : tx_list_arr, recordsTotal : query_result[0].cnt, recordsFiltered : query_result[0].cnt};

        await sc_connection.release();
        res.send(ret_msg);
        return;

    } catch (err) {
        console.log(err);
        await sc_connection.release();
        res.send(404);
        return;
    }
}