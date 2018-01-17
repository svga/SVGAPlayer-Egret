
class SVGAVectorLayer extends egret.Sprite {
    constructor(){
        super()
    }

    private drawBezier(obj: BezierPath) {

        if(obj == null) { return }

        this.graphics.clear()

        let currentPoint = { x: 0, y: 0, x1: 0, y1: 0, x2: 0, y2: 0 }
        this.graphics.beginFill(0x000000, 1)
        let d = obj._d.replace(/([a-zA-Z])/g, '|||$1 ').replace(/,/g, ' ');
        d.split('|||').forEach(segment => {
            if (segment.length == 0) { return; }
            const firstLetter = segment.substr(0, 1);
            if (Renderer.validMethods.indexOf(firstLetter) >= 0) {
                const args = segment.substr(1).trim().split(" ");
                this.drawBezierElement(this, currentPoint, firstLetter, args);
            }
        })
        if (obj._styles && obj._styles.fill) {
            // console.log("fill()")
        }
        if (obj._styles && obj._styles.stroke) {
            // console.log("stroke()")
        }

        this.graphics.endFill()
    }

    private drawBezierElement(shape, currentPoint, method, args) {
        switch (method) {
            case 'M':
                currentPoint.x = Number(args[0]);
                currentPoint.y = Number(args[1]);
                shape.graphics.moveTo(currentPoint.x, currentPoint.y);
                break;
            case 'm':
                currentPoint.x += Number(args[0]);
                currentPoint.y += Number(args[1]);
                shape.graphics.moveTo(currentPoint.x, currentPoint.y);
                break;
            case 'L':
                currentPoint.x = Number(args[0]);
                currentPoint.y = Number(args[1]);
                shape.graphics.lineTo(currentPoint.x, currentPoint.y);
                break;
            case 'l':
                currentPoint.x += Number(args[0]);
                currentPoint.y += Number(args[1]);
                shape.graphics.lineTo(currentPoint.x, currentPoint.y);
                break;
            case 'H':
                currentPoint.x = Number(args[0]);
                shape.graphics.lineTo(currentPoint.x, currentPoint.y);
                break;
            case 'h':
                currentPoint.x += Number(args[0]);
                shape.graphics.lineTo(currentPoint.x, currentPoint.y);
                break;
            case 'V':
                currentPoint.y = Number(args[0]);
                shape.graphics.lineTo(currentPoint.x, currentPoint.y);
                break;
            case 'v':
                currentPoint.y += Number(args[0]);
                shape.graphics.lineTo(currentPoint.x, currentPoint.y);
                break;
            case 'C':
                currentPoint.x1 = Number(args[0]);
                currentPoint.y1 = Number(args[1]);
                currentPoint.x2 = Number(args[2]);
                currentPoint.y2 = Number(args[3]);
                currentPoint.x = Number(args[4]);
                currentPoint.y = Number(args[5]);
                shape.graphics.bezierCurveTo(currentPoint.x1, currentPoint.y1, currentPoint.x2, currentPoint.y2, currentPoint.x, currentPoint.y);
                break;
            case 'c':
                currentPoint.x1 = currentPoint.x + Number(args[0]);
                currentPoint.y1 = currentPoint.y + Number(args[1]);
                currentPoint.x2 = currentPoint.x + Number(args[2]);
                currentPoint.y2 = currentPoint.y + Number(args[3]);
                currentPoint.x += Number(args[4]);
                currentPoint.y += Number(args[5]);
                shape.graphics.bezierCurveTo(currentPoint.x1, currentPoint.y1, currentPoint.x2, currentPoint.y2, currentPoint.x, currentPoint.y);
                break;
            case 'S':
                if (currentPoint.x1 && currentPoint.y1 && currentPoint.x2 && currentPoint.y2) {
                    currentPoint.x1 = currentPoint.x - currentPoint.x2 + currentPoint.x;
                    currentPoint.y1 = currentPoint.y - currentPoint.y2 + currentPoint.y;
                    currentPoint.x2 = Number(args[0]);
                    currentPoint.y2 = Number(args[1]);
                    currentPoint.x = Number(args[2]);
                    currentPoint.y = Number(args[3]);
                    shape.graphics.bezierCurveTo(currentPoint.x1, currentPoint.y1, currentPoint.x2, currentPoint.y2, currentPoint.x, currentPoint.y);
                } else {
                    currentPoint.x1 = Number(args[0]);
                    currentPoint.y1 = Number(args[1]);
                    currentPoint.x = Number(args[2]);
                    currentPoint.y = Number(args[3]);
                    shape.graphics.quadraticCurveTo(currentPoint.x1, currentPoint.y1, currentPoint.x, currentPoint.y);
                }
                break;
            case 's':
                if (currentPoint.x1 && currentPoint.y1 && currentPoint.x2 && currentPoint.y2) {
                    currentPoint.x1 = currentPoint.x - currentPoint.x2 + currentPoint.x;
                    currentPoint.y1 = currentPoint.y - currentPoint.y2 + currentPoint.y;
                    currentPoint.x2 = currentPoint.x + Number(args[0]);
                    currentPoint.y2 = currentPoint.y + Number(args[1]);
                    currentPoint.x += Number(args[2]);
                    currentPoint.y += Number(args[3]);
                    shape.graphics.bezierCurveTo(currentPoint.x1, currentPoint.y1, currentPoint.x2, currentPoint.y2, currentPoint.x, currentPoint.y);
                } else {
                    currentPoint.x1 = currentPoint.x + Number(args[0]);
                    currentPoint.y1 = currentPoint.y + Number(args[1]);
                    currentPoint.x += Number(args[2]);
                    currentPoint.y += Number(args[3]);
                    shape.graphics.quadraticCurveTo(currentPoint.x1, currentPoint.y1, currentPoint.x, currentPoint.y);
                }
                break;
            case 'Q':
                currentPoint.x1 = Number(args[0]);
                currentPoint.y1 = Number(args[1]);
                currentPoint.x = Number(args[2]);
                currentPoint.y = Number(args[3]);
                shape.graphics.quadraticCurveTo(currentPoint.x1, currentPoint.y1, currentPoint.x, currentPoint.y);
                break;
            case 'q':
                currentPoint.x1 = currentPoint.x + Number(args[0]);
                currentPoint.y1 = currentPoint.y + Number(args[1]);
                currentPoint.x += Number(args[2]);
                currentPoint.y += Number(args[3]);
                shape.graphics.quadraticCurveTo(currentPoint.x1, currentPoint.y1, currentPoint.x, currentPoint.y);
                break;
            case 'A':
                break;
            case 'a':
                break;
            case 'Z':
            case 'z':
                // shape.graphics.closePath();
                break;
            default:
                break;
        }
    }
}