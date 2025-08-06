import { createCanvas, Image, loadImage, SKRSContext2D } from "@napi-rs/canvas";
import fs from "fs";
import { Summary } from "../ai/prompts/summary";
import { registerFont } from "canvas";
import path from "path";
//@ts-ignore
import emojiUnicode from "emoji-unicode";
import { config } from "../configuration";
import {
  getDateTitleIntervalString,
  getTimeIntervalString,
} from "../utils/date";
import { logger } from "../utils/logger";

type Emojis = Record<string, Image | undefined>;

const rootDir = path.resolve(path.dirname(__filename), "..", "..");
const imagesDir = path.join(rootDir, "images");

export enum Cluster {
  "Политика" = "techno",
  "Экономика" = "techno",
  "Крипта" = "techno",
  "Технологии" = "techno",
  "Отношения" = "techno",
  "Наука и космос" = "techno",
  "AI и нейросети" = "techno",
}

registerFont(
  path.join(rootDir, "fonts", "unbounded", "static",  "Unbounded-Bold.ttf"),
  {family: 'Unbounded', weight: '800'}
);

registerFont(
  path.join(rootDir, "fonts", "unbounded", "static", "Unbounded-Regular.ttf"),
  { family: "Unbounded", weight: "400" }
);

export type RenderPostImageProps = {
  cluster: Cluster;
  summary: Array<Omit<Summary, "id" | "summary_detailed">>;
  fromDate: Date;
  toDate: Date;
};

function loadEmojis(emojis: string[]): Promise<Emojis> {
  return Promise.all(
    emojis.map((emoji) => {
      const emojiPath = path.join(
        imagesDir,
        "apple-emoji",
        `${emojiUnicode(emoji).replaceAll(" ", "-").toLowerCase()}.png`
      );
      return loadImage(emojiPath)
        .then((img) => [emoji, img])
        .catch((reason) => {
          logger.error("Could not load emoji: %s %s", emoji, emojiPath, reason);
          // console.error(`"Could not load emoji: ${emoji} ${emojiPath}`, reason);
          return [emoji, undefined];
        });
    })
  ).then((emojis) => Object.fromEntries(emojis));
}

function loadBackground({
  summary,
  cluster,
}: Omit<RenderPostImageProps, "fromDate" | "toDate">) {
  const longestText = summary.reduce(
    (max, info) =>
      max.length > info.summary_short.length ? max : info.summary_short,
    ""
  );
  const canvas = createCanvas(2000, 100);
  const ctx = canvas.getContext("2d");
  ctx.font = "500 36px Inter";

  const textMetrics = ctx.measureText(longestText);
  const textWidth =
    textMetrics.actualBoundingBoxLeft + textMetrics.actualBoundingBoxRight;

  let imageWidth = 1100;
  if (textWidth > 1200) {
    imageWidth = 1700;
  } else if (textWidth > 1100) {
    imageWidth = 1600;
  } else if (textWidth > 1000) {
    imageWidth = 1500;
  } else if (textWidth > 900) {
    imageWidth = 1400;
  } else if (textWidth > 800) {
    imageWidth = 1300;
  } else if (textWidth > 700) {
    imageWidth = 1200;
  }
  const backgroundDir = path.join(
    imagesDir,
    "backgrounds",
    "glass" /*config.backgroundType*/,
    `${cluster}-${imageWidth}.png`
  );
  console.log("Loading background: " + backgroundDir);
  return loadImage(backgroundDir);
}
function drawTitle(
  ctx: SKRSContext2D,
  { fromDate, toDate, summary }: Omit<RenderPostImageProps, "cluster" | "">
) {
  const timeY = 200;
  const X = 94;
  const mainY = 300;

  ctx.fillStyle = "#1d1d1dff";
  ctx.font = "40px Unbounded";
  ctx.fillText(getTimeIntervalString(fromDate, toDate), X, timeY);

  ctx.font = "800 64px Unbounded";
  ctx.fillText(
    `Главное за ${getDateTitleIntervalString(fromDate, toDate)}`,
    X,
    mainY
  );
}

