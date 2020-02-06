const db = require("../src/DBUtil.js");
const util = require("../src/CommonUtil.js");
const config = require("../conf/config.js");
const define = require("../conf/define.js");

const registUserInfo = async (sc_conn, account_conn, pub_key, id) => {
    let ret_msg;
    if(pub_key === undefined) {
        ret_msg = { errorCode : 1002, contents : { msg : "Need Public Key", timestamp : new Date().getTime() }};
    } else {
        let sql = db.accountQuerys.getLastRevision;
        [query_result] = await sc_conn.query(sql, pub_key);
        
        if(query_result[0] === undefined) {
            ret_msg = { errorCode : 1001, contents : { msg : "Not Regist", timestamp : new Date().getTime() }};
        } else {
            try {
                let new_db_key = query_result[0].db_key;

                sql = db.accountQuerys.getContractContents;
                [query_result] = await sc_conn.query(sql, new_db_key);
                let contents = JSON.parse(query_result[0].contract.slice(1, query_result[0].contract.length - 1));

                let is_add_contract = false;

                for(var i = 0; i < contents.Note.length; i++)
                {
                    if(contents.Note[i].Kind === define.CONTRACT_KIND.ADD_USER 
                        && contents.Note[i].Content.PublicKey === pub_key)
                    {
                        if(contents.Note[i].Content.ID === undefined) {
                            id = null;
                        } else {
                            id = contents.Note[i].Content.ID;
                        }
                        
                        sql = db.accountQuerys.insertAccountInfo;
                        await account_conn.query(sql, [0, id, pub_key, new_db_key, null]); 
                        ret_msg = { errorCode : 0 , info_db_key : new_db_key, account_status : 0, user_id : contents.Note[i].Content.ID, user_pub_key : pub_key};

                        is_add_contract = true;
                        break;
                    }
                    else if(contents.Note[i].Kind === define.CONTRACT_KIND.ADD_HW
                            && contents.Note[i].Content.PublicKey === pub_key)
                    {
                        sql = db.accountQuerys.insertAccountInfo;
                        await account_conn.query(sql, [0, contents.Note[i].Content.ID, contents.Note[i].Content.PublicKey, new_db_key, contents.Note[i].Content.HWSN]);
                        ret_msg = { errorCode : 0, info_db_key : new_db_key, account_status : 0, user_id : contents.Note[i].Content.ID, user_pub_key : contents.Note[i].Content.PublicKey};

                        is_add_contract = true;
                        break;
                    }
                }

                if(!is_add_contract) {
                    ret_msg = { errorCode : 1003, contents : { msg : "No have add contract", timestamp : new Date().getTime()}};
                }
                
            } catch (err) {
                console.log(err);
                ret_msg = { errorCode : 2000, reason : JSON.stringify(err) };
            }
        }
    }
    return ret_msg;
}

const getUserInfo = async (conn, pub_key, id) => {
    let ret_msg;
    let sql = db.accountQuerys.getAccountStatus;

    if(id === undefined || pubkey !== undefined) 
    {
        sql += "pub_key = ?";
        [query_result] = await conn.query(sql, [pub_key]);
        if(query_result[0] === undefined) {
            ret_msg = { errorCode : 1000 };
        } else {
            ret_msg = {
                errorCode : 0,
                account_status : query_result[0].status,
                info_db_key : query_result[0].db_key,
                user_pub_key : pub_key,
                user_id : query_result[0].id,
                topic_name : query_result[0].topic,
                user_ip : query_result[0].ip
            }
        }
    } else if(pubkey === undefined || id !== undefined) {
        sql += "id = ?";
        [query_result] = await conn.query(sql, [id]);
        if(query_result[0] === undefined) {
            ret_msg = { errorCode : 1000 };
        } else {
            ret_msg = {
                errorCode : 0,
                account_status : query_result[0].status,
                info_db_key : query_result[0].db_key,
                user_pub_key : query_result[0].pub_key,
                user_id : id,
                topic_name : query_result[0].topic,
                user_ip : query_result[0].ip
            }
        }
    } 
    return ret_msg;
}

