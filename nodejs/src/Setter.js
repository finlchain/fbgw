const config = require("./../conf/config.js");
const keyUtil = require("./KeyUtil.js");

const keySet = async () => {
    const pubkey = await keyUtil.ISpubkeySet();
    config.setISPubkey(pubkey);
}

module.exports.init = async () => {
    await keySet();
}