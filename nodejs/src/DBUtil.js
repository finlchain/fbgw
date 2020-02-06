const mysql = require("mysql2/promise");
const util = require("./CommonUtil.js");
const config = require("./../conf/config.js");

const block_conn_pool = mysql.createPool(config.blk_db_config);
const sc_conn_pool = mysql.createPool(config.sc_db_config);
const account_conn_pool = mysql.createPool(config.account_db_config); 

module.exports.BIG_INT_MAX_LEN = 20;

module.exports.connection = async (config) => {
    if(config.database == "account") {
        return await account_conn_pool.getConnection(async conn => conn);
    } else if(config.database == "block") {
        return await block_conn_pool.getConnection(async conn => conn);
    } else if(config.database == "sc") {
        return await sc_conn_pool.getConnection(async conn => conn);
    }
}

const dbShardQuerys = {
    ShardDropTableQuerys : 
        [
            "DROP TABLE IF EXISTS sc.contents",
            "DROP TABLE IF EXISTS sc.info",
            "DROP TABLE IF EXISTS sc.ledgers",
            "DROP TABLE IF EXISTS block.contents",
            "DROP TABLE IF EXISTS block.info",
            "DROP TABLE IF EXISTS block.txs",
            "DROP TABLE IF EXISTS block.prv_contents"
        ],
    ShardDelServerQuerys : "DELETE FROM mysql.servers WHERE Server_name IN",
    ShardCreateServerQuerys:
        "CREATE SERVER ?"
        + " FOREIGN DATA WRAPPER mysql"
        + " OPTIONS("
        + " HOST ?,"
        + " DATABASE ?,"
        + " USER ?,"
        + " PASSWORD ?,"
        + " PORT ?)",
    ShardCreateTableQuerys:
        [
            "CREATE OR REPLACE TABLE `contents` ("
            + "`subnet_id` smallint(5) unsigned NOT NULL,"
            + "`db_key` bigint(20) unsigned NOT NULL,"
            + "`contract` json DEFAULT NULL,"
            + "PRIMARY KEY (`db_key`, `subnet_id`) USING BTREE"
            + ") ENGINE=spider COMMENT='wrapper \"mysql\", table \"contents\"' "
            + "PARTITION BY KEY (`subnet_id`)"
            + "(",
            "CREATE OR REPLACE TABLE `info` ("
            + "`subnet_id` smallint(5) unsigned NOT NULL,"
            + "`db_key` bigint(20) unsigned NOT NULL,"
            + "`blk_num` bigint(20) unsigned,"
            + "`bgt` bigint(20) unsigned,"
            + "`bct` bigint(20) unsigned,"
            + "`sc_hash` text NOT NULL,"
            + "PRIMARY KEY (`blk_num`, `subnet_id`, `db_key`) USING BTREE,"
            + "KEY `sc_hash` (`sc_hash`(64)) USING BTREE"
            + ") ENGINE=spider COMMENT='wrapper \"mysql\", table \"info\"' "
            + "PARTITION BY KEY (`subnet_id`)"
            + "(",
            "CREATE OR REPLACE TABLE `ledgers` ("
            + "`subnet_id` smallint(5) unsigned NOT NULL,"
            + "`idx` bigint(20) unsigned NOT NULL,"
            + "`from_pk` text NOT NULL DEFAULT '',"
            + "`revision` int(11) unsigned NOT NULL DEFAULT 0,"
            + "`db_key` bigint(20) unsigned NOT NULL,"
            + "`blk_num` bigint(20) unsigned NOT NULL,"
            + "`to_pk` text NOT NULL DEFAULT '',"
            + "`kind` int(11) unsigned NOT NULL DEFAULT 0,"
            + "`amount` text DEFAULT '',"
            + "`balance` text DEFAULT '',"
            + "PRIMARY KEY (`blk_num`, `db_key`, `subnet_id`, `to_pk`(66)) USING BTREE,"
            + "KEY `balance` (`from_pk`(66), `revision`) USING BTREE"
            + ") ENGINE=spider COMMENT='wrapper \"mysql\", table \"ledgers\"' "
            + "PARTITION BY KEY (`subnet_id`)"
            + "(",
            "CREATE OR REPLACE TABLE `contents` ("
            + "`subnet_id` smallint(5) unsigned NOT NULL,"
            + "`blk_num` bigint(20) unsigned NOT NULL,"
            + "`sig_type` tinyint(3) unsigned DEFAULT NULL,"
            + "`p2p_addr` bigint(20) unsigned DEFAULT NULL,"
            + "`bgt` bigint(20) unsigned DEFAULT NULL,"
            + "`pbh` text DEFAULT NULL,"
            + "`tx_cnt` int(11) unsigned DEFAULT NULL,"
            + "`blk_hash` text DEFAULT NULL,"
            + "`sig` text DEFAULT NULL,"
            + "PRIMARY KEY (`blk_num`, `subnet_id`) USING BTREE,"
            + "KEY `blk_hash` (`blk_hash`(64)) USING BTREE"
            + ") ENGINE=spider COMMENT='wrapper \"mysql\", table \"contents\"' "
            + "PARTITION BY KEY (`subnet_id`)"
            + "(",
            "CREATE OR REPLACE TABLE `info` ("
            + "`subnet_id` smallint(5) unsigned,"
            + "`blk_num` bigint(20) unsigned,"
            + "`status` tinyint(3) unsigned,"
            + "`bct` bigint(20) unsigned,"
            + "KEY `blk_num` (`blk_num`)"
            + ") ENGINE=spider COMMENT='wrapper \"mysql\", table \"info\"' "
            + "PARTITION BY KEY (`subnet_id`)"
            + "(",
            "CREATE OR REPLACE TABLE `txs` ("
            + "`subnet_id` smallint(5) unsigned NOT NULL,"
            + "`blk_num` bigint(20) unsigned NOT NULL,"
            + "`db_key` bigint(20) unsigned NOT NULL,"
            + "`sc_hash` text NOT NULL,"
            + "PRIMARY KEY (`db_key`, `subnet_id`) USING BTREE,"
            + "KEY `sc_hash` (`sc_hash`(64)) USING BTREE"
            + ") ENGINE=spider COMMENT='wrapper \"mysql\", table \"txs\"' "
            + "PARTITION BY KEY (`subnet_id`)"
            + "(",
            "CREATE OR REPLACE TABLE `prv_contents` ("
            + "`subnet_id` smallint(5) unsigned NOT NULL,"
            + "`blk_num` bigint(20) unsigned NOT NULL,"
            + "`sig_type` tinyint(3) unsigned DEFAULT NULL,"
            + "`p2p_addr` bigint(20) unsigned DEFAULT NULL,"
            + "`bgt` bigint(20) unsigned DEFAULT NULL,"
            + "`pbh` text DEFAULT NULL,"
            + "`tx_cnt` int(11) unsigned DEFAULT NULL,"
            + "`blk_hash` text DEFAULT NULL,"
            + "`sig` text DEFAULT NULL,"
            + "PRIMARY KEY (`blk_num`, `subnet_id`) USING BTREE,"
            + "KEY `hash` (`blk_hash`(64)) USING BTREE"
            + ") ENGINE=spider COMMENT='wrapper \"mysql\", table \"prv_contents\"' "
            + "PARTITION BY KEY (`subnet_id`)"
            + "("
        ]
}

