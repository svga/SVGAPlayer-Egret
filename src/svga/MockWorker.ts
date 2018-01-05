
class MockWorker {

    success: any
    failure: any

    public loadAssets(url: string, success: any, failure: any) {
        this.success = success
        this.failure = failure

//TODO: Determine whether the current environment can resolve svga1.0 files
        if(false){
            
        }else{
            const req = new egret.HttpRequest()
            req.open(url, egret.HttpMethod.GET)
            req.responseType = egret.HttpResponseType.ARRAY_BUFFER
            req.send()
            req.addEventListener(egret.Event.COMPLETE, this.onGetComplete, this)
        }
    }

    private onGetComplete(event: egret.Event): void {
        var request = <egret.HttpRequest>event.currentTarget
        this.load_viaProto(request.response, this.success, this.failure)
    }

    private load_viaProto(arraybuffer: any, success: any, failure: any) {
        try {
            let inflate = new Zlib.Inflate(new Uint8Array(arraybuffer))
            let movieData = ProtoBufDecoder.shareProtoBufDecoder().decode(inflate.decompress())
            let images = {};

            this.loadImages(images, undefined, movieData, success)

        } catch (error) {
            this.failure && this.failure(error)
            console.log(error)
            throw error
        }

    }

    private loadImages(images: any, zip: any, movieData: any, success: any) {
        if(true){

            for(let key in movieData.images){
                let element = movieData.images[key];
                let value = this.Uint8ToString(element)
                images[key] = btoa(value)
            }
        }

        success({
            movie: movieData,
            images
        })
    }

    private Uint8ToString(u8a: any){
        var CHUNK_SZ = 0x8000;
        var c = [];
        for (var i = 0; i < u8a.length; i += CHUNK_SZ) {
            c.push(String.fromCharCode.apply(null, u8a.subarray(i, i + CHUNK_SZ)));
        }
        return c.join("");
    }
}