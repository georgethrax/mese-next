'use strict';

define('loader', function (require, module) {
    module.exports.defaultGame = undefined;
    module.exports.loadGame = undefined;

    // load from url hash
    var loadHash = function () {
        var urlHash = window.location.hash.slice(1);
        if (urlHash !== '') {
            module.exports.loadGame(urlHash);
        }
    };
    $(loadHash);
    $(window).on('hashchange', loadHash);

    module.exports.jump = function () {
        //
    };
});
