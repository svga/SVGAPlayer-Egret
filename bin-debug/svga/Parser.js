var __reflect = (this && this.__reflect) || function (p, c, t) {
    p.__class__ = c, t ? t.push(c) : t = [c], p.__types__ = p.__types__ ? t.concat(p.__types__) : t;
};
var Parser = (function () {
    function Parser() {
    }
    Parser.prototype.load = function (url, success, failure) {
        this.loadViaWorker(url, success, failure);
    };
    Parser.prototype.loadViaWorker = function (url, success, failure) {
        var mockWorker = new MockWorker();
        mockWorker.loadAssets(url, function (data) {
            var videoItem = new VideoEntity(data.movie, data.images);
            success(videoItem);
        }, failure);
    };
    return Parser;
}());
__reflect(Parser.prototype, "Parser");
//# sourceMappingURL=Parser.js.map