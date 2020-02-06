const config = require("./../conf/config.js");
const define = require("./../conf/define.js");
const util = require("./CommonUtil.js");

const fs = require('fs');
const pemreader = require('crypto-key-composer');
const { createECDH, ECDH } = require('crypto');

const PEMReadPublicKey = async (path) => {
    let pemRead = await pemreader.decomposePublicKey(fs.readFileSync(path));
    return pemRead;
}

module.exports.ISpubkeySet = async () => {
    let pubkey = await PEMReadPublicKey(config.ISPubkeyPathConfig.is_pubkey_path);

    if(config.dsa_type === define.DSA_TYPE.EDDSA)
    {
        let publickey = await util.BytesToBuffer(pubkey.keyData.bytes);
        publickey = define.KEY_DELIMITER.ED25519 + publickey.toString('hex');
        return publickey;
    }
    else if(config.dsa_type === define.DSA_TYPE.ECDSA)
    {
        const ec_point_x = await util.BytesToBuffer(pubkey.keyData.x).toString('hex');
        const ec_point_y = await util.BytesToBuffer(pubkey.keyData.y).toString('hex');

        const uncompressedpubkey = define.KEY_DELIMITER.SECP256_UNCOMPRESSED_DELIMITER + ec_point_x + ec_point_y;
        const publicKey = await ECDH.convertKey(uncompressedpubkey, "prime256v1", "hex", "hex", "compressed");
        return publicKey;
    }
}