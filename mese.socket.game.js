'use strict';

var util = require('./mese.util');
var access = require('./mese.access');
var game = require('./mese.game');

module.exports = function (socket, session) {
    socket.on('report', function (args) {
        // args: game, period, uid

        if (
            !util.verifierStr(/^[A-Za-z0-9_ ]+$/)(args.game)
            || !util.verifyNum(args.uid)
        ) {
            session.log('bad socket request');

            return;
        }

        session.log('get report ' + args.game);

        access.game(
            args.game,
            function (uid, players, gameData) {
                if (uid == args.uid) {
                    return;
                }

                var player = undefined;

                for (var i in players) {
                    if (players[i] === session.user) {
                        player = parseInt(i);
                        break;
                    }
                }

                game.print(
                    gameData, player,
                    function (report) {
                        report.game = args.game;
                        report.uid = uid;
                        report.players = players;

                        socket.emit('report_player', report);
                    },
                    function (report) {
                        report.game = args.game;
                        report.uid = uid;
                        report.players = players;

                        socket.emit('report_public', report);
                    }
                );
            },
            function () {
                session.log('game not found ' + args.game);

                socket.emit('report_fail');
            }
        );
    });

    socket.on('submit', function (args) {
        // args: game, period, price, prod, mk, ci, rd

        if (
            session.user === undefined
            || !util.verifierStr(/^[A-Za-z0-9_ ]+$/)(args.game)
            || !util.verifyInt(args.period)
            || !util.verifyNum(args.price)
            || !util.verifyInt(args.prod)
            || !util.verifyNum(args.mk)
            || !util.verifyNum(args.ci)
            || !util.verifyNum(args.rd)
        ) {
            session.log('bad socket request');

            return;
        }

        session.log('submit ' + args.game);

        access.gameAction(
            args.game,
            function (players, oldData, setter, next) {
                var player = undefined;

                for (var i in players) {
                    if (players[i] === session.user) {
                        player = parseInt(i);
                        break;
                    }
                }

                if (player !== undefined) {
                    game.submit(
                        oldData, player, args.period,
                        args.price, args.prod, args.mk, args.ci, args.rd,
                        function (accepted, closed, gameData) {
                            if (accepted) {
                                if (closed) {
                                    session.log('submission accepted and peroid closed');
                                } else {
                                    session.log('submission accepted');
                                }

                                setter(undefined, gameData, function () {
                                    // TODO: push updates?
                                });

                                socket.emit('submit_ok');
                            } else {
                                session.log('submission declined ' + args.game);

                                next(); // manually finish

                                socket.emit('submit_decline');
                            }
                        },
                        function (report) {
                            socket.emit('report_early', report);
                        }
                    );

                    return true; // need setter() or next()
                } else {
                    session.log('submission not allowed ' + args.game);

                    socket.emit('submit_fail_player');
                }
            },
            function (setter) {
                session.log('game not found ' + args.game);

                socket.emit('submit_fail_game');
            }
        );
    });
};
