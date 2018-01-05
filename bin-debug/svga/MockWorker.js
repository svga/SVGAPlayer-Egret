var __reflect = (this && this.__reflect) || function (p, c, t) {
    p.__class__ = c, t ? t.push(c) : t = [c], p.__types__ = p.__types__ ? t.concat(p.__types__) : t;
};
var MockWorker = (function () {
    function MockWorker() {
    }
    MockWorker.prototype.loadAssets = function (url, success, failure) {
        this.success = success;
        this.failure = failure;
        if (false) {
        }
        else {
            var req = new egret.HttpRequest();
            req.open(url, egret.HttpMethod.GET);
            req.responseType = egret.HttpResponseType.ARRAY_BUFFER;
            req.send();
            req.addEventListener(egret.Event.COMPLETE, this.onGetComplete, this);
        }
    };
    MockWorker.prototype.onGetComplete = function (event) {
        var request = event.currentTarget;
        this.load_viaProto(request.response, this.success, this.failure);
    };
    MockWorker.prototype.load_viaProto = function (arraybuffer, success, failure) {
        try {
            var protoBufDecoder = new ProtoBufDecoder();
            var inflate = new Zlib.Inflate(new Uint8Array(arraybuffer));
            var movieData = protoBufDecoder.decode(inflate.decompress());
            var images = {};
            this.loadImages(images, undefined, movieData, success);
        }
        catch (error) {
            this.failure && this.failure(error);
            console.log(error);
            throw error;
        }
    };
    MockWorker.prototype.loadImages = function (images, zip, movieData, success) {
        if (true) {
            for (var key in movieData.images) {
                var element = movieData.images[key];
                var value = this.Uint8ToString(element);
                images[key] = btoa(value);
            }
        }
        success({
            movie: movieData,
            images: images
        });
    };
    MockWorker.prototype.Uint8ToString = function (u8a) {
        var CHUNK_SZ = 0x8000;
        var c = [];
        for (var i = 0; i < u8a.length; i += CHUNK_SZ) {
            c.push(String.fromCharCode.apply(null, u8a.subarray(i, i + CHUNK_SZ)));
        }
        return c.join("");
    };
    return MockWorker;
}());
__reflect(MockWorker.prototype, "MockWorker");
//# sourceMappingURL=MockWorker.js.map