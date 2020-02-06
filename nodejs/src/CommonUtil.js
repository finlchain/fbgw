const define = require("./../conf/define.js");
const Nodegeocoder = require('node-geocoder');
const geocoder = Nodegeocoder({provider: 'openstreetmap', language:'en'});
const groupBy = require('json-groupby');

module.exports.Padding = (data, len, delimiter) => {
    if(delimiter === define.PADDING_DELIMITER.FRONT) {
        while(data.length < len) {
            data = "0" + data;
            if(data.length == len) break;
            else continue;
        }
    } else if(delimiter === define.PADDING_DELIMITER.BACK) {
        while(data.length < len) {
            data = data + "0";
            if(data.length == len) break;
            else continue;
        }
    }
    return data;
}

module.exports.isObject = (obj) => {
    return (!!obj) && (obj.constructor === Object);
}

module.exports.asyncForEach = async (array, callback) => {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

module.exports.REGEX = {
    HEX_STR_REGEX : /^[a-fA-F0-9]+$/,
    HASH_REGEX : /^[a-z0-9+]{5,65}$/
}

module.exports.BytesToBuffer = (bytes) => {
    var buff = Buffer.alloc(bytes.byteLength);
    var view = new Uint8Array(bytes);
    
    for(var i = 0; i < buff.length; i++) {
        buff[i] = view[i];
    }
    return buff;
}

const geocoderReverseCB = (latitude, longitude) => {
    return new Promise((resolve, reject) => {
        geocoder.reverse({ lat: latitude, lon: longitude })
            .then((res) => {
                resolve(res);
            })
            .catch((err) => {
                reject(err);
            });
    });
}

const geocoderReverse = async (latitude, longitude) => {
    let res = await geocoderReverseCB(latitude, longitude);
    let object = {
        country: res[0].countryCode,
        city: res[0].city
    }
    return object;
}

module.exports.int2ipLast = (ipInt) => {
    let ip = "***.***.***.";
    ip += (ipInt & 255).toString(); 
    return ip
}

module.exports.ip2int = (ip) => {
    return ip.split('.').reduce(function(ipInt, octet) { return (ipInt << 8) + parseInt(octet, 10)}, 0) >>> 0;
}

module.exports.p2pAddr2geo = async (p2pAddr) => {
    let geoValue = p2pAddr.substr(2, 8);
    
    let lat_float = parseInt(geoValue.substr(2, 2), 16);
    lat_float = lat_float > 10 ? lat_float : "0" + lat_float; 
    let lat = [parseInt(geoValue.substr(0, 2), 16), lat_float];

    let lon_float = parseInt(geoValue.substr(6, 2), 16);
    lon_float = lon_float > 10 ? lon_float : "0" + lon_float;
    let lon = [parseInt(geoValue.substr(4, 2), 16), lon_float];

    let geo = await geocoderReverse(lat.join('.'), lon.join('.'));

    return geo.country + " " + geo.city;
}

module.exports.ArrayGroupBy = (json_arr, key_arr, col_arr) => {
    return groupBy(json_arr, key_arr, col_arr);
}

module.exports.nodeInfo_json2array = (json_data) => {
    var result = [];

    for(var key in json_data){
        if(json_data.hasOwnProperty(key)) {
            result.push({subnet : key, nodes : json_data[key]});
        }
    }

    return result;
}