const findTopicName = async (blk_num) => {
    let sql;
    let p2p_addr;
    let topic_name;

    const blk_conn = await db.connection(config.blk_db_config);

    try {
        sql = db.accountQuerys.getP2PAddr;
        [query_result] = await blk_conn.query(sql, blk_num);
        p2p_addr = query_result[0].p2p_addr;
        
        p2p_addr = parseInt(p2p_addr).toString(16);
        topic_name = p2p_addr.slice(define.INDEX.TOPIC_NAME_SPLIT_START, define.INDEX.TOPIC_NAME_SPLIT_END);
    } catch (err) {
        await blk_conn.release();
        return "blank";
    }

    await blk_conn.release();
    return topic_name;
}

const UpdateRegistContract = async (account_conn, contents, db_key, blk_num, user_id, user_pub_key, curr_status) => {
    let sql;
    let sql_argv;

    let user_status;
    let user_ID = user_id;
    let user_PUB_KEY = user_pub_key;
    let user_ip;
    let topic_name;    

    // 19.10.28 ~ kind�� ���� account info update

    await util.asyncForEach(contents.Note, async (element, index) => {

        if (element.Kind === define.CONTRACT_KIND.ADD_USER && user_pub_key === element.Content.PublicKey)
        {
            user_status = define.USER_STATUS.LOGOUT;
            user_id = element.Content.ID;
            sql_argv = [user_status, user_id, element.Content.PublicKey, db_key, null, null, null, element.Content.PublicKey];
        }
        else if(element.Kind === define.CONTRACT_KIND.CHANGE_USER_ID && user_pub_key === element.Content.PublicKey) 
        {
            user_status = curr_status;
            user_ID = element.Content.ID;
            sql_argv = [user_status, user_ID, user_pub_key, db_key, null, null, null, user_pub_key];            
        }
        else if(element.Kind === define.CONTRACT_KIND.CHANGE_USER_PUB_KEY && user_id === element.Content.ID)
        {
            user_status = curr_status;
            user_PUB_KEY = element.Content.PublicKey;
            sql_argv = [user_status, user_id, element.Content.PublicKey, db_key, null, null, null, user_pub_key];
        }
        else if(element.Kind === define.CONTRACT_KIND.LOGIN_USER)
        {
            user_status = define.USER_STATUS.LOGIN;
            topic_name = await findTopicName(blk_num);
            sql_argv = [user_status, user_id, user_pub_key, db_key, null, element.Content.IP, topic_name, user_pub_key];
        }
        else if(element.Kind === define.CONTRACT_KIND.LOGOUT_USER)
        {
            user_status = define.USER_STATUS.LOGOUT;
            sql_argv = [user_status, user_id, user_pub_key, db_key, null, null, null, user_pub_key];
        }
        else if(element.Kind === define.CONTRACT_KIND.LOGOUT_USER_TIMEOUT)
        {
            user_status = define.USER_STATUS.LOGOUT;
            sql_argv = [user_status, element.Content.ID, element.Content.PublicKey, db_key, null, null, null, element.Content.PublicKey];
        }
        else if(element.Kind === define.CONTRACT_KIND.ADD_HW && user_pub_key === element.Content.PublicKey)
        {
            user_status = define.USER_STATUS.LOGOUT;
            user_id = element.Content.ID;
            sql_argv = [user_status, user_id, user_pub_key, db_key, element.Content.HWSN, null, null, user_pub_key];
        }
        else if(element.Kind === define.CONTRACT_KIND.CHANGE_HW_ID && user_pub_key === element.Content.PublicKey) 
        {
            user_status = curr_status;
            user_id = element.Content.ID;
            sql_argv = [user_status, user_id, user_pub_key, db_key, element.Content.HWSN, null, null, user_pub_key];
        }
        else if(element.Kind === define.CONTRACT_KIND.CHANGE_HW_PUB_KEY && user_id === element.Content.ID)
        {
            user_status = curr_status;
            user_PUB_KEY = element.Content.PublicKey;
            sql_argv = [user_status, user_id, element.Content.PublicKey, db_key, element.Content.HWSN, null, null, user_pub_key];
        }
        else if(element.Kind === define.CONTRACT_KIND.CHANGE_HW_SN && user_pub_key === element.Content.PublicKey)
        {
            user_status = curr_status;
            sql_argv = [user_status, user_id, user_pub_key, db_key, element.Content.HWSN, null, null, user_pub_key];            
        }

        try {
            sql = db.accountQuerys.updateAccountInfo;
            await account_conn.query(sql, sql_argv);
        } catch (err) {
            console.log(err);
            return 404;
        }
    });

    return { user_status : user_status,  topic_name : topic_name, user_ip : user_ip , user_id : user_id, user_pub_key : user_PUB_KEY};
}

