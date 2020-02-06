const db = require("../src/DBUtil");
const util = require("../src/CommonUtil.js");
const config = require("../conf/config.js");
const define = require("../conf/define.js");

exports.nodeList = async (req, res) => {
    const request = req.query;
    const len = parseInt(request.length);
    const startIdx = parseInt(request.start);

    let nodeObjMap = new Map();
    let p2pAddrArray = new Array();
    
    if(startIdx === undefined || len === undefined) {
        res.send(404);
        return;
    }

    const sc_connection = await db.connection(config.sc_db_config);
    let ret_msg;

    try {
        let sql = db.nodeQuerys.nodeInfoDBkey;
        sql += `(${define.CONTRACT_KIND.ADD_HW}, ${define.CONTRACT_KIND.CHANGE_HW_ID}, ${define.CONTRACT_KIND.CHANGE_HW_PUB_KEY}, ${define.CONTRACT_KIND.CHANGE_HW_SN})`;
        [query_result] = await sc_connection.query(sql);
        
        sql = db.nodeQuerys.nodeInfoContract;
        await util.asyncForEach(query_result, async (element, index) => {
            [query_result] = await sc_connection.query(sql, [element.db_key]);  
            const contract_json = JSON.parse(JSON.stringify(query_result[0].contract.substr(1, query_result[0].contract.length - 2)));         
            const contract = JSON.parse(contract_json); 
            
            await util.asyncForEach(contract.Note, async(note_element, index) => {
                if(note_element.Kind === define.CONTRACT_KIND.ADD_HW)
                {
                    let ip = util.int2ipLast(note_element.Content.IP);
                    let p2p_addr = note_element.Content.P2P_Address;
                    p2pAddrArray.push( { addr : p2p_addr.substr(2, 12), node_role : parseInt(p2p_addr.substr(14, 4)), pubkey : note_element.Content.PublicKey } );
                    let region = await util.p2pAddr2geo(p2p_addr);

                    let pubkey = note_element.Content.PublicKey;
                    let node_object = {
                        ID : note_element.Content.ID,
                        PublicKey : note_element.Content.PublicKey,
                        HW_SN : note_element.Content.HWSN,
                        IP : ip,
                        Region : region
                    }
                    nodeObjMap.set(pubkey, node_object);
                }
                else if(note_element.Kind === define.CONTRACT_KIND.CHANGE_HW_ID) 
                {
                    let pubkey = note_element.Content.PublicKey;
                    let node_object = nodeObjMap.get(pubkey);
                    note_object.ID = note_element.Content.ID;
                    nodeObjMap.delete(pubkey);
                    nodeObjMap.set(pubkey, node_object);
                }
                else if(note_element.Kind === define.CONTRACT_KIND.CHANGE_HW_PUB_KEY)
                {
                    let node_object = nodeObjMap.get(contract.From);
                    node_object.PublicKey = note_element.Content.PublicKey;
                    nodeObjMap.delete(contract.From);
                    nodeObjMap.set(note_element.Content.PublicKey, note_object);

                    p2pSubnetMap.set(contract.From, note_element.Content.PublicKey);
                }
                else if(note_element.Kind === define.CONTRACT_KIND.CHANGE_HW_SN)
                {
                    let pubkey = note_element.Content.PublicKey;
                    let node_object = nodeObjMap.get(pubkey);
                    note_object.HW_SN = note_element.Content.HWSN;
                    nodeObjMap.delete(pubkey);
                    nodeObjMap.set(pubkey, node_object);                    
                }
            });
        });

        let group_json = await util.ArrayGroupBy(p2pAddrArray, ['addr'], ['node_role', 'pubkey']);
        let group_arr = util.nodeInfo_json2array(group_json);

        await util.asyncForEach(group_arr, (element, index) => {
            const subnet = parseInt(element.subnet.substr(8, 4), 16);
            
            for(var i = 0; i < element.nodes.node_role.length; i++) 
            {
                let nodeObj = nodeObjMap.get(element.nodes.pubkey[i]);
                nodeObjMap.delete(element.nodes.pubkey[i]);

                nodeObj.subnet = subnet;
                if(element.nodes.node_role[i] === define.NODE_ROLE.n_NN) 
                {
                    nodeObj.Role = define.NODE_ROLE.s_NN;
                }
                else if(element.nodes.node_role[i] === define.NODE_ROLE.n_CN) 
                {
                    nodeObj.Role = define.NODE_ROLE.s_CN;
                }
                else if(element.nodes.node_role[i] === define.NODE_ROLE.n_DBN) 
                {
                    nodeObj.Role = define.NODE_ROLE.s_DBN;
                }

                nodeObjMap.set(element.nodes.pubkey[i], nodeObj);
            }
        });

        let node_list_arr = new Array();
        node_list_arr = Array.from(nodeObjMap.values());

        ret_msg = { errorCode : 0, contents : { nodelist : node_list_arr.slice(startIdx, len) }, data : node_list_arr.slice(startIdx, len), recordsTotal : node_list_arr.length, recordsFiltered : node_list_arr.length };

        sc_connection.release();
        res.send(ret_msg);
        return;

    } catch (err) {

        sc_connection.release();
        res.send(404);
        return;
    }
}

module.exports.nodeNum = async (req, res) => {
    const sc_connection = await db.connection(config.sc_db_config);
    let ret_msg;
    let node_num = 0;

    try {
        let sql = db.nodeQuerys.nodeInfoDBkey;
        sql += `(${define.CONTRACT_KIND.ADD_HW})`;
        [query_result] = await sc_connection.query(sql);

        sql = db.nodeQuerys.nodeInfoContract;
        await util.asyncForEach(query_result, async (element, index) => {
            [query_result] = await sc_connection.query(sql, [element.db_key]);
            const contract_json = JSON.parse(JSON.stringify(query_result[0].contract.substr(1, query_result[0].contract.length - 2)));
            const contract = JSON.parse(contract_json);

            await util.asyncForEach(contract.Note, async(note_element, index) => {
                if(note_element.Kind === define.CONTRACT_KIND.ADD_HW) node_num++;
            });
        });

        ret_msg = { errorCode : 0, contents : { nodeNum : node_num }};

        sc_connection.release();
        res.send(ret_msg);
        return;
    } catch (err) {

        sc_connection.release();
        res.send(404);
        return;
    }
}