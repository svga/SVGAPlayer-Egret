
class VideoEntity {

    /**
     * SVGA 文件版本
     */
    version: string

    /**
     * 影片尺寸
     */
    videoSize = {width: 0, height: 0}
    /**
     * 帧率
     */
    FPS: number

    /**
     * 帧数
     */
    frames: number

    /**
     * Bitmaps
     */
    images: Object

    /**
     * SpriteEntity[]
     */
    sprites: Array<any>

    constructor(spec: any, images: any){
        this.videoSize.width = spec.params.viewBoxWidth || 0.0;
        this.videoSize.height = spec.params.viewBoxHeight || 0.0;
    }
}