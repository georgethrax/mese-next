'use strict';

var verify = require('./util.verify');
var access = require('./server.access');
var game = require('./rtmese.game');
var manager = require('./rtmese.manager');

module.exports = function (socket, session) {
    socket.on('rtmese_join', function (args) {
        // args: game, uid

        if (
            !verify.str(/^[A-Za-z0-9_ ]+$/)(args.game)
            || !verify.int()(args.uid)
        ) {
            session.log('bad socket request');

            return;
        }

        session.log('join game ' + args.game);

        access.game(
            'rtmese', args.game,
            function (uid, players, gameData) {
                var print = function (gameObj, player, playing) {
                    game.print(
                        gameObj, player,
                        function (report) {
                            report.game = args.game;
                            report.uid = uid;
                            report.players = players;
                            report.playing = playing;

                            socket.emit('rtmese_report_player', report);
                        },
                        function (report) {
                            report.game = args.game;
                            report.uid = uid;
                            report.players = players;
                            report.playing = playing;

                            socket.emit('rtmese_report_public', report);
                        }
                    );
                };

                var player = -1;

                for (var i in players) {
                    if (players[i] === session.user) {
                        player = parseInt(i, 10);
                        break;
                    }
                }

                manager.get(
                    args.game,
                    function (gameObj) {
                        if (player >= 0) {
                            if (session.rtmese_free !== undefined) {
                                session.rtmese_free();
                            }
                            session.rtmese_free = function () {
                                delete gameObj['check_' + player];
                                delete gameObj['delay_' + player];
                                delete gameObj['report_' + player];
                            };

                            gameObj['check_' + player] = function (name) {
                                return name === players[player];
                            };

                            gameObj['delay_' + player] = function () {
                                socket.emit('rtmese_report_delay', gameObj.delay);
                            };

                            gameObj['report_' + player] = function (playing) {
                                print(gameObj, player, playing);
                            };
                        }

                        print(gameObj, player, true);
                    },
                    function () {
                        if (uid === args.uid) {
                            return;
                        }

                        print(JSON.parse(gameData), player, false);
                    }
                );
            },
            function () {
                session.log('game not found ' + args.game);

                socket.emit('rtmese_join_fail_game');
            },
            function (type) {
                session.log('wrong game type ' + args.game);

                socket.emit('rtmese_join_fail_type', type);
            }
        );
    });

    socket.on('rtmese_submit', function (args) {
        // args: game, price, prod_rate, mk, ci, rd

        if (
            session.user === undefined
            || !verify.str(/^[A-Za-z0-9_ ]+$/)(args.game)
            || !verify.num()(args.price)
            || !verify.num()(args.prod_rate)
            || !verify.num()(args.mk)
            || !verify.num()(args.ci)
            || !verify.num()(args.rd)
        ) {
            session.log('bad socket request');

            return;
        }

        session.log('submit ' + args.game);

        manager.get(
            args.game,
            function (gameObj) {
                var player = -1;

                for (var i = 0; i < gameObj.player_count; i += 1) {
                    if (gameObj['check_' + i] !== undefined) {
                        if (gameObj['check_' + i](session.user)) {
                            player = i;
                            break;
                        }
                    }
                }

                if (player >= 0) {
                    game.submit(
                        gameObj, player,
                        args.price, args.prod_rate, args.mk, args.ci, args.rd
                    );

                    // socket.emit('rtmese_submit_ok');
                } else {
                    session.log('submission not allowed ' + args.game);

                    socket.emit('rtmese_submit_fail_player');
                }
            },
            function () {
                session.log('game is not running ' + args.game);

                socket.emit('rtmese_submit_fail_running');
            }
        );
    });

    socket.on('disconnect', function () { // notice: an extra hook
        if (session.rtmese_free !== undefined) {
            session.rtmese_free();
        }
    });
};