const chkAccountAndUpdate = async (sc_conn, account_conn, argv) => {
    let ret_msg;
    let sql;

    try {
        let user_id;
        let info_revision;
        let contract_revision;
        let blk_num;
        let new_db_key;
        let balance = 0;
        let kind;
        let status;
        let contents;

        let user_pub_key = argv.pub_key;
        if(argv.id === undefined) user_id = null;
        else user_id = argv.id;

        sql = db.accountQuerys.getInfoRevision;
        sql += `'${argv.db_key}'`;
        [query_result] = await sc_conn.query(sql);
        info_revision = query_result[0].revision;
        
        sql = db.accountQuerys.getLastRevision;
        [query_result] = await sc_conn.query(sql, [user_pub_key.toString()]);
        contract_revision = query_result[0].revision;
        blk_num = query_result[0].blk_num;
        new_db_key = query_result[0].db_key;
        kind = query_result[0].kind;

        sql = db.accountQuerys.getContractContents;
        [query_result] = await sc_conn.query(sql, [new_db_key]);
        contents = JSON.parse(query_result[0].contract.slice(1, query_result[0].contract.length - 1));

        if(info_revision < contract_revision) 
        {
            if(kind >= 0 && kind < define.CONTRACT_KIND.ADD_USER) 
            {
                sql = db.accountQuerys.updateFintechInfo;
                await account_conn.query(sql, [argv.status, user_id, user_pub_key, new_db_key, user_pub_key]);       
                status = argv.status;    
            }
            else 
            {
                status = await UpdateRegistContract(account_conn, contents, new_db_key, blk_num, user_id, user_pub_key, argv.status);
            }

            if(status === 404) {
                ret_msg = { errorCode : 404 }
                return ret_msg;
            }
        } else {
            status = {
                user_status : argv.status,
                user_id : user_id,
                user_pub_key : user_pub_key,
                topic_name : argv.topic_name === undefined ? "blank" : argv.topic_name,
                user_ip : argv.user_ip
            };
        }

        sql = db.accountQuerys.getBalance;
        [query_result] = await sc_conn.query(sql, [user_pub_key]);
        if(query_result[0] !== undefined) 
        {
            balance = query_result[0].balance;
        }

        sql = db.accountQuerys.getContractList;
        [query_result] = await sc_conn.query(sql, [user_pub_key, blk_num, 0]);
    
        balance = parseFloat(balance);
        await util.asyncForEach(query_result, async (element, index) => {
            balance = parseFloat(balance) + parseFloat(element.amount);
        });

        balance = Math.round(balance * 1e12) / 1e12;
            
        if (util.isObject(status)) {
            ret_msg = { errorCode : 0, 
                        contents : { 
                            id : status.user_id, 
                            pub_key : status.user_pub_key, 
                            status : status.user_status, 
                            revision : contract_revision, 
                            previous_key : new_db_key, 
                            topic_name : status.topic_name, 
                            balance : balance.toString(),
                            ip : status.user_ip,
                            timestamp : new Date().getTime()
                        }
                    };
        } else {
            ret_msg = { errorCode : 0, 
                        contents : { 
                            id : user_id, 
                            pub_key : user_pub_key, 
                            status : status, 
                            revision : contract_revision, 
                            previous_key : new_db_key, 
                            topic_name : status.topic_name,
                            balance : balance.toString(),
                            ip : null,
                            timestamp : new Date().getTime()
                        }
                    };
        }
    } catch (err) {
        console.log(err);
        ret_msg = { errorCode : 404 }
    }

    return ret_msg;
}

exports.getStatus = async(req, res) => {
    const request = req.query;
    if(request.id === undefined && request.pubkey === undefined) {
        res.send(404);
        return;
    }

    const account_connection = await db.connection(config.account_db_config);
    const sc_connection = await db.connection(config.sc_db_config);
    let ret_msg;

    ret_msg = await getUserInfo(account_connection, request.pubkey, request.id);

    if(ret_msg.errorCode !== 0) {
        // id or public key is not regist or contract Not apply
        ret_msg = await registUserInfo(sc_connection, account_connection, request.pubkey, request.id);
    }

    if(ret_msg.errorCode === 0) {
        let argv = {
            id : ret_msg.user_id,
            pub_key : ret_msg.user_pub_key,
            db_key : ret_msg.info_db_key,
            status : ret_msg.account_status,
            topic_name : ret_msg.topic_name,
            user_ip : ret_msg.user_ip,
            kind : request.kind
        }

        ret_msg = await chkAccountAndUpdate(sc_connection, account_connection, argv);

    } else {
        ret_msg = { errorCode : 1001, contents : { msg : "Not Regist", timestamp : new Date().getTime()}};
    }

    await account_connection.release();
    await sc_connection.release();

    if(ret_msg.errorCode == 404) {
        res.send(404);
    } else {
        res.send(ret_msg);
    }
    return;
}

