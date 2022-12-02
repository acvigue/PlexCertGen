const { default: axios } = require("axios");
const FormData = require('form-data');
const fs = require('fs');
const { exit } = require("process");

const serverID = process.env.PLEX_SERVER_ID;
const token = process.env.PLEX_SERVER_TOKEN;
const endDir = "/config";
var commonName = "";

const plexHeaders = {
    "Accept": "*\/*",
    "accept-encoding": "gzip",
    "x-plex-token": token,
    'x-plex-client-identifier': serverID,
    "x-plex-provides": "server",
    "x-plex-version": "1.25.2.5319-c43dc0277",
    "user-agent": "PlexMediaServer/1.25.2.5319-c43dc0277"
}

axios.get(`https://plex.tv/api/v2/devices/${serverID}/certificate/subject`, {
    headers: plexHeaders
}).then((resp) => {
    commonName = resp.data.split("commonName=\"")[1].split("\"")[0];

    const spawn = require('child_process').spawn;
    const child = spawn('/usr/bin/openssl', ['req','-nodes','-newkey','rsa:2048','-keyout',`privkey.pem`,'-out',`req.csr`]);

    child.stderr.on('data', (data) => {
        console.log(data.toString());
        if(data.indexOf("Country Name") != -1) {
            child.stdin.write("\n");
        }
        if(data.indexOf("State or Province Name") != -1) {
            child.stdin.write("\n");
        }
        if(data.indexOf("Locality Name") != -1) {
            child.stdin.write("\n");
        }
        if(data.indexOf("Common Name") != -1) {
            child.stdin.write(`${commonName}\n`);
        }
        if(data.indexOf("Organizational Unit Name") != -1) {
            child.stdin.write(`\n`);
        }
        if(data.indexOf("Organization Name") != -1) {
            child.stdin.write(`\n`);
        }
        if(data.indexOf("Email Address") != -1) {
            child.stdin.write(`\n`);
        }
        if(data.indexOf("A challenge password") != -1) {
            child.stdin.write(`\n`);
        }
        if(data.indexOf("An optional company name") != -1) {
            child.stdin.write(`\n`);
        }
    });

    child.on('close', (code) => {
        console.log(`CSR generated for ${commonName}: ${code}`);
        const formData = new FormData();
        formData.append('file', fs.createReadStream(`./req.csr`));
        axios.put(`https://plex.tv/api/v2/devices/${serverID}/certificate/csr?reason=missing&invalidIn=0`, formData, {
            headers: Object.assign(plexHeaders, formData.getHeaders())
        }).then((csrPostResp) => {
            if(csrPostResp.status == 204) {
                console.log(`CSR uploaded for ${commonName}.`);

                //do loop waiting for cert
                setTimeout(() => {
                    const dlInterval = setInterval(() => {
                        axios.get(`https://plex.tv/api/v2/devices/${serverID}/certificate/download`, {
                            headers: plexHeaders
                        }).then((certDownloadResp) => {
                            if(certDownloadResp.status == 200) {
                                clearInterval(dlInterval);
                                fs.writeFileSync(`${endDir}/fullchain.pem`, certDownloadResp.data.toString());
                                fs.copyFileSync("./privkey.pem", `${endDir}/privkey.pem`);
                                fs.unlinkSync("./req.csr");
                                console.log(`Certificate downloaded`);
                            } else {
                                console.log(`Certificate for ${commonName} not ready yet (${certDownloadResp.status})`);
                            }
                        })
                    }, 3000);
                }, 15000);
            }
        }).catch((err) => {
            console.log("Error uploading cert", err);
            exit;
        })
    });
})