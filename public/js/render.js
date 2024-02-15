// Immediately-invoked function expression (IIFE)
// To be able to use top level async
(async () => {
    const SERVER_URL = 'http://localhost:9094'
    const SOCKET_URL = `${SERVER_URL}/hybrid-scanner`
    const SCANNER_ID = '64f02eca86af2653bc482fbd'

    const socket = io(SOCKET_URL, {
        query: {
            scannerId: SCANNER_ID,
            room: `scanner-${SCANNER_ID}`
        }
    });

    // Database
    const db = new Dexie("HRISDesktopScanner")

    db.version(1).stores({
        logs: '++id, uid, unix',
    });
    db.open().catch(function (e) {
        console.error("Open failed: " + e.stack);
    })

    // db.logs.get(1).then((item) => {
    //     if(item){
    //         console.log(item, moment.unix(item.unix))
    //     }
    // }).catch((err) => {
    //     console.error(err)
    // })

    // let date1 = moment('2023-09-15')
    // let date2 = moment('2023-09-15')
    // db.logs.where('unix').between(
    //     date1.startOf('day').unix(),
    //     date2.endOf('day').unix(),
    // ).toArray().then((items) => {
    //     if(items){
    //         console.log(items)
    //     }
    // }).catch((err) => {
    //     console.error(err)
    // })

    let enumerateDaysBetweenDates = (startDate, endDate) => {
        let now = startDate.clone(), dates = [];
        let currentDate = moment();

        while (now.isSameOrBefore(endDate)) {
            dates.push({
                isToday: currentDate.isSame(now, 'day'),
                weekDay: now.format('ddd'),
                day: now.format('D'),
            });
            now.add(1, 'days');
        }
        return dates;
    }

    let returnTimer = null
    let voices = []
    const IS_NUMERIC = (n) => {
        return !isNaN(parseFloat(n)) && isFinite(n);
    }
    const getAttendancesByDate = (key) => {
        let attendances = localStorage.getItem(key)
        if (attendances) {
            attendances = JSON.parse(attendances)
        }
        if (!attendances) {
            attendances = []
        }
        return attendances
    }

    const loadingScreen = () => {
        anime({
            targets: '#loader-pixels .pixel',
            loop: true,
            scale: .70,
            direction: 'alternate',
            delay: anime.stagger(100) // increase delay by 100ms for each elements.
        });
        let tl = anime.timeline({
            easing: 'easeOutCubic',
            duration: 800,
            loop: true,
        });
        tl.add({
            targets: '#loader-pixels .text',
            translateY: 10,
        })
        tl.add({
            targets: '#loader-pixels .text',
            translateY: 0,
        })
    }

    const checkIfAuthenticated = (me) => {
        fetch(`${SERVER_URL}/api/app/jwt/decode`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'Authorization': localStorage.getItem('jwtX')
            }
        }).then(async function (response) {
            if (response.ok) {
                return response.json();
            }
            throw new Error(await response.text())
        }).then(function (responseJson) {
            me.loggedIn = true
        }).catch(async function (error) {
            // console.error(error)
            me.loggedIn = false
        }).then(function () {
            me.pending = false
        });
    }

    const SPEAKER = window.speechSynthesis || null;
    const loadVoices = (me) => {
        // Voices
        let voiceChecker = setInterval(function () {
            if (voices.length <= 0) {
                if (SPEAKER) {
                    voices = SPEAKER?.getVoices() || []
                }
            } else {
                clearInterval(voiceChecker)
                me.voicesReady = true;
            }
        }, 300)
    }
    let vApp = new Vue({
        el: '#vApp',
        delimiters: ["${", "}"],
        mixins: [],
        data: {
            scannerId: SCANNER_ID,
            status: 'offline',
            pending: true,

            loggedIn: false,
            loginError: '',
            username: 'hybrid.scanner.1',
            password: 'adminadmin',

            duplicate: false,
            page: 0,
            code: '',
            photo: '',
            profilePhoto: '',
            error: '',
            errorCountdown: '',
            name: '',
            returnCountdown: 0,
            voicesReady: false,

            time: '',
            clock: '',
            date: '',
            rotate: 0,
            rotateM: 0,
            rotateH: 0,
            weekDays: [],

            log0: '',
            log1: '',
            log2: '',
            log3: '',
            logIndex: 0,

        },
        mounted: function () {
            let me = this
            loadingScreen()
            checkIfAuthenticated(me)
            loadVoices(me)

            document.getElementById("code")?.focus();

            let startingTime = moment().tz('Asia/Manila').startOf('day');
            let tick = function () {
                let now = moment().tz('Asia/Manila')
                me.clock = now.clone().format('h:mm A');
                me.date = now.format('MMMM');
                let seconds = parseInt(now.diff(startingTime, 'seconds'));

                let rotate = Math.round(seconds / 60 * 360 - 90)
                let rotateM = Math.round(seconds / 60 / 60 * 360 - 90)
                let rotateH = Math.round(seconds / 60 / 60 / 12 * 360 - 90)

                // console.log(seconds, 'seconds')
                // console.log(minutes, 'minutes')
                // console.log(hours, rotateH, 'hours')

                anime({
                    targets: '.arm-second',
                    rotate: rotate
                });
                anime({
                    targets: '.arm-minute',
                    rotate: rotateM
                });
                anime({
                    targets: '.arm-hour',
                    rotate: rotateH
                });
            }
            tick();
            setInterval(tick, 500);

            let slowTick = function () {
                let now = moment().tz('Asia/Manila');
                let startDate = now.clone().startOf('week');
                let endDate = now.clone().endOf('week');
                me.weekDays = enumerateDaysBetweenDates(startDate, endDate);
            }
            slowTick();
            setInterval(slowTick, 10000);

            // client-side
            socket.on("connect", () => {
                me.status = 'online'
                console.log('connected ', socket.id); // x8WIv7-mJelg7on_ALbx
            });

            socket.on("disconnect", () => {
                me.status = 'offline'
                // console.log('disconnected ', socket.id); // undefined
            });

            socket.on("connect_error", (err) => {
                if (err.message == 'Duplicate scanner.') {
                    me.duplicate = true
                    alert(err.message)
                }
                console.error(`Connection Error: ` + err.message);
            });

            socket.on("refresh", async (scannerId) => {
                console.log('REFRESH in 10 seconds');
                await new Promise(resolve => setTimeout(resolve, 10000))
                socket.emit('refreshed', scannerId)
                window.location.reload(false);
            });

            socket.on("sendscanstoserver", async (args, callback) => {
                try {
                    // console.log('sendscanstoserver')
                    if (me.scannerId === args.scannerId) {
                        let momentDate = moment(args.date)
                        // let key = momentDate.format('YYYY-MM-DD')
                        // let scans = localStorage.getItem(key) // Data type is string. Remember to use JSON.parse and stringify accordingly
                        // if (!scans) {
                        //     scans = '[]'
                        // }

                        console.log(moment().format('YYYY-MM-DD h:mmA'), ': Scanner ' + args.scannerName + ' is sending scans to the server...')
                        // socket.timeout(10000).emitWithAck('scansfromclient', {
                        //     scannerId: me.scannerId,
                        //     date: key,
                        //     scans: scans
                        // }, (r, rr) => {
                        //     console.log(r, rr)
                        // })

                        let date1 = momentDate.clone()
                        let date2 = momentDate.clone()
                        db.logs.where('unix').between(
                            date1.startOf('day').unix(),
                            date2.endOf('day').unix(),
                        ).toArray().then((scans) => {
                            if (scans) {
                                // console.log(scans)
                                callback({
                                    scannerId: me.scannerId,
                                    date: momentDate.format('YYYY-MM-DD'),
                                    scans: scans
                                })
                                console.log('Scans sent.')
                            }
                        }).catch((err) => {
                            callback(err.message)
                            console.error(err)
                        })

                    }
                } catch (err) {
                    callback(err.message)
                    console.error(err)
                }
            });


            // Test vars
            me.code = '0534747031'

            let key = '2024-02-01'
            let attendances = getAttendancesByDate(key)
            let attendance = attendances.find(a => a.uid === me.code)
            if (!attendance) {
                attendance = {
                    uid: me.code,
                    logs: []
                }
                attendances.push(attendance)
            }
            attendance.logs = ['08:00AM', '12:00PM']
            localStorage.setItem(key, JSON.stringify(attendances))
        },
        watch: {
            page: function (newPage, oldPage) {
                const me = this;
                jQuery('#carousel-scan').carousel(newPage)

                if (newPage === 0) {
                    me.reset();
                }
            }
        },
        methods: {
            getJwt: function () {
                return localStorage.getItem('jwtX')
            },
            logMeIn: function () {
                let me = this;
                me.pending = true;
                // console.log('aaa')
                fetch(`${SERVER_URL}/api/login`, {
                    method: 'POST',
                    body: JSON.stringify({
                        username: me.username,
                        password: me.password,
                    }),
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                }).then(async function (response) {
                    if (response.ok) {
                        return response.json();
                    }
                    throw new Error(await response.text())

                }).then(function (responseJson) {
                    let data = responseJson
                    console.log(data)
                    me.loggedIn = true
                    localStorage.setItem('jwtX', data.jwt)
                }).catch(async function (error) {
                    // alert(error)
                    me.loginError = error

                }).then(function () {
                    me.pending = false
                });
            },
            reset: function () {
                let me = this;

                me.page = 0;
                me.code = '';
                me.photo = '';
                me.profilePhoto = '';
                me.time = '';
                me.name = '';

                if (returnTimer) {
                    clearInterval(returnTimer);
                }
            },
            hambal: function (words) {
                try {
                    if (this.voicesReady) {
                        let utterThis = new SpeechSynthesisUtterance(words);
                        const ZIRA = voices.find(v => {
                            return v.name.includes('Microsoft Zira')
                        });
                        if (ZIRA) {
                            utterThis.voice = ZIRA
                        }
                        utterThis.pitch = 1;
                        utterThis.rate = 1;
                        SPEAKER.cancel(); // Stop talking
                        SPEAKER.speak(utterThis);
                    }
                } catch (err) {
                    console.error(err)
                }
            },
            returnBalik: function (delay) {
                let me = this;
                if (returnTimer) {
                    clearInterval(returnTimer);
                }
                me.returnCountdown = delay;
                returnTimer = setInterval(function () {
                    me.returnCountdown -= 1;
                    if (me.returnCountdown <= 0) {
                        clearInterval(returnTimer);
                        me.page = 0;
                    }
                }, 1000)
            },
            focus: function () {
                // setTimeout(function () {
                //     document.getElementById("code")?.focus();
                // }, 10);
            },
            onSubmit: function () {
                const me = this;
                try {
                    let code = _.get(me, 'code', '')
                    code = _.trim(code)
                    if (!code || me.pending) {
                        return
                    }

                    // No tap on error, wait for timer
                    if (me.page === 2) {
                        return
                    }

                    if (code.length !== 10 || !IS_NUMERIC(code)) {
                        throw new Error('Invalid ID Number.')
                    }

                    // Rapid tap
                    if (me.page === 1) {
                        me.page = 0
                        return
                    }

                    document.getElementById("code").focus();
                    document.getElementById("code").select();

                    if (me.status === 'online') {
                        me.logOnline()

                    } else {
                        me.log()

                    }
                } catch (err) {
                    // console.error(err);
                    me.hambal(err.message)
                    me.page = 2;
                    me.error = err.message;
                    me.returnBalik(7);
                }
            },
            log: function () {
                const me = this;

                try {
                    me.pending = true

                    // 1. Get system time
                    let momentNow = moment()
                    // let momentNow = moment().month(8).date(1)
                    const key = momentNow.format('YYYY-MM-DD')

                    // 2. Get database
                    let attendances = localStorage.getItem(key)
                    if (attendances) {
                        attendances = JSON.parse(attendances)
                    }
                    if (!attendances) {
                        attendances = []
                    }
                    let attendance = attendances.find(a => a.uid === me.code)
                    if (!attendance) {
                        attendance = {
                            uid: me.code,
                            logs: []
                        }
                        attendances.push(attendance)
                    }

                    if (attendance.logs.length >= 4) {
                        throw new Error('Max logs already.')
                    }

                    // Throttle to avoid double scan
                    let lastLog = attendance.logs.at(-1)
                    const waitTime = 15
                    let diff = momentNow.diff(moment(lastLog, 'hh:mmA'), 'minutes')
                    if (diff < waitTime) {
                        let timeUnit = 'minute'
                        if (waitTime - diff > 1) {
                            timeUnit = 'minutes'
                        }
                        // throw new Error(`You have just logged. Please wait ${waitTime - diff} ${timeUnit} and try again later.`)
                    }
                    attendance.logs.push(momentNow.format('hh:mmA'))


                    let newItem = {
                        uid: me.code,
                        unix: momentNow.unix(),
                        date: momentNow.format('YYYY-MM-DD'),
                        time: momentNow.format('hh:mmA')
                    }

                    db.logs.add(newItem).then(() => {
                        console.log('indexedDb added', newItem)
                    }).catch(err => {
                        console.error(err)
                    })

                    me.log0 = _.get(attendance, 'logs[0]')
                    me.log1 = _.get(attendance, 'logs[1]')
                    me.log2 = _.get(attendance, 'logs[2]')
                    me.log3 = _.get(attendance, 'logs[3]')
                    me.logIndex = _.get(attendance, 'logs.length', 0)

                    localStorage.setItem(key, JSON.stringify(attendances))

                    // Greet
                    let momentLogTime = momentNow.clone()
                    me.time = momentLogTime.clone().format('hh:mm A');

                    let morning = momentLogTime.clone().format('A') === 'AM' ? true : false;
                    let afternoon = momentLogTime.clone().format('A') === 'PM' ? true : false;
                    let evening = momentLogTime.clone().hours() >= 18 ? true : false;

                    let message = [];
                    if (morning) {
                        message.push('Good morning!');
                    } else if (evening) {
                        message.push('Good evening!');
                    } else if (afternoon) {
                        message.push('Good afternoon!');
                    }
                    message.push('Your time is')
                    message.push(momentLogTime.clone().format('hh:mm A') + '.')
                    me.hambal(message.join(' '))

                    // Balik
                    me.page = 1
                    me.code = ''
                    me.returnBalik(10)

                } catch (err) {
                    // console.error(err);
                    me.hambal(err.message)
                    me.page = 2;
                    me.error = err.message;
                    me.returnBalik(7);
                } finally {
                    // always executed
                    me.pending = false;
                }
            },
            logOnline: function () {
                const me = this

                fetch(`http://localhost:9094/api/scanner/${me.scannerId}/log`, {
                    method: 'POST',
                    body: JSON.stringify({
                        code: me.code,
                    }),
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                }).then(async function (response) {
                    if (response.ok) {
                        return response.json();
                    }
                    throw new Error(await response.text())

                }).then(function (responseJson) {
                    let data = responseJson
                    console.log(responseJson)

                    let log = _.get(data, 'log')
                    me.log0 = _.get(data, 'logs.log0')
                    me.log1 = _.get(data, 'logs.log1')
                    me.log2 = _.get(data, 'logs.log2')
                    me.log3 = _.get(data, 'logs.log3')
                    me.logIndex = _.get(data, 'logIndex')

                    let gender = _.get(data, 'employee.gender')
                    let firstName = _.get(data, 'employee.firstName')
                    let lastName = _.trim(_.get(data, 'employee.lastName'))

                    let speechSynthesisName = _.get(data, 'employee.speechSynthesisName', '');
                    speechSynthesisName = speechSynthesisName ? speechSynthesisName : firstName;
                    speechSynthesisName = speechSynthesisName.replace(/^Ma\./i, '');
                    let profilePhoto = _.get(data, 'employee.profilePhoto');

                    if (log) {
                        let momentLogTime = moment(log.dateTime)
                        me.time = momentLogTime.clone().format('hh:mm A');
                        me.name = firstName + ' ' + lastName;
                        me.profilePhoto = profilePhoto;

                        let morning = momentLogTime.clone().format('A') === 'AM' ? true : false;
                        let afternoon = momentLogTime.clone().format('A') === 'PM' ? true : false;
                        let evening = momentLogTime.clone().hours() >= 18 ? true : false;

                        let message = [];


                        if (morning) {
                            message.push('Good morning');
                        } else if (evening) {
                            message.push('Good evening');
                        } else if (afternoon) {
                            message.push('Good afternoon');
                        }



                        if (gender === 'M') {
                            message.push('Sir');
                        } else if (gender === 'F') {
                            message.push('Maam');
                        }

                        message.push(speechSynthesisName + '!')
                        message.push('Your time is')
                        message.push(momentLogTime.clone().format('hh:mm A') + '.')


                        me.hambal(message.join(' '))
                    }
                    // Balik
                    me.page = 1
                    me.code = ''
                    me.returnBalik(10)


                }).catch(async function (error) {
                    me.hambal(error)
                    me.page = 2;
                    me.error = error;
                    me.returnBalik(7);

                }).then(function () {
                    me.pending = false
                });
            }
        }
    });

    // This is electron renderer.js
    window.electronAPI.onDataFromMain((_event, value) => {
        if (value === 'logout') {
            localStorage.removeItem('jwtX')
            vApp.loggedIn = false
        }
    })

})()