export type TocItem = {
  page: number;
  title: string;
  desc: string;
  section: string;
};

export const TOC_ITEMS: TocItem[] = [
  { page: 1, title: "カバー", desc: "", section: "" },
  { page: 2, title: "目次", desc: "", section: "" },
  { page: 4, title: "地と図について", desc: "", section: "" },
  { page: 6, title: "グランド・ジャット島の日曜日の午後", desc: "", section: "" },
  { page: 8, title: "蜜柑（演習）", desc: "", section: "" },
  { page: 10, title: "裏表紙", desc: "", section: "" },
];

export default TOC_ITEMS;