module.exports.accountList = async (req, res) => {
    const request = req.query;
    const len = parseInt(request.length);
    const startIdx = parseInt(request.start);
    const search = request.search.value;

    if(startIdx === undefined || len === undefined) {
        res.send(404);
        return;
    }

    const account_connection = await db.connection(config.account_db_config);
    let ret_msg;

    try {
        if(search === "" || !util.REGEX.HASH_REGEX.test(search) || search.length < 4) {
            let sql = db.accountQuerys.accountList;
            [query_result] = await account_connection.query(sql, [startIdx, len]);   
        } else {
            let sql = db.accountQuerys.accountListWithPubkey + `"%${search}%"`;
            [query_result] = await account_connection.query(sql);
        }

        let account_list_arr = new Array();
        await util.asyncForEach(query_result, (element, index) => {
            let accountInfo = {
                id : element.id,
                status : element.status,
                pubkey : element.pub_key
            }
            account_list_arr.push(accountInfo);
        });

        sql = db.accountQuerys.TotalAccountCnt;
        [query_result] = await account_connection.query(sql);

        ret_msg = { errorCode : 0, contents: { accountlist : account_list_arr}, data : account_list_arr, recordsTotal : query_result[0].cnt, recordsFiltered : query_result[0].cnt};

        sql = "FLUSH TABLES";
        await account_connection.query(sql);

        await account_connection.release();
        res.send(ret_msg);
        return;
    } catch (err) {
        console.log(err);
        await account_connection.release();
        res.send(404);
        return;
    }
}

module.exports.accountTXList = async (req, res) => {
    const request = req.query;
    const len = parseInt(request.length);
    const startIdx = parseInt(request.start);
    const pubkey = request.key;

    if(startIdx === undefined || len === undefined || pubkey === undefined) {
        res.send(404);
        return;
    }

    const sc_connection = await db.connection(config.sc_db_config);

    let ret_msg;

    try {
        let sql = db.accountQuerys.accountTXList;
        [query_result] = await sc_connection.query(sql, [pubkey, pubkey, startIdx, len]);

        let tx_list_arr = new Array();
        await util.asyncForEach(query_result, (element, index) => {
            let txInfo = {
                blk_num : element.blk_num,
                db_key : element.db_key,
                from_pk : element.from_pk,
                to_pk : element.to_pk,
                kind : element.kind,
                amount : element.amount,
            }
            if(element.from_pk === pubkey && element.kind < define.CONTRACT_KIND.COIN_TYPE_LAST_NUMBER) {
                txInfo.delimiter = "OUT";
            } else if(element.to_pk == pubkey && element.kind < define.CONTRACT_KIND.COIN_TYPE_LAST_NUMBER) {
                txInfo.delimiter = "IN";
            } else {
                txInfo.delimiter = "NONE";
            }
            tx_list_arr.push(txInfo);
        });

        sql = db.accountQuerys.TotalAccountTxCnt;
        [query_result] = await sc_connection.query(sql, [pubkey, pubkey]);

        ret_msg = { errorCode : 0, contents : { txlist : tx_list_arr}, data : tx_list_arr, recordsTotal : query_result[0].cnt, recordsFiltered : query_result[0].cnt };

        sql = "FLUSH TABLES";
        await sc_connection.query(sql);

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

module.exports.accountNum = async (req, res) => {
    const account_conn = await db.connection(config.account_db_config);
    let ret_msg;

    try {
        let sql = db.accountQuerys.accountNum;
        
        [query_result] = await account_conn.query(sql);

        ret_msg = { errorCode : 0, contents : { active : query_result[0].active_cnt, total : query_result[0].total_cnt } };

        await account_conn.release();
        res.send(ret_msg);
        return;
    } catch (err) {
        console.log(err);
        await account_conn.release();
        res.send(404);
        return;
    }
}