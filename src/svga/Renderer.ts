
class Renderer {
    private owner: any = undefined;
    private prepared: boolean = false;
    private undrawFrame: any = undefined;
    private bitmapCache: any = undefined;

    constructor(owner: any){
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
            for (var imageKey in this.owner.videoItem.images) {
                let src = this.owner.videoItem.images[imageKey]
                if (src.indexOf("iVBO") === 0 || src.indexOf("/9j/2w") === 0) {
                    totalCount++;

                    let imgTag: HTMLImageElement = new Image;
                    imgTag.onload = () => {   //图片加载完成事件（只有加载完成才能转换）
                        imgTag.onload = null;
                        loadedCount++;
                        if (loadedCount == totalCount) {
                            this.prepared = true
                            if (typeof this.undrawFrame === "number") {
                                this.drawFrame(this.undrawFrame);
                                this.undrawFrame = undefined;
                            }
                        }
                    }
                    imgTag.src = 'data:image/png;base64,' + src
                    this.bitmapCache[imageKey] = imgTag


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
            this.prepared = true
        }
    }

    public clear() {

    }

    public drawFrame(frame: any) {
        if (this.prepared) {
            // const ctx = (this.owner._drawingCanvas || this.owner._container).getContext('2d')
            // const areaFrame = {
            //     x: 0.0,
            //     y: 0.0,
            //     width: (this.owner._drawingCanvas || this._owner._container).width,
            //     height: (this._owner._drawingCanvas || this._owner._container).height,
            // }
            // ctx.clearRect(areaFrame.x, areaFrame.y, areaFrame.width, areaFrame.height)
            this.owner.videoItem.sprites.forEach(sprite => {
                let frameItem = sprite.frames[this.owner.currentFrame]
                if (frameItem.alpha < 0.05) {
                    return
                }
// 
                let src = this.bitmapCache[sprite.imageKey] || this.owner.videoItem.images[sprite.imageKey]
                let myBmp:egret.Bitmap = new egret.Bitmap(<any>src)
                console.log(myBmp)

            })
        }
        else {
            this.undrawFrame = frame;
        }
    }


}