function drawSummary(
  ctx: SKRSContext2D,
  summary: RenderPostImageProps["summary"],
  emojis: Emojis
) {
  const startY = 376;
  const startYemoji = 368;
  const xEmoji = 94;
  const xTitle = 160;

  const incrementY = 100;
  ctx.fillStyle = "#1d1d1dff";
  ctx.font = "500 36px Inter";

  const imageHeight = 52;

  for (let i = 0; i < summary.length; i++) {
    const emoji = emojis[summary[i].emoji];
    const title = summary[i].summary_short;

    if (emoji) {
      ctx.drawImage(
        emoji,
        xEmoji,
        startYemoji + incrementY * i,
        imageHeight,
        imageHeight
      );
    }

    ctx.fillText(title, xTitle, startY + 34 + incrementY * i);
  }
}

export function renderPostImage({
  cluster,
  summary,
  fromDate,
  toDate,
}: RenderPostImageProps) {
  return loadBackground({ cluster, summary }).then((background) =>
    loadEmojis(summary.map(({ emoji }) => emoji))
      .then((emojis) => ({ background, emojis }))
      .then((images) => {
        const canvas = createCanvas(
          images.background.width,
          images.background.height
        );

        const ctx = canvas.getContext("2d");

        ctx.drawImage(images.background, 0, 0);

        drawTitle(ctx, { summary, fromDate, toDate });

        drawSummary(ctx, summary, images.emojis);

        return canvas.toBuffer("image/png");
      })
  );
}

const photoFilesDir = path.join(rootDir, "db", "photo");

export function writePhotoFile(
  photo: Buffer<ArrayBuffer>,
  name: string
): string {
  if (!fs.existsSync(photoFilesDir)) {
    fs.mkdirSync(photoFilesDir, { recursive: true });
  }
  const file = path.join(photoFilesDir, name);
  fs.writeFileSync(file, photo);
  return file;
}

export function clearPhotoDir() {
  try {
    if (!fs.existsSync(photoFilesDir)) {
      fs.mkdirSync(photoFilesDir, { recursive: true });
      return;
    }
    const files = fs.readdirSync(photoFilesDir);

    for (const file of files) {
      const filePath = path.join(photoFilesDir, file);
      const stats = fs.statSync(filePath);

      if (stats.isFile()) {
        fs.unlinkSync(filePath);
      } else if (stats.isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      }
    }
    logger.info(`Directory '${photoFilesDir}' cleared successfully.`);
  } catch (err) {
    logger.error(`Error clearing directory '${photoFilesDir}':`, err);
  }
}

// renderPostImage({
//   cluster: Cluster.Технологии,
//   summary: [
//     {
//       emoji: "🇵🇱",
//       summary_short: "Польша укрепит т армию и защиту восточного фланга НАТО",
//     },
//     {
//       emoji: "🏛",
//       summary_short:
//         "Доверие депутатов к Зеленскому пошатнулось из-за манипуляций при голосовании",
//     },
//     {
//       emoji: "🔒",
//       summary_short: "Профессора РЭУ арестовали по обвинению в госизмене",
//     },
//     {
//       emoji: "🤝",
//       summary_short:
//         "Кремль опубликовал кадры встречи Путина с спецпредставителем США",
//     },
//     {
//       emoji: "🇺🇳",
//       summary_short:
//         "СБ ООН обсуждал украинский конфликт с участием РФ, США и Китая",
//     },
//   ],
//   toDate: new Date(),
//   fromDate: new Date(),
// })
//   .then((imageBuffer) => fs.promises.writeFile(`./techno.png`, imageBuffer))
//   .then(
//     (result) => console.log("Successfully wrote image"),
//     (reason) => console.error("Error", reason)
//   );
