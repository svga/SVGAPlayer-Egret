
class VideoEntity {

    /**
     * SVGA 文件版本
     */
    version: string = ""

    /**
     * 影片尺寸
     */
    videoSize = {width: 0, height: 0}
    /**
     * 帧率
     */
    FPS: number = 20

    /**
     * 帧数
     */
    frames: number = 0

    /**
     * Bitmaps
     */
    images: Object = {}

    /**
     * SpriteEntity[]
     */
    sprites: Array<any> = []

    constructor(spec: any, images: any){

        if (typeof spec === "object" && spec.$type == ProtoBufDecoder.shareProtoBufDecoder().protoMovieEntity) {
            if (typeof spec.params === "object") {
                this.version = spec.ver;
                this.videoSize.width = spec.params.viewBoxWidth || 0.0;
                this.videoSize.height = spec.params.viewBoxHeight || 0.0;
                this.FPS = spec.params.fps || 20;
                this.frames = spec.params.frames || 0;
            }
            this.resetSprites(spec)
        }

        if(images){
            this.images = images
        }
    }
    private resetSprites(spec: any) {
        if(spec.sprites instanceof Array){
            this.sprites = spec.sprites.map((obj) => {
                return new SpriteEntity(obj)
            })
        }
    }
}