const createTableAccount = async () => {
    const account_conn = await mysql.createConnection(config.account_db_config);
    await account_conn.query(this.accountQuerys.createAccountTable);

    let sql = "TRUNCATE info";
    await account_conn.query(sql);
    await account_conn.end();
}

const createShard = async () => {
    const conn = await mysql.createConnection(config.maria_db_config);
    const sc_conn = await mysql.createConnection(config.sc_db_config);
    const blk_conn = await mysql.createConnection(config.blk_db_config);

    let ret_msg;

    try {
        // DROP CURRENT TABLE
        await util.asyncForEach(dbShardQuerys.ShardDropTableQuerys, async (element, index) => {
            await conn.query(element);
        });

        let sql = "FLUSH PRIVILEGES";
        await conn.query(sql);

        // DELETE Server Info
        sql = dbShardQuerys.ShardDelServerQuerys + "(";
        await util.asyncForEach(config.shard_user_config.shardClientList, async (element, index) => {
            if (index == config.shard_user_config.shardClientList.length - 1) {
                sql += `'${JSON.parse(JSON.stringify(element)).name}_sc', `;
                sql += `'${JSON.parse(JSON.stringify(element)).name}_block')`;
            } else {
                sql += `'${JSON.parse(JSON.stringify(element)).name}_sc', `;
                sql += `'${JSON.parse(JSON.stringify(element)).name}_block', `;
            }
        });
        await conn.query(sql);

        sql = "FLUSH PRIVILEGES";
        await conn.query(sql);

        // REGIST Shard Client info
        await util.asyncForEach(config.shard_user_config.shardClientList, async (element) => {
            let client_info = JSON.parse(JSON.stringify(element));
            let params = [
                client_info.name + "_sc",
                client_info.host,
                "sc",
                client_info.user,
                client_info.pwd,
                client_info.port
            ];
            await conn.query(dbShardQuerys.ShardCreateServerQuerys, params);

            params.splice(params.indexOf(client_info.name + "_sc"), 1, client_info.name + "_block");
            params.splice(params.indexOf("sc"), 1, "block");

            await conn.query(dbShardQuerys.ShardCreateServerQuerys, params);
        });

        sql = "FLUSH PRIVILEGES";
        await conn.query(sql);

        sql = [...dbShardQuerys.ShardCreateTableQuerys];
        await util.asyncForEach(config.shard_user_config.shardClientList, async (element, index) => {
            for (var i = 0; i < sql.length; i++) {
                if(i === 0 || i === 1 || i === 2) {
                    sql[i] += `PARTITION shard_${element.name} COMMENT = 'srv"${element.name}_sc"'`;
                } else {
                    sql[i] += `PARTITION shard_${element.name} COMMENT = 'srv"${element.name}_block"'`;
                }

                if(index === config.shard_user_config.shardClientList.length - 1) {
                    sql[i] += ")";
                } else {
                    sql[i] += ", ";
                }
            }
        });

        for(var i = 0; i < sql.length; i++) {
            if(i === 0 || i === 1 || i === 2) {
                await sc_conn.query(sql[i]);
            } else {
                await blk_conn.query(sql[i]);
            }
        }

        sql = "FLUSH PRIVILEGES";
        await conn.query(sql);

        ret_msg = { res : true };
    } catch (err) {
        console.log(err);
        ret_msg = { res : false, reason : err };
    }

    await conn.end();
    await sc_conn.end();
    await blk_conn.end();

    return ret_msg;
}

