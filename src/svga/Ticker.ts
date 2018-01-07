
class Ticker {
    private owner: any = undefined;
    private running: boolean = false;

    constructor(owner: any) {
        this.owner = owner
    }

    public start() {
        if(this.running) { return; }
        this.running = true
        let requestFrame = () => {
            egret.startTick((timeStamp: number): boolean => {
                this.owner._onTick();
                if (this.running === true) {
                    requestFrame();
                }
//TODO: I don't know the boolean return for what?
                return false
            }, this);
        }
        requestFrame();
    }

    public stop() {
        this.running = false
    }
}