import { createCanvas, Image, loadImage, SKRSContext2D } from "@napi-rs/canvas";
import fs from "fs";
import { Summary } from "../ai/prompts/summary";
import path from "path";
//@ts-ignore
import emojiUnicode from "emoji-unicode";
import { config } from "../configuration";
import {
  getDateTitleIntervalString,
  getTimeIntervalString,
} from "../utils/date";
import { logger } from "../utils/logger";

// const logger = {
//   info: (...args: any[]) => {
//     console.log(...args);
//   },
//   error: (...args: any[]) => {
//     console.error(...args);
//   },
// };
type Emojis = Record<string, Image | undefined>;

const rootDir = path.resolve(path.dirname(__filename), "..", "..");
const imagesDir = path.join(rootDir, "images");

const emojiData: { unified: string; non_qualified: string; image: string }[] =
  JSON.parse(
    fs
      .readFileSync(path.join(imagesDir, "apple-emoji", "emoji.json"))
      .toString("utf-8")
  );

export enum Cluster {
  "Политика" = "techno",
  "Экономика" = "techno",
  "Крипта" = "techno",
  "Технологии" = "techno",
  "Отношения и психология" = "techno",
  "Наука и космос" = "techno",
  "AI и нейросети" = "techno",
}

export type RenderPostImageProps = {
  cluster: Cluster;
  summary: Array<Omit<Summary, "id" | "summary_detailed" | "summary_tts">>;
  fromDate: Date;
  toDate: Date;
};

function loadEmojis(emojis: string[]): Promise<Emojis> {
  return Promise.all(
    emojis.map((emoji) => {
      const unicode = emojiUnicode(emoji).replaceAll(" ", "-").toUpperCase();
      const data = emojiData.find(
        (e) => (e.non_qualified ?? e.unified) === unicode
      );
      const imageName = data?.image ?? `${unicode.toLowerCase()}.png`;
      const emojiPath = path.join(imagesDir, "apple-emoji", imageName);
      return loadImage(emojiPath)
        .then((img) => [emoji, img])
        .catch((reason) => {
          logger.error("Could not load emoji: %s %s", emoji, emojiPath, reason);
          return [emoji, undefined];
        });
    })
  ).then((emojis) => Object.fromEntries(emojis));
}

function chooseBackgroundWidth({
  summary,
}: Omit<RenderPostImageProps, "fromDate" | "toDate" | "cluster">) {
  return 1100;

  const longestText = summary.reduce(
    (max, info) =>
      max.length > info.summary_short.length ? max : info.summary_short,
    ""
  );
  const canvas = createCanvas(2000, 100);
  const ctx = canvas.getContext("2d");
  ctx.font = "500 36px Inter";

  const textMetrics = ctx.measureText(longestText);
  const textWidth = textMetrics.width;

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
  return imageWidth;
}

function loadBackground({
  summary,
  cluster,
}: Omit<RenderPostImageProps, "fromDate" | "toDate">) {
  const imageWidth = chooseBackgroundWidth({ summary });
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
  { fromDate, toDate, summary }: Omit<RenderPostImageProps, "cluster" | "id">
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

function splitLine(
  line: string,
  splitLength: number,
  maxLines: number
): string[] {
  if (line.length <= splitLength) {
    return [line];
  }
  let lastLine = line;
  let lineNumber = 1;
  const result = [];

  while (lastLine.length > splitLength && lineNumber < maxLines) {
    let lastSpace = lastLine.lastIndexOf(" ", splitLength);
    const nextSpace = lastLine.lastIndexOf(" ", lastSpace - 1);
    if (lastSpace - nextSpace - 1 <= 3) {
      lastSpace = nextSpace;
    }
    result.push(lastLine.substring(0, lastSpace));
    lastLine = lastLine.substring(lastSpace + 1);
    lineNumber++;
  }
  result.push(lastLine);

  return result;
}

function drawSummary(
  ctx: SKRSContext2D,
  summary: RenderPostImageProps["summary"],
  emojis: Emojis
) {
  const startY = 360;
  const startYemoji = 360;
  const xEmoji = 94;
  const xTitle = 160;
  let incrementY = 100;
  let lineHeight = 42;
  const imageHeight = 42;

  ctx.fillStyle = "#1d1d1dff";
  ctx.font = "500 32px Inter";

  let splitLength = 44;
  let maxLines = 2;
  if (summary.length <= 2) {
    incrementY = 250;
    lineHeight = 60;
    ctx.font = "400 50px Inter";
    splitLength = 30;
    maxLines = 3;
  }

  for (let i = 0; i < summary.length; i++) {
    const emoji = emojis[summary[i].emoji];
    const title = splitLine(summary[i].summary_short, splitLength, maxLines);

    if (emoji) {
      ctx.drawImage(
        emoji,
        xEmoji,
        startYemoji + incrementY * i,
        imageHeight,
        imageHeight
      );
    }

    for (let j = 0; j < title.length; j++) {
      ctx.fillText(
        title[j],
        xTitle,
        startY + 34 + incrementY * i + lineHeight * j
      );
    }
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
  photo: Buffer<ArrayBufferLike>,
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

renderPostImage({
  cluster: Cluster.Технологии,
  summary: [
    {
      emoji: "🇵🇱",
      summary_short: "Польша укрепит армию и защиту восточного фланга НАТО",
    },
    {
      emoji: "🏛",
      summary_short:
        "Доверие депутатов к Зеленскому пошатнулось из-за манипуляций при голосовании",
    },
    {
      emoji: "🔒",
      summary_short: "Профессора РЭУ арестовали по обвинению в госизмене",
    },
    {
      emoji: "🤝",
      summary_short:
        "Кремль опубликовал кадры встречи Путина с спецпредставителем США",
    },
    {
      emoji: "🇺🇳",
      summary_short:
        "СБ ООН обсуждал украинский конфликт с участием РФ, США и Китая",
    },
  ],
  toDate: new Date(),
  fromDate: new Date(),
})
  .then((imageBuffer) => fs.promises.writeFile(`./techno.png`, imageBuffer))
  .then(
    (result) => console.log("Successfully wrote image"),
    (reason) => console.error("Error", reason)
  );