module.exports.accountQuerys = {
    createAccountTable : 
        "CREATE TABLE IF NOT EXISTS `info` ("
        + "`status` tinyint(3) unsigned NOT NULL,"
        + "`id` text,"
        + "`pub_key` text NOT NULL,"
        + "`db_key` bigint(20) unsigned NOT NULL,"
        + "`hw_sn` json DEFAULT NULL,"
        + "`ip` varchar(16) DEFAULT NULL,"
        + "`topic` text DEFAULT NULL,"
        + "PRIMARY KEY (`pub_key`(66), `db_key`) USING BTREE"
        + ") ENGINE=InnoDB",
    getAccountStatus : "SELECT status, id, pub_key, db_key, topic, ip FROM info WHERE ",
    getInfoRevision : "SELECT revision FROM ledgers WHERE db_key =  ",
    getLastRevision : "SELECT revision, idx, db_key, blk_num, kind FROM ledgers WHERE from_pk = ? ORDER BY revision DESC, balance ASC LIMIT 1",
    getBalance : "SELECT balance FROM ledgers WHERE from_pk = ? ORDER BY `revision` DESC, `idx` DESC LIMIT 1",
    getContractContents : "SELECT contract from contents where db_key = ?",
    getContractList : "SELECT amount FROM ledgers WHERE (to_pk = ? AND blk_num >= ?) AND kind = ?",
    getP2PAddr : "SELECT p2p_addr FROM contents WHERE blk_num = ?",
    getTopicName : "SELECT status, topic FROM info WHERE pub_key = ?",
    getBrokerContract : "SELECT contract FROM contents WHERE db_key = (SELECT db_key FROM ledgers WHERE from_pk = ? AND kind = ? ORDER BY `revision` DESC, `idx` DESC LIMIT 1)",
    updateAccountInfo : "UPDATE info SET status = ?, id = ?, pub_key = ?, db_key = ?, hw_sn = ?, ip = ?, topic = ? WHERE pub_key = ?",
    updateFintechInfo : "UPDATE info SET status = ?, id = ?, pub_key = ?, db_key = ? WHERE pub_key = ?",
    insertAccountInfo : "INSERT INTO info(status, id, pub_key, db_key, hw_sn) VALUES (?, ?, ?, ?, ?)",
    accountList : "SELECT status, id, pub_key FROM info LIMIT ?, ?",
    accountListWithPubkey : "SELECT status, id, pub_key FROM info WHERE pub_key LIKE ",
    TotalAccountCnt : "SELECT count(*) AS cnt from info",
    accountTXList : "SELECT subnet_id, from_pk, db_key, blk_num, to_pk, kind, amount FROM ledgers WHERE (from_pk = ? OR to_pk = ?) ORDER BY blk_num DESC LIMIT ?, ?",
    TotalAccountTxCnt : "SELECT count(*) AS cnt FROM ledgers WHERE from_pk = ? OR to_pk = ?",
    accountNum : "SELECT count(*) AS total_cnt, (SELECT count(*) FROM info WHERE status = 1) AS active_cnt FROM info"
}

