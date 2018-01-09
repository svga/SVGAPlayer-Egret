
class Renderer {
    private owner: any = undefined;
    private prepared: boolean = false;
    private undrawFrame: any = undefined;
    private bitmapCache: {} = undefined;

    constructor(owner: any) {
        this.owner = owner
    }

    public prepare() {
        this.prepared = false
        this.bitmapCache = undefined;
        let bitmapKey: Array<string> = Object.keys(this.owner.videoItem.images)
        if (this.owner.videoItem.images === undefined || bitmapKey.length == 0) {
            this.bitmapCache = {};
            this.prepared = true;
            return;
        }
        if (this.bitmapCache === undefined) {
            this.bitmapCache = {}
            let totalCount = 0
            let loadedCount = 0
            for (let imageKey in this.owner.videoItem.images) {
                let src = this.owner.videoItem.images[imageKey]
                if (src.indexOf("iVBO") === 0 || src.indexOf("/9j/2w") === 0) {
                    totalCount++;

                    // let imgTag: HTMLImageElement = new Image;
                    // imgTag.onload = () => {
                    //     imgTag.onload = null;
                    //     loadedCount++;
                    //     if (loadedCount == totalCount) {
                    //         this.prepared = true
                    //         if (typeof this.undrawFrame === "number") {
                    //             this.drawFrame(this.undrawFrame);
                    //             this.undrawFrame = undefined;
                    //         }
                    //     }
                    // }
                    // imgTag.src = 'data:image/png;base64,' + src
                    // this.bitmapCache[imageKey] = imgTag

                    let bitmapData: egret.BitmapData = egret.BitmapData.create("base64", src, (base64_bitmapdata) => {
                        loadedCount++

                        let texture = new egret.Texture()
                        texture.bitmapData = base64_bitmapdata
                        let bitmap: egret.Bitmap = new egret.Bitmap(texture)
                        bitmap.name = imageKey
                        this.owner.addChild(bitmap)

                        if (loadedCount == totalCount) {
                            this.prepared = true
                            if (typeof this.undrawFrame === "number") {
                                this.drawFrame(this.undrawFrame);
                                this.undrawFrame = undefined;
                            }
                        }  
                    })

                    // let imgTag = document.createElement('img');
                    // imgTag.onload = function () {
                    //     loadedCount++;
                    //     if (loadedCount == totalCount) {
                    //         this.prepared = true
                    //         if (typeof this._undrawFrame === "number") {
                    //             this.drawFrame(this._undrawFrame);
                    //             this._undrawFrame = undefined;
                    //         }
                    //     }
                    // }.bind(this);
                    // imgTag.src = 'data:image/png;base64,' + src;
                }
            }
        }
    }

    public clear() {
        this.owner.removeChildren()
    }

    public drawFrame(frame: any) {

        if (this.prepared) {

            this.owner.videoItem.sprites.forEach(sprite => {
                let frameItem: FrameEntity = sprite.frames[this.owner.currentFrame]
                let bitmap = this.owner.getChildByName(sprite.imageKey)
                bitmap.matrix = new egret.Matrix(frameItem.transform.a, frameItem.transform.b, frameItem.transform.c, frameItem.transform.d, frameItem.transform.tx, frameItem.transform.ty)
                bitmap.alpha = frameItem.alpha
            })
        }
        else {
            this.undrawFrame = frame;
        }
    }
}