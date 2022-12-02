const { default: axios } = require("axios");
const FormData = require('form-data');
const fs = require('fs');
const { exit } = require("process");
const forge = require("node-forge");

const serverID = process.env.PLEX_SERVER_ID;
const token = process.env.PLEX_SERVER_TOKEN;
const endDir = "./";

const plexHeaders = {
    "Accept": "*\/*",
    "accept-encoding": "gzip",
    "x-plex-token": token,
    'x-plex-client-identifier': serverID,
    "x-plex-provides": "server",
    "x-plex-version": "1.25.2.5319-c43dc0277",
    "user-agent": "PlexMediaServer/1.25.2.5319-c43dc0277"
}

console.log('Generating 2048-bit key-pair...');
let keys = forge.pki.rsa.generateKeyPair(2048);
console.log('Key-pair created.');

axios.get(`https://plex.tv/api/v2/devices/${serverID}/certificate/subject`, {
    headers: plexHeaders
}).then((resp) => {
    let commonName = resp.data.split("commonName=\"")[1].split("\"")[0];
    console.log(`Required common name: ${commonName}`);

    console.log('Creating CSR ...');
    let csr = forge.pki.createCertificationRequest();
    csr.publicKey = keys.publicKey;

    csr.setSubject([{
        name: 'commonName',
        valueTagClass: forge.asn1.Type.UTF8,
        value: commonName
    }]);

    csr.sign(keys.privateKey);
    console.log('CSR signed');

    const formData = new FormData();
    formData.append('file', forge.pki.certificationRequestToPem(csr));
    //console.log(forge.pki.certificationRequestToPem(csr));
    
    axios.put(`https://plex.tv/api/v2/devices/${serverID}/certificate/csr?reason=missing&invalidIn=0`, formData, {
        headers: { ...plexHeaders, ...formData.getHeaders()}
    }).then((csrPostResp) => {
        if(csrPostResp.status == 204) {
            console.log(`CSR uploaded for ${commonName}.`);

            //do loop waiting for cert
            const dlInterval = setInterval(() => {
                axios.get(`https://plex.tv/api/v2/devices/${serverID}/certificate/download`, {
                    headers: plexHeaders
                }).then((certDownloadResp) => {
                    if(certDownloadResp.status == 200) {
                        clearInterval(dlInterval);
                        fs.writeFileSync(`${endDir}/fullchain.pem`, certDownloadResp.data.toString());
                        fs.writeFileSync(`${endDir}/privkey.pem`, forge.pki.privateKeyToPem(keys.privateKey));
                        console.log(`Certificate downloaded`);
                    } else {
                        console.log(`Certificate not ready yet (${certDownloadResp.status})`);
                    }
                }).catch((err) => {
                    console.log(`Download returned error`, err.response);
                })
            }, 3000);
        }
    }).catch((err) => {
        console.log("Error uploading cert", err);
    })
})