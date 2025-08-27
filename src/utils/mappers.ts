export function mapCluster(cluster: string) {
  switch (cluster) {
    case "Политика":
      return "политике";
    case "Экономика":
      return "экономике";
    case "Крипта":
      return "крипт+е";
    case "Технологии":
      return "технологиях";
    case "Отношения и психология":
      return "отношениях и психолгии";
    case "Наука и космос":
      return "науке и космосе";
    case "AI и нейросети":
      return "искусственном интеллекте и нейросет+ях";
  }
  return '';
}
