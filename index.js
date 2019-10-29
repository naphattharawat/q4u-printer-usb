const escpos = require('escpos');
const moment = require('moment');
const mqtt = require('mqtt');
const fse = require('fs-extra');
const fs = require('fs');
const _ = require('lodash');



var notifyServer;
var notifyUser;
var notifyPassword;
var CLIENT;
var printers;
log('########### Q4U PRINTER NETWORK ###########');


fse.readJson('./config.json')
    .then(json => {
        printers = json.printer;
        notifyServer = json.notify.notifyServer
        notifyUser = json.notify.notifyUser;
        notifyPassword = json.notify.notifyPassword;
        if (notifyServer && notifyUser && notifyPassword && printers.length) {
            start();
        } else {
            log(`[ERROR] Config file failed.`);
        }
    }).catch(err => {
        log(err);
    })



function log(text, log = true) {
    var _text = `${moment().format('HH:mm:ss')} - ${text}`;
    fs.appendFileSync('./log.log', `${_text}\n`);
    if (!log) {
        fs.appendFileSync('./error_log.log', `${_text}\n`);
    }
    console.log(_text);
}


function printTest() {
    const device = new escpos.USB();
    const printer = new escpos.Printer(device);
    log(`Print test....`);


    device.open(function () {
        var dateTime = moment().locale('th').format('DD MMM YYYY HH:mm:ss');

        printer
            .model('qrprinter')
            .align('ct')
            .encode('tis620')
            .size(2, 1)
            .text('โรงพยาบาลทดสอบ')
            .text('ตรวจโรคทั่วไป')
            .text('')
            .size(1, 1)
            .text('ลำดับที่')
            .size(3, 3)
            .text('50009')
            .size(1, 1)
            .text('ผู้สูงอายุ')
            .qrimage('xxxx#9BE33IBFU#100010#01#50004#4#20190116#0012#ตรวจโรคทั่วไป', {
                type: 'png',
                mode: 'dhdw',
                size: 3
            }, function (err) {
                this.text('จำนวนที่รอ 5 คิว')
                this.text('วันที่ ' + dateTime)
                this.text('**********************')
                this.text('สแกน QR CODE ผ่านแอปพลิเคชัน H4U')
                this.text('')
                this.encode('GB18030')
                this.text('HN')
                this.barcode('0041223', 'CODE39', "CODE128")
                this.text('')
                this.cut()
                this.close();
            })

    });
}



function start() {
    for (const p of printers) {
        if (p.printerId && notifyServer) {
            const TOPIC = `/printer/${p.printerId}`;
            CLIENT = mqtt.connect('mqtt://' + notifyServer, {
                username: notifyUser,
                password: notifyPassword
            });

            CLIENT.on('connect', function () {
                CLIENT.subscribe(TOPIC, function (err) {
                    if (!err) {
                        log(`[MQTT] Connect Success.`);
                    } else {
                        log(`[MQTT] Connect Failed. ${err}`, false);
                        CLIENT.end();
                    }
                })
            });

            CLIENT.on('message', function (topic, message) {
                var message = message.toString();
                if (message) {
                    var _topic = topic.substr(9, topic.length - 9)
                    var idx = _.findIndex(printers, { 'printerId': _topic });
                    if (idx > -1) {
                        try {
                            var json = JSON.parse(message);
                            var queue = json;
                            if (queue) {
                                printQueue(queue);
                            } else {
                                log(`[ERROR] Queue not found.`, false);
                            }
                        } catch (error) {
                            log(`[ERROR] Can't receive message.`, false);
                        }
                    } else {
                        log(`[ERROR] Invalid topic.`, false);
                    }
                }
            });

            CLIENT.on('close', function () {
                log(`[ERROR] Connection closed.`, false)
            });

            CLIENT.on('error', function () {
                log(`[ERROR] Connection error.`, false)
            });

            CLIENT.on('offline', function () {
                log(`[ERROR] Connection offline.`, false)
            });

        } else {
            log('[ERROR] เกิดข้อผิดพลาด กรุณาระบุ Printer ID', false);
        }
    }
}

async function printQueue(queue) {
    try {
        const device = new escpos.USB();
        if (device) {
            const printer = new escpos.Printer(device);
            if (queue) {
                const printSmallQueue = queue.printSmallQueue || 'N';
                const hosname = queue.hosname;
                const queueNumber = queue.queueNumber;
                const servicePointName = queue.servicePointName;
                const remainQueue = queue.remainQueue || 0;
                const priorityName = queue.priorityName;
                const qrcode = queue.qrcode;
                const queueInterview = queue.queueInterview;
                const hn = queue.hn;
                const firstName = queue.firstName;
                const lastName = queue.lastName;

                const dateTime = moment().locale('th').format('DD MMM YYYY HH:mm:ss');

                device.open(function () {

                    printer
                        .model('qrprinter')
                        .align('ct')
                        .encode('tis620');

                    if (printSmallQueue === 'Y') {
                        printer
                            .size(2, 1)
                            .text(hosname)
                            .text('')
                            .text(servicePointName)
                            .text('')
                            .size(1, 1)
                            .text('ลำดับที่')
                            .text('')
                            .size(3, 3)
                            .text(queueNumber)
                            .size(2, 1)
                            .text('')
                            .text('HN ' + hn)
                            .size(1, 1)
                            .text(firstName + ' ' + lastName)
                            .text('')
                            .cut()
                    }

                    printer
                        .size(2, 1)
                        .text(hosname)
                        .text(servicePointName)
                        .text('')
                        .size(1, 1)
                        .text('ลำดับที่')
                        .text('')
                        .size(3, 3)
                        .text(queueNumber)
                        // .text('')
                        // .size(1, 1)
                        // .text('คิวซักประวัติ')
                        // .size(2, 2)
                        // .text(queueInterview)
                        .size(1, 1)
                        .text('')
                        .text(priorityName)
                        .qrimage(qrcode, {
                            type: 'png',
                            mode: 'dhdw',
                            size: 2
                        }, function (err) {
                            this.text(`จำนวนที่รอ ${remainQueue} คิว`)
                            this.text('วันที่ ' + dateTime)
                            this.text('**********************')
                            this.text('สแกน QR CODE ผ่านแอปพลิเคชัน H4U')
                            this.text('')
                            // this.encode('GB18030')
                            // this.text('HN')
                            // this.barcode(hn, 'CODE39', "CODE128")
                            // this.text('')
                            this.cut()
                            this.close();
                        })

                });
                log(`[PRINT] Success print queue number ${queueNumber}.`, false)
            } else {
                log(`[PRINT] Queue number ${queueNumber} not found.`, false)
            }

        } else {
            log(`[PRINT] Connect printer failed (${printerIp}).`, false);
        }
    } catch (error) {
        log(`[PRINT] Error.`, false)
    }
}

// function stop() {
//     log(` Stopping...`;
//     

//     try {
//         CLIENT.unsubscribe(TOPIC);
//         CLIENT.end();
//     } catch (error) {
//         log(` STOP ERROR: ${error.message}`;
//         
//     }
// }

// init();
