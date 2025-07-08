import { createCanvas, loadImage } from "@napi-rs/canvas";
import fs from "fs";


loadImage('src/images/kitty.jpg').then(image => {
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(image, 0, 0);

    ctx.fillStyle = 'rgba(255,255,255, 0.6)';

    ctx.beginPath();
    ctx.roundRect(50, 400, image.width - 100, 200, 25);
    ctx.closePath();
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'black';
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.clip();
    ctx.filter = 'blur(5px)';

    ctx.drawImage(image, 0, 0);

    ctx.filter = 'none';
    ctx.restore();

    ctx.save();
    ctx.fill();
    ctx.restore();

    ctx.font = '30px Impact';
    const text = 'Классная киска!';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillText(text, 100, 450);
    
    fs.writeFileSync('dist/canvas.png', canvas.toBuffer('image/png'));
});