//block_num & 291474976710655

module.exports.blockQuerys = {
    LightBlkInfoWithBlknum : "SELECT subnet_id, blk_num, sig_type, p2p_addr, bgt, pbh, tx_cnt, blk_hash, sig FROM contents WHERE blk_num = ",
    LightBlkInfoWithHash : "SELECT subnet_id, blk_num, sig_type, p2p_addr, bgt, pbh, tx_cnt, blk_hash, sig FROM contents WHERE blk_hash = ?",
    // BlkList : "SELECT blk_num, bgt, tx_cnt, blk_hash, subnet_id FROM contents WHERE blk_num BETWEEN ? AND ?",
    BlkList : "SELECT blk_num, bgt, tx_cnt, blk_hash, subnet_id FROM contents ORDER BY blk_num DESC LIMIT ?, ?",
    BlkListWithHash : "SELECT blk_num, bgt, tx_cnt, blk_hash, subnet_id FROM contents WHERE blk_hash LIKE ",
    TotalBlkCnt : "SELECT count(*) AS cnt from contents",
}

module.exports.scQuerys = {
    TxList : "SELECT db_key FROM info ORDER BY blk_num DESC LIMIT ?, ?",
    TxListWithHash : "SELECT i.subnet_id, i.blk_num AS blk_num, i.sc_hash, c.contract, i.db_key FROM info AS i, contents AS c WHERE i.db_key = c.db_key AND i.sc_hash LIKE ",
    TxListWithBlkNum : "SELECT i.subnet_id, i.blk_num AS blk_num, i.sc_hash, c.contract FROM info AS i, contents AS c WHERE (i.db_key = c.db_key) AND blk_num = ?",
    getDBKeyWithFromAndKind : "SELECT db_key FROM contract WHERE from_pk = ? AND kind = ? ORDER BY revision DESC LIMIT 1",
    TxInfoWithBlknum : "SELECT i.subnet_id, i.blk_num AS blk_num, c.contract, i.sc_hash FROM info AS i, contents AS c WHERE i.db_key = c.db_key AND i.sc_hash = ?",
    TxInfoUsingDBKey : "SELECT i.subnet_id, i.blk_num AS blk_num, c.contract, i.sc_hash FROM info AS i, contents AS c WHERE i.db_key = c.db_key AND i.db_key = ?",
    TotalSCCnt : "SELECT count(*) AS cnt from contents"
}

module.exports.nodeQuerys = {
    nodeInfoDBkey : "SELECT DISTINCT(l.db_key) FROM contents AS c, ledgers AS l WHERE (c.db_key = l.db_key) AND l.kind IN ",
    nodeInfoContract : "SELECT contract FROM contents WHERE db_key = ?"
}

module.exports.init = async () => {
    const connection = await mysql.createConnection(config.maria_db_config);
    let res;
    let sql;

    try {
        // CREATE DATABASE;
        sql = "CREATE DATABASE IF NOT EXISTS `sc`";
        await connection.query(sql);

        sql = "CREATE DATABASE IF NOT EXISTS `block`";
        await connection.query(sql);

        sql = "CREATE DATABASE IF NOT EXISTS `account`";
        await connection.query(sql);

        createTableAccount();
        res = await createShard();
        if(!ret_msg.res) {
            console.log("shard fail");
            return;
        }
        console.log("shard success");
        
    } catch (err) {
        res = { res : false, reason : err };
    }

    await connection.end();
    return res;
}