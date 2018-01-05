
class SpriteEntity {

    imageKey:string = null
    frames: Array<FrameEntity> = []

    constructor(spec: any){
        this.imageKey = spec.imageKey
        if(spec.frames) {
            this.frames = spec.frames.map((obj) => {
                return new FrameEntity(obj)
            })
        }
    }
}