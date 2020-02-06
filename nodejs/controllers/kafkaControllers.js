const db = require("../src/DBUtil.js");
const util = require("../src/CommonUtil.js");
const config = require("../conf/config.js");
const define = require("../conf/define.js");

const getTopicName = async (pubkey) => {
    const account_conn = await db.connection(config.account_db_config);
    console.log(pubkey);
    try {
        let sql = db.accountQuerys.getTopicName;
        [query_result] = await account_conn.query(sql, [pubkey]);
        
        if(query_result[0] === undefined) 
            return false;

        let status = query_result[0].status;
        let topic = query_result[0].topic;

        await account_conn.release();

        if(topic !== undefined && status === define.USER_STATUS.LOGIN)
            return topic;
        else 
            return false;
    } catch (err) {
        await account_conn.release();
        return false;
    }
}

const getBrokerListFromDB = async (topic) => {
    const sc_conn = await db.connection(config.sc_db_config);

    try {
        let sql = db.accountQuerys.getBrokerContract;
        const is_pubkey = config.getISPubkey();
        [query_result] = await sc_conn.query(sql, [is_pubkey, define.CONTRACT_KIND.ADD_KAFKA]);

        if(query_result[0] === undefined) 
        {
            console.log("No Data of kafka topic list");

            await sc_conn.end();
            return;
        }

        let contract = JSON.parse(query_result[0].contract.slice(1, query_result[0].contract.length - 1));
        let brokerList;

        await util.asyncForEach(contract.Note, async (element, index) => {
            if(element.Kind === define.CONTRACT_KIND.ADD_KAFKA)
            {
                if(element.Content.TopicList.includes(topic))
                {
                    brokerList = element.Content.BrokerList;
                }
            }
        });
        
        await sc_conn.release();
        return brokerList;
    } catch (err) {
        await sc_conn.release();
        console.log(err);
    }
}

exports.getBrokerList = async (req, res) => {
    const request = req.query;
    let topic = await getTopicName(request.pubkey);
    let ret_msg;

    if(topic) 
    {
        let brokerlist = await getBrokerListFromDB(topic);
        if(brokerlist)
        {
            ret_msg = {
                errorCode : 0,
                contents : {
                    broker_list : brokerlist,
                    topic_name : topic,
                    timestamp : new Date().getTime()
                }
            }
        }
        else {
            ret_msg = {
                errorCode : 3000,
                contents : {
                    msg : "No have brokerlsit",
                    timestamp : new Date().getTime()
                }
            }
        }
    }
    else 
    {
        ret_msg = {
            errorCode : 3001,
            contents : {
                msg : "Not Login"
            }
        }
    }
    res.send(ret_msg);
}